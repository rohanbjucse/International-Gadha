import React, { useState, useEffect, useRef } from 'react';
import { Card } from './Card';
import { Sparkles, Utensils, ShieldCheck } from 'lucide-react';

export function Table({
  tableCards = [],
  lastAction,
  activePlayer,
  isMyTurn
}) {
  const [toast, setToast] = useState(null);
  const [isToastExiting, setIsToastExiting] = useState(false);
  const toastTimeoutRef = useRef(null);

  // Auto-dismissing play notification animation
  useEffect(() => {
    if (!lastAction || !lastAction.timestamp) return;

    // Reset any pending dismiss timer
    if (toastTimeoutRef.current) {
      clearTimeout(toastTimeoutRef.current);
    }

    setToast(lastAction);
    setIsToastExiting(false);

    // Start exit animation after 1.8s, completely remove at 2.2s
    toastTimeoutRef.current = setTimeout(() => {
      setIsToastExiting(true);
      setTimeout(() => {
        setToast(null);
        setIsToastExiting(false);
      }, 400);
    }, 2000);

    return () => {
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, [lastAction?.timestamp]);

  return (
    <div className="table-container">
      {/* Table Center Felt Surface */}
      <div className="table-felt">
        {/* Table Felt Branding Watermark */}
        <div className="table-felt-watermark">
          <span className="watermark-emoji">🫏</span>
          <span className="watermark-text">INTERNATIONAL GADHA</span>
        </div>

        {/* Transient Action Notification (Appears & Automatically Disappears) */}
        {toast && (
          <div
            key={toast.timestamp}
            className={`action-toast-pill ${
              isToastExiting ? 'animate-toast-out' : 'animate-toast-in'
            } ${
              toast.type === 'eat'
                ? 'toast-eat'
                : toast.type === 'safe'
                ? 'toast-safe'
                : 'toast-info'
            }`}
          >
            <div className="toast-icon">
              {toast.type === 'eat' ? (
                <Utensils size={15} className="text-amber-300" />
              ) : toast.type === 'safe' ? (
                <ShieldCheck size={15} className="text-emerald-300" />
              ) : (
                <Sparkles size={15} className="text-purple-300" />
              )}
            </div>
            <span className="toast-text">{toast.message}</span>
          </div>
        )}

        {/* Turn Status Pill */}
        <div className={`turn-status-indicator ${isMyTurn ? 'turn-pulse-me' : ''}`}>
          {isMyTurn ? (
            <span className="flex items-center gap-1.5 font-bold text-emerald-300">
              <span className="status-dot-active" /> YOUR TURN!
            </span>
          ) : activePlayer ? (
            <span className="flex items-center gap-1.5 text-slate-200">
              <span className="status-dot-other" /> Turn: <strong>{activePlayer.name}</strong>
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
                <span className="text-2xl">🫏</span>
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
                  style={{ animationDelay: `${idx * 0.03}s` }}
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
