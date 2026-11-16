const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const net = require('node:net');
const { io: ioClient } = require('./client/node_modules/socket.io-client');

const sockets = new Set();
const serverOutput = [];
let serverProcess;

function getFreePort() {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(error => error ? reject(error) : resolve(port));
    });
  });
}

function connectSocket(url) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      transports: ['websocket'],
      reconnection: false,
      timeout: 3000
    });
    sockets.add(socket);

    const timer = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Socket connection timed out.'));
    }, 5000);

    socket.once('connect', () => {
      clearTimeout(timer);
      resolve(socket);
    });
    socket.once('connect_error', error => {
      clearTimeout(timer);
      reject(error);
    });
  });
}

function request(socket, eventName, payload) {
  return new Promise((resolve, reject) => {
    socket.timeout(4000).emit(eventName, payload, (timeoutError, response) => {
      if (timeoutError) {
        reject(new Error(`${eventName} acknowledgement timed out.`));
      } else {
        resolve(response);
      }
    });
  });
}

function waitForServer(url) {
  return new Promise((resolve, reject) => {
    const deadline = Date.now() + 10000;
    const poll = async () => {
      try {
        const response = await fetch(`${url}/api/health`);
        if (response.ok) {
          resolve();
          return;
        }
      } catch {
        // The server may not have bound its port yet.
      }

      if (Date.now() >= deadline) {
        reject(new Error(`Server did not start. ${serverOutput.join('')}`));
        return;
      }
      setTimeout(poll, 100);
    };
    poll();
  });
}

function createStateTracker(socket, initialState = null) {
  let latestState = initialState;
  const listeners = new Set();
  socket.on('game_state_update', state => {
    latestState = state;
    listeners.forEach(listener => listener(state));
  });

  return {
    get latest() {
      return latestState;
    },
    waitFor(predicate, timeoutMs = 5000) {
      if (latestState && predicate(latestState)) return Promise.resolve(latestState);
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          listeners.delete(onState);
          reject(new Error('Timed out waiting for expected game state.'));
        }, timeoutMs);

        function onState(state) {
          if (!predicate(state)) return;
          clearTimeout(timer);
          listeners.delete(onState);
          resolve(state);
        }

        listeners.add(onState);
      });
    }
  };
}

function attachAutoPlayer(socket, roomCode, playerId, getEnabled) {
  let moveInFlight = false;
  let moveError = null;
  const acknowledgedActions = new Set();
  function playForState(state) {
    if (!getEnabled() || state.status !== 'playing') return;
    if (state.turnResolutionPending && state.pendingActionId) {
      if (acknowledgedActions.has(state.pendingActionId)) return;
      acknowledgedActions.add(state.pendingActionId);
      request(socket, 'turn_animation_complete', {
        roomCode,
        actionId: state.pendingActionId
      }).then(result => {
        if (!result?.success) moveError = new Error(result?.error || 'Animation acknowledgement failed.');
      }).catch(error => { moveError = error; });
      return;
    }
    if (moveInFlight) return;
    if (state.currentTurnPlayerId !== playerId) return;

    const player = state.players.find(item => item.id === playerId);
    const card = player?.hand?.[0];
    if (!card) return;

    moveInFlight = true;
    const payload = {
      roomCode,
      cardId: card.id,
      chosenJokerRank: card.isJoker ? 1 : null
    };
    request(socket, 'play_card', payload)
      .then(result => {
        if (!result?.success) moveError = new Error(result?.error || 'Automated player move failed.');
      })
      .catch(error => { moveError = error; })
      .finally(() => { moveInFlight = false; });
  }
  socket.on('game_state_update', playForState);
  return {
    getError: () => moveError,
    playForState
  };
}

function waitForFinished(tracker, timeoutMs = 20000) {
  return tracker.waitFor(state => state.status === 'finished', timeoutMs);
}

