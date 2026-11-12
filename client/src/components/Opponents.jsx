import React from 'react';
import { Card } from './Card';
import { Wifi, WifiOff, Bot, Crown, AlertTriangle } from 'lucide-react';

export function Opponents({ opponents, currentTurnPlayerId }) {
  if (!opponents || opponents.length === 0) return null;

  return (
    <div className="opponents-container">
      {opponents.map((player) => {
        const isCurrentTurn = currentTurnPlayerId === player.id;

        return (
          <div
            key={player.id}
            className={`opponent-seat ${isCurrentTurn ? 'opponent-active' : ''} ${
              !player.connected ? 'opponent-offline' : ''
            }`}
          >
            {/* Active Turn Halo */}
            {isCurrentTurn && <div className="turn-glow-ring" />}

            {/* Avatar & Badges */}
            <div className="opponent-header">
              <div className="opponent-avatar-wrap">
                <span className="opponent-avatar">{player.avatar || '😎'}</span>
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

            {/* Mini Fanned Face-down Cards in Hand */}
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
          </div>
        );
      })}
    </div>
  );
}

