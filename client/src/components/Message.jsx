import React, { useState, useEffect } from 'react';
import { useSocket } from '../stores/socketStore.jsx';
import { useQuote } from '../stores/quoteStore.jsx';
import { useEncryption } from '../stores/encryptionStore.jsx';
import { CryptoService } from '../services/crypto.js';
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
      <article className="message" onClick={handleClick} role="article" aria-label={`Message from ${message.username}`}>
        <div className="message-avatar" aria-hidden="true">
          {message.username[0].toUpperCase()}
        </div>
        <div className="message-content">
          <div className="message-header">
            <span className="message-author">{message.username}</span>
            <time className="message-time" dateTime={new Date(message.created_at * 1000).toISOString()}>{timeString}</time>
          </div>
          <div className="message-text">
            {displayContent.split('\n').map((line, i) => {
              if (line.startsWith('> ')) {
                return (
                  <div key={i} className="quoted-line">
                    {line.substring(2)}
                  </div>
                );
              }
              return <div key={i}>{line}</div>;
            })}
          </div>
          {message.image_url && (
            <figure className="message-image">
              <img 
                src={message.image_url} 
                alt={`Image shared by ${message.username} at ${timeString}`}
                loading="lazy"
              />
            </figure>
          )}
          {message.thread_count > 0 && (
            <div className="thread-info">
              <span className="thread-count">{message.thread_count} replies</span>
              <span className="thread-last">last at {threadLastTime}</span>
            </div>
          )}
          <div className="message-actions">
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={handleQuote}
              aria-label="Quote this message"
            >
              quote
            </button>
            <button 
              className="btn btn-sm btn-ghost" 
              onClick={handleReply}
              aria-label={`Open thread for this message (${message.thread_count || 0} replies)`}
            >
              thread
            </button>
          </div>
        </div>
      </article>

      {showThread && (
        <ThreadView
          parentMessage={message}
          onClose={() => setShowThread(false)}
        />
      )}
    </>
  );
}