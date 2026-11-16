import { useEffect, useRef, useState, useCallback } from 'react';

// Multiple STUN servers improve connectivity, but restrictive networks may still require TURN.
const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    { urls: 'stun:stun.services.mozilla.com:3478' }
  ],
  iceCandidatePoolSize: 8
};

function getSavedToggle(key, defaultValue) {
  const savedValue = localStorage.getItem(key);
  return savedValue === null ? defaultValue : savedValue === 'true';
}

function getMediaErrorMessage(error) {
  if (error?.name === 'NotAllowedError' || error?.name === 'SecurityError') {
    return 'Camera or microphone permission was denied. Allow access in this browser to use video chat.';
  }
  if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
    return 'No camera or microphone is available on this device.';
  }
  if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
    return 'A camera or microphone is already in use by another app.';
  }
  return 'Unable to access the camera or microphone. Check device permissions and try again.';
}

export function useWebRTC({ socket, roomCode, enabled }) {
  const [localStream, setLocalStream] = useState(null);
  const [peerStreams, setPeerStreams] = useState({}); // socketId -> MediaStream
  const [peerMuteStates, setPeerMuteStates] = useState({}); // socketId -> { micOn, camOn }
  const [micOn, setMicOn] = useState(() => getSavedToggle('gadha_mic_on', true));
  const [camOn, setCamOn] = useState(() => getSavedToggle('gadha_cam_on', true));
  const [permissionError, setPermissionError] = useState(null);
  const [isInitializing, setIsInitializing] = useState(false);

  const micOnRef = useRef(micOn);
  const camOnRef = useRef(camOn);
  const localStreamRef = useRef(null);
  const pcsRef = useRef({}); // socketId -> RTCPeerConnection
  const makingOfferRef = useRef({}); // socketId -> boolean
  const iceCandidatesQueueRef = useRef({}); // socketId -> [RTCIceCandidate]

  useEffect(() => {
    localStorage.setItem('gadha_mic_on', String(micOn));
    micOnRef.current = micOn;
  }, [micOn]);

  useEffect(() => {
    localStorage.setItem('gadha_cam_on', String(camOn));
    camOnRef.current = camOn;
  }, [camOn]);

  // Start capturing local mic & cam with cascading fallback
  const startMedia = useCallback(async () => {
    setIsInitializing(true);
    setPermissionError(null);

    // Stop existing stream if any
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(t => t.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError('Camera/Mic not supported by this browser.');
        setIsInitializing(false);
        return null;
      }

      let stream = null;
      let captureError = null;
      const captureOptions = [
        {
          video: {
            facingMode: 'user',
            width: { ideal: 320, max: 640 },
            height: { ideal: 240, max: 480 }
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true
          }
        },
        { video: true, audio: true },
        { audio: true, video: false },
        { audio: false, video: true }
      ];

      for (const options of captureOptions) {
        try {
          stream = await navigator.mediaDevices.getUserMedia(options);
          break;
        } catch (error) {
          captureError = error;
        }
      }

      if (!stream) {
        console.warn('Media capture error:', captureError);
        setPermissionError(getMediaErrorMessage(captureError));
        setIsInitializing(false);
        return null;
      }

      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      const nextMicState = audioTracks.length > 0 && micOnRef.current;
      const nextCamState = videoTracks.length > 0 && camOnRef.current;
      audioTracks.forEach(track => { track.enabled = nextMicState; });
      videoTracks.forEach(track => { track.enabled = nextCamState; });
      micOnRef.current = nextMicState;
      camOnRef.current = nextCamState;
      setMicOn(nextMicState);
      setCamOn(nextCamState);
      localStreamRef.current = stream;
      setLocalStream(stream);
      if (!audioTracks.length || !videoTracks.length) {
        setPermissionError(
          !audioTracks.length
            ? 'No microphone is available on this device.'
            : 'No camera is available on this device.'
        );
      }
      setIsInitializing(false);
      return stream;
    } catch (finalErr) {
      console.warn('getUserMedia fatal:', finalErr);
      setPermissionError('Unable to access media devices.');
      setIsInitializing(false);
      return null;
    }
  }, []);

  // Create an RTCPeerConnection for a target peer (W3C Perfect Negotiation)
  const getOrCreatePC = useCallback((targetSocketId, stream) => {
    if (pcsRef.current[targetSocketId]) {
      return pcsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcsRef.current[targetSocketId] = pc;
    makingOfferRef.current[targetSocketId] = false;
    iceCandidatesQueueRef.current[targetSocketId] = [];

    // Attach local tracks
    const activeStream = stream || localStreamRef.current;
    if (activeStream) {
      activeStream.getTracks().forEach((track) => {
        pc.addTrack(track, activeStream);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && socket?.connected) {
        socket.emit('webrtc_ice_candidate', {
          toSocketId: targetSocketId,
          candidate: event.candidate
        });
      }
    };

    // Handle remote stream tracks
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setPeerStreams((prev) => ({
          ...prev,
          [targetSocketId]: remoteStream
        }));
      }
    };

    // Handle connection state changes
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        pc.close();
        delete pcsRef.current[targetSocketId];
        delete makingOfferRef.current[targetSocketId];
        delete iceCandidatesQueueRef.current[targetSocketId];
        setPeerStreams((prev) => {
          const next = { ...prev };
          delete next[targetSocketId];
          return next;
        });
      }
    };

    return pc;
  }, [socket]);

  // Toggle Microphone
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    const nextState = !micOnRef.current;
    micOnRef.current = nextState;
    audioTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setMicOn(nextState);

    if (socket?.connected && roomCode) {
      socket.emit('webrtc_mute_state', { roomCode, micOn: nextState, camOn: camOnRef.current });
    }
  }, [socket, roomCode]);

  // Toggle Camera
  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    if (videoTracks.length === 0) return;
    const nextState = !camOnRef.current;
    camOnRef.current = nextState;
    videoTracks.forEach((track) => {
      track.enabled = nextState;
    });
    setCamOn(nextState);

    if (socket?.connected && roomCode) {
      socket.emit('webrtc_mute_state', { roomCode, micOn: micOnRef.current, camOn: nextState });
    }
  }, [socket, roomCode]);

  useEffect(() => {
    if (!socket || !roomCode || !enabled) {
      // Clean up when disabled
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      Object.values(pcsRef.current).forEach((pc) => {
        try { pc.close(); } catch {}
      });
      pcsRef.current = {};
      makingOfferRef.current = {};
      iceCandidatesQueueRef.current = {};
      setPeerStreams({});
      setPeerMuteStates({});
      return;
    }

    let isMounted = true;

    function announceReady() {
      if (!socket.connected || !localStreamRef.current) return;
      socket.emit('webrtc_ready', { roomCode });
      socket.emit('webrtc_mute_state', {
        roomCode,
        micOn: micOnRef.current,
        camOn: camOnRef.current
      });
    }

    const handleSocketDisconnect = () => {
      Object.values(pcsRef.current).forEach(pc => pc.close());
      pcsRef.current = {};
      makingOfferRef.current = {};
      iceCandidatesQueueRef.current = {};
      setPeerStreams({});
      setPeerMuteStates({});
    };

    const handleDeviceChange = async () => {
      const stream = await startMedia();
      if (!isMounted) return;

      if (socket.connected) {
        socket.emit('webrtc_leave', { roomCode });
      }
      handleSocketDisconnect();
      if (stream) announceReady();
    };

    const handleVisibilityChange = () => {
      const hasEndedTrack = localStreamRef.current?.getTracks()
        .some(track => track.readyState === 'ended');
      if (document.visibilityState === 'visible' && hasEndedTrack) {
        handleDeviceChange();
      }
    };

    // 1. Peer joined -> Initiate Offer using polite pattern
    const handlePeerJoined = async ({ socketId }) => {
      if (socketId === socket.id) return;
      try {
        const pc = getOrCreatePC(socketId, localStreamRef.current);
        makingOfferRef.current[socketId] = true;
        const offer = await pc.createOffer();
        if (pc.signalingState !== 'stable') return;
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', { toSocketId: socketId, offer });
      } catch (err) {
        console.warn('Failed to create offer:', err);
      } finally {
        makingOfferRef.current[socketId] = false;
      }
    };

    // 2. Received Offer -> Perfect Negotiation Glare Resolution
    const handleOffer = async ({ fromSocketId, offer }) => {
      try {
        const pc = getOrCreatePC(fromSocketId, localStreamRef.current);
        const polite = socket.id < fromSocketId;
        const offerCollision = makingOfferRef.current[fromSocketId] || pc.signalingState !== 'stable';

        // Glare resolution: if not polite and collision, ignore the colliding offer
        if (!polite && offerCollision) {
          return;
        }

        if (offerCollision) {
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush queued candidates
        const queued = iceCandidatesQueueRef.current[fromSocketId] || [];
        for (const candidate of queued) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
          } catch {}
        }
        iceCandidatesQueueRef.current[fromSocketId] = [];

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc_answer', { toSocketId: fromSocketId, answer });
      } catch (err) {
        console.warn('Failed to handle offer:', err);
      }
    };

    // 3. Received Answer -> Set Remote
    const handleAnswer = async ({ fromSocketId, answer }) => {
      try {
        const pc = pcsRef.current[fromSocketId];
        if (pc && pc.signalingState === 'have-local-offer') {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));

          // Flush queued candidates
          const queued = iceCandidatesQueueRef.current[fromSocketId] || [];
          for (const candidate of queued) {
            try {
              await pc.addIceCandidate(new RTCIceCandidate(candidate));
            } catch {}
          }
          iceCandidatesQueueRef.current[fromSocketId] = [];
        }
      } catch (err) {
        console.warn('Failed to handle answer:', err);
      }
    };

    // 4. Received ICE Candidate
    const handleCandidate = async ({ fromSocketId, candidate }) => {
      try {
        const pc = pcsRef.current[fromSocketId];
        if (pc && pc.remoteDescription && pc.remoteDescription.type) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } else {
          // Queue candidate until remote description is established
          if (!iceCandidatesQueueRef.current[fromSocketId]) {
            iceCandidatesQueueRef.current[fromSocketId] = [];
          }
          iceCandidatesQueueRef.current[fromSocketId].push(candidate);
        }
      } catch (err) {
        console.warn('Failed to add candidate:', err);
      }
    };

    // 5. Peer left
    const handlePeerLeft = ({ socketId }) => {
      const pc = pcsRef.current[socketId];
      if (pc) {
        try { pc.close(); } catch {}
        delete pcsRef.current[socketId];
        delete makingOfferRef.current[socketId];
        delete iceCandidatesQueueRef.current[socketId];
      }
      setPeerStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
      setPeerMuteStates((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    // 6. Peer mute state changed
    const handlePeerMuteState = ({ socketId, micOn: pMic, camOn: pCam }) => {
      setPeerMuteStates((prev) => ({
        ...prev,
        [socketId]: { micOn: pMic, camOn: pCam }
      }));
    };

    socket.on('webrtc_peer_joined', handlePeerJoined);
    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleCandidate);
    socket.on('webrtc_peer_left', handlePeerLeft);
    socket.on('webrtc_peer_mute_state', handlePeerMuteState);
    socket.on('connect', announceReady);
    socket.on('disconnect', handleSocketDisconnect);
    navigator.mediaDevices?.addEventListener?.('devicechange', handleDeviceChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    startMedia().then(stream => {
      if (isMounted && stream) announceReady();
    });

    return () => {
      isMounted = false;
      socket.off('webrtc_peer_joined', handlePeerJoined);
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleCandidate);
      socket.off('webrtc_peer_left', handlePeerLeft);
      socket.off('webrtc_peer_mute_state', handlePeerMuteState);
      socket.off('connect', announceReady);
      socket.off('disconnect', handleSocketDisconnect);
      navigator.mediaDevices?.removeEventListener?.('devicechange', handleDeviceChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);

      if (socket.connected) {
        socket.emit('webrtc_leave', { roomCode });
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }

      Object.values(pcsRef.current).forEach((pc) => {
        try { pc.close(); } catch {}
      });
      pcsRef.current = {};
      makingOfferRef.current = {};
      iceCandidatesQueueRef.current = {};
      setPeerStreams({});
      setPeerMuteStates({});
    };
  }, [socket, roomCode, enabled, startMedia, getOrCreatePC]);

  return {
    localStream,
    peerStreams,
    peerMuteStates,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    permissionError,
    isInitializing
  };
}
