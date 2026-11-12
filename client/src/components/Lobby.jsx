import React, { useState } from 'react';
import {
  Copy,
  Check,
  Share2,
  UserPlus,
  Play,
  Trash2,
  Crown,
  Bot,
  Users,
  Sparkles,
  BookOpen
} from 'lucide-react';

export function Lobby({
  roomCode,
  players = [],
  currentPlayerId,
  isHost,
  onAddBot,
  onRemovePlayer,
  onStartGame,
  onOpenRules
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = `${window.location.origin}${window.location.pathname}?room=${roomCode}`;
  const playerCount = players.length;
  const canStart = playerCount >= 3 && playerCount <= 6;

  function copyCode() {
    navigator.clipboard.writeText(roomCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  }

  return (
    <div className="lobby-container animate-fade-in">
      <div className="lobby-card">
        {/* Lobby Header */}
        <div className="lobby-header">
          <div className="lobby-donkey-badge">
            <span className="text-3xl">🫏</span>
          </div>
          <h2 className="lobby-title">Game Lobby</h2>
          <p className="lobby-subtitle">
            Gather 3 to 6 players to divide the deck equally and start playing!
          </p>
        </div>

        {/* Room Code & Share Section */}
        <div className="room-code-banner">
          <div className="room-code-meta">
            <span className="code-label">ROOM CODE:</span>
            <span className="code-value">{roomCode}</span>
          </div>

          <div className="room-code-actions">
            <button
              onClick={copyCode}
              className={`btn-code-copy ${copiedCode ? 'btn-copied' : ''}`}
              title="Copy Room Code"
            >
              {copiedCode ? <Check size={16} /> : <Copy size={16} />}
              {copiedCode ? 'Copied!' : 'Copy Code'}
            </button>

            <button
              onClick={copyLink}
              className={`btn-code-copy ${copiedLink ? 'btn-copied' : ''}`}
              title="Copy Direct Invite Link"
            >
              {copiedLink ? <Check size={16} /> : <Share2 size={16} />}
              {copiedLink ? 'Link Copied!' : 'Share Link'}
            </button>
          </div>
        </div>

        {/* Players Grid (Slots 1 to 6) */}
        <div className="players-slots-section">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Users size={16} className="text-amber-400" />
              Players Seated ({playerCount} / 6)
            </h3>

            {isHost && playerCount < 6 && (
              <button
                onClick={onAddBot}
                className="btn-add-bot flex items-center gap-1 text-xs"
                title="Add a smart computer player"
              >
                <Bot size={14} /> Add AI Bot
              </button>
            )}
          </div>

          <div className="players-grid">
            {players.map((p, index) => {
              const isMe = p.id === currentPlayerId;
              return (
                <div
                  key={p.id}
                  className={`player-slot-card ${isMe ? 'slot-me' : ''}`}
                >
                  <div className="slot-avatar-wrap">
                    <span className="slot-avatar">{p.avatar || '😎'}</span>
                    {p.isHost && (
                      <span className="slot-host-crown" title="Host">
                        <Crown size={12} />
                      </span>
                    )}
                    {p.isBot && (
                      <span className="slot-bot-badge" title="AI Bot">
                        <Bot size={12} />
                      </span>
                    )}
                  </div>

                  <div className="slot-info">
                    <span className="slot-name">
                      {p.name} {isMe && '(You)'}
                    </span>
                    <span className="slot-seat">Seat {index + 1}</span>
                  </div>

                  {isHost && !isMe && (
                    <button
                      onClick={() => onRemovePlayer(p.id)}
                      className="btn-remove-player"
                      title="Remove player"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              );
            })}

            {/* Empty Slots */}
            {Array.from({ length: 6 - playerCount }).map((_, i) => (
              <div key={`empty-${i}`} className="player-slot-card slot-empty">
                <div className="empty-avatar-circle">
                  <UserPlus size={16} className="text-slate-500" />
                </div>
                <div className="slot-info">
                  <span className="slot-name text-slate-500">Waiting for player...</span>
                  <span className="slot-seat text-slate-600">Seat {playerCount + i + 1}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deck Distribution Preview */}
        <div className="deck-preview-pill">
          <Sparkles size={14} className="text-amber-400" />
          <span>
            {playerCount < 3
              ? 'At least 3 players required (2 jokers added for 3 players = 18 cards each).'
              : playerCount === 3
              ? '3 Players: 52 cards + 2 Jokers = 54 cards (18 cards each).'
              : playerCount === 4
              ? '4 Players: 52 cards = 13 cards each (0 jokers).'
              : playerCount === 5
              ? '5 Players: 52 cards + 3 Jokers = 55 cards (11 cards each).'
              : '6 Players: 54 cards with 2 Jokers = 9 cards each.'}
          </span>
        </div>

        {/* Lobby Actions */}
        <div className="lobby-actions-footer">
          <button onClick={onOpenRules} className="btn-secondary flex items-center gap-2">
            <BookOpen size={16} /> Rules & Tutorial
          </button>

          {isHost ? (
            <button
              onClick={onStartGame}
              disabled={!canStart}
              className={`btn-start-game flex items-center gap-2 ${
                !canStart ? 'btn-disabled' : 'btn-glow'
              }`}
            >
              <Play size={18} />
              {canStart
                ? `Start Game (${playerCount} Players)`
                : `Need ${3 - playerCount} more player${3 - playerCount > 1 ? 's' : ''}`}
            </button>
          ) : (
            <div className="text-slate-400 text-sm flex items-center gap-2">
              <span className="status-dot-active" />
              Waiting for host to start the game...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

