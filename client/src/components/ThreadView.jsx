import React, { useState, useEffect } from 'react';
import { useSocket } from '../stores/socketStore.jsx';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import { useQuote } from '../stores/quoteStore.jsx';
import { escapeHtml, sanitizeUsername } from '../utils/sanitize.js';
import MessageInput from './MessageInput.jsx';
import QuotePreview from './QuotePreview.jsx';
import './ThreadView.css';

export default function ThreadView({ parentMessage, onClose }) {
  const socket = useSocket();
  const { sendMessage } = useWorkspace();
  const { quotedMessage, quoteMessage, clearQuote } = useQuote();
  const [threadMessages, setThreadMessages] = useState([]);

  useEffect(() => {
    if (socket) {
      socket.emit('join_thread', parentMessage.id);

      const handleThreadMessages = (data) => {
        setThreadMessages(data.messages);
      };

      const handleNewThreadMessage = (message) => {
        setThreadMessages(prev => [...prev, message]);
      };

      socket.on('thread_messages', handleThreadMessages);
      socket.on('new_thread_message', handleNewThreadMessage);

      return () => {
        socket.off('thread_messages', handleThreadMessages);
        socket.off('new_thread_message', handleNewThreadMessage);
      };
    }
  }, [socket, parentMessage.id]);

  const handleSendReply = (content) => {
    if (quotedMessage) {
      const quotedContent = `> ${quotedMessage.username}: ${quotedMessage.content}\n\n${content}`;
      sendMessage(quotedContent, parentMessage.id);
      clearQuote();
    } else {
      sendMessage(content, parentMessage.id);
    }
  };

  const handleQuoteMessage = (message) => {
    quoteMessage(message);
  };

  return (
    <div className="thread-overlay" onClick={onClose}>
      <div className="thread-panel" onClick={(e) => e.stopPropagation()}>
        <div className="thread-header">
          <h3>Thread</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="thread-content">
          <div className="thread-parent">
            <div className="message-avatar">
              {sanitizeUsername(parentMessage.username)[0]?.toUpperCase() || '?'}
            </div>
            <div className="message-content">
              <div className="message-author">{sanitizeUsername(parentMessage.username)}</div>
              <div className="message-text">{escapeHtml(parentMessage.content)}</div>
              <div className="message-actions">
                <button className="reply-btn" onClick={() => handleQuoteMessage(parentMessage)}>
                  quote
                </button>
              </div>
            </div>
          </div>

          <div className="thread-divider">
            <span>{threadMessages.length} {threadMessages.length === 1 ? 'reply' : 'replies'}</span>
          </div>

          <div className="thread-messages">
            {threadMessages.map(msg => (
              <div key={msg.id} className="thread-message">
                <div className="message-avatar">
                  {sanitizeUsername(msg.username)[0]?.toUpperCase() || '?'}
                </div>
                <div className="message-content">
                  <div className="message-author">{sanitizeUsername(msg.username)}</div>
                  <div className="message-text">{escapeHtml(msg.content)}</div>
                  <div className="message-actions">
                    <button className="reply-btn" onClick={() => handleQuoteMessage(msg)}>
                      quote
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {quotedMessage && (
          <QuotePreview message={quotedMessage} onClear={clearQuote} />
        )}
        
        <div className="thread-input">
          <MessageInput onSend={handleSendReply} placeholder="Reply in thread..." />
        </div>
      </div>
    </div>
  );
}