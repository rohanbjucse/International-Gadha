import React, { useState, useEffect } from 'react';
import { Play, LogIn, PlusCircle, BookOpen, Volume2, VolumeX, Sparkles, RotateCcw } from 'lucide-react';
import { sounds } from '../utils/sound';

const AVATARS = ['🤠', '😎', '🦊', '🦁', '🐼', '🥷', '🧙‍♂️', '👑', '🃏', '🚀'];

export function Home({
  onCreateRoom,
  onJoinRoom,
  onResumeSession,
  savedSession,
  onOpenRules,
  defaultRoomCode = ''
}) {
  const [name, setName] = useState(() => localStorage.getItem('gadha_player_name') || '');
  const [avatar, setAvatar] = useState(() => localStorage.getItem('gadha_player_avatar') || '🤠');
  const [joinCode, setJoinCode] = useState(defaultRoomCode);
  const [activeTab, setActiveTab] = useState(defaultRoomCode ? 'join' : 'create');
  const [isMuted, setIsMuted] = useState(sounds.isMuted());
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (defaultRoomCode) {
      setJoinCode(defaultRoomCode);
      setActiveTab('join');
    }
  }, [defaultRoomCode]);

  function handleNameChange(val) {
    setName(val);
    localStorage.setItem('gadha_player_name', val);
  }

  function handleAvatarSelect(av) {
    setAvatar(av);
    localStorage.setItem('gadha_player_avatar', av);
  }

  function handleCreate() {
    if (!name.trim()) {
      setErrorMsg('Please enter your name first!');
      return;
    }
    setErrorMsg('');
    onCreateRoom(name.trim(), avatar);
  }

  function handleJoin() {
    if (!name.trim()) {
      setErrorMsg('Please enter your name first!');
      return;
    }
    if (!joinCode.trim()) {
      setErrorMsg('Please enter a 6-digit room code!');
      return;
    }
    setErrorMsg('');
    onJoinRoom(joinCode.trim().toUpperCase(), name.trim(), avatar);
  }

  function toggleSound() {
    const muted = sounds.toggleMute();
    setIsMuted(muted);
  }

  return (
    <div className="home-container animate-fade-in">
      {/* Top Bar with Sound & Rules */}
      <div className="home-top-bar">
        <button
          onClick={toggleSound}
          className="btn-icon-subtle"
          title={isMuted ? 'Unmute Sound' : 'Mute Sound'}
        >
          {isMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
        </button>

        <button onClick={onOpenRules} className="btn-rules-pill">
          <BookOpen size={15} /> How to Play
        </button>
      </div>

      <div className="home-card">
        {/* Brand Title with Mascot */}
        <div className="home-brand">
          <div className="home-mascot animate-bounce-subtle">
            <span className="text-6xl">🫏</span>
          </div>
          <h1 className="home-title">INTERNATIONAL GADHA</h1>
          <p className="home-tagline">
            The legendary card-eating game. Watch out for the <strong>Spades (♠)</strong> or be crowned the ultimate Gadha!
          </p>
        </div>

        {/* Reconnect Banner if saved session exists */}
        {savedSession && savedSession.roomCode && (
          <div className="reconnect-prompt-banner animate-slide-down">
            <div className="flex items-center gap-2">
              <RotateCcw size={16} className="text-amber-400 animate-spin-slow" />
              <div className="text-left text-xs">
                <span className="font-bold text-white">Ongoing Game Detected!</span>
                <span className="text-slate-300 block">Room: {savedSession.roomCode}</span>
              </div>
            </div>
            <button
              onClick={() => onResumeSession(savedSession)}
              className="btn-resume-session"
            >
              Resume Game
            </button>
          </div>
        )}

        {/* Player Profile Setup */}
        <div className="profile-setup-section">
          <label className="input-label">Choose Your Player Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="e.g. CardMaster, Raj, DonkeySlayer"
            maxLength={15}
            className="input-text"
          />

          <label className="input-label mt-3">Pick an Avatar</label>
          <div className="avatar-picker-row">
            {AVATARS.map((av) => (
              <button
                key={av}
                type="button"
                onClick={() => handleAvatarSelect(av)}
                className={`avatar-option-btn ${avatar === av ? 'avatar-selected' : ''}`}
              >
                {av}
              </button>
            ))}
          </div>
        </div>

        {/* Tab switcher: Create vs Join */}
        <div className="tabs-container">
          <button
            onClick={() => { setActiveTab('create'); setErrorMsg(''); }}
            className={`tab-btn ${activeTab === 'create' ? 'tab-btn-active' : ''}`}
          >
            <PlusCircle size={16} /> Create Game
          </button>
          <button
            onClick={() => { setActiveTab('join'); setErrorMsg(''); }}
            className={`tab-btn ${activeTab === 'join' ? 'tab-btn-active' : ''}`}
          >
            <LogIn size={16} /> Join Game
          </button>
        </div>

        {/* Error message banner */}
        {errorMsg && (
          <div className="error-toast animate-shake">
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Tab Content */}
        <div className="tab-body">
          {activeTab === 'create' ? (
            <div className="create-tab-view animate-fade-in">
              <p className="tab-info-text">
                Start a fresh room, get a 6-digit room code to share with friends, or play against AI bots!
              </p>
              <button onClick={handleCreate} className="btn-primary w-full py-3 text-lg font-bold flex items-center justify-center gap-2">
                <Sparkles size={20} /> Create New Room
              </button>
            </div>
          ) : (
            <div className="join-tab-view animate-fade-in">
              <label className="input-label">Enter 6-Digit Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. GADHA7"
                maxLength={6}
                className="input-text font-mono text-center tracking-widest text-xl uppercase"
              />
              <button
                onClick={handleJoin}
                className="btn-primary w-full mt-3 py-3 text-lg font-bold flex items-center justify-center gap-2"
              >
                <LogIn size={20} /> Join Room
              </button>
            </div>
          )}
        </div>

        {/* Quick Rules Hint */}
        <div className="home-quick-rules">
          <div className="quick-rule-item">
            <span className="quick-rule-dot text-rose-400">♠</span>
            <span>Spades = Gadha Points (Ace=1 to King=13)</span>
          </div>
          <div className="quick-rule-item">
            <span className="quick-rule-dot text-amber-400">🍽️</span>
            <span>Match single card or sum of 2 cards to eat</span>
          </div>
          <div className="quick-rule-item">
            <span className="quick-rule-dot text-purple-400">🃏</span>
            <span>Jokers are wildcards (0 points)</span>
          </div>
        </div>
      </div>
    </div>
  );
}

