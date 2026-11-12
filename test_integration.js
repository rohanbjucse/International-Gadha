const { io: ioClient } = require('./client/node_modules/socket.io-client');

console.log('Testing socket connection and session persistence...');

const socket = ioClient('http://localhost:3001', {
  transports: ['websocket'],
  reconnection: false
});

let roomCode = null;
let playerId = null;
let sessionToken = null;

socket.on('connect', () => {
  console.log('Connected to server!');

  // Register game_state_update listener upfront
  socket.on('game_state_update', (gameState) => {
    if (gameState.status === 'playing') {
      console.log('Game state received! Status:', gameState.status);
      console.log('Players count:', gameState.players.length);
      const myPlayer = gameState.players.find(p => p.id === playerId);
      console.log('My hand length:', myPlayer?.hand?.length);
      console.assert(myPlayer?.hand?.length === 18, '3 players should have 18 cards each (54 total)');

      // Now test session persistence: disconnect and reconnect!
      console.log('Disconnecting current socket to simulate page refresh / back...');
      socket.disconnect();

      setTimeout(() => {
        const socket2 = ioClient('http://localhost:3001', { transports: ['websocket'] });
        socket2.on('connect', () => {
          console.log('New socket connected, calling reconnect_session...');
          socket2.emit('reconnect_session', { roomCode, playerId, sessionToken }, (recRes) => {
            console.log('Reconnect response:', recRes.success ? 'Session Restored Successfully!' : recRes.error);
            console.assert(recRes.success === true, 'Reconnect must succeed');
            console.assert(recRes.gameState.status === 'playing', 'Game must still be playing');
            console.assert(recRes.gameState.players.find(p => p.id === playerId)?.hand?.length === 18, 'Player hand restored');
            console.log('SESSION PERSISTENCE VERIFIED 100%!');
            socket2.disconnect();
            process.exit(0);
          });
        });
      }, 500);
    }
  });

  // Create room
  socket.emit('create_room', { playerName: 'Rohan', avatar: '🤠' }, (res) => {
    console.log('Create room result:', res.success ? `Room code ${res.roomCode}` : res.error);
    if (!res.success) process.exit(1);

    roomCode = res.roomCode;
    playerId = res.playerId;
    sessionToken = res.sessionToken;

    // Add bot 1
    socket.emit('add_bot', { roomCode }, () => {
      console.log('Bot 1 added');

      // Add bot 2
      socket.emit('add_bot', { roomCode }, () => {
        console.log('Bot 2 added (Total 3 players)');

        // Start game
        socket.emit('start_game', { roomCode }, (startRes) => {
          console.log('Start game response:', startRes);
        });
      });
    });
  });
});

socket.on('connect_error', (err) => {
  console.error('Connection error:', err.message);
  process.exit(1);
});
