import React, { useState, useEffect } from 'react';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import { useAuth } from '../stores/authStore.jsx';
import './WorkspaceSettings.css';

export default function WorkspaceSettings({ onClose }) {
  const { currentWorkspace } = useWorkspace();
  const { token } = useAuth();
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  
  const [workspaceName, setWorkspaceName] = useState('');
  const [imagesEnabled, setImagesEnabled] = useState(false);

  useEffect(() => {
    if (currentWorkspace) {
      fetchSettings();
    }
  }, [currentWorkspace]);

  const fetchSettings = async () => {
    try {
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        setSettings(data);
        setWorkspaceName(data.name);
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
      const response = await fetch(`/api/workspaces/${currentWorkspace.id}/settings`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: workspaceName,
          images_enabled: imagesEnabled
        })
      });

      if (response.ok) {
        const updated = await response.json();
        // Update workspace in store
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
            <h2>realm settings</h2>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
          <div className="settings-content">
            <p className="settings-error">only realm owners can modify settings</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-header">
          <h2>workspace settings</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>
        
        <form className="settings-form" onSubmit={handleSave}>
          <div className="settings-section">
            <h3>general</h3>
            
            <div className="form-group">
              <label htmlFor="workspace-name">realm name</label>
              <input
                id="workspace-name"
                type="text"
                className="input"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
              />
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
      </div>
    </div>
  );
}