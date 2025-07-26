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
      const response = await fetch(getApiUrl('/api/servers/public'), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch public realms');
      }
      
      const data = await response.json();
      setPublicServers(data);
    } catch (error) {
      setError('Failed to load public realms');
    } finally {
      setLoading(false);
    }
  };

  const joinPublicServer = async (serverId) => {
    setJoining(true);
    setError('');
    
    try {
      const response = await fetch(getApiUrl(`/api/servers/${serverId}/join`), {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to join realm');
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
      const response = await fetch(getApiUrl('/api/servers/join-by-code'), {
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
        throw new Error(data.error || 'Failed to join realm');
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
    <div className="find-realm-view">
      <div className="find-realm-header">
        <h2>Find Realms</h2>
        <button className="close-button" onClick={onClose}>×</button>
      </div>

      <div className="find-realm-content">
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
                This realm is encrypted. Ask the realm admin for the encryption key.
              </p>
            )}
          </form>
        </div>

        <div className="divider">
          <span>or</span>
        </div>

        <div className="public-realms-section">
          <h3>Public Realms</h3>
          
          {loading ? (
            <div className="loading">Loading public realms...</div>
          ) : publicServers.length === 0 ? (
            <div className="empty-state">No public realms available</div>
          ) : (
            <div className="public-realms-list">
              {publicServers.map(realm => (
                <div key={realm.id} className="public-realm-item">
                  <div className="realm-info">
                    <h4>{realm.name}</h4>
                    {realm.description && (
                      <p className="realm-description">{realm.description}</p>
                    )}
                    <span className="member-count">{realm.member_count} members</span>
                  </div>
                  <button
                    onClick={() => joinPublicServer(realm.id)}
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