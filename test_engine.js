const assert = require('node:assert/strict');
const {
  createCard,
  checkTableMatches,
  buildDeck,
  calculateGadhaPoints,
  isValidJokerRank,
  SUITS
} = require('./server/gameEngine');

function card(suit, rank, id) {
  return createCard(suit, rank, id);
}

for (const [playerCount, expectedDeckSize] of [[3, 54], [4, 52], [5, 55], [6, 54]]) {
  const deck = buildDeck(playerCount);
  assert.equal(deck.length, expectedDeckSize, `${playerCount}-player deck size`);
  assert.equal(deck.length % playerCount, 0, `${playerCount}-player deal is equal`);
  assert.equal(new Set(deck.map((item) => item.id)).size, deck.length, 'card IDs are unique');
}

const table = [
  card(SUITS.HEARTS, 1, 'ace-hearts'),
  card(SUITS.CLUBS, 2, 'two-clubs'),
  card(SUITS.SPADES, 9, 'nine-spades')
];

const safeMove = checkTableMatches(table, card(SUITS.HEARTS, 4, 'played-four'));
assert.equal(safeMove.isSafe, true, '4 is safe on the initial table');

const pairCapture = checkTableMatches(
  [...table, card(SUITS.HEARTS, 4, 'four-hearts')],
  card(SUITS.SPADES, 3, 'played-three')
);
assert.deepEqual(
  new Set(pairCapture.allMatchedCards.map((item) => item.id)),
  new Set(['ace-hearts', 'two-clubs']),
  'rank-independent pair sums capture both cards'
);

const kingCapture = checkTableMatches(
  [card(SUITS.SPADES, 9, 'nine-spades'), card(SUITS.HEARTS, 4, 'four-hearts')],
  card(SUITS.DIAMONDS, 13, 'played-king')
);
assert.deepEqual(
  new Set(kingCapture.allMatchedCards.map((item) => item.id)),
  new Set(['nine-spades', 'four-hearts']),
  '13 captures 9 + 4'
);

const overlappingPairs = checkTableMatches(
  [
    card(SUITS.HEARTS, 2, 'two-hearts'),
    card(SUITS.CLUBS, 2, 'two-clubs'),
    card(SUITS.DIAMONDS, 2, 'two-diamonds')
  ],
  card(SUITS.HEARTS, 4, 'played-four')
);
assert.equal(overlappingPairs.pairMatches.length, 3, 'all matching pairs are reported');
assert.equal(overlappingPairs.allMatchedCards.length, 3, 'overlapping pairs capture each card once');

const duplicateSingles = checkTableMatches(
  [card(SUITS.HEARTS, 7, 'seven-hearts'), card(SUITS.CLUBS, 7, 'seven-clubs')],
  card(SUITS.DIAMONDS, 7, 'played-seven')
);
assert.equal(duplicateSingles.allMatchedCards.length, 2, 'all direct rank matches are captured');

const jokerCapture = checkTableMatches(
  [card(SUITS.HEARTS, 2, 'two-hearts'), card(SUITS.CLUBS, 3, 'three-clubs')],
  card(SUITS.JOKER, 0, 'joker'),
  5
);
assert.equal(jokerCapture.effectiveRank, 5);
assert.equal(jokerCapture.allMatchedCards.length, 2, 'joker choice matches pair sum');
assert.equal(isValidJokerRank(1), true);
assert.equal(isValidJokerRank(13), true);
assert.equal(isValidJokerRank(0), false);
assert.equal(isValidJokerRank(14), false);
assert.equal(isValidJokerRank(5.5), false);
assert.equal(isValidJokerRank('5'), false);

assert.equal(
  calculateGadhaPoints([
    card(SUITS.SPADES, 1, 'ace-spades'),
    card(SUITS.SPADES, 13, 'king-spades'),
    card(SUITS.HEARTS, 12, 'queen-hearts'),
    card(SUITS.JOKER, 0, 'zero-point-joker')
  ]),
  14,
  'only spades contribute Gadha points'
);

console.log('Game engine tests passed.');
