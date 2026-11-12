import React from 'react';

export function Card({
  card,
  isPlayable = false,
  isSelected = false,
  onClick,
  size = 'md', // 'sm', 'md', 'lg'
  isFaceDown = false,
  style = {}
}) {
  if (isFaceDown) {
    return (
      <div
        className={`card-base card-facedown size-${size}`}
        style={style}
      >
        <div className="card-back-pattern">
          <div className="card-back-inner">
            <span className="card-back-icon">🫏</span>
          </div>
        </div>
      </div>
    );
  }

  const isJoker = card.isJoker;
  const isRed = card.suit === 'H' || card.suit === 'D';

  return (
    <div
      onClick={isPlayable ? onClick : undefined}
      className={`card-base size-${size} ${isPlayable ? 'cursor-pointer hover-lift' : ''} ${
        isSelected ? 'card-selected' : ''
      } ${isJoker ? 'card-joker' : ''}`}
      style={style}
      title={card.name}
    >
      {/* Joker Wildcard Pill */}
      {isJoker && (
        <div className="joker-tag">
          <span>WILDCARD</span>
        </div>
      )}

      {/* Top Left Corner */}
      <div className={`card-corner top-left ${isRed ? 'text-red' : isJoker ? 'text-purple' : 'text-dark'}`}>
        <span className="corner-rank">{card.label}</span>
        <span className="corner-suit">{card.symbol}</span>
      </div>

      {/* Center Graphic */}
      <div className={`card-center ${isRed ? 'text-red' : isJoker ? 'text-purple' : 'text-dark'}`}>
        {isJoker ? (
          <div className="joker-center-art">
            <span className="joker-emoji">🃏</span>
            <span className="joker-label">JOKER</span>
            {card.jokerSubstituteRank && (
              <span className="joker-sub-value">as {card.jokerSubstituteRank}</span>
            )}
          </div>
        ) : (
          <div className="center-suit-symbol">
            {card.symbol}
            {card.rank >= 11 && (
              <span className="court-label">{card.label}</span>
            )}
          </div>
        )}
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div className={`card-corner bottom-right ${isRed ? 'text-red' : isJoker ? 'text-purple' : 'text-dark'}`}>
        <span className="corner-rank">{card.label}</span>
        <span className="corner-suit">{card.symbol}</span>
      </div>
    </div>
  );
}
