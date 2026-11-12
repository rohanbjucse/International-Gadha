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
import { ChatModal } from './components/ChatModal';
import { VideoTile } from './components/VideoTile';
import { useWebRTC } from './hooks/useWebRTC';
import { sounds } from './utils/sound';
import {
  Volume2,
  VolumeX,
  BookOpen,
  LogOut,
  Wifi,
  WifiOff,
  Mic,
  MicOff,
  Video,
  VideoOff,
  MessageSquare,
  Square
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
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [latestChatToast, setLatestChatToast] = useState(null);
  const [pendingJokerCard, setPendingJokerCard] = useState(null);
  const [isMuted, setIsMuted] = useState(sounds.isMuted());
  const [statusNotification, setStatusNotification] = useState('');
  const [videoEnabled, setVideoEnabled] = useState(false);

  const lastActionTimestampRef = useRef(null);

  // WebRTC video/audio chat (available during lobby or gameplay)
  const isInRoom = !!gameState;
  const {
    localStream,
    peerStreams,
    peerMuteStates,
    micOn,
    camOn,
    toggleMic,
    toggleCam,
    permissionError,
    isInitializing
  } = useWebRTC({
    socket,
    roomCode,
    enabled: videoEnabled && isInRoom
  });

  // Initialize Socket.IO connection
  useEffect(() => {
    const s = io(SERVER_URL, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 20,
      reconnectionDelay: 1000,
      timeout: 15000
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
            if (Array.isArray(res.gameState?.chatHistory)) {
              setChatMessages(res.gameState.chatHistory);
            }
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

      if (Array.isArray(state.chatHistory) && state.chatHistory.length > 0) {
        setChatMessages((prev) => {
          const prevKeys = new Set(prev.map(m => m.id || `${m.senderId}_${m.timestamp}`));
          const newItems = state.chatHistory.filter(m => !prevKeys.has(m.id || `${m.senderId}_${m.timestamp}`));
          return newItems.length > 0 ? [...prev, ...newItems] : prev;
        });
      }

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

    s.on('chat_received', (chatMsg) => {
      setChatMessages((prev) => [...prev.slice(-49), chatMsg]);
      setIsChatOpen((open) => {
        if (!open) {
          setUnreadChatCount((c) => c + 1);
          setLatestChatToast(chatMsg);
          setTimeout(() => {
            setLatestChatToast((cur) => (cur === chatMsg ? null : cur));
          }, 3500);
        }
        return open;
      });
    });

    s.on('notification', ({ message }) => {
      setStatusNotification(message);
      setTimeout(() => setStatusNotification(''), 4000);
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
        if (Array.isArray(res.gameState?.chatHistory)) {
          setChatMessages(res.gameState.chatHistory);
        }
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
        if (Array.isArray(res.gameState?.chatHistory)) {
          setChatMessages(res.gameState.chatHistory);
        }
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
    const activeRoom = roomCode || gameState?.roomCode;
    if (!socket || !activeRoom) return;

    if (card.isJoker) {
      setPendingJokerCard(card);
      setIsJokerModalOpen(true);
      return;
    }

    sounds.playCardSnap();
    socket.emit('play_card', {
      roomCode: activeRoom,
      playerId: myPlayerId,
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
    const activeRoom = roomCode || gameState?.roomCode;
    if (!pendingJokerCard || !socket || !activeRoom) return;
    setIsJokerModalOpen(false);

    sounds.playCardSnap();
    socket.emit('play_card', {
      roomCode: activeRoom,
      playerId: myPlayerId,
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
    const activeRoom = roomCode || gameState?.roomCode;
    if (!socket || !activeRoom) return;
    socket.emit('sort_hand', { roomCode: activeRoom, playerId: myPlayerId, newHandOrder });
  }

  // Restart Game / Play Again
  function handleRestartGame() {
    const activeRoom = roomCode || gameState?.roomCode;
    if (!socket || !activeRoom) return;
    socket.emit('restart_game', { roomCode: activeRoom, playerId: myPlayerId }, (res) => {
      if (res && res.error) alert(res.error);
    });
  }

  // Leave Game
  function handleLeaveGame() {
    if (window.confirm('Are you sure you want to leave this game?')) {
      clearLocalSession();
    }
  }

  // Host: End Game
  function handleEndGame() {
    const activeRoom = roomCode || gameState?.roomCode;
    if (!socket || !activeRoom) return;
    if (window.confirm('Are you sure you want to end this game now? Current scores will decide the International Gadha!')) {
      socket.emit('end_game', { roomCode: activeRoom, playerId: myPlayerId }, (res) => {
        if (res && res.error) alert(res.error);
      });
    }
  }

  // Send in-game chat message or reaction
  function handleSendMessage({ message, reaction }) {
    const activeRoom = roomCode || gameState?.roomCode;
    if (!socket || !activeRoom) return;
    socket.emit('send_chat', { roomCode: activeRoom, playerId: myPlayerId, message, reaction });
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
    <div className={`game-app-root${gameState?.status === 'playing' || gameState?.status === 'finished' ? ' is-playing' : ''}`}>
      {/* Global Top Navbar */}
      <header className="global-navbar">
        <div className="nav-left">
          <div className="brand-logo" onClick={() => !gameState && clearLocalSession()}>
            <span className="brand-icon">🫏</span>
            <span className="brand-title">
              <span className="brand-title-full">INTERNATIONAL </span>GADHA
            </span>
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
            {connected ? <Wifi size={13} /> : <WifiOff size={13} />}
            <span className="hidden-mobile">{connected ? 'Online' : 'Offline'}</span>
          </span>

          {/* Video Chat Toggle (during room) */}
          {isInRoom && (
            <button
              onClick={() => setVideoEnabled(v => !v)}
              className={`nav-btn-icon ${videoEnabled ? 'nav-btn-active' : ''}`}
              title={videoEnabled ? 'Disable Video Chat' : 'Enable Video Chat'}
            >
              {videoEnabled ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
          )}

          {/* Table Chat Toggle */}
          {gameState && (
            <button
              onClick={() => {
                setIsChatOpen(v => !v);
                setUnreadChatCount(0);
              }}
              className="nav-btn-icon nav-btn-chat"
              title="Open Chat"
            >
              <MessageSquare size={16} />
              {unreadChatCount > 0 && (
                <span className="chat-unread-badge">{unreadChatCount}</span>
              )}
            </button>
          )}

          {/* Host End Game Button (During active game) */}
          {isHost && gameState?.status === 'playing' && (
            <button
              onClick={handleEndGame}
              className="nav-btn-end"
              title="Host: End Game Now"
            >
              <Square size={12} fill="currentColor" />
              <span>End</span>
            </button>
          )}

          {/* Sound Toggle */}
          <button
            onClick={toggleSound}
            className="nav-btn-icon"
            title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>

          {/* Rules Modal */}
          <button
            onClick={() => setIsRulesOpen(true)}
            className="nav-btn-icon hidden-xs"
            title="How to Play Rules"
          >
            <BookOpen size={16} />
          </button>

          {/* Exit / Leave Game (ALWAYS visible!) */}
          {gameState && (
            <button
              onClick={handleLeaveGame}
              className="nav-btn-leave"
              title="Leave Room"
            >
              <LogOut size={14} />
              <span className="leave-text">Leave</span>
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
            isConnected={connected}
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
            {permissionError && (
              <div className="video-perm-toast">
                <span>⚠️ {permissionError}</span>
              </div>
            )}

            {/* Seated Opponents Area (Integrated Video & Live Avatars) */}
            <Opponents
              opponents={opponents}
              currentTurnPlayerId={gameState.currentTurnPlayerId}
              videoEnabled={videoEnabled}
              localPlayer={me}
              localStream={localStream}
              peerStreams={peerStreams}
              peerMuteStates={peerMuteStates}
              micOn={micOn}
              camOn={camOn}
              onToggleMic={toggleMic}
              onToggleCam={toggleCam}
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

      {/* Floating Incoming Chat Toast (When chat drawer is closed) */}
      {latestChatToast && !isChatOpen && (
        <div
          className="chat-floating-toast"
          onClick={() => {
            setIsChatOpen(true);
            setUnreadChatCount(0);
            setLatestChatToast(null);
          }}
          title="Click to open chat"
        >
          <span className="toast-chat-icon">💬</span>
          <span className="toast-sender">{latestChatToast.senderName}:</span>
          <span className="toast-msg">{latestChatToast.message}</span>
        </div>
      )}

      {/* Table Chat Drawer / Modal */}
      <ChatModal
        isOpen={isChatOpen}
        onClose={() => {
          setIsChatOpen(false);
          setUnreadChatCount(0);
        }}
        messages={chatMessages}
        onSendMessage={handleSendMessage}
        myPlayerId={myPlayerId}
      />

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
