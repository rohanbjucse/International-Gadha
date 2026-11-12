import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { Trophy, RefreshCw, LogOut, ShieldCheck, Flame } from 'lucide-react';
import { sounds } from '../utils/sound';

export function GameOverModal({
  results,
  currentPlayerId,
  isHost,
  onRestart,
  onLeave
}) {
  if (!results) return null;

  const { standings, internationalGadhas, winners } = results;
  const isMeGadha = internationalGadhas.some(g => g.playerId === currentPlayerId);
  const isMeWinner = winners.some(w => w.playerId === currentPlayerId);

  useEffect(() => {
    if (isMeWinner) {
      sounds.playVictoryFanfare();
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 }
      });
    } else {
      sounds.playGadhaBray();
    }
  }, [isMeWinner]);

  return (
    <div className="modal-overlay animate-fade-in">
      <div className="modal-card game-over-box">
        {/* Top Celebration / Shame Banner */}
        <div className={`game-over-banner ${isMeGadha ? 'banner-is-gadha' : 'banner-is-winner'}`}>
          <div className="banner-donkey-icon">
            <span className="text-5xl">🫏</span>
          </div>

          <h1 className="game-over-title">
            {isMeGadha ? (
              <span className="text-rose-400">YOU ARE THE INTERNATIONAL GADHA! 🫏👑</span>
            ) : isMeWinner ? (
              <span className="text-emerald-400">YOU ARE SAFE & VICTORIOUS! 🏆</span>
            ) : (
              <span className="text-amber-400">GAME OVER!</span>
            )}
          </h1>

          <p className="game-over-subtitle">
            The player(s) with the most Gadha (♠ Spade) points earned the crown!
          </p>
        </div>

        {/* International Gadha Spotlight Card */}
        <div className="gadha-spotlight">
          <div className="gadha-crown-badge">👑 OFFICIAL INTERNATIONAL GADHA 🫏</div>
          <div className="gadha-names-list">
            {internationalGadhas.map(g => (
              <div key={g.playerId} className="gadha-person">
                <span className="text-2xl">{g.avatar || '😎'}</span>
                <span className="font-bold text-lg text-white">{g.name}</span>
                <span className="gadha-score-tag">♠ {g.gadhaPoints} Gadha Points</span>
              </div>
            ))}
          </div>
        </div>

        {/* Standings Table */}
        <div className="standings-table-wrap">
          <h3 className="standings-title">Final Standings</h3>
          <table className="standings-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Player</th>
                <th>Eaten Spades (Gadha Cards)</th>
                <th className="text-right">Gadha Score</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((p, idx) => {
                const isThisGadha = internationalGadhas.some(g => g.playerId === p.playerId);
                const isThisWinner = winners.some(w => w.playerId === p.playerId);
                const isMe = p.playerId === currentPlayerId;

                return (
                  <tr
                    key={p.playerId}
                    className={`standings-row ${isMe ? 'row-me' : ''} ${
                      isThisGadha ? 'row-gadha' : isThisWinner ? 'row-winner' : ''
                    }`}
                  >
                    <td className="rank-col">
                      {isThisWinner ? (
                        <span className="flex items-center gap-1 text-emerald-400 font-bold">
                          <Trophy size={14} /> 1st
                        </span>
                      ) : isThisGadha ? (
                        <span className="flex items-center gap-1 text-rose-400 font-bold">
                          🫏 Gadha
                        </span>
                      ) : (
                        `#${idx + 1}`
                      )}
                    </td>
                    <td className="player-col">
                      <div className="flex items-center gap-2">
                        <span>{p.avatar || '😎'}</span>
                        <span className="font-medium text-white">{p.name}</span>
                        {isMe && <span className="badge-you">YOU</span>}
                        {p.isBot && <span className="badge-bot-sm">BOT</span>}
                      </div>
                    </td>
                    <td className="spades-col">
                      {p.spadeCards.length === 0 ? (
                        <span className="text-emerald-400 text-xs">0 Spades! (Clean)</span>
                      ) : (
                        <div className="spades-tag-row">
                          {p.spadeCards.map((sc, i) => (
                            <span key={i} className="mini-spade-tag">
                              ♠{sc.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="score-col text-right">
                      <span className={`score-pill ${isThisGadha ? 'score-gadha' : 'score-safe'}`}>
                        ♠ {p.gadhaPoints}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Modal Actions */}
        <div className="modal-actions-row">
          {isHost ? (
            <button onClick={onRestart} className="btn-primary flex items-center gap-2">
              <RefreshCw size={16} /> Play Again
            </button>
          ) : (
            <div className="text-slate-400 text-sm flex items-center gap-2">
              <RefreshCw size={16} className="animate-spin text-amber-400" />
              Waiting for host to restart game...
            </div>
          )}

          <button onClick={onLeave} className="btn-secondary flex items-center gap-2">
            <LogOut size={16} /> Exit to Lobby
          </button>
        </div>
      </div>
    </div>
  );
}

