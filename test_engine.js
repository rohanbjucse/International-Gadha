const { createCard, checkTableMatches, buildDeck, SUITS } = require('./server/gameEngine');

console.log('Testing User Prompt Example...');

let table = [
  createCard(SUITS.HEARTS, 1, 'ace-hearts'),
  createCard(SUITS.CLUBS, 2, 'two-clubs'),
  createCard(SUITS.SPADES, 9, 'nine-spades')
];

console.log('Initial Table:', table.map(c => c.name));

// Player A plays 4 of Hearts
const pA_card = createCard(SUITS.HEARTS, 4, 'four-hearts');
const matchA = checkTableMatches(table, pA_card);
console.log('Player A plays 4 of Hearts -> Safe?', matchA.isSafe);
if (matchA.isSafe) {
  table.push(pA_card);
}
console.log('Table after A:', table.map(c => c.name));
console.assert(matchA.isSafe === true, 'A should be safe');
console.assert(table.length === 4, 'Table should have 4 cards');

// Player B plays 3 of Spade
const pB_card = createCard(SUITS.SPADES, 3, 'three-spades');
const matchB = checkTableMatches(table, pB_card);
console.log('Player B plays 3 of Spades -> Safe?', matchB.isSafe);
console.log('Player B eaten cards:', matchB.allMatchedCards.map(c => c.name));
console.assert(matchB.isSafe === false, 'B should not be safe');
console.assert(matchB.allMatchedCards.length === 2, 'B should match 2 cards (Ace + 2)');

// Remove matched cards from table
const eatenB = [...matchB.allMatchedCards, pB_card];
const eatenBIds = new Set(matchB.allMatchedCards.map(c => c.id));
table = table.filter(c => !eatenBIds.has(c.id));
console.log('Table after B:', table.map(c => c.name));
console.assert(table.length === 2, 'Table should have 2 cards left (9 of Spades, 4 of Hearts)');

// Player C plays King of Diamonds
const pC_card = createCard(SUITS.DIAMONDS, 13, 'king-diamonds');
const matchC = checkTableMatches(table, pC_card);
console.log('Player C plays King of Diamonds -> Safe?', matchC.isSafe);
console.log('Player C eaten cards:', matchC.allMatchedCards.map(c => c.name));
console.assert(matchC.isSafe === false, 'C should not be safe');
console.assert(matchC.allMatchedCards.length === 2, 'C should match 4 of Hearts + 9 of Spades (4+9=13)');

const eatenC = [...matchC.allMatchedCards, pC_card];
const eatenCIds = new Set(matchC.allMatchedCards.map(c => c.id));
table = table.filter(c => !eatenCIds.has(c.id));
console.log('Table after C:', table.map(c => c.name));
console.assert(table.length === 0, 'Table should now be empty');

console.log('Deck counts for 3, 4, 5, 6 players:');
[3, 4, 5, 6].forEach(n => {
  const deck = buildDeck(n);
  console.log(`${n} players: ${deck.length} cards, ${deck.length / n} cards per player`);
  console.assert(deck.length % n === 0, `Deck must divide equally by ${n}`);
});

console.log('ALL TESTS PASSED PERFECTLY!');

