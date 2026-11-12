/**
 * International Gadha - Core Game Engine
 * 
 * Rules:
 * - 3 to 6 players
 * - Standard 52-card deck + Jokers for equal distribution:
 *   * 3 players: 52 + 2 jokers = 54 cards (18 each)
 *   * 4 players: 52 cards (13 each, 0 jokers)
 *   * 5 players: 52 + 3 jokers = 55 cards (11 each)
 *   * 6 players: 52 + 2 jokers = 54 cards (9 each) [or 52 with 4 on table]
 * - Gadha cards: ALL SPADES are Gadha cards.
 *   Value = face value: Ace=1, 2=2, ..., Jack=11, Queen=12, King=13.
 *   Non-spades = 0 Gadha points.
 *   Joker = 0 Gadha points, can substitute any rank (1-13).
 * - Turn Rule:
 *   Player plays a card to the table.
 *   If UNIQUE (no card on table has same rank AND no pair of cards on table sums to the card's rank):
 *     Safe! Card stays on table.
 *   If NOT UNIQUE:
 *     Player eats the matched card(s) from table AND their played card!
 *     All eaten cards go into player's bank.
 * - Motive: Minimize Gadha points in bank. Player with highest Gadha points is INTERNATIONAL GADHA!
 */

const SUITS = {
  SPADES: 'S',
  HEARTS: 'H',
  DIAMONDS: 'D',
  CLUBS: 'C',
  JOKER: 'J'
};

const SUIT_SYMBOLS = {
  S: '♠',
  H: '♥',
  D: '♦',
  C: '♣',
  J: '🃏'
};

const SUIT_COLORS = {
  S: '#111827', // dark
  H: '#dc2626', // red
  D: '#dc2626', // red
  C: '#111827', // dark
  J: '#7c3aed'  // purple
};

const RANK_LABELS = {
  1: 'A',
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K'
};

function createCard(suit, rank, id, jokerSubstituteRank = null) {
  const isSpade = suit === SUITS.SPADES;
  const isJoker = suit === SUITS.JOKER;
  
  // Gadha points: ONLY Spades have Gadha points equal to rank (Ace=1 .. King=13).
  // Jokers and other suits have 0 Gadha points.
  const gadhaPoints = isSpade ? rank : 0;
  
  return {
    id: id || `${suit}-${rank}-${Math.random().toString(36).substring(2, 7)}`,
    suit,
    rank,
    symbol: SUIT_SYMBOLS[suit] || suit,
    color: SUIT_COLORS[suit] || '#111827',
    label: isJoker ? '🃏' : RANK_LABELS[rank],
    name: isJoker ? 'Joker' : `${RANK_LABELS[rank]} of ${suit === 'S' ? 'Spades' : suit === 'H' ? 'Hearts' : suit === 'D' ? 'Diamonds' : 'Clubs'}`,
    isSpade,
    isJoker,
    gadhaPoints,
    jokerSubstituteRank: isJoker ? jokerSubstituteRank : null
  };
}

/**
 * Build deck based on player count
 */
function buildDeck(playerCount) {
  const deck = [];
  let cardIndex = 1;

  // Standard 52 cards
  const standardSuits = [SUITS.SPADES, SUITS.HEARTS, SUITS.DIAMONDS, SUITS.CLUBS];
  for (const suit of standardSuits) {
    for (let rank = 1; rank <= 13; rank++) {
      deck.push(createCard(suit, rank, `card-${cardIndex++}`));
    }
  }

  // Jokers to balance division:
  // 3 players -> +2 jokers (54 cards = 18 each)
  // 4 players -> 0 jokers (52 cards = 13 each)
  // 5 players -> +3 jokers (55 cards = 11 each)
  // 6 players -> +2 jokers (54 cards = 9 each)
  let jokerCount = 0;
  if (playerCount === 3) jokerCount = 2;
  else if (playerCount === 4) jokerCount = 0;
  else if (playerCount === 5) jokerCount = 3;
  else if (playerCount === 6) jokerCount = 2;

  for (let i = 1; i <= jokerCount; i++) {
    deck.push(createCard(SUITS.JOKER, 0, `joker-${i}`));
  }

  return deck;
}

/**
 * Fisher-Yates shuffle
 */
