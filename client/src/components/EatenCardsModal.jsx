import React, { useState } from 'react';
import { Card } from './Card';
import { X, Utensils, Layers, ArrowUpDown } from 'lucide-react';

export function EatenCardsModal({ isOpen, onClose, bank = [], playerName = 'Your' }) {
  if (!isOpen) return null;

  const [filterSuit, setFilterSuit] = useState('ALL');

  const spadeCards = bank.filter(c => c.isSpade);
  const spadeScore = spadeCards.reduce((sum, c) => sum + c.rank, 0);

  const displayedCards = filterSuit === 'ALL'
    ? bank
    : filterSuit === 'SPADES'
    ? bank.filter(c => c.isSpade)
    : bank.filter(c => c.suit === filterSuit);

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="modal-card eaten-cards-modal-box" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <Utensils className="text-amber-400" size={22} />
            <div>
              <h2 className="text-xl font-bold text-white">
                {playerName} Eaten Cards ({bank.length})
              </h2>
              <span className="text-xs text-slate-300">
                All cards eaten into your bank this game
              </span>
            </div>
          </div>
          <button onClick={onClose} className="btn-icon-close" title="Close">
            <X size={20} />
          </button>
        </div>

        {/* Bank Summary Bar */}
        <div className="eaten-summary-bar">
          <div className="eaten-stat-item">
            <span className="eaten-stat-label">Total Eaten:</span>
            <span className="eaten-stat-val text-white">{bank.length} cards</span>
          </div>
          <div className="eaten-stat-item">
            <span className="eaten-stat-label">Spades (Gadha Cards):</span>
            <span className="eaten-stat-val text-rose-400">
              {spadeCards.length} cards (♠ {spadeScore} pts)
            </span>
          </div>
          <div className="eaten-stat-item">
            <span className="eaten-stat-label">Non-Spades (0 pts):</span>
            <span className="eaten-stat-val text-emerald-400">
              {bank.length - spadeCards.length} cards
            </span>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="eaten-filter-bar">
          <span className="text-xs text-slate-400 font-semibold mr-1">Filter:</span>
          {[
            { id: 'ALL', label: `All (${bank.length})` },
            { id: 'SPADES', label: `♠ Spades (${spadeCards.length})` },
            { id: 'H', label: `♥ Hearts (${bank.filter(c => c.suit === 'H').length})` },
            { id: 'D', label: `♦ Diamonds (${bank.filter(c => c.suit === 'D').length})` },
            { id: 'C', label: `♣ Clubs (${bank.filter(c => c.suit === 'C').length})` },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFilterSuit(f.id)}
              className={`filter-pill-btn ${filterSuit === f.id ? 'filter-pill-active' : ''}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Cards Grid */}
        <div className="eaten-cards-scroll-body">
          {bank.length === 0 ? (
            <div className="empty-eaten-state">
              <span className="text-4xl mb-2">🍽️</span>
              <p className="text-white font-bold">No Cards Eaten Yet!</p>
              <p className="text-slate-400 text-xs">
                Your bank is currently empty. Cards you eat from the table will appear here.
              </p>
            </div>
          ) : displayedCards.length === 0 ? (
            <div className="empty-eaten-state">
              <p className="text-slate-300 text-sm">No cards match this suit filter.</p>
            </div>
          ) : (
            <div className="eaten-cards-grid">
              {displayedCards.map((card, idx) => (
                <div key={card.id || idx} className="eaten-card-item">
                  <Card
                    card={card}
                    size="md"
                    isPlayable={false}
                    showSafetyBadge={false}
                  />
                  <span className="eaten-card-name-sub">
                    {card.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-secondary w-full">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

