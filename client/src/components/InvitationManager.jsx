import React, { useState, useEffect } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import { useServer } from '../stores/serverStore.jsx';
import { getApiUrl } from '../config.js';
import './InvitationManager.css';

export default function InvitationManager({ serverId }) {
  const { token } = useAuth();
  const [invitations, setInvitations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [expiresIn, setExpiresIn] = useState('24');

  useEffect(() => {
    fetchInvitations();
  }, [serverId]);

  const fetchInvitations = async () => {
    try {
      const response = await fetch(getApiUrl(`/api/channels/servers/${serverId}/invitations`), {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch invitations');
      }
      
      const data = await response.json();
      setInvitations(data);
    } catch (error) {
      setError('Failed to load invitations');
    } finally {
      setLoading(false);
    }
  };

  const createInvitation = async (e) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    
    try {
      const response = await fetch(getApiUrl(`/api/channels/servers/${serverId}/invitations`), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          maxUses: maxUses ? parseInt(maxUses) : null,
          expiresIn: expiresIn ? parseInt(expiresIn) : null
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invitation');
      }
      
      await fetchInvitations();
      setMaxUses('');
      setExpiresIn('24');
      
      // Copy invite code to clipboard
      const inviteUrl = window.location.origin + data.inviteUrl;
      navigator.clipboard.writeText(data.code);
      
      let alertMessage = `Invitation created! Code: ${data.code}\nThe code has been copied to your clipboard.`;
      if (data.requiresEncryptionKey) {
        alertMessage += '\n\n⚠️ This server is encrypted! You must also share the encryption key with the invitee.';
      }
      alert(alertMessage);
    } catch (error) {
      setError(error.message);
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    return new Date(timestamp * 1000).toLocaleString();
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return expiresAt < Math.floor(Date.now() / 1000);
  };

  const copyCode = (code) => {
    navigator.clipboard.writeText(code);
    alert('Invite code copied to clipboard!');
  };

  return (
    <div className="invitation-manager">
      <h3>Realm Invitations</h3>
      
      <div className="create-invitation-section">
        <h4>Create New Invitation</h4>
        <form onSubmit={createInvitation}>
          <div className="invitation-options">
            <div className="form-group">
              <label htmlFor="max-uses">Max Uses (optional)</label>
              <input
                id="max-uses"
                type="number"
                min="1"
                placeholder="Unlimited"
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
                disabled={creating}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="expires-in">Expires In (hours)</label>
              <input
                id="expires-in"
                type="number"
                min="1"
                placeholder="24"
                value={expiresIn}
                onChange={(e) => setExpiresIn(e.target.value)}
                disabled={creating}
              />
            </div>
          </div>
          
          <button type="submit" className="btn btn-primary" disabled={creating}>
            {creating ? 'Creating...' : 'Create Invitation'}
          </button>
        </form>
        
        {error && (
        <div className="error-message">
          {error}
          {error.includes('6 months') && (
            <div className="error-details">
              You can only create one invitation per server every 6 months.
            </div>
          )}
        </div>
      )}
      </div>

      <div className="invitations-list-section">
        <h4>Active Invitations</h4>
        
        {loading ? (
          <div className="loading">Loading invitations...</div>
        ) : invitations.length === 0 ? (
          <div className="empty-state">No invitations created yet</div>
        ) : (
          <div className="invitations-list">
            {invitations.map(invitation => (
              <div 
                key={invitation.id} 
                className={`invitation-item ${isExpired(invitation.expires_at) ? 'expired' : ''}`}
              >
                <div className="invitation-code">
                  <code>{invitation.code}</code>
                  <button 
                    className="copy-button"
                    onClick={() => copyCode(invitation.code)}
                    title="Copy code"
                  >
                    📋
                  </button>
                </div>
                
                <div className="invitation-details">
                  <div className="detail">
                    <span className="label">Uses:</span>
                    <span className="value">
                      {invitation.uses_count} / {invitation.max_uses || '∞'}
                    </span>
                  </div>
                  
                  <div className="detail">
                    <span className="label">Expires:</span>
                    <span className="value">
                      {formatDate(invitation.expires_at)}
                      {isExpired(invitation.expires_at) && ' (Expired)'}
                    </span>
                  </div>
                  
                  <div className="detail">
                    <span className="label">Created by:</span>
                    <span className="value">{invitation.created_by_username}</span>
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