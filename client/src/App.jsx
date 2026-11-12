import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { Home } from './components/Home';
import { Lobby } from './components/Lobby';
import { Table } from './components/Table';
import { Opponents } from './components/Opponents';
import { PlayerHand } from './components/PlayerHand';
import { JokerModal } from './components/JokerModal';
import { GameOverModal } from './components/GameOverModal';
import { RulesModal } from './components/RulesModal';
import { EatenCardsModal } from './components/EatenCardsModal';
import { sounds } from './utils/sound';
import {
  Volume2,
  VolumeX,
  BookOpen,
  LogOut,
  Wifi,
  WifiOff,
  Sparkles,
  HelpCircle
} from 'lucide-react';

// Connect to backend server (supports production domains, direct port 3001, and Vite dev port 5173)
const SERVER_URL = window.location.port === '5173'
  ? 'http://localhost:3001'
  : window.location.origin;

export default function App() {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [gameState, setGameState] = useState(null);
  const [myPlayerId, setMyPlayerId] = useState(() => localStorage.getItem('gadha_player_id') || null);
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('gadha_session_token') || null);
  const [roomCode, setRoomCode] = useState(() => localStorage.getItem('gadha_room_code') || null);

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isJokerModalOpen, setIsJokerModalOpen] = useState(false);
  const [isEatenModalOpen, setIsEatenModalOpen] = useState(false);
  const [pendingJokerCard, setPendingJokerCard] = useState(null);
  const [isMuted, setIsMuted] = useState(sounds.isMuted());
  const [statusNotification, setStatusNotification] = useState('');

  const lastActionTimestampRef = useRef(null);

  // Initialize Socket.IO connection
  useEffect(() => {
    const s = io(SERVER_URL, {
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });

    s.on('connect', () => {
      setConnected(true);

      // Check URL query parameters or localStorage for auto-reconnect
      const params = new URLSearchParams(window.location.search);
      const urlRoomCode = params.get('room');
      const savedRoom = urlRoomCode || localStorage.getItem('gadha_room_code');
      const savedPid = localStorage.getItem('gadha_player_id');
      const savedToken = localStorage.getItem('gadha_session_token');

      if (savedRoom && savedPid && savedToken) {
        s.emit('reconnect_session', {
          roomCode: savedRoom,
          playerId: savedPid,
          sessionToken: savedToken
        }, (res) => {
          if (res && res.success) {
            setGameState(res.gameState);
            setMyPlayerId(res.playerId);
            setRoomCode(res.roomCode);
          } else {
            // Room likely expired
            clearLocalSession();
          }
        });
      }
    });

    s.on('disconnect', () => {
      setConnected(false);
    });

    s.on('game_state_update', (state) => {
      setGameState(state);

      // Play sound effects based on actions
      if (state.lastAction && state.lastAction.timestamp !== lastActionTimestampRef.current) {
        lastActionTimestampRef.current = state.lastAction.timestamp;

        if (state.lastAction.type === 'eat') {
          if (state.lastAction.pointsGained > 0) {
            sounds.playDangerAlert();
          } else {
            sounds.playEatThud();
          }
        } else if (state.lastAction.type === 'safe') {
          sounds.playSafeChime();
        } else if (state.lastAction.type === 'game_started') {
          sounds.playCardSnap();
        }
      }
    });

    setSocket(s);

    return () => {
      s.disconnect();
    };
  }, []);

  function saveSession(rCode, pId, token) {
    setRoomCode(rCode);
    setMyPlayerId(pId);
    setSessionToken(token);
    localStorage.setItem('gadha_room_code', rCode);
    localStorage.setItem('gadha_player_id', pId);
    localStorage.setItem('gadha_session_token', token);

    // Update URL query string without reloading
    const newUrl = `${window.location.pathname}?room=${rCode}`;
    window.history.replaceState({ path: newUrl }, '', newUrl);
  }

  function clearLocalSession() {
    setGameState(null);
    setRoomCode(null);
    setMyPlayerId(null);
    setSessionToken(null);
    localStorage.removeItem('gadha_room_code');
    localStorage.removeItem('gadha_player_id');
    localStorage.removeItem('gadha_session_token');

    // Clean URL
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Create room
  function handleCreateRoom(playerName, avatar) {
    if (!socket) return;
    socket.emit('create_room', { playerName, avatar }, (res) => {
      if (res && res.success) {
        saveSession(res.roomCode, res.playerId, res.sessionToken);
        setGameState(res.gameState);
      } else if (res && res.error) {
        alert(res.error);
      }
    });
  }

  // Join room
  function handleJoinRoom(code, playerName, avatar) {
    if (!socket) return;
    socket.emit('join_room', { roomCode: code, playerName, avatar }, (res) => {
      if (res && res.success) {
        saveSession(res.roomCode, res.playerId, res.sessionToken);
        setGameState(res.gameState);
      } else if (res && res.error) {
        alert(res.error);
      }
    });
  }

  // Resume ongoing session
  function handleResumeSession(session) {
    if (!socket) return;
    socket.emit('reconnect_session', {
      roomCode: session.roomCode,
      playerId: session.playerId,
      sessionToken: session.sessionToken
    }, (res) => {
      if (res && res.success) {
        setGameState(res.gameState);
        setMyPlayerId(res.playerId);
        setRoomCode(res.roomCode);
      } else {
        alert(res?.error || 'Unable to resume session.');
        clearLocalSession();
      }
    });
  }

  // Add Bot
  function handleAddBot() {
    if (!socket || !roomCode) return;
    socket.emit('add_bot', { roomCode }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }

  // Remove Player/Bot
  function handleRemovePlayer(targetPlayerId) {
    if (!socket || !roomCode) return;
    socket.emit('remove_player', { roomCode, targetPlayerId }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }

  // Start Game
  function handleStartGame() {
    if (!socket || !roomCode) return;
    socket.emit('start_game', { roomCode }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }

  // Play a card
  function handlePlayCard(card) {
    if (card.isJoker) {
      setPendingJokerCard(card);
      setIsJokerModalOpen(true);
      return;
    }

    sounds.playCardSnap();
    socket.emit('play_card', {
      roomCode,
      cardId: card.id,
      chosenJokerRank: null
    }, (res) => {
      if (res && res.error) {
        alert(res.error);
      }
    });
  }

  // Confirm Joker rank selection
  function handleSelectJokerRank(rank) {
    if (!pendingJokerCard) return;
    setIsJokerModalOpen(false);

    sounds.playCardSnap();
    socket.emit('play_card', {
      roomCode,
      cardId: pendingJokerCard.id,
      chosenJokerRank: rank
    }, (res) => {
      if (res && res.error) {
        alert(res.error);
      }
      setPendingJokerCard(null);
    });
  }

  // Reorder hand locally & sync to server
  function handleReorderHand(newHandOrder) {
    if (!socket || !roomCode) return;
    socket.emit('sort_hand', { roomCode, newHandOrder });
  }

  // Restart Game / Play Again
  function handleRestartGame() {
    if (!socket || !roomCode) return;
    socket.emit('restart_game', { roomCode }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }

  // Leave Game
  function handleLeaveGame() {
    if (window.confirm('Are you sure you want to leave this game?')) {
      clearLocalSession();
    }
  }

  function toggleSound() {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  }

  // Derive active game data
  const me = gameState?.players?.find(p => p.id === myPlayerId);
  const opponents = gameState?.players?.filter(p => p.id !== myPlayerId) || [];
  const isMyTurn = gameState?.currentTurnPlayerId === myPlayerId;
  const activePlayer = gameState?.players?.find(p => p.id === gameState?.currentTurnPlayerId);
  const isHost = me?.isHost || false;

  // Read URL parameter for room code if any
  const urlRoomCode = new URLSearchParams(window.location.search).get('room') || '';

  const savedSessionObj = (roomCode && myPlayerId && sessionToken) ? {
    roomCode,
    playerId: myPlayerId,
    sessionToken
  } : null;

  return (
    <div className="game-app-root">
      {/* Global Top Navbar */}
      <header className="global-navbar">
        <div className="nav-left">
          <div className="brand-logo" onClick={() => !gameState && clearLocalSession()}>
            <span className="brand-icon">🫏</span>
            <span className="brand-title">INTERNATIONAL GADHA</span>
          </div>

          {gameState && (
            <div className="nav-room-badge">
              <span className="room-label">ROOM:</span>
              <span className="room-val">{gameState.roomCode}</span>
            </div>
          )}
        </div>

        <div className="nav-right">
          {/* Connection status indicator */}
          <span
            className={`nav-status-pill ${connected ? 'status-online' : 'status-offline'}`}
            title={connected ? 'Connected to Game Server' : 'Connecting to Server...'}
          >
            {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
            <span className="hidden-mobile">{connected ? 'Online' : 'Offline'}</span>
          </span>

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="nav-btn-icon"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          {/* Rules Modal */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="nav-btn-icon"
            title="How to Play Rules"
          >
            <BookOpen size={18} />
          </button>

          {/* Exit / Leave Game */}
          {gameState && (
            <button
              onClick={handleLeaveGame}
              className="nav-btn-leave"
              title="Leave Room"
            >
              <LogOut size={16} />
              <span className="hidden-mobile">Leave</span>
            </button>
          )}
        </div>
      </header>

      {/* Main View Area */}
      <main className="game-app-body">
        {!gameState ? (
          <Home
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onResumeSession={handleResumeSession}
            savedSession={savedSessionObj}
            onOpenRules={() => setIsRulesOpen(true)}
            defaultRoomCode={urlRoomCode}
          />
        ) : gameState.status === 'waiting' ? (
          <Lobby
            roomCode={gameState.roomCode}
            players={gameState.players}
            currentPlayerId={myPlayerId}
            isHost={isHost}
            onAddBot={handleAddBot}
            onRemovePlayer={handleRemovePlayer}
            onStartGame={handleStartGame}
            onOpenRules={() => setIsRulesOpen(true)}
          />
        ) : (
          <div className="gameplay-viewport">
            {/* Seated Opponents Area */}
            <Opponents
              opponents={opponents}
              currentTurnPlayerId={gameState.currentTurnPlayerId}
            />

            {/* Table Area */}
            <Table
              tableCards={gameState.table}
              lastAction={gameState.lastAction}
              activePlayer={activePlayer}
              isMyTurn={isMyTurn}
            />

            {/* Player Hand Controls & Hand Fan */}
            <PlayerHand
              hand={me?.hand || []}
              bank={me?.bank || []}
              isMyTurn={isMyTurn}
              onPlayCard={handlePlayCard}
              onReorderHand={handleReorderHand}
              onOpenEatenCards={() => setIsEatenModalOpen(true)}
            />
          </div>
        )}
      </main>

      {/* Joker Rank Selector Modal */}
      <JokerModal
        isOpen={isJokerModalOpen}
        onClose={() => { setIsJokerModalOpen(false); setPendingJokerCard(null); }}
        onSelectRank={handleSelectJokerRank}
      />

      {/* Eaten Cards Modal */}
      <EatenCardsModal
        isOpen={isEatenModalOpen}
        onClose={() => setIsEatenModalOpen(false)}
        bank={me?.bank || []}
        playerName={me?.name || 'Your'}
      />

      {/* Game Over Screen */}
      {gameState?.status === 'finished' && (
        <GameOverModal
          results={gameState.gameResults}
          currentPlayerId={myPlayerId}
          isHost={isHost}
          onRestart={handleRestartGame}
          onLeave={clearLocalSession}
        />
      )}

      {/* Rules Modal */}
      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />
    </div>
  );
}
