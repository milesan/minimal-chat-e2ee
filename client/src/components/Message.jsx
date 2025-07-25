import React, { useState, useEffect } from 'react';
import { useSocket } from '../stores/socketStore.jsx';
import { useQuote } from '../stores/quoteStore.jsx';
import { useEncryption } from '../stores/encryptionStore.jsx';
import { CryptoService } from '../services/crypto.js';
import { escapeHtml, isValidImageUrl, sanitizeUsername } from '../utils/sanitize.js';
import ThreadView from './ThreadView.jsx';
import './Message.css';

export default function Message({ message }) {
  const [showThread, setShowThread] = useState(false);
  const [decryptedContent, setDecryptedContent] = useState(null);
  const [decryptError, setDecryptError] = useState(false);
  const socket = useSocket();
  const { quoteMessage } = useQuote();
  const { getPassword } = useEncryption();
  const timestamp = new Date(message.created_at * 1000);
  const timeString = timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  useEffect(() => {
    if (message.encrypted && message.encryption_metadata) {
      const password = getPassword(message.channel_id);
      if (password) {
        CryptoService.decrypt(message.content, message.encryption_metadata, password)
          .then(decrypted => {
            setDecryptedContent(decrypted);
            setDecryptError(false);
          })
          .catch(err => {
            console.error('Decryption failed:', err);
            setDecryptError(true);
          });
      }
    }
  }, [message, getPassword]);

  const displayContent = message.encrypted ? 
    (decryptedContent || (decryptError ? '🔒 [decryption failed]' : '🔒 [encrypted]')) : 
    message.content;

  const handleClick = (e) => {
    if (!e.target.closest('.reply-btn')) {
      setShowThread(true);
    }
  };

  const handleReply = (e) => {
    e.stopPropagation();
    setShowThread(true);
  };

  const handleQuote = (e) => {
    e.stopPropagation();
    // Use decrypted content for quotes if available
    const messageToQuote = message.encrypted && decryptedContent ? 
      { ...message, content: decryptedContent } : 
      message;
    quoteMessage(messageToQuote);
  };

  const threadLastTime = message.thread_last_message 
    ? new Date(message.thread_last_message * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <>
      <div className="message" onClick={handleClick}>
        <div className="message-avatar">
          {sanitizeUsername(message.username)[0]?.toUpperCase() || '?'}
        </div>
        <div className="message-content">
          <div className="message-header">
            <span className="message-author">{sanitizeUsername(message.username)}</span>
            <span className="message-time">{timeString}</span>
          </div>
          <div className="message-text">
            {displayContent.split('\n').map((line, i) => {
              if (line.startsWith('> ')) {
                return (
                  <div key={i} className="quoted-line">
                    {escapeHtml(line.substring(2))}
                  </div>
                );
              }
              return <div key={i}>{escapeHtml(line)}</div>;
            })}
          </div>
          {message.image_url && isValidImageUrl(message.image_url) && (
            <div className="message-image">
              <img src={message.image_url} alt="Uploaded image" />
            </div>
          )}
          {message.thread_count > 0 && (
            <div className="thread-info">
              <span className="thread-count">{message.thread_count} replies</span>
              <span className="thread-last">last at {threadLastTime}</span>
            </div>
          )}
          <div className="message-actions">
            <button className="reply-btn" onClick={handleQuote}>
              quote
            </button>
            <button className="reply-btn" onClick={handleReply}>
              thread
            </button>
          </div>
        </div>
      </div>

      {showThread && (
        <ThreadView
          parentMessage={message}
          onClose={() => setShowThread(false)}
        />
      )}
    </>
  );
}