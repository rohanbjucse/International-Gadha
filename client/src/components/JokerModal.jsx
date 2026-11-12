import React from 'react';
import { X } from 'lucide-react';

const RANK_LIST = [
  { rank: 1, label: 'Ace (1)' },
  { rank: 2, label: '2' },
  { rank: 3, label: '3' },
  { rank: 4, label: '4' },
  { rank: 5, label: '5' },
  { rank: 6, label: '6' },
  { rank: 7, label: '7' },
  { rank: 8, label: '8' },
  { rank: 9, label: '9' },
  { rank: 10, label: '10' },
  { rank: 11, label: 'Jack (11)' },
  { rank: 12, label: 'Queen (12)' },
  { rank: 13, label: 'King (13)' }
];

export function JokerModal({ isOpen, onClose, onSelectRank }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-card joker-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🃏</span>
            <h2 className="text-xl font-bold text-white">Play Wildcard Joker</h2>
          </div>
          <button onClick={onClose} className="btn-icon-close">
            <X size={20} />
          </button>
        </div>

        <p className="modal-description">
          A Joker can substitute any rank from 1 to 13. Since it is non-spade, it gives <strong>0 Gadha points</strong>.
          Choose which rank this Joker should play as:
        </p>

        <div className="joker-ranks-grid">
          {RANK_LIST.map(({ rank, label }) => (
            <button
              key={rank}
              onClick={() => onSelectRank(rank)}
              className="joker-rank-btn rank-neutral"
            >
              <div className="rank-name">{label}</div>
            </button>
          ))}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary w-full">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
