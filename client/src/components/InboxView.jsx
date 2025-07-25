import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import { useSocket } from '../stores/socketStore.jsx';
import Message from './Message.jsx';
import './InboxView.css';

export default function InboxView() {
  const { currentWorkspace, messages } = useWorkspace();
  const { user } = useAuth();
  const socket = useSocket();
  const [inboxMessages, setInboxMessages] = useState([]);

  useEffect(() => {
    if (currentWorkspace && user) {
      // Collect all messages that quote or reply to the user
      const userMessages = [];
      
      Object.values(messages).forEach(channelMessages => {
        channelMessages.forEach(msg => {
          // Check if message quotes the user
          const quotesUser = msg.content.includes(`> ${user.username}:`);
          
          // Check if message is a direct reply in thread
          const isDirectReply = msg.thread_id && channelMessages.some(m => 
            m.id === msg.thread_id && m.user_id === user.id
          );
          
          if ((quotesUser || isDirectReply) && msg.user_id !== user.id) {
            userMessages.push(msg);
          }
        });
      });
      
      // Sort by timestamp, most recent first
      userMessages.sort((a, b) => b.created_at - a.created_at);
      setInboxMessages(userMessages);
    }
  }, [currentWorkspace, messages, user]);

  return (
    <div className="inbox-view">
      <div className="inbox-header">
        <h2>inbox</h2>
        <span className="inbox-subtitle">replies and quotes to you</span>
      </div>

      <div className="inbox-content">
        {inboxMessages.length === 0 ? (
          <div className="empty-inbox">
            <div className="empty-icon">📥</div>
            <div className="empty-text">no messages yet</div>
            <div className="empty-hint">quotes and replies to your messages will appear here</div>
          </div>
        ) : (
          <div className="inbox-messages">
            {inboxMessages.map(msg => (
              <div key={msg.id} className="inbox-item">
                <div className="inbox-context">
                  in #{msg.channel_name || 'channel'}
                </div>
                <Message message={msg} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}