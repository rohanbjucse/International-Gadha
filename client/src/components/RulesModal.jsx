import React from 'react';
import { X, BookOpen, ShieldCheck, Utensils, AlertTriangle, Sparkles } from 'lucide-react';

export function RulesModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="modal-card rules-modal-box">
        <div className="modal-header">
          <div className="flex items-center gap-2">
            <BookOpen className="text-amber-400" size={22} />
            <h2 className="text-xl font-bold text-white">How to Play "International Gadha"</h2>
          </div>
          <button onClick={onClose} className="btn-icon-close">
            <X size={20} />
          </button>
        </div>

        <div className="rules-modal-content">
          {/* Section 1: Objective */}
          <div className="rules-section">
            <h3 className="rules-sec-title">🎯 Objective & The Gadha Score</h3>
            <p>
              The motive of the game is to finish with the <strong>FEWEST Gadha points</strong> possible.
            </p>
            <div className="rules-callout callout-danger">
              <AlertTriangle size={18} className="text-rose-400 flex-shrink-0" />
              <div>
                <strong>What is a Gadha Card?</strong> ALL <strong>SPADE (♠)</strong> cards are Gadha cards!
                Their Gadha value equals their face value:
                <div className="mt-1 font-mono text-sm">
                  Ace = 1 pt • 2..10 = 2..10 pts • Jack = 11 pts • Queen = 12 pts • King = 13 pts
                </div>
                <div className="text-emerald-300 text-xs mt-1">
                  All Hearts (♥), Diamonds (♦), Clubs (♣), and Jokers (🃏) count as <strong>0 Gadha points</strong>!
                </div>
              </div>
            </div>
          </div>

          {/* Section 2: Players & Deck */}
          <div className="rules-section">
            <h3 className="rules-sec-title">👥 Players & Deck Division</h3>
            <p>3 to 6 players play. Cards are divided equally:</p>
            <ul className="rules-list">
              <li><strong>3 Players:</strong> 52 cards + 2 Jokers = 54 cards (18 each)</li>
              <li><strong>4 Players:</strong> 52 cards (13 each)</li>
              <li><strong>5 Players:</strong> 52 cards + 3 Jokers = 55 cards (11 each)</li>
              <li><strong>6 Players:</strong> 54 cards with 2 Jokers (9 each)</li>
            </ul>
          </div>

          {/* Section 3: The Turn Rule */}
          <div className="rules-section">
            <h3 className="rules-sec-title">🔄 Turn Flow: Unique vs. Eaten</h3>
            <p>On your turn, you play any 1 card to the center table:</p>

            <div className="rules-flow-grid">
              <div className="flow-card flow-safe">
                <div className="flex items-center gap-1 font-bold text-emerald-300">
                  <ShieldCheck size={16} /> SAFE (Unique Move)
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  If <strong>NO card</strong> on the table has the same rank, <strong>AND NO sum of two cards</strong> on the table equals your card's rank:
                  Your card stays safely on the table!
                </p>
              </div>

              <div className="flow-card flow-eat">
                <div className="flex items-center gap-1 font-bold text-amber-300">
                  <Utensils size={16} /> EATEN (Capture!)
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  If your card matches a single card on the table OR equals the sum of two cards on the table:
                  <strong>You MUST pick up the matched table cards + your played card</strong> into your Bank!
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Real Example */}
          <div className="rules-section">
            <h3 className="rules-sec-title">📖 Walkthrough Example</h3>
            <div className="example-box">
              <div className="example-step">
                <span className="step-tag">1</span>
                <span>Table starts with: <strong>♥Ace (1)</strong>, <strong>♣2</strong>, <strong>♠9</strong></span>
              </div>
              <div className="example-step">
                <span className="step-tag">2</span>
                <span>
                  Player A plays <strong>♥4</strong>. (1+2=3, 1+9=10, 2+9=11 — none equal 4).
                  <strong className="text-emerald-300"> SAFE!</strong> 4 stays on table.
                </span>
              </div>
              <div className="example-step">
                <span className="step-tag">3</span>
                <span>
                  Player B plays <strong>♠3</strong>. Notice <strong>♥Ace (1) + ♣2 = 3</strong>!
                  <strong className="text-amber-300"> EATEN!</strong> Player B picks up Ace, 2, and their ♠3 into their bank (+3 Gadha pts). Table now has ♠9 and ♥4.
                </span>
              </div>
              <div className="example-step">
                <span className="step-tag">4</span>
                <span>
                  Player C plays <strong>♦King (13)</strong>. Notice <strong>♥4 + ♠9 = 13</strong>!
                  <strong className="text-amber-300"> EATEN!</strong> Player C eats 4, ♠9, and King (+9 Gadha pts)! Table is now clear.
                </span>
              </div>
            </div>
          </div>

          {/* Section 5: Jokers */}
          <div className="rules-section">
            <h3 className="rules-sec-title">🃏 Wildcard Jokers</h3>
            <p>
              When playing a Joker, you can choose any rank (1 to 13) for it to act as. Since a Joker is not a spade, it yields <strong>0 Gadha points</strong>!
            </p>
          </div>

          {/* Section 6: Winner vs International Gadha */}
          <div className="rules-section">
            <h3 className="rules-sec-title">👑 The International Gadha</h3>
            <p>
              At the end of the round, each player tallies their Spades face values.
              The player with the <strong>HIGHEST Gadha points</strong> is crowned the <strong>INTERNATIONAL GADHA 🫏</strong>!
              The player with the lowest score wins!
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button onClick={onClose} className="btn-primary w-full">
            Got it, Let's Play!
          </button>
        </div>
      </div>
    </div>
  );
}

