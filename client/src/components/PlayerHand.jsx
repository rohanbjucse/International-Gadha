import React, { useState } from 'react';
import { Card } from './Card';
import {
  ArrowUpDown,
  Layers,
  Sparkles,
  MoveLeft,
  MoveRight,
  Utensils
} from 'lucide-react';

export function PlayerHand({
  hand = [],
  bank = [],
  isMyTurn = false,
  onPlayCard,
  onReorderHand,
  onOpenEatenCards
}) {
  const [selectedCardId, setSelectedCardId] = useState(null);

  // Sorting helpers
  function sortByRank() {
    const sorted = [...hand].sort((a, b) => {
      const valA = a.isJoker ? 99 : a.rank;
      const valB = b.isJoker ? 99 : b.rank;
      return valA - valB;
    });
    onReorderHand(sorted.map(c => c.id));
  }

  function sortBySuit() {
    const suitOrder = { S: 1, H: 2, D: 3, C: 4, J: 5 };
    const sorted = [...hand].sort((a, b) => {
      if (suitOrder[a.suit] !== suitOrder[b.suit]) {
        return suitOrder[a.suit] - suitOrder[b.suit];
      }
      return a.rank - b.rank;
    });
    onReorderHand(sorted.map(c => c.id));
  }

  function sortSpadesFirst() {
    const sorted = [...hand].sort((a, b) => {
      if (a.isSpade && !b.isSpade) return -1;
      if (!a.isSpade && b.isSpade) return 1;
      return a.rank - b.rank;
    });
    onReorderHand(sorted.map(c => c.id));
  }

  function moveCard(index, direction) {
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= hand.length) return;
    const newHand = [...hand];
    const [moved] = newHand.splice(index, 1);
    newHand.splice(targetIndex, 0, moved);
    onReorderHand(newHand.map(c => c.id));
  }

  function handleCardClick(card) {
    if (!isMyTurn) return;
    onPlayCard(card);
  }

  return (
    <div className="player-hand-container">
      {/* Hand Controls Bar */}
      <div className="hand-controls-bar">
        {/* Left: View Eaten Cards Button */}
        <div className="hand-status-left">
          <button
            onClick={onOpenEatenCards}
            className="bank-status-pill bank-clickable"
            title="Click to see all cards you ate"
          >
            <Utensils size={14} className="text-amber-400" />
            <span className="font-bold">Eaten Cards:</span> {bank.length} cards
            <span className="bank-view-tag">View</span>
          </button>
        </div>

        {/* Center: Sorting Controls */}
        <div className="hand-sort-actions">
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-1">
            Sort:
          </span>
          <button
            onClick={sortByRank}
            className="btn-sort"
            title="Sort cards from Ace to King"
          >
            <ArrowUpDown size={13} /> Rank
          </button>
          <button
            onClick={sortBySuit}
            className="btn-sort"
            title="Group by Suit (♠ ♥ ♦ ♣)"
          >
            <Layers size={13} /> Suit
          </button>
          <button
            onClick={sortSpadesFirst}
            className="btn-sort btn-sort-spade"
            title="Group Spades First"
          >
            ♠ Spades
          </button>
        </div>
      </div>

      {/* Cards in Hand Fanned Area */}
      <div className={`cards-fanned-area ${isMyTurn ? 'my-turn-glow' : ''}`}>
        {hand.length === 0 ? (
          <div className="empty-hand-message">
            <span>🎉 You have played all your cards! Waiting for round to finish.</span>
          </div>
        ) : (
          <div className="cards-scroll-track">
            {hand.map((card, idx) => (
              <div key={card.id} className="hand-card-slot">
                {/* Manual move buttons */}
                <div className="card-manual-move-btns">
                  {idx > 0 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); moveCard(idx, -1); }}
                      className="btn-mini-move"
                      title="Move Left"
                    >
                      <MoveLeft size={11} />
                    </button>
                  )}
                  {idx < hand.length - 1 && (
                    <button
                      onClick={(e) => { e.stopPropagation(); moveCard(idx, 1); }}
                      className="btn-mini-move"
                      title="Move Right"
                    >
                      <MoveRight size={11} />
                    </button>
                  )}
                </div>

                <Card
                  card={card}
                  size="lg"
                  isPlayable={isMyTurn}
                  isSelected={selectedCardId === card.id}
                  onClick={() => handleCardClick(card)}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Hand Footer Guidance */}
      <div className="hand-guidance-footer">
        {isMyTurn ? (
          <span className="text-emerald-300 font-medium animate-pulse flex items-center justify-center gap-1">
            <Sparkles size={14} /> Click any card to play it to the table!
          </span>
        ) : (
          <span className="text-slate-400 text-xs">
            {hand.length} {hand.length === 1 ? 'card' : 'cards'} remaining in hand.
          </span>
        )}
      </div>
    </div>
  );
}
