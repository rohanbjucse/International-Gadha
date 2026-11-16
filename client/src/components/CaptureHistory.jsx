import React, { useEffect, useState } from 'react';
import { History, X } from 'lucide-react';

export function CaptureHistory({ history = [] }) {
  const [isOpen, setIsOpen] = useState(false);
  const captures = history
    .map((action, index) => ({ ...action, turnNumber: index + 1 }))
    .filter(action => action.type === 'eat');

  useEffect(() => {
    if (!isOpen) return undefined;

    function handleKeyDown(event) {
      if (event.key === 'Escape') setIsOpen(false);
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        className="capture-history-trigger"
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
      >
        <History size={14} />
        Capture history
        <span>{captures.length}</span>
      </button>

      {isOpen && (
        <div
          className="capture-history-backdrop"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setIsOpen(false);
          }}
        >
          <section
            className="capture-history-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="capture-history-title"
          >
            <header className="capture-history-header">
              <div>
                <h2 id="capture-history-title"><History size={18} /> Capture history</h2>
                <span>{captures.length} captures this game</span>
              </div>
              <button
                className="capture-history-close"
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close capture history"
              >
                <X size={18} />
              </button>
            </header>

            {captures.length === 0 ? (
              <p className="capture-history-empty">Captured cards will appear here as the game progresses.</p>
            ) : (
              <div className="capture-history-list">
                {captures.slice(-12).reverse().map(action => (
                  <article
                    className="capture-history-turn"
                    key={`${action.timestamp}-${action.playerId}-${action.turnNumber}`}
                  >
                    <div className="capture-history-turn-title">
                      <span>Turn {action.turnNumber}</span>
                      <strong title={action.playerName}>{action.playerName}</strong>
                    </div>
                    <div className="capture-history-cards" aria-label="Cards captured">
                      {(action.eatenCards || []).map((card, cardIndex) => (
                        <span
                          className={`capture-history-card ${card.isSpade ? 'capture-history-spade' : ''}`}
                          key={card.id || `${action.timestamp}-${cardIndex}`}
                          title={card.name}
                        >
                          {card.label}{card.symbol}
                        </span>
                      ))}
                    </div>
                    <div className="capture-history-summary">
                      <span>{action.eatenCards?.length || 0} cards</span>
                      <span>+{action.pointsGained || 0} ♠</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
