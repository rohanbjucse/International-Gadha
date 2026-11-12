const { io: ioClient } = require('./client/node_modules/socket.io-client');

console.log('Testing full gameplay turn flow & Bot response...');

const socket = ioClient('http://localhost:3001', {
  transports: ['websocket'],
  reconnection: false
});

socket.on('connect', () => {
  socket.emit('create_room', { playerName: 'Rohan', avatar: '🤠' }, (res) => {
    const roomCode = res.roomCode;
    const playerId = res.playerId;

    socket.emit('add_bot', { roomCode }, () => {
      socket.emit('add_bot', { roomCode }, () => {
        let gameStarted = false;

        socket.on('game_state_update', (state) => {
          if (state.status === 'playing' && !gameStarted) {
            gameStarted = true;
            console.log('Game started! Table cards:', state.table.length);
            console.log('Current turn player:', state.currentTurnPlayerId);

            const me = state.players.find(p => p.id === playerId);
            console.log('My cards available:', me.hand.length);

            // Play the first card from my hand
            const cardToPlay = me.hand[0];
            console.log(`Playing card: ${cardToPlay.name} (rank ${cardToPlay.rank}, isSpade: ${cardToPlay.isSpade})`);

            socket.emit('play_card', {
              roomCode,
              cardId: cardToPlay.id,
              chosenJokerRank: cardToPlay.isJoker ? 1 : null
            }, (playRes) => {
              console.log('Play card response:', playRes);
            });
          } else if (gameStarted && state.lastAction) {
            console.log('Action recorded:', state.lastAction.message);
            console.log('Table cards now:', state.table.length);

            // Wait for next action (from bot)
            if (state.lastAction.playerId !== playerId) {
              console.log('Bot successfully took its turn!');
              console.log('TEST GAMEPLAY COMPLETED WITH FLYING COLORS!');
              socket.disconnect();
              process.exit(0);
            }
          }
        });

        socket.emit('start_game', { roomCode });
      });
    });
  });
});

