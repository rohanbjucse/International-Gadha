import React from 'react';
import { Wifi, WifiOff, Bot, Crown, Mic, MicOff, Video, VideoOff } from 'lucide-react';

function VideoFeed({ stream, isLocal = false, avatar = '😎', camOff = false }) {
  const hasVideo = stream && !camOff && typeof stream.getVideoTracks === 'function' && stream.getVideoTracks().length > 0;

  return (
    <div className="seat-media-box">
      {hasVideo ? (
        <video
          autoPlay
          playsInline
          muted={isLocal}
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream;
            }
          }}
          className={`seat-video-element ${isLocal ? 'seat-video-mirror' : ''}`}
        />
      ) : (
        <span className="opponent-avatar">{avatar}</span>
      )}
    </div>
  );
}

export function Opponents({
  opponents = [],
  currentTurnPlayerId,
  videoEnabled = false,
  localPlayer = null,
  localStream = null,
  peerStreams = {},
  micOn = true,
  camOn = true,
  onToggleMic,
  onToggleCam
}) {
  if (!opponents || opponents.length === 0) return null;

  return (
    <div className={`opponents-container ${videoEnabled ? 'opponents-video-mode' : ''}`}>
      {/* When video is enabled, show local player ("You") seat first */}
      {videoEnabled && localPlayer && (
        <div
          className={`opponent-seat seat-local ${
            currentTurnPlayerId === localPlayer.id ? 'opponent-active' : ''
          }`}
        >
          {currentTurnPlayerId === localPlayer.id && <div className="turn-glow-ring" />}

          <div className="opponent-header">
            <div className="opponent-avatar-wrap">
              <VideoFeed
                stream={localStream}
                isLocal={true}
                avatar={localPlayer.avatar || '😎'}
                camOff={!camOn}
              />
              <span className="badge-you-tag">YOU</span>
            </div>

            <div className="opponent-info">
              <div className="opponent-name-row">
                <span className="opponent-name" title={localPlayer.name}>
                  {localPlayer.name} (You)
                </span>
              </div>

              {/* Local quick controls for Mic & Cam */}
              <div className="local-media-controls">
                <button
                  type="button"
                  onClick={onToggleMic}
                  className={`btn-media-pill ${!micOn ? 'btn-media-muted' : ''}`}
                  title={micOn ? 'Mute Mic' : 'Unmute Mic'}
                >
                  {micOn ? <Mic size={11} /> : <MicOff size={11} />}
                </button>
                <button
                  type="button"
                  onClick={onToggleCam}
                  className={`btn-media-pill ${!camOn ? 'btn-media-muted' : ''}`}
                  title={camOn ? 'Turn Off Cam' : 'Turn On Cam'}
                >
                  {camOn ? <Video size={11} /> : <VideoOff size={11} />}
                </button>
              </div>

              <div className="opponent-stats-row">
                <span className="stat-badge stat-cards">
                  🎴 {localPlayer.hand?.length || 0} in hand
                </span>
                <span className="stat-badge stat-cards">
                  🍽️ {localPlayer.bank?.length || 0} eaten
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Opponent Seats */}
      {opponents.map((player) => {
        const isCurrentTurn = currentTurnPlayerId === player.id;
        const peerStream = player.socketId ? peerStreams[player.socketId] : null;

        return (
          <div
            key={player.id}
            className={`opponent-seat ${isCurrentTurn ? 'opponent-active' : ''} ${
              !player.connected ? 'opponent-offline' : ''
            }`}
          >
            {/* Active Turn Halo */}
            {isCurrentTurn && <div className="turn-glow-ring" />}

            {/* Avatar / Video & Badges */}
            <div className="opponent-header">
              <div className="opponent-avatar-wrap">
                {videoEnabled && !player.isBot ? (
                  <VideoFeed
                    stream={peerStream}
                    isLocal={false}
                    avatar={player.avatar || '😎'}
                    camOff={false}
                  />
                ) : (
                  <span className="opponent-avatar">{player.avatar || '😎'}</span>
                )}

                {player.isHost && (
                  <span className="badge-host" title="Room Host">
                    <Crown size={12} />
                  </span>
                )}
                {player.isBot && (
                  <span className="badge-bot" title="AI Bot">
                    <Bot size={12} />
                  </span>
                )}
              </div>

              <div className="opponent-info">
                <div className="opponent-name-row">
                  <span className="opponent-name" title={player.name}>
                    {player.name}
                  </span>
                  {!player.isBot && (
                    <span
                      className={`conn-status ${player.connected ? 'conn-online' : 'conn-offline'}`}
                      title={player.connected ? 'Connected' : 'Disconnected'}
                    >
                      {player.connected ? <Wifi size={12} /> : <WifiOff size={12} />}
                    </span>
                  )}
                </div>

                {/* Player Hand & Bank Count */}
                <div className="opponent-stats-row">
                  <span className="stat-badge stat-cards">
                    🎴 {player.cardCount} in hand
                  </span>
                  <span className="stat-badge stat-cards">
                    🍽️ {player.bankCount || 0} eaten
                  </span>
                </div>
              </div>
            </div>

            {/* Mini Fanned Face-down Cards in Hand (hidden on mobile) */}
            {!videoEnabled && (
              <div className="opponent-mini-hand">
                {Array.from({ length: Math.min(player.cardCount, 8) }).map((_, idx) => (
                  <div
                    key={idx}
                    className="mini-card-overlap"
                    style={{
                      transform: `translateX(${idx * 8}px) rotate(${(idx - 3) * 3}deg)`
                    }}
                  >
                    <div className="mini-card-back" />
                  </div>
                ))}
                {player.cardCount > 8 && (
                  <span className="mini-card-more">+{player.cardCount - 8}</span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
