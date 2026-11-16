import React, { useState } from 'react';
import { Wifi, WifiOff, Bot, Crown, Mic, MicOff, Video, VideoOff, Maximize2, X } from 'lucide-react';

function VideoFeed({ stream, isLocal = false, avatar = '😎', camOff = false, className = '' }) {
  const hasVideo = stream && !camOff && typeof stream.getVideoTracks === 'function' && stream.getVideoTracks().length > 0;

  return (
    <div className={`seat-media-box ${className}`}>
      {hasVideo ? (
        <video
          autoPlay
          playsInline
          muted={isLocal}
          ref={(el) => {
            if (el && el.srcObject !== stream) {
              el.srcObject = stream;
              el.play?.().catch(() => {});
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
  peerMuteStates = {},
  micOn = true,
  camOn = true,
  onToggleMic,
  onToggleCam,
  showStats = true,
  showMiniHands = true
}) {
  const [featuredVideo, setFeaturedVideo] = useState(null);
  if ((!opponents || opponents.length === 0) && !(videoEnabled && localPlayer)) return null;

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
              <button
                type="button"
                className="video-expand-button"
                aria-label={`Expand ${localPlayer.name}'s video`}
                onClick={() => setFeaturedVideo({
                  stream: localStream,
                  isLocal: true,
                  avatar: localPlayer.avatar || '😎',
                  camOff: !camOn,
                  name: `${localPlayer.name} (You)`
                })}
              >
                <Maximize2 size={13} />
              </button>
              <span className="badge-you-tag">YOU</span>
              {!micOn && (
                <span className="badge-seat-muted" title="Microphone Muted">
                  <MicOff size={10} />
                </span>
              )}
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

              {showStats && <div className="opponent-stats-row">
                <span className="stat-badge stat-cards">
                  🎴 {localPlayer.hand?.length || 0} in hand
                </span>
                <span className="stat-badge stat-cards">
                  🍽️ {localPlayer.bank?.length || 0} eaten
                </span>
              </div>}
            </div>
          </div>
        </div>
      )}

      {/* Opponent Seats */}
      {opponents.map((player) => {
        const isCurrentTurn = currentTurnPlayerId === player.id;
        const peerStream = player.socketId ? peerStreams[player.socketId] : null;
        const peerMute = player.socketId ? peerMuteStates[player.socketId] : null;
        const isPeerCamOff = peerMute?.camOn === false;
        const isPeerMicOff = peerMute?.micOn === false;

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
                  <>
                    <VideoFeed
                      stream={peerStream}
                      isLocal={false}
                      avatar={player.avatar || '😎'}
                      camOff={isPeerCamOff}
                    />
                    <button
                      type="button"
                      className="video-expand-button"
                      aria-label={`Expand ${player.name}'s video`}
                      onClick={() => setFeaturedVideo({
                        stream: peerStream,
                        isLocal: false,
                        avatar: player.avatar || '😎',
                        camOff: isPeerCamOff,
                        name: player.name
                      })}
                    >
                      <Maximize2 size={13} />
                    </button>
                  </>
                ) : (
                  <span className="opponent-avatar">{player.avatar || '😎'}</span>
                )}

                {isPeerMicOff && (
                  <span className="badge-seat-muted" title="Player Muted">
                    <MicOff size={10} />
                  </span>
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
                {showStats && <div className="opponent-stats-row">
                  <span className="stat-badge stat-cards">
                    🎴 {player.cardCount} in hand
                  </span>
                  <span className="stat-badge stat-cards">
                    🍽️ {player.bankCount || 0} eaten
                  </span>
                </div>}
              </div>
            </div>

            {/* Mini Fanned Face-down Cards in Hand (hidden on mobile) */}
            {showMiniHands && !videoEnabled && (
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

      {featuredVideo && (
        <div className="video-spotlight-backdrop" onClick={() => setFeaturedVideo(null)}>
          <section
            className="video-spotlight"
            role="dialog"
            aria-modal="true"
            aria-label={`${featuredVideo.name} video`}
            onClick={event => event.stopPropagation()}
          >
            <header>
              <strong>{featuredVideo.name}</strong>
              <button
                type="button"
                className="video-spotlight-close"
                aria-label="Close expanded video"
                onClick={() => setFeaturedVideo(null)}
              >
                <X size={18} />
              </button>
            </header>
            <VideoFeed
              stream={featuredVideo.stream}
              isLocal={featuredVideo.isLocal}
              avatar={featuredVideo.avatar}
              camOff={featuredVideo.camOff}
              className="seat-media-box-spotlight"
            />
          </section>
        </div>
      )}
    </div>
  );
}
