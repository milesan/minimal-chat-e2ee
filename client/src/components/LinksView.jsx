import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import LinkItem from './LinkItem.jsx';
import './LinksView.css';

export default function LinksView({ isGreatest = false }) {
  const { currentWorkspace } = useWorkspace();
  const { token } = useAuth();
  const [links, setLinks] = useState([]);
  const [showAddLink, setShowAddLink] = useState(false);
  const [newLink, setNewLink] = useState({ url: '', title: '', topic: '', description: '', short_description: '' });
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    if (currentWorkspace) {
      fetchLinks();
    }
  }, [currentWorkspace]);

  const fetchLinks = async () => {
    try {
      const endpoint = isGreatest 
        ? `/api/links/workspaces/${currentWorkspace.id}/links/greatest`
        : `/api/links/workspaces/${currentWorkspace.id}/links`;
      const response = await fetch(endpoint, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLinks(data);
    } catch (error) {
      console.error('Failed to fetch links:', error);
    }
  };

  const handleAddLink = async (e) => {
    e.preventDefault();
    setLinkError('');
    try {
      const response = await fetch(`/api/links/workspaces/${currentWorkspace.id}/links`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newLink)
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to add link');
      }

      await fetchLinks();
      setNewLink({ url: '', title: '', topic: '', description: '', short_description: '' });
      setShowAddLink(false);
    } catch (error) {
      console.error('Failed to add link:', error);
      setLinkError(error.message || 'Failed to add link');
    }
  };

  return (
    <div className="links-view">
      {!currentWorkspace ? (
        <div className="no-workspace">
          <p>Please create or select a realm first</p>
        </div>
      ) : (
        <>
          <div className="links-header">
            <h2>{isGreatest ? 'greatest links' : 'links'}</h2>
            {!isGreatest && (
              <button 
                className="add-link-btn"
                onClick={() => setShowAddLink(!showAddLink)}
              >
                {showAddLink ? 'cancel' : 'add link'}
              </button>
            )}
          </div>

      {showAddLink && (
        <form className="add-link-form" onSubmit={handleAddLink}>
          <input
            type="url"
            className="input"
            placeholder="url"
            value={newLink.url}
            onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
            required
          />
          <input
            type="text"
            className="input"
            placeholder="title"
            value={newLink.title}
            onChange={(e) => setNewLink({ ...newLink, title: e.target.value })}
            required
          />
          <input
            type="text"
            className="input"
            placeholder="topic (optional)"
            value={newLink.topic}
            onChange={(e) => setNewLink({ ...newLink, topic: e.target.value })}
          />
          <textarea
            className="input textarea"
            placeholder="description (optional - can be long)"
            value={newLink.description}
            onChange={(e) => setNewLink({ ...newLink, description: e.target.value })}
            rows="4"
          />
          <input
            type="text"
            className="input"
            placeholder="short description (optional - shown under link)"
            value={newLink.short_description}
            onChange={(e) => setNewLink({ ...newLink, short_description: e.target.value })}
          />
          {linkError && (
            <div className="error-message" style={{ color: 'red', marginTop: '8px' }}>
              {linkError}
            </div>
          )}
          <button type="submit" className="btn btn-primary">submit</button>
        </form>
      )}

      <div className="links-list">
        {links.length === 0 ? (
          <div className="empty-links">
            {isGreatest 
              ? 'no links with 25+ votes yet' 
              : 'no links yet'
            }
          </div>
        ) : (
          <>
            {isGreatest && (
              <div className="greatest-info">
                only showing links with 25+ votes
              </div>
            )}
            {links.map(link => (
              <LinkItem key={link.id} link={link} onUpdate={fetchLinks} />
            ))}
          </>
        )}
      </div>
        </>
      )}
    </div>
  );
}