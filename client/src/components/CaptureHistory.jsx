import React from 'react';
import { History, Utensils } from 'lucide-react';

export function CaptureHistory({ history = [] }) {
  const captures = history
    .map((action, index) => ({ ...action, turnNumber: index + 1 }))
    .filter(action => action.type === 'eat');

  return (
    <aside className="capture-history-panel" aria-label="Capture history">
      <header className="capture-history-header">
        <div>
          <h2><History size={16} /> Capture history</h2>
          <span>{captures.length} captures this game</span>
        </div>
        <Utensils size={17} />
      </header>

      {captures.length === 0 ? (
        <p className="capture-history-empty">Cards captured during play will appear here.</p>
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
    </aside>
  );
}
