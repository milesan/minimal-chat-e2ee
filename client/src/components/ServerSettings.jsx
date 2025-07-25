import React, { useState, useEffect } from 'react';
import { useServer } from '../stores/serverStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import InvitationManager from './InvitationManager.jsx';
import './ServerSettings.css';

export default function ServerSettings({ onClose }) {
  const { currentServer } = useServer();
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [serverVisibility, setServerVisibility] = useState('private');
  const [imagesEnabled, setImagesEnabled] = useState(false);

  useEffect(() => {
    if (currentServer) {
      fetchSettings();
    }
  }, [currentServer]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/servers/${currentServer.id}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setServerName(data.name);
        setServerDescription(data.description || '');
        setServerVisibility(data.visibility || 'private');
        setImagesEnabled(data.images_enabled === 1);
      }
    } catch (error) {
      console.error('Failed to fetch settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    try {
      const response = await fetch(`/api/servers/${currentServer.id}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: serverName,
          description: serverDescription,
          visibility: serverVisibility,
          images_enabled: imagesEnabled
        })
      });

      if (response.ok) {
        const updated = await response.json();
        // Update server in store
        window.location.reload(); // Simple refresh for now
      } else {
        const error = await response.json();
        setError(error.error || 'Failed to update settings');
      }
    } catch (error) {
      setError('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading settings...</div>;
  }

  if (!settings?.is_owner) {
    return (
      <div className="settings-overlay" onClick={onClose}>
        <div className="settings-modal" onClick={e => e.stopPropagation()}>
          <div className="settings-header">
            <h2>server settings</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="settings-content">
            <p className="settings-error">only server owners can modify settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>server settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form className="settings-form" onSubmit={handleSave}>
          <div className="settings-section">
            <h3>general</h3>
            
            <div className="form-group">
              <label htmlFor="server-name">server name</label>
              <input
                id="server-name"
                type="text"
                className="input"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="server-description">description (optional)</label>
              <textarea
                id="server-description"
                className="input"
                rows="3"
                value={serverDescription}
                onChange={(e) => setServerDescription(e.target.value)}
                placeholder="Tell people what this server is about"
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="server-visibility">visibility</label>
              <select
                id="server-visibility"
                className="input"
                value={serverVisibility}
                onChange={(e) => setServerVisibility(e.target.value)}
              >
                <option value="private">Private - Invite only</option>
                <option value="public">Public - Anyone can join</option>
              </select>
              <div className="feature-info">
                {serverVisibility === 'public' ? 
                  'Anyone with an account can find and join this server' : 
                  'Only invited members can join this server'
                }
              </div>
            </div>
          </div>

          <div className="settings-section">
            <h3>features</h3>
            
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={imagesEnabled}
                  onChange={(e) => setImagesEnabled(e.target.checked)}
                />
                <span>enable image uploads</span>
              </label>
              <div className="feature-info">
                {imagesEnabled ? (
                  <span className="feature-status enabled">images enabled (free during beta)</span>
                ) : (
                  <span className="feature-status">$5/month when out of beta</span>
                )}
              </div>
            </div>
          </div>

          {error && (
            <div className="settings-error">{error}</div>
          )}

          <div className="settings-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'saving...' : 'save changes'}
            </button>
          </div>
        </form>
        
        {settings?.is_owner && (
          <div className="settings-section">
            <InvitationManager serverId={currentServer.id} />
          </div>
        )}
      </div>
    </div>
  );
}