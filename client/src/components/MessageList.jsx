import React from 'react';
import Message from './Message.jsx';
import './MessageList.css';

export default function MessageList({ messages }) {
  if (messages.length === 0) {
    return (
      <div className="empty-messages">
        be the first to say something
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