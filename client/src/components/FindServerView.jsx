import React, { useState, useEffect } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import { useServer } from '../stores/serverStore.jsx';
import { getApiUrl } from '../config.js';
import './FindServerView.css';

export default function FindServerView({ onClose }) {
  const { token } = useAuth();
  const { fetchServers } = useServer();
  const [publicServers, setPublicServers] = useState([]);
  const [inviteCode, setInviteCode] = useState('');
  const [encryptionKey, setEncryptionKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    fetchPublicServers();
  }, []);

  const fetchPublicServers = async () => {
    try {
      const response = await fetch(getApiUrl('/api/channels/servers/public'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch public servers');
      }
      
      const data = await response.json();
      setPublicServers(data);
    } catch (error) {
      setError('Failed to load public servers');
    } finally {
      setLoading(false);
    }
  };

  const joinPublicServer = async (serverId) => {
    setJoining(true);
    setError('');
    
    try {
      const response = await fetch(getApiUrl(`/api/channels/servers/${serverId}/join`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join server');
      }
      
      await fetchServers();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setJoining(false);
    }
  };

  const joinByInviteCode = async (e) => {
    e.preventDefault();
    if (!inviteCode.trim()) return;
    
    setJoining(true);
    setError('');
    
    try {
      const response = await fetch(getApiUrl('/api/channels/servers/join-by-code'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          code: inviteCode.trim(),
          encryptionKey: encryptionKey.trim() || undefined
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join server');
      }
      
      await fetchServers();
      onClose();
    } catch (error) {
      setError(error.message);
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="find-server-view">
      <div className="find-server-header">
        <h2>Find Servers</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="find-server-content">
        <div className="invite-code-section">
          <h3>Join with Invite Code</h3>
          <form onSubmit={joinByInviteCode}>
            <div className="invite-code-input-group">
              <input
                type="text"
                placeholder="Enter invite code"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                disabled={joining}
                className="invite-input"
              />
              <input
                type="password"
                placeholder="Encryption key (if required)"
                value={encryptionKey}
                onChange={(e) => setEncryptionKey(e.target.value)}
                disabled={joining}
                className="invite-input"
              />
              <button type="submit" disabled={joining || !inviteCode.trim()}>
                {joining ? 'Joining...' : 'Join'}
              </button>
            </div>
            {error && error.includes('encryption key') && (
              <p className="encryption-hint">
                This server is encrypted. Ask the server admin for the encryption key.
              </p>
            )}
          </form>
        </div>

        <div className="divider">
          <span>or</span>
        </div>

        <div className="public-servers-section">
          <h3>Public Servers</h3>
          
          {loading ? (
            <div className="loading">Loading public servers...</div>
          ) : publicServers.length === 0 ? (
            <div className="empty-state">No public servers available</div>
          ) : (
            <div className="public-servers-list">
              {publicServers.map(server => (
                <div key={server.id} className="public-server-item">
                  <div className="server-info">
                    <h4>{server.name}</h4>
                    {server.description && (
                      <p className="server-description">{server.description}</p>
                    )}
                    <span className="member-count">{server.member_count} members</span>
                  </div>
                  <button
                    onClick={() => joinPublicServer(server.id)}
                    disabled={joining}
                    className="join-button"
                  >
                    Join
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">{error}</div>
        )}
      </div>
    </div>
  );
}