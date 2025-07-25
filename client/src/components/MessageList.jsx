import React from 'react';
import Message from './Message.jsx';
import './MessageList.css';

export default function MessageList({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">💬</div>
        <div className="empty-state-title">No messages yet</div>
        <div className="empty-state-description">be the first to say something</div>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  );
}