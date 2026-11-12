import React from 'react';
import { Card } from './Card';
import { Sparkles, Utensils, ShieldCheck, AlertCircle } from 'lucide-react';

export function Table({
  tableCards = [],
  lastAction,
  activePlayer,
  isMyTurn
}) {
  return (
    <div className="table-container">
      {/* Table Center Felt Surface */}
      <div className="table-felt">
        {/* Table Felt Branding Watermark */}
        <div className="table-felt-watermark">
          <span className="watermark-emoji">🫏</span>
          <span className="watermark-text">INTERNATIONAL GADHA</span>
        </div>

        {/* Action Notification Banner */}
        {lastAction && (
          <div
            key={lastAction.timestamp}
            className={`action-banner animate-slide-down ${
              lastAction.type === 'eat'
                ? 'banner-eat'
                : lastAction.type === 'safe'
                ? 'banner-safe'
                : 'banner-info'
            }`}
          >
            <div className="banner-icon">
              {lastAction.type === 'eat' ? (
                <Utensils size={18} className="text-amber-400" />
              ) : lastAction.type === 'safe' ? (
                <ShieldCheck size={18} className="text-emerald-400" />
              ) : (
                <Sparkles size={18} className="text-purple-400" />
              )}
            </div>
            <div className="banner-content">
              <span className="banner-msg">{lastAction.message}</span>
            </div>
          </div>
        )}

        {/* Turn Status Pill */}
        <div className={`turn-status-indicator ${isMyTurn ? 'turn-pulse-me' : ''}`}>
          {isMyTurn ? (
            <span className="flex items-center gap-2 font-bold text-emerald-300">
              <span className="status-dot-active" /> YOUR TURN TO PLAY!
            </span>
          ) : activePlayer ? (
            <span className="flex items-center gap-2 text-slate-200">
              <span className="status-dot-other" /> Waiting for <strong>{activePlayer.name}</strong>...
            </span>
          ) : (
            <span>Preparing table...</span>
          )}
        </div>

        {/* Center Cards Layout */}
        <div className="table-cards-surface">
          {tableCards.length === 0 ? (
            <div className="empty-table-placeholder animate-fade-in">
              <div className="empty-table-circle">
                <span className="text-3xl">🫏</span>
              </div>
              <p className="empty-table-title">Table is Clear</p>
              <p className="empty-table-sub">Any card played now will be SAFE!</p>
            </div>
          ) : (
            <div className="table-cards-grid">
              {tableCards.map((card, idx) => (
                <div
                  key={card.id}
                  className="table-card-wrapper animate-card-drop"
                  style={{ animationDelay: `${idx * 0.04}s` }}
                >
                  <Card
                    card={card}
                    size="md"
                    isPlayable={false}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

