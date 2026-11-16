import React from 'react';

export function Card({
  card,
  isPlayable = false,
  isSelected = false,
  safety = null,
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

  // Convert joker substitute rank number to display label
  const getSubRankLabel = (rank) => {
    if (!rank) return null;
    const n = Number(rank);
    if (n === 1) return 'A';
    if (n === 11) return 'J';
    if (n === 12) return 'Q';
    if (n === 13) return 'K';
    return String(n);
  };
  const subRankLabel = isJoker ? getSubRankLabel(card.jokerSubstituteRank) : null;

  // Corner display values
  const cornerRank = isJoker ? (subRankLabel || 'JK') : card.label;
  const cornerSuit = isJoker ? '🃏' : card.symbol;
  const CardElement = isPlayable ? 'button' : 'div';
  const safetyLabel = safety
    ? safety.isSafe
      ? 'SAFE'
      : `EAT ${safety.riskPoints}♠`
    : null;
  const safetyDescription = safety
    ? safety.isSafe
      ? 'safe'
      : `will eat ${safety.riskPoints} Gadha points`
    : '';

  return (
    <CardElement
      type={isPlayable ? 'button' : undefined}
      onClick={isPlayable ? onClick : undefined}
      aria-label={isPlayable ? `${card.name}${safetyDescription ? `, ${safetyDescription}` : ''}` : undefined}
      className={`card-base size-${size} ${isPlayable ? 'cursor-pointer hover-lift' : ''} ${
        isSelected ? 'card-selected' : ''
      } ${isJoker ? 'card-joker' : ''}`}
      style={style}
      title={isJoker ? (subRankLabel ? `Joker (substituting ${subRankLabel})` : 'Joker Wildcard') : card.name}
    >
      {/* Joker Wildcard Pill */}
      {isJoker && (
        <div className={`joker-tag ${subRankLabel ? 'joker-tag-subbed' : ''}`}>
          <span>{subRankLabel ? `JOKER = ${subRankLabel}` : 'WILDCARD'}</span>
        </div>
      )}

      {/* Top Left Corner */}
      <div className={`card-corner top-left ${isRed ? 'text-red' : isJoker ? 'text-purple' : 'text-dark'}`}>
        <span className="corner-rank">{cornerRank}</span>
        <span className="corner-suit">{cornerSuit}</span>
      </div>

      {/* Center Graphic */}
      <div className={`card-center ${isRed ? 'text-red' : isJoker ? 'text-purple' : 'text-dark'}`}>
        {isJoker ? (
          <div className="joker-center-art">
            <span className="joker-emoji">🃏</span>
            {subRankLabel ? (
              <span className="joker-sub-value">= {subRankLabel}</span>
            ) : (
              <span className="joker-label">JOKER</span>
            )}
          </div>
        ) : (
          <div className="center-suit-symbol">
            {card.symbol}
          </div>
        )}
      </div>

      {/* Bottom Right Corner (Inverted) */}
      <div className={`card-corner bottom-right ${isRed ? 'text-red' : isJoker ? 'text-purple' : 'text-dark'}`}>
        <span className="corner-rank">{cornerRank}</span>
        <span className="corner-suit">{cornerSuit}</span>
      </div>
      {isPlayable && safetyLabel && (
        <div className={`safety-pill ${safety.isSafe ? 'pill-safe' : safety.riskPoints > 0 ? 'pill-danger' : 'pill-warning'}`}>
          {safetyLabel}
        </div>
      )}
    </CardElement>
  );
}
