import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card } from './Card';
import { Sparkles, Utensils } from 'lucide-react';

function TableActionAnimation({ action, myPlayerId, onDone }) {
  const [phase, setPhase] = useState('throw');
  const eatenCards = action.eatenCards || [];
  const isEating = action.type === 'eat' && eatenCards.length > 0;
  const cardStagger = Math.min(Math.max(eatenCards.length - 1, 0) * 0.12, 1.2);
  const captureDuration = 3.2 + cardStagger;

  if (phase === 'throw') {
    return (
      <div
        className="table-motion-card table-card-throw"
        aria-hidden="true"
        onAnimationEnd={() => {
          if (isEating) setPhase('gather');
          else onDone();
        }}
      >
        <Card card={action.card} size="md" />
      </div>
    );
  }

  return (
    <div
      className={`table-capture-flight ${action.playerId === myPlayerId ? 'capture-to-local' : 'capture-to-opponent'}`}
      style={{ animationDuration: `${captureDuration}s` }}
      aria-live="polite"
      aria-label={`${eatenCards.length} cards captured by ${action.playerName}`}
      onAnimationEnd={event => {
        if (event.target === event.currentTarget) onDone();
      }}
    >
      <span className="capture-flight-caption">
        {action.playerName} captures {eatenCards.length} cards · +{action.pointsGained || 0} Spade points
      </span>
      <div className="capture-flight-cards">
        {eatenCards.map((card, index) => (
          <div
            className="capture-flight-card"
            key={card.id}
            style={{
              animationDelay: `${Math.min(index * 0.12, 1.2)}s`,
              animationDuration: '3.2s'
            }}
          >
            <Card card={card} size="sm" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function Table({
  tableCards = [],
  lastAction,
  activePlayer,
  isMyTurn,
  myPlayerId,
  animationAction
}) {
  const [dismissedToastKey, setDismissedToastKey] = useState('');
  const [animationState, setAnimationState] = useState({ active: null, queuedCaptures: [] });
  const tableSurfaceRef = useRef(null);
  const previousPositionsRef = useRef(new Map());
  const positionAnimationsRef = useRef(new Map());
  const incomingAction = animationAction || lastAction;
  const incomingActionKey = incomingAction ? JSON.stringify(incomingAction) : '';
  const seenActionKeyRef = useRef(incomingActionKey);
  const motionAction = animationState.active;
  const animationKey = motionAction ? JSON.stringify(motionAction) : '';
  const toastKey = lastAction ? JSON.stringify(lastAction) : '';
  const isAnimationActive = !!motionAction;
  const hiddenPlayedCardId = isAnimationActive && motionAction.type === 'safe'
    ? motionAction.card.id
    : null;
  const visibleTableCards = hiddenPlayedCardId
    ? tableCards.filter(card => card.id !== hiddenPlayedCardId)
    : tableCards;

  // Keep the active capture animation alive while newer server actions arrive.
  useEffect(() => {
    if (!incomingActionKey || incomingActionKey === seenActionKeyRef.current) return;
    seenActionKeyRef.current = incomingActionKey;

    if (!incomingAction?.card || !['eat', 'safe'].includes(incomingAction.type)) return;

    setAnimationState(current => {
      if (!current.active && current.queuedCaptures.length === 0) {
        return { ...current, active: incomingAction };
      }

      if (incomingAction.type === 'eat') {
        return {
          ...current,
          queuedCaptures: [...current.queuedCaptures, incomingAction]
        };
      }

      return current;
    });
  }, [incomingAction, incomingActionKey]);

  const finishAnimation = () => {
    setAnimationState(current => ({
      active: current.queuedCaptures[0] || null,
      queuedCaptures: current.queuedCaptures.slice(1)
    }));
  };

  useLayoutEffect(() => {
    const surface = tableSurfaceRef.current;
    if (!surface) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const nextPositions = new Map();
    const cardElements = surface.querySelectorAll('[data-table-card-id]');

    cardElements.forEach(element => {
      const cardId = element.getAttribute('data-table-card-id');
      const rect = element.getBoundingClientRect();
      const previousPosition = previousPositionsRef.current.get(cardId);

      if (previousPosition && !reducedMotion) {
        const deltaX = previousPosition.left - rect.left;
        const deltaY = previousPosition.top - rect.top;

        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          positionAnimationsRef.current.get(cardId)?.cancel();
          const animation = element.animate(
            [
              { transform: `translate(${deltaX}px, ${deltaY}px)` },
              { transform: 'translate(0, 0)' }
            ],
            { duration: 620, easing: 'cubic-bezier(0.2, 0.75, 0.25, 1)' }
          );
          positionAnimationsRef.current.set(cardId, animation);
          animation.onfinish = () => {
            if (positionAnimationsRef.current.get(cardId) === animation) {
              positionAnimationsRef.current.delete(cardId);
            }
          };
        }
      }

      nextPositions.set(cardId, { left: rect.left, top: rect.top });
    });

    positionAnimationsRef.current.forEach((animation, cardId) => {
      if (!nextPositions.has(cardId)) {
        animation.cancel();
        positionAnimationsRef.current.delete(cardId);
      }
    });

    previousPositionsRef.current = nextPositions;
  });

  return (
    <div className="table-container">
      <div className="table-felt">
        <div className="table-felt-watermark">
          <span className="watermark-emoji">🫏</span>
          <span className="watermark-text">INTERNATIONAL GADHA</span>
        </div>

        {toastKey && dismissedToastKey !== toastKey && (
          <div
            key={toastKey}
            className={`action-toast-pill toast-lifecycle ${lastAction.type === 'eat' ? 'toast-eat' : 'toast-info'}`}
            onAnimationEnd={() => setDismissedToastKey(toastKey)}
            aria-hidden="true"
          >
            <div className="toast-icon">
              {lastAction.type === 'eat'
                ? <Utensils size={15} className="text-amber-300" />
                : <Sparkles size={15} className="text-purple-300" />}
            </div>
            <span className="toast-text">{lastAction.message}</span>
          </div>
        )}

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

        <div className="table-cards-surface" ref={tableSurfaceRef}>
          {visibleTableCards.length === 0 && !isAnimationActive ? (
            <div className="empty-table-placeholder animate-fade-in">
              <div className="empty-table-circle">
                <span className="text-2xl">🫏</span>
              </div>
              <p className="empty-table-title">Table is Clear</p>
              <p className="empty-table-sub">Play a card to start the round.</p>
            </div>
          ) : (
            <div className="table-cards-grid">
              {visibleTableCards.map(card => (
                <div
                  key={card.id}
                  className="table-card-wrapper"
                  data-table-card-id={card.id}
                >
                  <Card card={card} size="md" isPlayable={false} />
                </div>
              ))}
            </div>
          )}

          {isAnimationActive && (
            <TableActionAnimation
              key={animationKey}
              action={motionAction}
              myPlayerId={myPlayerId}
              onDone={finishAnimation}
            />
          )}
        </div>
      </div>
    </div>
  );
}
