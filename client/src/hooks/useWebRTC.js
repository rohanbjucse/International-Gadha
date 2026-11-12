import { useEffect, useRef, useState, useCallback } from 'react';

const RTC_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
};

export function useWebRTC({ socket, roomCode, enabled }) {
  const [localStream, setLocalStream] = useState(null);
  const [peerStreams, setPeerStreams] = useState({}); // socketId -> MediaStream
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [permissionError, setPermissionError] = useState(null);

  const localStreamRef = useRef(null);
  const pcsRef = useRef({}); // socketId -> RTCPeerConnection
  const iceCandidatesQueueRef = useRef({}); // socketId -> [RTCIceCandidate]

  // Start capturing local mic & cam
  const startMedia = useCallback(async () => {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        setPermissionError('WebRTC not supported on this device/browser.');
        return null;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setCamOn(true);
      setMicOn(true);
      setPermissionError(null);
      return stream;
    } catch {
      // If video+audio failed, try audio only
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = audioOnly;
        setLocalStream(audioOnly);
        setCamOn(false);
        setMicOn(true);
        setPermissionError(null);
        return audioOnly;
      } catch {
        setPermissionError('Camera/microphone access denied.');
        return null;
      }
    }
  }, []);

  // Create an RTCPeerConnection for a target peer
  const getOrCreatePC = useCallback((targetSocketId, stream) => {
    if (pcsRef.current[targetSocketId]) {
      return pcsRef.current[targetSocketId];
    }

    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcsRef.current[targetSocketId] = pc;
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
      if (event.candidate && socket) {
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
    audioTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setMicOn(audioTracks[0]?.enabled ?? false);
  }, []);

  // Toggle Camera
  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach((track) => {
      track.enabled = !track.enabled;
    });
    setCamOn(videoTracks[0]?.enabled ?? false);
  }, []);

  useEffect(() => {
    if (!socket || !roomCode || !enabled) {
      // Clean up if disabled
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
      Object.values(pcsRef.current).forEach((pc) => {
        try { pc.close(); } catch {}
      });
      pcsRef.current = {};
      iceCandidatesQueueRef.current = {};
      setPeerStreams({});
      return;
    }

    let isMounted = true;

    async function init() {
      const stream = await startMedia();
      if (!isMounted || !stream) return;

      // Broadcast ready to room so other peers can connect
      socket.emit('webrtc_ready', { roomCode });
    }

    init();

    // 1. Peer joined -> Initiate Offer
    const handlePeerJoined = async ({ socketId }) => {
      if (socketId === socket.id) return;
      try {
        const pc = getOrCreatePC(socketId, localStreamRef.current);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc_offer', { toSocketId: socketId, offer });
      } catch (err) {
        console.warn('Failed to create offer:', err);
      }
    };

    // 2. Received Offer -> Set Remote & Send Answer
    const handleOffer = async ({ fromSocketId, offer }) => {
      try {
        const pc = getOrCreatePC(fromSocketId, localStreamRef.current);
        await pc.setRemoteDescription(new RTCSessionDescription(offer));

        // Flush queued ICE candidates
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
        if (pc) {
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
          // Queue candidate until remote description is set
          if (!iceCandidatesQueueRef.current[fromSocketId]) {
            iceCandidatesQueueRef.current[fromSocketId] = [];
          }
          iceCandidatesQueueRef.current[fromSocketId].push(candidate);
        }
      } catch (err) {
        console.warn('Failed to add ICE candidate:', err);
      }
    };

    // 5. Peer left
    const handlePeerLeft = ({ socketId }) => {
      const pc = pcsRef.current[socketId];
      if (pc) {
        try { pc.close(); } catch {}
        delete pcsRef.current[socketId];
        delete iceCandidatesQueueRef.current[socketId];
      }
      setPeerStreams((prev) => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    };

    socket.on('webrtc_peer_joined', handlePeerJoined);
    socket.on('webrtc_offer', handleOffer);
    socket.on('webrtc_answer', handleAnswer);
    socket.on('webrtc_ice_candidate', handleCandidate);
    socket.on('webrtc_peer_left', handlePeerLeft);

    return () => {
      isMounted = false;
      socket.off('webrtc_peer_joined', handlePeerJoined);
      socket.off('webrtc_offer', handleOffer);
      socket.off('webrtc_answer', handleAnswer);
      socket.off('webrtc_ice_candidate', handleCandidate);
      socket.off('webrtc_peer_left', handlePeerLeft);

      if (socket) {
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
      iceCandidatesQueueRef.current = {};
      setPeerStreams({});
    };
  }, [socket, roomCode, enabled, startMedia, getOrCreatePC]);

  return {
    localStream,
    peerStreams,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    permissionError
  };
}
