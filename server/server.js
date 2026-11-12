const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const {
  buildDeck,
  shuffle,
  checkTableMatches,
  calculateGadhaPoints,
  getGadhaCards,
  analyzeHandSafety,
  chooseBotMove
} = require('./gameEngine');

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(express.json());

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  },
  transports: ['websocket', 'polling']
});

// Port configuration
const PORT = process.env.PORT || 3001;

// Storage for active game rooms
const rooms = new Map();

// Helper to generate 6-character room code
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O, 0, 1, I for clarity
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return rooms.has(code) ? generateRoomCode() : code;
}

// Generate random ID
function generateId(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).substring(2, 9)}_${Date.now().toString(36)}`;
}

// Bot names generator
const BOT_NAMES = [
  'Gadha Master 🫏',
  'Card Ninja 🥷',
  'Lucky Luke 🍀',
  'Royal Bluff 👑',
  'Spade Hunter ♠️',
  'Deck Wizard 🧙‍♂️'
];

/**
 * Sanitize game state for a specific player (hide other players' hands)
 */
function getSanitizedGameState(room, requestingPlayerId) {
  const playersSummary = room.players.map(p => {
    const gadhaCardsInBank = getGadhaCards(p.bank);
    const gadhaScore = calculateGadhaPoints(p.bank);

    const base = {
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isBot: p.isBot,
      avatar: p.avatar,
      connected: p.connected,
      socketId: p.isBot ? null : p.socketId,  // expose socketId for WebRTC peer mapping
      cardCount: p.hand.length,
      bankCount: p.bank.length,
      gadhaPoints: gadhaScore,
      gadhaCardsCount: gadhaCardsInBank.length
    };

    // If this is the requesting player, give them their full hand and their eaten bank
    if (p.id === requestingPlayerId) {
      base.hand = p.hand;
      base.bank = p.bank;
    }

    return base;
  });

  return {
    roomCode: room.roomCode,
    status: room.status,
    table: room.table,
    players: playersSummary,
    currentTurnPlayerId: room.currentTurnPlayerId,
    turnIndex: room.turnIndex,
    lastAction: room.lastAction,
    history: room.history.slice(-15),
    chatHistory: (room.chatHistory || []).slice(-60),
    gameResults: room.gameResults,
    createdAt: room.createdAt
  };
}

/**
 * Broadcast sanitized state to all connected players in room
 */
function broadcastRoomState(room) {
  for (const player of room.players) {
    if (player.socketId) {
      const sanitized = getSanitizedGameState(room, player.id);
      io.to(player.socketId).emit('game_state_update', sanitized);
    }
  }
}

/**
 * Start game and deal cards equally
 */
function startGame(room) {
  const playerCount = room.players.length;
  if (playerCount < 3 || playerCount > 6) {
    return { error: 'Game requires 3 to 6 players to start.' };
  }

  const deck = shuffle(buildDeck(playerCount));
  const cardsPerPlayer = Math.floor(deck.length / playerCount);

  // Deal cards equally
  room.players.forEach((p, idx) => {
    p.hand = deck.slice(idx * cardsPerPlayer, (idx + 1) * cardsPerPlayer);
    p.bank = [];
  });

  room.table = [];
  room.status = 'playing';
  room.turnIndex = 0;
  room.currentTurnPlayerId = room.players[0].id;
  room.history = [];
  room.gameResults = null;
  room.lastAction = {
    type: 'game_started',
    message: `Game started with ${playerCount} players! Each player dealt ${cardsPerPlayer} cards.`,
    timestamp: Date.now()
  };

  broadcastRoomState(room);

  // If first player is a bot, schedule bot turn
  checkAndTriggerBotTurn(room);

  return { success: true };
}

/**
 * Play a card from a player's hand
 */
function playCard(room, playerId, cardId, chosenJokerRank = null) {
  if (room.status !== 'playing') {
    return { error: 'Game is not currently active.' };
  }

  if (room.currentTurnPlayerId !== playerId) {
    return { error: "It is not your turn!" };
  }

  const player = room.players.find(p => p.id === playerId);
  if (!player) return { error: 'Player not found.' };

  const cardIndex = player.hand.findIndex(c => c.id === cardId);
  if (cardIndex === -1) return { error: 'Card not found in hand.' };

  const [card] = player.hand.splice(cardIndex, 1);
  if (card.isJoker) {
    card.jokerSubstituteRank = chosenJokerRank || 1;
  }

  // Check matching rules against table
  const matchResult = checkTableMatches(room.table, card, chosenJokerRank);

  let actionDetails;

  if (matchResult.isSafe) {
    // SAFE: Card is added to the table
    room.table.push(card);
    actionDetails = {
      type: 'safe',
      playerId: player.id,
      playerName: player.name,
      card,
      message: `${player.name} played ${card.name}. Safe! Card added to table.`,
      eatenCards: [],
      pointsGained: 0,
      timestamp: Date.now()
    };
  } else {
    // EATEN: Card matched single card or pair sum!
    const matchedCards = matchResult.allMatchedCards;
    const matchedCardIds = new Set(matchedCards.map(c => c.id));

    // Remove eaten cards from table
    room.table = room.table.filter(c => !matchedCardIds.has(c.id));

    // Player takes matched cards + their played card into their bank
    const totalEaten = [...matchedCards, card];
    player.bank.push(...totalEaten);

    const spadeCards = getGadhaCards(totalEaten);
    const pointsGained = calculateGadhaPoints(totalEaten);

    let reasonMsg = '';
    if (matchResult.singleMatches.length > 0) {
      reasonMsg += `matched ${matchResult.singleMatches.map(c => c.label).join(', ')}`;
    }
    if (matchResult.pairMatches.length > 0) {
      if (reasonMsg) reasonMsg += ' and ';
      reasonMsg += `pair sum: ${matchResult.pairMatches.map(p => `${p[0].label}+${p[1].label}=${matchResult.effectiveRank}`).join(', ')}`;
    }

    actionDetails = {
      type: 'eat',
      playerId: player.id,
      playerName: player.name,
      card,
      eatenCards: totalEaten,
      pointsGained,
      spadeCardsCount: spadeCards.length,
      reason: reasonMsg,
      message: `${player.name} played ${card.name} (${reasonMsg}) and ATE ${totalEaten.length} cards! (+${pointsGained} Gadha points)`,
      timestamp: Date.now()
    };
  }

  room.lastAction = actionDetails;
  room.history.push(actionDetails);

  // Check if game has ended (all players have no cards in hand)
  const remainingHandCards = room.players.reduce((sum, p) => sum + p.hand.length, 0);

  if (remainingHandCards === 0) {
    finishGame(room);
  } else {
    // Advance turn to next player who still has cards
    advanceTurn(room);
  }

  broadcastRoomState(room);

  // If next player is bot and game still playing, trigger bot move
  if (room.status === 'playing') {
    checkAndTriggerBotTurn(room);
  }

  return { success: true };
}

/**
 * Advance turn clockwise to the next player with cards
 */
function advanceTurn(room) {
  const numPlayers = room.players.length;
  let nextIdx = (room.turnIndex + 1) % numPlayers;

  // Search for the next player who has cards
  let attempts = 0;
  while (room.players[nextIdx].hand.length === 0 && attempts < numPlayers) {
    nextIdx = (nextIdx + 1) % numPlayers;
    attempts++;
  }

  room.turnIndex = nextIdx;
  room.currentTurnPlayerId = room.players[nextIdx].id;
}

/**
 * Compute final game results
 */
function finishGame(room) {
  room.status = 'finished';

  const results = room.players.map(p => {
    const spadeCards = getGadhaCards(p.bank);
    const score = calculateGadhaPoints(p.bank);
    return {
      playerId: p.id,
      name: p.name,
      avatar: p.avatar,
      isBot: p.isBot,
      gadhaPoints: score,
      spadeCards: spadeCards.map(c => ({
        id: c.id,
        name: c.name,
        rank: c.rank,
        label: c.label
      })),
      totalEatenCards: p.bank.length
    };
  });

  // Rank players: lowest points first (best), highest points last (International Gadha)
  results.sort((a, b) => a.gadhaPoints - b.gadhaPoints);

  const maxPoints = Math.max(...results.map(r => r.gadhaPoints));
  const minPoints = Math.min(...results.map(r => r.gadhaPoints));

  // Determine losers (International Gadha) and winners
  const gadhas = results.filter(r => r.gadhaPoints === maxPoints);
  const winners = results.filter(r => r.gadhaPoints === minPoints);

  room.gameResults = {
    standings: results,
    internationalGadhas: gadhas,
    winners: winners,
    finishedAt: Date.now()
  };

  room.lastAction = {
    type: 'game_over',
    message: `Game over! The INTERNATIONAL GADHA is ${gadhas.map(g => g.name).join(' & ')} with ${maxPoints} Gadha points! 🫏`,
    timestamp: Date.now()
  };
}

/**
 * Check if the active turn belongs to a bot and trigger AI move
 */
function checkAndTriggerBotTurn(room) {
  if (!room || room.status !== 'playing') return;
  const currentPlayer = room.players.find(p => p.id === room.currentTurnPlayerId);
  if (!currentPlayer || !currentPlayer.isBot || currentPlayer.hand.length === 0) {
    return;
  }

  // Clear any existing timer to prevent race conditions
  if (room.botTurnTimer) {
    clearTimeout(room.botTurnTimer);
    room.botTurnTimer = null;
  }

  const turnPlayerId = currentPlayer.id;
  room.botTurnTimer = setTimeout(() => {
    room.botTurnTimer = null;
    try {
      if (room.status !== 'playing' || room.currentTurnPlayerId !== turnPlayerId) {
        return;
      }

      const bot = room.players.find(p => p.id === turnPlayerId);
      if (!bot || !bot.isBot || bot.hand.length === 0) return;

      let botMove = null;
      try {
        botMove = chooseBotMove(bot.hand, room.table);
      } catch (err) {
        console.error('Bot AI error in chooseBotMove:', err);
      }

      if (botMove && botMove.card) {
        playCard(room, bot.id, botMove.card.id, botMove.jokerRank);
      } else if (bot.hand.length > 0) {
        // Fallback safety move so game never gets stuck
        playCard(room, bot.id, bot.hand[0].id, bot.hand[0].isJoker ? 1 : null);
      }
    } catch (e) {
      console.error('Error executing bot move:', e);
    }
  }, 1100);
}

// ---------------- Socket.IO Event Handlers ----------------

io.on('connection', (socket) => {
  let boundRoomCode = null;
  let boundPlayerId = null;

  // 1. Create Room
  socket.on('create_room', ({ playerName, avatar }, callback) => {
    const roomCode = generateRoomCode();
    const playerId = generateId('p');
    const sessionToken = generateId('token');

    const newRoom = {
      roomCode,
      createdAt: Date.now(),
      status: 'waiting',
      players: [
        {
          id: playerId,
          sessionToken,
          name: (playerName || 'Player 1').trim().substring(0, 15),
          avatar: avatar || '🤠',
          isHost: true,
          isBot: false,
          connected: true,
          socketId: socket.id,
          hand: [],
          bank: []
        }
      ],
      table: [],
      currentTurnPlayerId: null,
      turnIndex: 0,
      history: [],
      chatHistory: [],
      lastAction: null,
      gameResults: null
    };

    rooms.set(roomCode, newRoom);
    socket.join(roomCode);
    boundRoomCode = roomCode;
    boundPlayerId = playerId;

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode,
        playerId,
        sessionToken,
        gameState: getSanitizedGameState(newRoom, playerId)
      });
    }

    broadcastRoomState(newRoom);
  });

  // 2. Join Room
  socket.on('join_room', ({ roomCode, playerName, avatar }, callback) => {
    const normalizedCode = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);

    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found! Check your code.' });
      return;
    }

    if (room.status !== 'waiting') {
      if (typeof callback === 'function') callback({ error: 'Game is already in progress or completed.' });
      return;
    }

    if (room.players.length >= 6) {
      if (typeof callback === 'function') callback({ error: 'Room is full (maximum 6 players).' });
      return;
    }

    const playerId = generateId('p');
    const sessionToken = generateId('token');
    const newPlayer = {
      id: playerId,
      sessionToken,
      name: (playerName || `Player ${room.players.length + 1}`).trim().substring(0, 15),
      avatar: avatar || '😎',
      isHost: false,
      isBot: false,
      connected: true,
      socketId: socket.id,
      hand: [],
      bank: []
    };

    room.players.push(newPlayer);
    socket.join(normalizedCode);
    boundRoomCode = normalizedCode;
    boundPlayerId = playerId;

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode: normalizedCode,
        playerId,
        sessionToken,
        gameState: getSanitizedGameState(room, playerId)
      });
    }

    broadcastRoomState(room);
  });

  // 3. Persistent Session Reconnect (Handles back button, refresh, reconnection)
  socket.on('reconnect_session', ({ roomCode, playerId, sessionToken }, callback) => {
    const normalizedCode = (roomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);

    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room expired or not found.' });
      return;
    }

    const player = room.players.find(p => p.id === playerId && p.sessionToken === sessionToken);
    if (!player) {
      if (typeof callback === 'function') callback({ error: 'Invalid session credentials.' });
      return;
    }

    // Reattach socket
    player.socketId = socket.id;
    player.connected = true;
    socket.join(normalizedCode);
    boundRoomCode = normalizedCode;
    boundPlayerId = playerId;

    if (typeof callback === 'function') {
      callback({
        success: true,
        roomCode: normalizedCode,
        playerId,
        gameState: getSanitizedGameState(room, playerId)
      });
    }

    broadcastRoomState(room);

    // If game is playing and it's a bot's turn, make sure bot logic resumes
    if (room.status === 'playing') {
      checkAndTriggerBotTurn(room);
    }
  });

  // 4. Add Bot Player
  socket.on('add_bot', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    if (room.status !== 'waiting') {
      if (typeof callback === 'function') callback({ error: 'Cannot add bot while game is in progress.' });
      return;
    }

    if (room.players.length >= 6) {
      if (typeof callback === 'function') callback({ error: 'Maximum 6 players allowed.' });
      return;
    }

    const botId = generateId('bot');
    const botIndex = room.players.filter(p => p.isBot).length;
    const botName = BOT_NAMES[botIndex % BOT_NAMES.length];

    const botPlayer = {
      id: botId,
      sessionToken: generateId('bottoken'),
      name: botName,
      avatar: '🤖',
      isHost: false,
      isBot: true,
      connected: true,
      socketId: null,
      hand: [],
      bank: []
    };

    room.players.push(botPlayer);
    if (typeof callback === 'function') callback({ success: true });
    broadcastRoomState(room);
  });

  // 5. Remove Bot or Player (Host only)
  socket.on('remove_player', ({ roomCode, targetPlayerId }, callback) => {
    const room = rooms.get(roomCode);
    if (!room || room.status !== 'waiting') return;

    const caller = room.players.find(p => p.socketId === socket.id);
    if (!caller || !caller.isHost) {
      if (typeof callback === 'function') callback({ error: 'Only the host can remove players.' });
      return;
    }

    room.players = room.players.filter(p => p.id !== targetPlayerId);
    if (typeof callback === 'function') callback({ success: true });
    broadcastRoomState(room);
  });

  // 6. Start Game (Host only)
  socket.on('start_game', ({ roomCode }, callback) => {
    const room = rooms.get(roomCode);
    if (!room) return;

    const caller = room.players.find(p => p.socketId === socket.id);
    if (!caller || !caller.isHost) {
      if (typeof callback === 'function') callback({ error: 'Only the room host can start the game.' });
      return;
    }

    const res = startGame(room);
    if (res.error) {
      if (typeof callback === 'function') callback({ error: res.error });
      return;
    }

    if (typeof callback === 'function') callback({ success: true });
  });

  // 7. Play Card
  socket.on('play_card', ({ roomCode, playerId, cardId, chosenJokerRank }, callback) => {
    const normalizedCode = (roomCode || boundRoomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found.' });
      return;
    }

    const player = room.players.find(p => (playerId && p.id === playerId) || p.socketId === socket.id || p.id === boundPlayerId);
    if (!player) {
      if (typeof callback === 'function') callback({ error: 'Player session not found.' });
      return;
    }

    if (player.socketId !== socket.id) {
      player.socketId = socket.id;
      player.connected = true;
      socket.join(normalizedCode);
      boundRoomCode = normalizedCode;
      boundPlayerId = player.id;
    }

    const result = playCard(room, player.id, cardId, chosenJokerRank);
    if (result.error) {
      if (typeof callback === 'function') callback({ error: result.error });
      return;
    }

    if (typeof callback === 'function') callback({ success: true });
  });

  // 8. Re-order Hand (Persist user-sorted hand)
  socket.on('sort_hand', ({ roomCode, playerId, newHandOrder }) => {
    const normalizedCode = (roomCode || boundRoomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);
    if (!room) return;

    const player = room.players.find(p => (playerId && p.id === playerId) || p.socketId === socket.id || p.id === boundPlayerId);
    if (!player || !Array.isArray(newHandOrder)) return;

    if (player.socketId !== socket.id) {
      player.socketId = socket.id;
      player.connected = true;
      socket.join(normalizedCode);
      boundRoomCode = normalizedCode;
      boundPlayerId = player.id;
    }

    // Reorder player's hand according to IDs sent
    const cardMap = new Map(player.hand.map(c => [c.id, c]));
    const reordered = [];
    for (const id of newHandOrder) {
      if (cardMap.has(id)) {
        reordered.push(cardMap.get(id));
      }
    }

    if (reordered.length === player.hand.length) {
      player.hand = reordered;
      socket.emit('game_state_update', getSanitizedGameState(room, player.id));
    }
  });

  // 9. Restart Game / Play Again
  socket.on('restart_game', ({ roomCode, playerId }, callback) => {
    const normalizedCode = (roomCode || boundRoomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found.' });
      return;
    }

    const caller = room.players.find(p => (playerId && p.id === playerId) || p.socketId === socket.id || p.id === boundPlayerId);
    if (!caller || !caller.isHost) {
      if (typeof callback === 'function') callback({ error: 'Only host can restart the game.' });
      return;
    }

    room.status = 'waiting';
    room.table = [];
    room.history = [];
    room.gameResults = null;
    room.lastAction = null;
    room.players.forEach(p => {
      p.hand = [];
      p.bank = [];
    });

    if (typeof callback === 'function') callback({ success: true });
    broadcastRoomState(room);
  });

  // 10. Chat / Reaction
  socket.on('send_chat', ({ roomCode, playerId, message, reaction }, callback) => {
    const normalizedCode = (roomCode || boundRoomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);
    if (!room) {
      if (typeof callback === 'function') callback({ error: 'Room not found.' });
      return;
    }

    const player = room.players.find(p => (playerId && p.id === playerId) || p.socketId === socket.id || p.id === boundPlayerId);
    if (!player) {
      if (typeof callback === 'function') callback({ error: 'Player not found in room.' });
      return;
    }

    if (player.socketId !== socket.id) {
      player.socketId = socket.id;
      player.connected = true;
      socket.join(normalizedCode);
      boundRoomCode = normalizedCode;
      boundPlayerId = player.id;
    }

    const chatItem = {
      id: generateId('chat'),
      senderId: player.id,
      senderName: player.name,
      message: message ? message.substring(0, 100) : '',
      reaction: reaction || null,
      timestamp: Date.now()
    };

    if (!room.chatHistory) {
      room.chatHistory = [];
    }
    room.chatHistory.push(chatItem);
    if (room.chatHistory.length > 100) {
      room.chatHistory.shift();
    }

    io.to(normalizedCode).emit('chat_received', chatItem);
    if (typeof callback === 'function') callback({ success: true, chatItem });
  });

  // 11. WebRTC Signaling relay (peer-to-peer video/audio)
  socket.on('webrtc_offer', ({ toSocketId, offer }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_offer', { fromSocketId: socket.id, offer });
    }
  });

  socket.on('webrtc_answer', ({ toSocketId, answer }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_answer', { fromSocketId: socket.id, answer });
    }
  });

  socket.on('webrtc_ice_candidate', ({ toSocketId, candidate }) => {
    if (toSocketId) {
      io.to(toSocketId).emit('webrtc_ice_candidate', { fromSocketId: socket.id, candidate });
    }
  });

  socket.on('webrtc_ready', ({ roomCode: rc }) => {
    socket.to(rc).emit('webrtc_peer_joined', { socketId: socket.id });
  });

  socket.on('webrtc_leave', ({ roomCode: rc }) => {
    socket.to(rc).emit('webrtc_peer_left', { socketId: socket.id });
  });

  socket.on('webrtc_mute_state', ({ roomCode: rc, micOn, camOn }) => {
    socket.to(rc).emit('webrtc_peer_mute_state', { socketId: socket.id, micOn, camOn });
  });

  // 12. Host manually ends game
  socket.on('end_game', ({ roomCode, playerId }, callback) => {
    const normalizedCode = (roomCode || boundRoomCode || '').toUpperCase().trim();
    const room = rooms.get(normalizedCode);
    if (!room) return callback && callback({ error: 'Room not found' });

    const caller = room.players.find(p => (playerId && p.id === playerId) || p.socketId === socket.id || p.id === boundPlayerId);
    if (!caller || !caller.isHost) {
      return callback && callback({ error: 'Only the room host can end the game' });
    }

    if (room.status === 'playing') {
      finishGame(room);
      room.lastAction = {
        type: 'game_ended_by_host',
        message: `${caller.name} (Host) ended the game!`,
        timestamp: Date.now()
      };
      broadcastRoomState(room);
    }
    if (callback) callback({ success: true });
  });

  // 13. Disconnect handling (Keep session persistent!)
  socket.on('disconnect', () => {
    if (boundRoomCode && boundPlayerId) {
      const room = rooms.get(boundRoomCode);
      if (room) {
        const player = room.players.find(p => p.id === boundPlayerId);
        if (player) {
          player.connected = false;
          player.socketId = null;
          broadcastRoomState(room);
        }
      }
    }
  });
});

// Serve frontend build in production
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', activeRooms: rooms.size, timestamp: Date.now() });
});

// For any route not found, return index.html (SPA support)
app.use((req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'), (err) => {
    if (err) {
      res.send('International Gadha Server is running. Client build in progress...');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🃏 International Gadha Server running on http://localhost:${PORT}`);
});