async function testBotWaitsForAnimation(url) {
  const socket = await connectSocket(url);
  const tracker = createStateTracker(socket);
  const created = await request(socket, 'create_room', { playerName: 'Turn Pacing Test' });
  assert.equal(created?.success, true, 'pacing test room creation succeeds');

  for (let i = 0; i < 2; i++) {
    const added = await request(socket, 'add_bot', { roomCode: created.roomCode });
    assert.equal(added?.success, true, 'pacing test adds both bots');
  }

  assert.equal(
    (await request(socket, 'start_game', { roomCode: created.roomCode })).success,
    true,
    'pacing test game starts'
  );
  const initialState = await tracker.waitFor(state => state.status === 'playing');
  const host = initialState.players.find(player => player.id === created.playerId);
  const card = host.hand[0];
  assert.equal(
    (await request(socket, 'play_card', {
      roomCode: created.roomCode,
      cardId: card.id,
      chosenJokerRank: card.isJoker ? 1 : null
    })).success,
    true,
    'human turn is accepted'
  );

  const pendingState = await tracker.waitFor(state => state.turnResolutionPending);
  assert.equal(pendingState.currentTurnPlayerId, created.playerId, 'turn remains with the player while resolving');
  assert.ok(pendingState.pendingActionId, 'pending action has an acknowledgement ID');
  await new Promise(resolve => setTimeout(resolve, 80));
  assert.equal(tracker.latest.history.length, 1, 'bot does not play before animation acknowledgement');
  assert.equal(tracker.latest.currentTurnPlayerId, created.playerId, 'turn does not advance before acknowledgement');

  const acknowledged = await request(socket, 'turn_animation_complete', {
    roomCode: created.roomCode,
    actionId: pendingState.pendingActionId
  });
  assert.equal(acknowledged?.success, true, 'animation acknowledgement is accepted');
  const botState = await tracker.waitFor(state => state.history.length === 2);
  const botAction = botState.history[1];
  assert.equal(
    botState.players.find(player => player.id === botAction.playerId)?.isBot,
    true,
    'bot takes its turn after the animation acknowledgement'
  );
  const fallbackBotState = await tracker.waitFor(state => state.history.length === 3, 3000);
  assert.equal(
    fallbackBotState.players.find(player => player.id === fallbackBotState.history[2].playerId)?.isBot,
    true,
    'a missing animation acknowledgement eventually releases the next bot turn'
  );
  socket.disconnect();
}

async function createBotGame(url, playerCount, roomName) {
  const socket = await connectSocket(url);
  const tracker = createStateTracker(socket);
  const created = await request(socket, 'create_room', { playerName: roomName });
  assert.equal(created?.success, true, 'room creation succeeds');

  for (let i = 1; i < playerCount; i++) {
    const added = await request(socket, 'add_bot', { roomCode: created.roomCode });
    assert.equal(added?.success, true, `host adds bot ${i}`);
  }

  let enabled = false;
  const autoPlayer = attachAutoPlayer(socket, created.roomCode, created.playerId, () => enabled);
  const started = await request(socket, 'start_game', { roomCode: created.roomCode });
  assert.equal(started?.success, true, `${playerCount}-player game starts`);

  const initialState = await tracker.waitFor(state => state.status === 'playing');
  const expectedCards = { 3: 54, 4: 52, 5: 55, 6: 54 }[playerCount];
  const host = initialState.players.find(player => player.id === created.playerId);
  assert.equal(host.hand.length, expectedCards / playerCount, `${playerCount}-player hand size`);

  enabled = true;
  autoPlayer.playForState(initialState);
  const finishedState = await waitForFinished(tracker);
  assert.equal(autoPlayer.getError(), null, 'automated human player did not encounter an error');
  assert.equal(finishedState.players.every(player => player.cardCount === 0), true, 'all hands are empty');
  assert.equal(finishedState.history.length, expectedCards, 'full turn history is available after the game');

  const bankCount = finishedState.players.reduce((sum, player) => sum + player.bankCount, 0);
  assert.equal(bankCount + finishedState.table.length, expectedCards, 'every dealt card is banked or left on the table');

  const tableSpadePoints = finishedState.table
    .filter(card => card.isSpade)
    .reduce((sum, card) => sum + card.rank, 0);
  const bankSpadePoints = finishedState.gameResults.standings
    .reduce((sum, player) => sum + player.gadhaPoints, 0);
  assert.equal(bankSpadePoints + tableSpadePoints, 91, 'all spade points are accounted for');
  assert.equal(finishedState.gameResults.standings.length, playerCount, 'every player has a final result');

  socket.disconnect();
}

