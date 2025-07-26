import React, { useState, useRef, useEffect } from 'react';
import { useServer } from '../stores/serverStore.jsx';
import { useSocket } from '../stores/socketStore.jsx';
import { useQuote } from '../stores/quoteStore.jsx';
import { useEncryption } from '../stores/encryptionStore.jsx';
import { CryptoService } from '../services/crypto.js';
import MessageList from './MessageList.jsx';
import MessageInput from './MessageInput.jsx';
import VoiceCall from './VoiceCall.jsx';
import QuotePreview from './QuotePreview.jsx';
import EncryptionModal from './EncryptionModal.jsx';
import './MessageArea.css';

export default function MessageArea() {
  const { currentChannel, messages, sendMessage } = useServer();
  const socket = useSocket();
  const { quotedMessage, clearQuote } = useQuote();
  const { getPassword, setPassword } = useEncryption();
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const messagesEndRef = useRef(null);

  const channelMessages = currentChannel ? messages[currentChannel.id] || [] : [];

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [channelMessages]);

  useEffect(() => {
    // Check if channel is encrypted and we don't have password
    if (currentChannel?.encrypted && !getPassword(currentChannel.id)) {
      setShowPasswordModal(true);
    }
  }, [currentChannel]);

  if (!currentChannel) {
    return (
      <div className="message-area empty-state">
        <div className="empty-content">
          <div className="empty-icon">#</div>
          <div className="empty-text">no channel selected</div>
          <div className="empty-hint">choose a channel from the sidebar</div>
        </div>
      </div>
    );
  }

  return (
    <div className="message-area">
      <div className="message-header">
        <div className="channel-info">
          <span className="channel-hash">#</span>
          <h2 className="channel-title">{currentChannel.name}</h2>
        </div>
        <button 
          className="voice-btn"
          onClick={() => setShowVoiceCall(!showVoiceCall)}
          title="Voice call"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path>
          </svg>
        </button>
      </div>

      <div className="message-content">
        <MessageList messages={channelMessages} />
        <div ref={messagesEndRef} />
      </div>

      {quotedMessage && (
        <QuotePreview message={quotedMessage} onClear={clearQuote} />
      )}
      
      <MessageInput onSend={async (content) => {
        let finalContent = content;
        if (quotedMessage) {
          finalContent = `> ${quotedMessage.username}: ${quotedMessage.content}\n\n${content}`;
          clearQuote();
        }
        
        // Encrypt if channel is encrypted
        if (currentChannel.encrypted && getPassword(currentChannel.id)) {
          try {
            const encrypted = await CryptoService.encrypt(finalContent, getPassword(currentChannel.id));
            socket.emit('send_message', { 
              content: encrypted.ciphertext,
              encrypted: true,
              encryptionMetadata: encrypted.metadata
            });
          } catch (error) {
            console.error('Encryption failed:', error);
          }
        } else {
          sendMessage(finalContent);
        }
      }} />

      {showVoiceCall && (
        <VoiceCall 
          channelId={currentChannel.id}
          onClose={() => setShowVoiceCall(false)}
        />
      )}

      {showPasswordModal && currentChannel?.encrypted && (
        <EncryptionModal
          channelName={currentChannel.name}
          mode="unlock"
          onSubmit={(password) => {
            setPassword(currentChannel.id, password);
            setShowPasswordModal(false);
          }}
          onCancel={() => setShowPasswordModal(false)}
        />
      )}
    </div>
  );
}