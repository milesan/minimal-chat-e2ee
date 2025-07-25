import React, { useState } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import LinkComments from './LinkComments.jsx';
import './LinkItem.css';

export default function LinkItem({ link, onUpdate }) {
  const { token } = useAuth();
  const [showComments, setShowComments] = useState(false);
  const [userRating, setUserRating] = useState(link.user_rating || 0);

  const handleRate = async (rating) => {
    try {
      const response = await fetch(`/api/links/links/${link.id}/rate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rating })
      });

      if (response.ok) {
        setUserRating(rating);
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to rate link:', error);
    }
  };

  return (
    <div className="link-item">
      <div className="link-main">
        <div className="link-content">
          <a href={link.url} target="_blank" rel="noopener noreferrer" className="link-title">
            {link.title}
          </a>
          {link.topic && <span className="link-topic">{link.topic}</span>}
          {link.short_description && (
            <div className="link-short-description">{link.short_description}</div>
          )}
          <div className="link-meta">
            <span className="link-author">by {link.creator_username}</span>
            <span className="link-stats">
              {link.avg_rating.toFixed(1)}/10 ({link.rating_count} votes)
            </span>
            <button 
              className="link-comments-btn"
              onClick={() => setShowComments(!showComments)}
            >
              {link.comment_count} comments
            </button>
          </div>
          {link.description && showComments && (
            <div className="link-description">
              <div className="description-label">description:</div>
              <div className="description-text">{link.description}</div>
            </div>
          )}
        </div>
        
        <div className="link-rating">
          <div className="rating-label">rate:</div>
          <div className="rating-buttons">
            {[...Array(11)].map((_, i) => (
              <button
                key={i}
                className={`rating-btn ${userRating === i ? 'active' : ''}`}
                onClick={() => handleRate(i)}
              >
                {i}
              </button>
            ))}
          </div>
        </div>
      </div>

      {showComments && (
        <LinkComments linkId={link.id} onClose={() => setShowComments(false)} />
      )}
    </div>
  );
}