function shuffle(cards) {
  const arr = [...cards];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Find matching cards on the table for a thrown card of rank `targetRank`
 * Matching rule:
 * 1. Single card on table has rank == targetRank
 * 2. Any pair of cards on table (c1, c2) has c1.effectiveRank + c2.effectiveRank == targetRank
 * 
 * Returns { isSafe: boolean, matches: Card[], singleMatches: Card[], pairMatches: Array<[Card, Card]> }
 */
function checkTableMatches(tableCards, playedCard, chosenJokerRank = null) {
  const effectiveRank = playedCard.isJoker ? (chosenJokerRank || playedCard.jokerSubstituteRank || 1) : playedCard.rank;
  
  const singleMatches = [];
  const pairMatches = [];
  const matchedCardIds = new Set();

  // Helper to get card rank on table (if a joker is already on table, use its substitute rank)
  function getCardVal(c) {
    return c.isJoker ? (c.jokerSubstituteRank || 1) : c.rank;
  }

  // 1. Direct single card matches
  for (const card of tableCards) {
    if (getCardVal(card) === effectiveRank) {
      singleMatches.push(card);
      matchedCardIds.add(card.id);
    }
  }

  // 2. Disjoint pairs of cards that sum to effectiveRank
  // We exclude cards already matched in singleMatches
  const availableForPairs = tableCards.filter(c => !matchedCardIds.has(c.id));
  const usedInPairs = new Set();

  for (let i = 0; i < availableForPairs.length; i++) {
    if (usedInPairs.has(availableForPairs[i].id)) continue;
    const v1 = getCardVal(availableForPairs[i]);

    for (let j = i + 1; j < availableForPairs.length; j++) {
      if (usedInPairs.has(availableForPairs[j].id)) continue;
      const v2 = getCardVal(availableForPairs[j]);

      if (v1 + v2 === effectiveRank) {
        pairMatches.push([availableForPairs[i], availableForPairs[j]]);
        usedInPairs.add(availableForPairs[i].id);
        usedInPairs.add(availableForPairs[j].id);
        matchedCardIds.add(availableForPairs[i].id);
        matchedCardIds.add(availableForPairs[j].id);
        break; // pair found for availableForPairs[i]
      }
    }
  }

  const allMatchedCards = tableCards.filter(c => matchedCardIds.has(c.id));
  const isSafe = allMatchedCards.length === 0;

  return {
    isSafe,
    effectiveRank,
    allMatchedCards,
    singleMatches,
    pairMatches
  };
}

/**
 * Calculate total Gadha points for a list of cards
 */
function calculateGadhaPoints(cards) {
  return cards.reduce((sum, c) => sum + (c.isSpade ? c.rank : 0), 0);
}

/**
 * Filter and get all spade cards from a list of cards
 */
function getGadhaCards(cards) {
  return cards.filter(c => c.isSpade);
}

/**
 * Analyze a player's hand against the current table state:
 * Gives for each card in hand:
 * - isSafe: boolean
 * - spadePointsAtRisk: number (if eaten)
 * - cardsToEatCount: number
 */
function analyzeHandSafety(hand, tableCards) {
  return hand.map(card => {
    if (card.isJoker) {
      // For jokers, check if there is at least one safe rank (1..13)
      let safeRank = null;
      let minSpadeRank = 999;
      let bestRank = 1;

      for (let r = 1; r <= 13; r++) {
        const match = checkTableMatches(tableCards, card, r);
        if (match.isSafe) {
          safeRank = r;
          break;
        } else {
          const eatenSpades = calculateGadhaPoints([...match.allMatchedCards, card]);
          if (eatenSpades < minSpadeRank) {
            minSpadeRank = eatenSpades;
            bestRank = r;
          }
        }
      }

      return {
        cardId: card.id,
        isSafe: safeRank !== null,
        recommendedRank: safeRank || bestRank,
        riskPoints: safeRank ? 0 : minSpadeRank,
        isJoker: true
      };
    }

    const match = checkTableMatches(tableCards, card);
    const eatenCards = match.isSafe ? [] : [...match.allMatchedCards, card];
    const riskPoints = calculateGadhaPoints(eatenCards);

    return {
      cardId: card.id,
      isSafe: match.isSafe,
      riskPoints,
      eatenCount: eatenCards.length,
      singleMatchCount: match.singleMatches.length,
      pairMatchCount: match.pairMatches.length
    };
  });
}

/**
 * Smart Bot move selection
 */
function chooseBotMove(botHand, tableCards) {
  const analysis = analyzeHandSafety(botHand, tableCards);

  // 1. Separate safe cards vs eating cards
  const safeCards = analysis.filter(a => a.isSafe);

  if (safeCards.length > 0) {
    // If we have safe cards:
    // Strategy: Play high non-spade cards first to get rid of them safely, or safe spades!
    // Safely playing a spade gets rid of it without taking it into our bank!
    // That's a huge strategic advantage in Gadha: playing your own spade safely discards it to the table!
    const candidateCards = safeCards.map(a => {
      const card = botHand.find(c => c.id === a.cardId);
      return { card, analysis: a };
    });

    // Prioritize safely discarding Spades! Because if you play a spade safely, you don't eat it!
    const safeSpades = candidateCards.filter(c => c.card.isSpade);
    if (safeSpades.length > 0) {
      // Discard highest spade safely
      safeSpades.sort((a, b) => b.card.rank - a.card.rank);
      return {
        card: safeSpades[0].card,
        jokerRank: null
      };
    }

    // Otherwise play non-joker safe card with highest rank
    const nonJokers = candidateCards.filter(c => !c.card.isJoker);
    if (nonJokers.length > 0) {
      nonJokers.sort((a, b) => b.card.rank - a.card.rank);
      return {
        card: nonJokers[0].card,
        jokerRank: null
      };
    }

    // If only safe card is Joker:
    const jokerChoice = candidateCards.find(c => c.card.isJoker);
    if (jokerChoice) {
      return {
        card: jokerChoice.card,
        jokerRank: jokerChoice.analysis.recommendedRank
      };
    }
  }

  // 2. If NO card is safe, we MUST eat:
  // Strategy: Minimize Gadha (spade) points taken!
  const eatingCards = analysis.map(a => {
    const card = botHand.find(c => c.id === a.cardId);
    return { card, analysis: a };
  });

  // Sort by riskPoints ascending (least spade points eaten)
  eatingCards.sort((a, b) => a.analysis.riskPoints - b.analysis.riskPoints);
  const bestChoice = eatingCards[0];

  return {
    card: bestChoice.card,
    jokerRank: bestChoice.card.isJoker ? bestChoice.analysis.recommendedRank : null
  };
}

module.exports = {
  SUITS,
  SUIT_SYMBOLS,
  SUIT_COLORS,
  RANK_LABELS,
  createCard,
  buildDeck,
  shuffle,
  checkTableMatches,
  calculateGadhaPoints,
  getGadhaCards,
  analyzeHandSafety,
  chooseBotMove
};

