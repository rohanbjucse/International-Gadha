import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Card } from './Card';
import { Sparkles, Utensils } from 'lucide-react';

function slotColumn(index, columnCount) {
  const offset = index % columnCount;
  const center = Math.ceil(columnCount / 2);
  if (offset === 0) return center;
  return offset % 2 === 1
    ? center + Math.ceil(offset / 2)
    : center - Math.floor(offset / 2);
}

function reconcileTableSlots(currentSlots, tableCards, retainedCaptureCards) {
  const cardsById = new Map(tableCards.map(card => [card.id, card]));
  retainedCaptureCards.forEach(card => cardsById.set(card.id, card));

  const nextSlots = currentSlots.map(card => card ? cardsById.get(card.id) || null : null);
  const occupiedIds = new Set(nextSlots.filter(Boolean).map(card => card.id));

  [...tableCards, ...retainedCaptureCards].forEach(card => {
    if (occupiedIds.has(card.id)) return;
    const emptyIndex = nextSlots.indexOf(null);
    if (emptyIndex === -1) nextSlots.push(card);
    else nextSlots[emptyIndex] = card;
    occupiedIds.add(card.id);
  });

  if (
    nextSlots.length === currentSlots.length &&
    nextSlots.every((card, index) => card === currentSlots[index])
  ) {
    return currentSlots;
  }
  return nextSlots;
}

