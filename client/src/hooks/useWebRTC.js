import { useEffect, useRef, useState, useCallback } from 'react';
import SimplePeer from 'simple-peer';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
};

export function useWebRTC({ socket, roomCode, enabled }) {
  const [localStream, setLocalStream] = useState(null);
  const [peerStreams, setPeerStreams] = useState({}); // socketId -> MediaStream
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [permissionError, setPermissionError] = useState(null);

  const peersRef = useRef({}); // socketId -> SimplePeer instance
  const localStreamRef = useRef(null);

  // Start local media
  const startMedia = useCallback(async () => {
    if (!enabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 320 }, height: { ideal: 240 } },
        audio: true
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      setPermissionError(null);
      return stream;
    } catch (err) {
      // Try audio only if video fails
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = audioStream;
        setLocalStream(audioStream);
        setCamOn(false);
        setPermissionError(null);
        return audioStream;
      } catch {
        setPermissionError('Camera/mic permission denied. Video chat unavailable.');
        return null;
      }
    }
  }, [enabled]);

  // Create a peer connection
  const createPeer = useCallback((targetSocketId, initiator, stream) => {
    if (peersRef.current[targetSocketId]) return;

    const peer = new SimplePeer({
      initiator,
      stream: stream || localStreamRef.current || undefined,
      trickle: true,
      config: ICE_SERVERS
    });

    peer.on('signal', (signal) => {
      socket.emit('webrtc_signal', { toSocketId: targetSocketId, signal });
    });

    peer.on('stream', (remoteStream) => {
      setPeerStreams(prev => ({ ...prev, [targetSocketId]: remoteStream }));
    });

    peer.on('close', () => {
      setPeerStreams(prev => {
        const next = { ...prev };
        delete next[targetSocketId];
        return next;
      });
      delete peersRef.current[targetSocketId];
    });

    peer.on('error', (err) => {
      console.warn('WebRTC peer error:', err);
      peer.destroy();
      delete peersRef.current[targetSocketId];
      setPeerStreams(prev => {
        const next = { ...prev };
        delete next[targetSocketId];
        return next;
      });
    });

    peersRef.current[targetSocketId] = peer;
    return peer;
  }, [socket]);

  // Toggle microphone
  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(t => { t.enabled = !t.enabled; });
    setMicOn(audioTracks[0]?.enabled ?? false);
  }, []);

  // Toggle camera
  const toggleCam = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;
    const videoTracks = stream.getVideoTracks();
    videoTracks.forEach(t => { t.enabled = !t.enabled; });
    setCamOn(videoTracks[0]?.enabled ?? false);
  }, []);

  useEffect(() => {
    if (!socket || !roomCode || !enabled) return;

    let currentStream = null;

    const init = async () => {
      currentStream = await startMedia();

      // Tell others we're ready for WebRTC
      socket.emit('webrtc_ready', { roomCode });
    };

    init();

    // Someone else joined and is ready
    const onPeerJoined = ({ socketId }) => {
      if (socketId === socket.id) return;
      createPeer(socketId, true, currentStream || localStreamRef.current);
    };

    // Incoming signal
    const onSignal = ({ fromSocketId, signal }) => {
      if (!peersRef.current[fromSocketId]) {
        // Create answering peer
        createPeer(fromSocketId, false, currentStream || localStreamRef.current);
      }
      try {
        peersRef.current[fromSocketId]?.signal(signal);
      } catch (e) {
        console.warn('Signal error:', e);
      }
    };

    socket.on('webrtc_peer_joined', onPeerJoined);
    socket.on('webrtc_signal', onSignal);

    return () => {
      socket.off('webrtc_peer_joined', onPeerJoined);
      socket.off('webrtc_signal', onSignal);

      // Destroy all peers
      Object.values(peersRef.current).forEach(p => { try { p.destroy(); } catch {} });
      peersRef.current = {};
      setPeerStreams({});

      // Stop local stream
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
      }
    };
  }, [socket, roomCode, enabled, startMedia, createPeer]);

  return {
    localStream,
    peerStreams,       // { socketId: MediaStream }
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    permissionError
  };
}
