import React from 'react';
import './QuotePreview.css';

export default function QuotePreview({ message, onClear }) {
  return (
    <div className="quote-preview">
      <div className="quote-content">
        <div className="quote-header">
          <span className="quote-label">replying to</span>
          <span className="quote-author">{message.username}</span>
        </div>
        <div className="quote-text">{message.content}</div>
      </div>
      <button className="quote-clear" onClick={onClear}>
        ×
      </button>
    </div>
  );
}