import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Smile, MessageSquare } from 'lucide-react';

const QUICK_EMOJIS = ['🫏', '😂', '🔥', '♠️', '👑', '👀', '👏', '😱', '👍', '💀'];

export function ChatModal({
  isOpen,
  onClose,
  messages = [],
  onSendMessage,
  myPlayerId
}) {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e?.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed) return;
    onSendMessage({ message: trimmed });
    setInputText('');
  };

  const handleQuickEmoji = (emoji) => {
    onSendMessage({ message: emoji, reaction: emoji });
  };

  return (
    <div className="chat-modal-overlay" onClick={onClose}>
      <div className="chat-modal-box" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="chat-modal-header">
          <div className="chat-header-title">
            <MessageSquare size={18} className="text-amber-400" />
            <span>Table Chat</span>
            <span className="chat-msg-count">({messages.length})</span>
          </div>
          <button onClick={onClose} className="chat-btn-close" title="Close Chat">
            <X size={18} />
          </button>
        </div>

        {/* Quick Reactions Bar */}
        <div className="chat-quick-emojis">
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              className="btn-quick-emoji"
              onClick={() => handleQuickEmoji(emoji)}
              title={`Send ${emoji}`}
            >
              {emoji}
            </button>
          ))}
        </div>

        {/* Message Log */}
        <div className="chat-messages-body">
          {messages.length === 0 ? (
            <div className="chat-empty-state">
              <span className="chat-empty-icon">💬</span>
              <p>No messages yet. Say hi or send an emoji!</p>
            </div>
          ) : (
            messages.map((msg, index) => {
              const isMe = msg.senderId === myPlayerId;
              const timeStr = msg.timestamp
                ? new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : '';

              return (
                <div
                  key={index}
                  className={`chat-message-row ${isMe ? 'chat-msg-me' : 'chat-msg-other'}`}
                >
                  <div className="chat-bubble">
                    {!isMe && (
                      <span className="chat-sender-name">{msg.senderName}</span>
                    )}
                    <span className="chat-bubble-text">{msg.message}</span>
                    <span className="chat-timestamp">{timeStr}</span>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input Bar */}
        <form onSubmit={handleSubmit} className="chat-input-bar">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Type a message..."
            maxLength={100}
            className="chat-text-input"
            autoFocus
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="chat-btn-send"
            title="Send Message"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </div>
  );
}