async function run() {
  const port = await getFreePort();
  const url = `http://127.0.0.1:${port}`;
  serverProcess = spawn(process.execPath, ['server/server.js'], {
    env: {
      ...process.env,
      PORT: String(port),
      BOT_TURN_DELAY_MS: '1',
      TURN_RESOLUTION_FALLBACK_MS: '1000',
      VITE_SERVER_URL: 'https://test-game-server.example'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  serverProcess.stdout.on('data', data => serverOutput.push(data.toString()));
  serverProcess.stderr.on('data', data => serverOutput.push(data.toString()));

  try {
    await waitForServer(url);

    const configResponse = await fetch(`${url}/api/config.js`);
    assert.equal(configResponse.status, 200, 'runtime client config is served');
    assert.equal(
      await configResponse.text(),
      'window.__GADHA_SERVER_URL__ = "https://test-game-server.example";',
      'runtime client config exposes the configured game server URL'
    );

    const departingHost = await connectSocket(url);
    const departingRoom = await request(departingHost, 'create_room', { playerName: 'Leaving Host' });
    const successorSocket = await connectSocket(url);
    await request(successorSocket, 'join_room', {
      roomCode: departingRoom.roomCode,
      playerName: 'Successor'
    });
    const successorTracker = createStateTracker(successorSocket);
    const lobbyChatReceived = new Promise(resolve => successorSocket.once('chat_received', resolve));
    const lobbyChat = await request(departingHost, 'send_chat', {
      roomCode: departingRoom.roomCode,
      message: 'Lobby chat works'
    });
    assert.equal(lobbyChat.success, true, 'players can send chat while the room is waiting');
    assert.equal((await lobbyChatReceived).message, 'Lobby chat works', 'lobby chat reaches other seated players');
    const hostLeave = await request(departingHost, 'leave_room', { roomCode: departingRoom.roomCode });
    assert.equal(hostLeave.removed, true, 'leaving a lobby removes the seat');
    const promotedState = await successorTracker.waitFor(state => state.players.length === 1);
    assert.equal(promotedState.players[0].isHost, true, 'lobby host is transferred on leave');
    const finalLeave = await request(successorSocket, 'leave_room', { roomCode: departingRoom.roomCode });
    assert.equal(finalLeave.removed, true, 'last player can close an empty lobby');
    departingHost.disconnect();
    successorSocket.disconnect();

    await testBotWaitsForAnimation(url);

    const hostSocket = await connectSocket(url);
    const hostTracker = createStateTracker(hostSocket);
    const created = await request(hostSocket, 'create_room', { playerName: 'Host' });
    assert.equal(created.success, true);
    assert.equal(created.gameState.yourPlayerId, created.playerId);
    assert.equal(created.gameState.sessionToken, created.sessionToken);
    const hostInitialState = await hostTracker.waitFor(state => state.yourPlayerId === created.playerId);
    assert.equal(hostInitialState.sessionToken, created.sessionToken, 'room updates retain the host session credentials');

    const guestSocket = await connectSocket(url);
    const guestTracker = createStateTracker(guestSocket);
    const joined = await request(guestSocket, 'join_room', {
      roomCode: created.roomCode,
      playerName: 'Guest'
    });
    assert.equal(joined.success, true);
    const guestInitialState = await guestTracker.waitFor(state => state.yourPlayerId === joined.playerId);
    assert.equal(guestInitialState.sessionToken, joined.sessionToken, 'room updates retain the guest session credentials');
    assert.notEqual(guestInitialState.sessionToken, created.sessionToken, 'each player only receives their own session credential');

    const deniedBot = await request(guestSocket, 'add_bot', { roomCode: created.roomCode });
    assert.match(deniedBot.error, /host/i, 'non-host cannot add bots');
    assert.equal((await request(hostSocket, 'add_bot', { roomCode: created.roomCode })).success, true);

    const started = await request(hostSocket, 'start_game', { roomCode: created.roomCode });
    assert.equal(started.success, true);
    const initialState = await hostTracker.waitFor(state => state.status === 'playing');
    const hostState = initialState.players.find(player => player.id === created.playerId);
    let originalHand = hostState.hand.map(card => card.id);
    assert.equal('handSafety' in hostState, false, 'private hand safety hints are not sent to clients');
    assert.equal(
      initialState.players.filter(player => player.id !== created.playerId).every(player => !('hand' in player)),
      true,
      "other players' hands are private"
    );

    const duplicateStart = await request(hostSocket, 'start_game', { roomCode: created.roomCode });
    assert.match(duplicateStart.error, /already started/i);
    assert.deepEqual(
      hostTracker.latest.players.find(player => player.id === created.playerId).hand.map(card => card.id),
      originalHand,
      'duplicate start does not redeal'
    );

    const spoofedPlay = await request(guestSocket, 'play_card', {
      roomCode: created.roomCode,
      playerId: created.playerId,
      cardId: originalHand[0]
    });
    assert.match(spoofedPlay.error, /turn/i, 'guest cannot act as the host');

    const spoofedRestart = await request(guestSocket, 'restart_game', {
      roomCode: created.roomCode,
      playerId: created.playerId
    });
    assert.match(spoofedRestart.error, /host/i, 'guest cannot act as the host');

    const duplicateOrder = Array(originalHand.length).fill(originalHand[0]);
    const invalidSort = await request(hostSocket, 'sort_hand', {
      roomCode: created.roomCode,
      newHandOrder: duplicateOrder
    });
    assert.match(invalidSort.error, /exactly once/i, 'sorting requires a permutation of the hand');
    assert.deepEqual(
      hostTracker.latest.players.find(player => player.id === created.playerId).hand.map(card => card.id),
      originalHand,
      'invalid sorting leaves the hand unchanged'
    );

    const firstCard = hostState.hand[0];
    const duplicateMovePayload = {
      roomCode: created.roomCode,
      cardId: firstCard.id,
      chosenJokerRank: firstCard.isJoker ? 1 : null
    };
    const duplicateMoves = await Promise.all([
      request(hostSocket, 'play_card', duplicateMovePayload),
      request(hostSocket, 'play_card', duplicateMovePayload)
    ]);
    assert.equal(duplicateMoves.filter(result => result.success).length, 1, 'only one simultaneous duplicate move succeeds');
    assert.equal(duplicateMoves.filter(result => result.error).length, 1, 'the second duplicate move is rejected');
    const pendingMove = await hostTracker.waitFor(state => state.turnResolutionPending);
    assert.equal(pendingMove.currentTurnPlayerId, created.playerId, 'the active turn remains locked during resolution');
    const blockedMove = await request(hostSocket, 'play_card', {
      roomCode: created.roomCode,
      cardId: hostTracker.latest.players.find(player => player.id === created.playerId).hand[0].id
    });
    assert.match(blockedMove.error, /resolving/i, 'another card cannot be played during the animation');
    assert.equal(
      (await request(hostSocket, 'turn_animation_complete', {
        roomCode: created.roomCode,
        actionId: pendingMove.pendingActionId
      })).success,
      true,
      'the active player can finish the turn animation'
    );
    assert.equal(
      (await request(guestSocket, 'turn_animation_complete', {
        roomCode: created.roomCode,
        actionId: pendingMove.pendingActionId
      })).success,
      true,
      'the other connected player can finish the turn animation'
    );
    await hostTracker.waitFor(state => !state.turnResolutionPending && state.currentTurnPlayerId !== created.playerId);
    originalHand = hostTracker.latest.players.find(player => player.id === created.playerId).hand.map(card => card.id);

    hostSocket.disconnect();
    await new Promise(resolve => setTimeout(resolve, 30));
    const reconnectedHost = await connectSocket(url);
    const reconnectedState = await request(reconnectedHost, 'reconnect_session', {
      roomCode: created.roomCode,
      playerId: created.playerId,
      sessionToken: created.sessionToken
    });
    assert.equal(reconnectedState.success, true, 'session reconnect succeeds during a game');
    assert.deepEqual(
      reconnectedState.gameState.players.find(player => player.id === created.playerId).hand.map(card => card.id),
      originalHand,
      'reconnect restores the exact hand'
    );

    const activeLeave = await request(reconnectedHost, 'leave_room', { roomCode: created.roomCode });
    assert.equal(activeLeave.sessionRetained, true, 'leaving an active game retains the session for resume');
    const resumedHost = await connectSocket(url);
    const resumedState = await request(resumedHost, 'reconnect_session', {
      roomCode: created.roomCode,
      playerId: created.playerId,
      sessionToken: created.sessionToken
    });
    assert.equal(resumedState.success, true, 'active session resumes after leaving the game view');
    assert.deepEqual(
      resumedState.gameState.players.find(player => player.id === created.playerId).hand.map(card => card.id),
      originalHand
    );

    const currentHostTracker = createStateTracker(resumedHost, resumedState.gameState);
    let autoPlayEnabled = false;
    const hostAutoPlayer = attachAutoPlayer(
      resumedHost,
      created.roomCode,
      created.playerId,
      () => autoPlayEnabled
    );
    const guestAutoPlayer = attachAutoPlayer(
      guestSocket,
      created.roomCode,
      joined.playerId,
      () => autoPlayEnabled
    );
    autoPlayEnabled = true;
    hostAutoPlayer.playForState(resumedState.gameState);

    const threePlayerFinish = await waitForFinished(currentHostTracker);
    assert.equal(threePlayerFinish.players.every(player => player.cardCount === 0), true);
    assert.equal(threePlayerFinish.history.length, 54, 'all turns remain available for the capture log');
    assert.equal(hostAutoPlayer.getError(), null);
    assert.equal(guestAutoPlayer.getError(), null);
    const threePlayerBanks = threePlayerFinish.players.reduce((sum, player) => sum + player.bankCount, 0);
    assert.equal(threePlayerBanks + threePlayerFinish.table.length, 54);

    guestSocket.disconnect();
    reconnectedHost.disconnect();
    resumedHost.disconnect();

    for (let cycle = 0; cycle < 3; cycle++) {
      await Promise.all([3, 4, 5, 6].map(playerCount =>
        createBotGame(url, playerCount, `Bots-${playerCount}-${cycle}`)
      ));
    }
  } finally {
    for (const socket of sockets) socket.disconnect();
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill();
      await new Promise(resolve => serverProcess.once('exit', resolve));
    }
  }
}

run()
  .then(() => console.log('Socket gameplay tests passed.'))
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  });
