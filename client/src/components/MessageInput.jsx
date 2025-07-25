import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../stores/socketStore.jsx';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import './MessageInput.css';

export default function MessageInput({ onSend, placeholder = "Type a message..." }) {
  const [message, setMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const socket = useSocket();
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (message.trim()) {
      onSend(message);
      setMessage('');
      if (inputRef.current) {
        inputRef.current.style.height = 'auto';
      }
      if (socket && isTyping) {
        socket.emit('stop_typing');
        setIsTyping(false);
      }
    }
  };

  const handleTyping = (e) => {
    setMessage(e.target.value);
    
    // Auto-resize textarea
    e.target.style.height = 'auto';
    e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';

    if (socket) {
      if (!isTyping && e.target.value.trim()) {
        socket.emit('typing');
        setIsTyping(true);
      }

      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        if (isTyping) {
          socket.emit('stop_typing');
          setIsTyping(false);
        }
      }, 3000);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-container" onSubmit={handleSubmit}>
      <textarea
        ref={inputRef}
        className="message-input"
        placeholder={placeholder}
        value={message}
        onChange={handleTyping}
        onKeyDown={handleKeyDown}
        rows="1"
      />
      <button type="submit" className="send-btn" disabled={!message.trim()}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
    </form>
  );
}