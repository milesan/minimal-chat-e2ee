import React, { useState, useEffect } from 'react';
import { useServer } from '../stores/serverStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import './WorldView.css';

export default function WorldView({ onViewChange }) {
  const { currentServer, channels, messages, setCurrentChannel } = useServer();
  const { token } = useAuth();
  const [worldMessages, setWorldMessages] = useState([]);

  useEffect(() => {
    if (currentServer && channels.length > 0) {
      // Collect all messages from all channels
      const allMessages = [];
      
      channels.forEach(channel => {
        const channelMessages = messages[channel.id] || [];
        channelMessages.forEach(msg => {
          if (!msg.thread_id) { // Only show top-level messages
            allMessages.push({
              ...msg,
              channel_id: channel.id,
              channel_name: channel.name
            });
          }
        });
      });
      
      // Sort by timestamp, most recent first
      allMessages.sort((a, b) => b.created_at - a.created_at);
      
      // Take top 100 messages
      setWorldMessages(allMessages.slice(0, 100));
    }
  }, [currentServer, channels, messages]);

  const handleMessageClick = (message) => {
    // Find and set the channel
    const channel = channels.find(c => c.id === message.channel_id);
    if (channel) {
      setCurrentChannel(channel);
      // Switch to chat view
      if (onViewChange) {
        onViewChange('chat');
      }
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp * 1000);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <div className="world-view">
      <div className="world-header">
        <h2>world</h2>
        <span className="world-subtitle">all recent posts across {currentServer?.name || 'realm'}</span>
      </div>

      <div className="world-content">
        {worldMessages.length === 0 ? (
          <div className="empty-world">
            <div className="empty-icon">🌍</div>
            <div className="empty-text">no messages yet</div>
            <div className="empty-hint">messages from all channels will appear here</div>
          </div>
        ) : (
          <div className="world-messages">
            {worldMessages.map(msg => (
              <div 
                key={msg.id} 
                className="world-message"
                onClick={() => handleMessageClick(msg)}
              >
                <div className="world-message-header">
                  <span className="world-channel">#{msg.channel_name}</span>
                  <span className="world-time">{formatTime(msg.created_at)}</span>
                </div>
                <div className="world-message-content">
                  <div className="world-avatar">
                    {msg.username[0].toUpperCase()}
                  </div>
                  <div className="world-message-body">
                    <div className="world-author">{msg.username}</div>
                    <div className="world-text">{msg.content}</div>
                    {msg.thread_count > 0 && (
                      <div className="world-thread-info">
                        {msg.thread_count} {msg.thread_count === 1 ? 'reply' : 'replies'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}