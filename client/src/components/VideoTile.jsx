import React, { useEffect, useRef } from 'react';
import { MicOff, VideoOff } from 'lucide-react';

export function VideoTile({
  stream,
  name,
  avatar = '😎',
  isMuted = false,
  isCamOff = false,
  isLocal = false,
  isActive = false,
  size = 'sm' // 'sm' | 'md' | 'xs'
}) {
  const videoRef = useRef(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (stream) {
      el.srcObject = stream;
    } else {
      el.srcObject = null;
    }
  }, [stream]);

  const hasVideo = stream && !isCamOff && stream.getVideoTracks().length > 0;

  return (
    <div className={`video-tile video-tile-${size} ${isActive ? 'video-tile-active' : ''} ${isLocal ? 'video-tile-local' : ''}`}>
      {hasVideo ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal} /* always mute own feed to prevent echo */
          className="video-tile-feed"
        />
      ) : (
        <div className="video-tile-avatar">
          <span className="video-avatar-emoji">{avatar}</span>
        </div>
      )}

      {/* Name bar */}
      <div className="video-tile-nameplate">
        <span className="video-tile-name">{isLocal ? 'You' : name}</span>
        <div className="video-tile-badges">
          {isMuted && <MicOff size={9} className="badge-muted" />}
          {isCamOff && <VideoOff size={9} className="badge-cam-off" />}
        </div>
      </div>

      {/* Active turn ring */}
      {isActive && <div className="video-active-ring" />}
    </div>
  );
}