function TableActionAnimation({
  action,
  phase,
  targetPosition,
  sourcePositions,
  myPlayerId,
  onPhaseChange,
  onDone
}) {
  const eatenCards = action.eatenCards || [];
  const isEating = action.type === 'eat' && eatenCards.length > 0;
  const cardStagger = Math.min(Math.max(eatenCards.length - 1, 0) * 0.1, 1.2);
  const captureDuration = 2.6 + cardStagger;

  if (phase === 'throw') {
    return (
      <div
        className="table-motion-card table-card-throw"
        style={{
          '--throw-x': `${targetPosition?.x || 0}px`,
          '--throw-y': `${targetPosition?.y || 0}px`
        }}
        aria-hidden="true"
        onAnimationEnd={() => {
          if (isEating) onPhaseChange('identify');
          else onDone();
        }}
      >
        <Card card={action.card} size="md" />
      </div>
    );
  }

  if (phase === 'identify') {
    return (
      <div
        className="table-identify-pause"
        aria-live="polite"
        onAnimationEnd={() => onPhaseChange('gather')}
      >
        {eatenCards.length} matched cards
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
        {action.playerName} took {eatenCards.length} cards · +{action.pointsGained || 0} Spade points
      </span>
      {eatenCards.map((card, index) => {
        const source = sourcePositions.get(card.id) || { x: 0, y: 0 };
        return (
          <div
            className="capture-flight-card"
            key={card.id}
            style={{
              '--source-x': `${source.x}px`,
              '--source-y': `${source.y}px`,
              animationDelay: `${Math.min(index * 0.1, 1.2)}s`
            }}
          >
            <Card card={card} size="md" />
          </div>
        );
      })}
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
  const [animationPhase, setAnimationPhase] = useState('throw');
  const [completedAnimationKey, setCompletedAnimationKey] = useState('');
  const [tableSlots, setTableSlots] = useState(() => tableCards);
  const [tableColumnCount, setTableColumnCount] = useState(() => (
    window.matchMedia('(max-width: 640px)').matches ? 6 : 8
  ));
  const tableSurfaceRef = useRef(null);
  const slotPositionsRef = useRef(new Map());
  const cardPositionsRef = useRef(new Map());
  const incomingAction = animationAction || lastAction;
  const incomingActionKey = incomingAction ? JSON.stringify(incomingAction) : '';
  const seenActionKeyRef = useRef(incomingActionKey);
  const motionAction = animationState.active;
  const animationKey = motionAction ? JSON.stringify(motionAction) : '';
  const toastKey = lastAction ? JSON.stringify(lastAction) : '';
  const isAnimationActive = !!motionAction;
  const retainedCaptureActions = [animationState.active, ...animationState.queuedCaptures]
    .filter(action => action?.type === 'eat');
  if (
    incomingAction?.type === 'eat' &&
    incomingActionKey !== completedAnimationKey &&
    !retainedCaptureActions.some(action => JSON.stringify(action) === incomingActionKey)
  ) {
    retainedCaptureActions.push(incomingAction);
  }
  const retainedCaptureCards = [
    ...new Map(retainedCaptureActions.flatMap(action => action.eatenCards || []).map(card => [card.id, card])).values()
  ];
  const retainedCaptureSignature = retainedCaptureCards.map(card => card.id).sort().join('|');
  const pendingIncomingAction = !isAnimationActive &&
    incomingActionKey !== seenActionKeyRef.current &&
    ['eat', 'safe'].includes(incomingAction?.type)
    ? incomingAction
    : null;
  const thrownCardId = animationPhase === 'throw'
    ? motionAction?.card.id || pendingIncomingAction?.card.id || null
    : null;
  const matchingCardIds = new Set(
    motionAction?.type === 'eat' && animationPhase === 'identify'
      ? (motionAction.eatenCards || []).map(card => card.id)
      : []
  );
  const eatingCardOrder = new Map(
    motionAction?.type === 'eat' && animationPhase === 'gather'
      ? (motionAction.eatenCards || []).map((card, index) => [card.id, index])
      : []
  );
  const slotCount = Math.max(tableSlots.length, 1);
  const isTableClear = tableSlots.every(card => !card) && !isAnimationActive;

  // Keep the active capture animation alive while newer server actions arrive.
  useEffect(() => {
    if (!incomingActionKey || incomingActionKey === seenActionKeyRef.current) return;
    seenActionKeyRef.current = incomingActionKey;

    if (!incomingAction?.card || !['eat', 'safe'].includes(incomingAction.type)) return;

    if (!animationState.active && animationState.queuedCaptures.length === 0) {
      setAnimationPhase('throw');
      setAnimationState(current => ({ ...current, active: incomingAction }));
      return;
    }

    if (incomingAction.type === 'eat') {
      setAnimationState(current => ({
        ...current,
        queuedCaptures: [...current.queuedCaptures, incomingAction]
      }));
    }
  }, [animationState.active, animationState.queuedCaptures, incomingAction, incomingActionKey]);

  const finishAnimation = () => {
    setCompletedAnimationKey(animationKey);
    setAnimationPhase('throw');
    setAnimationState(current => ({
      active: current.queuedCaptures[0] || null,
      queuedCaptures: current.queuedCaptures.slice(1)
    }));
  };

  useLayoutEffect(() => {
    setTableSlots(current => reconcileTableSlots(current, tableCards, retainedCaptureCards));
  }, [tableCards, retainedCaptureSignature]);

  useEffect(() => {
    function updateColumnCount() {
      setTableColumnCount(window.matchMedia('(max-width: 640px)').matches ? 6 : 8);
    }

    window.addEventListener('resize', updateColumnCount);
    return () => window.removeEventListener('resize', updateColumnCount);
  }, []);

  useLayoutEffect(() => {
    const surface = tableSurfaceRef.current;
    if (!surface) return;

    const surfaceRect = surface.getBoundingClientRect();
    const nextSlotPositions = new Map();
    const nextCardPositions = new Map();
    surface.querySelectorAll('[data-table-slot-index]').forEach(element => {
      const slotIndex = Number(element.getAttribute('data-table-slot-index'));
      const rect = element.getBoundingClientRect();
      nextSlotPositions.set(slotIndex, {
        x: rect.left + rect.width / 2 - (surfaceRect.left + surfaceRect.width / 2),
        y: rect.top + rect.height / 2 - (surfaceRect.top + surfaceRect.height / 2)
      });

      const cardId = element.getAttribute('data-table-card-id');
      if (cardId) {
        nextCardPositions.set(cardId, nextSlotPositions.get(slotIndex));
      }
    });

    slotPositionsRef.current = nextSlotPositions;
    cardPositionsRef.current = nextCardPositions;
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
          <div
            className="table-cards-grid"
            style={{ gridTemplateColumns: `repeat(${tableColumnCount}, ${tableColumnCount === 6 ? 38 : 68}px)` }}
          >
            {Array.from({ length: slotCount }, (_, index) => {
              const card = tableSlots[index] || null;
              const isThrownCard = !!card && card.id === thrownCardId;
              const matchClass = card && matchingCardIds.has(card.id) ? 'table-card-match' : '';
              const eatingIndex = card ? eatingCardOrder.get(card.id) : undefined;
              const eatingClass = eatingIndex !== undefined ? 'table-card-eating' : '';
              return (
                <div
                  className={`table-card-slot ${matchClass} ${eatingClass}`}
                  key={index}
                  data-table-slot-index={index}
                  data-table-card-id={card?.id}
                  data-play-card-slot={isThrownCard ? card.id : undefined}
                  style={{
                    gridColumn: slotColumn(index, tableColumnCount),
                    gridRow: Math.floor(index / tableColumnCount) + 1,
                    animationDelay: eatingIndex === undefined ? undefined : `${Math.min(eatingIndex * 0.1, 1.2)}s`
                  }}
                >
                  {card && !isThrownCard
                    ? (
                      <div className="table-card-wrapper">
                        <Card card={card} size="md" isPlayable={false} />
                      </div>
                    )
                    : <div className="table-card-slot-empty" />}
                </div>
              );
            })}
          </div>

          {isTableClear && (
            <div className="empty-table-placeholder">
              <div className="empty-table-circle">
                <span className="text-2xl">🫏</span>
              </div>
              <p className="empty-table-title">Table is Clear</p>
            </div>
          )}

          {isAnimationActive && (
            <TableActionAnimation
              key={animationKey}
              action={motionAction}
              phase={animationPhase}
              targetPosition={slotPositionsRef.current.get(
                tableSlots.findIndex(card => card?.id === motionAction.card.id)
              )}
              sourcePositions={cardPositionsRef.current}
              myPlayerId={myPlayerId}
              onPhaseChange={setAnimationPhase}
              onDone={finishAnimation}
            />
          )}
        </div>
      </div>
    </div>
  );
}
