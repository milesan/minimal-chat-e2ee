import React, { useState, useEffect } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import './LinkComments.css';

export default function LinkComments({ linkId, onClose }) {
  const { token } = useAuth();
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');

  useEffect(() => {
    fetchComments();
  }, [linkId]);

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/links/links/${linkId}/comments`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/links/links/${linkId}/comments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ content: newComment })
      });

      if (response.ok) {
        setNewComment('');
        fetchComments();
      }
    } catch (error) {
      console.error('Failed to add comment:', error);
    }
  };

  return (
    <div className="link-comments">
      <div className="comments-header">
        <span className="comments-title">comments ({comments.length})</span>
        <button className="close-comments" onClick={onClose}>×</button>
      </div>

      <div className="comments-list">
        {comments.length === 0 ? (
          <div className="no-comments">no comments yet</div>
        ) : (
          comments.map(comment => (
            <div key={comment.id} className="comment">
              <div className="comment-header">
                <span className="comment-author">{comment.username}</span>
                <span className="comment-time">
                  {new Date(comment.created_at * 1000).toLocaleString()}
                </span>
              </div>
              <div className="comment-text">{comment.content}</div>
            </div>
          ))
        )}
      </div>

      <form className="comment-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="comment-input"
          placeholder="add comment..."
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
        />
        <button type="submit" className="comment-submit">post</button>
      </form>
    </div>
  );
}