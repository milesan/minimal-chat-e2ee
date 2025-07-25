import React, { useState } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import { useWorkspace } from '../stores/workspaceStore.jsx';
import { useEncryption } from '../stores/encryptionStore.jsx';
import WorkspaceSettings from './WorkspaceSettings.jsx';
import EncryptionModal from './EncryptionModal.jsx';
import './Sidebar.css';

export default function Sidebar({ view, setView }) {
  const { user, logout } = useAuth();
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    channels,
    currentChannel,
    setCurrentChannel,
    createWorkspace,
    createChannel
  } = useWorkspace();
  
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');
  const [channelName, setChannelName] = useState('');
  const [workspaceError, setWorkspaceError] = useState('');
  const [channelError, setChannelError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [createEncrypted, setCreateEncrypted] = useState(false);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [newEncryptedChannel, setNewEncryptedChannel] = useState(null);
  const { setPassword } = useEncryption();

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setWorkspaceError('');
    setWorkspaceLoading(true);
    try {
      await createWorkspace(workspaceName);
      setWorkspaceName('');
      setShowWorkspaceModal(false);
    } catch (error) {
      console.error('Failed to create workspace:', error);
      setWorkspaceError(error.message || 'Failed to create workspace');
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    setChannelError('');
    setChannelLoading(true);
    try {
      const newChannel = await createChannel(channelName, createEncrypted);
      setChannelName('');
      setCreateEncrypted(false);
      setShowChannelModal(false);
      
      // If encrypted, show password modal
      if (createEncrypted && newChannel) {
        setNewEncryptedChannel(newChannel);
        setShowEncryptionModal(true);
      }
    } catch (error) {
      console.error('Failed to create channel:', error);
      setChannelError(error.message || 'Failed to create channel');
    } finally {
      setChannelLoading(false);
    }
  };

  return (
    <aside className="sidebar" role="navigation" aria-label="Main navigation">
      <div className="sidebar-header">
        <div className="workspace-selector">
          <select
            className="workspace-dropdown"
            value={currentWorkspace?.id || ''}
            onChange={(e) => {
              const workspace = workspaces.find(w => w.id === e.target.value);
              setCurrentWorkspace(workspace);
            }}
            aria-label="Select workspace"
          >
            {workspaces.length === 0 ? (
              <option value="">no workspaces</option>
            ) : (
              workspaces.map(workspace => (
                <option key={workspace.id} value={workspace.id}>
                  {workspace.name}
                </option>
              ))
            )}
          </select>
          <button 
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => setShowWorkspaceModal(true)}
            aria-label="Create new workspace"
            title="Create workspace"
          >
            <span aria-hidden="true">+</span>
          </button>
          {currentWorkspace && (
            <button 
              className="btn btn-icon btn-sm btn-ghost"
              onClick={() => setShowSettings(true)}
              aria-label="Workspace settings"
              title="Workspace settings"
            >
              <span aria-hidden="true">⚙</span>
            </button>
          )}
        </div>
      </div>

      <nav className="view-selector" role="tablist" aria-label="View selector">
        <button 
          className={`view-btn ${view === 'chat' ? 'active' : ''}`}
          onClick={() => setView('chat')}
          role="tab"
          aria-selected={view === 'chat'}
          aria-label="Chat view"
          tabIndex={view === 'chat' ? 0 : -1}
        >
          chat
        </button>
        <button 
          className={`view-btn ${view === 'dms' ? 'active' : ''}`}
          onClick={() => setView('dms')}
          role="tab"
          aria-selected={view === 'dms'}
          aria-label="Direct messages view"
          tabIndex={view === 'dms' ? 0 : -1}
        >
          dms
        </button>
        <button 
          className={`view-btn ${view === 'inbox' ? 'active' : ''}`}
          onClick={() => setView('inbox')}
          role="tab"
          aria-selected={view === 'inbox'}
          aria-label="Inbox view"
          tabIndex={view === 'inbox' ? 0 : -1}
        >
          inbox
        </button>
        <button 
          className={`view-btn ${view === 'links' ? 'active' : ''}`}
          onClick={() => setView('links')}
          role="tab"
          aria-selected={view === 'links'}
          aria-label="Links view"
          tabIndex={view === 'links' ? 0 : -1}
        >
          links
        </button>
        <button 
          className={`view-btn ${view === 'greatest' ? 'active' : ''}`}
          onClick={() => setView('greatest')}
          role="tab"
          aria-selected={view === 'greatest'}
          aria-label="Greatest messages view"
          tabIndex={view === 'greatest' ? 0 : -1}
        >
          greatest
        </button>
        <button 
          className={`view-btn ${view === 'world' ? 'active' : ''}`}
          onClick={() => setView('world')}
          role="tab"
          aria-selected={view === 'world'}
          aria-label="World chat view"
          tabIndex={view === 'world' ? 0 : -1}
        >
          world
        </button>
      </nav>

      {view === 'chat' ? (
        <div className="channels-section">
          <div className="channels-header">
            <span>Channels</span>
            <button 
              className="btn btn-icon btn-sm btn-ghost"
              onClick={() => setShowChannelModal(true)}
              aria-label="Create new channel"
              title="Create channel"
            >
              <span aria-hidden="true">+</span>
            </button>
          </div>
          <div className="channels-list" role="list">
            {channels.length === 0 ? (
              <div className="empty-channels">
                <span>no channels yet</span>
                <span className="empty-channels-hint">create one above</span>
              </div>
            ) : (
              channels.map(channel => (
                <button
                  key={channel.id}
                  className={`channel-item ${currentChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => setCurrentChannel(channel)}
                  role="listitem"
                  aria-label={`${channel.encrypted ? 'Encrypted channel' : 'Channel'} ${channel.name}`}
                  aria-current={currentChannel?.id === channel.id ? 'page' : undefined}
                >
                  <span className="channel-hash" aria-hidden="true">{channel.encrypted ? '🔒' : '#'}</span>
                  <span className="channel-name">{channel.name}</span>
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="links-section">
          <div className="links-header">
            <span>Links</span>
          </div>
        </div>
      )}

      <div className="sidebar-footer">
        <div className="user-info">
          <div className="user-avatar">{user.username[0].toUpperCase()}</div>
          <div className="user-details">
            <div className="user-name">{user.username}</div>
            <button className="logout-btn" onClick={logout} aria-label="Sign out">Sign out</button>
          </div>
        </div>
      </div>

      {showWorkspaceModal && (
        <div className="modal-overlay" onClick={() => {
          setShowWorkspaceModal(false);
          setWorkspaceError('');
        }} role="dialog" aria-modal="true" aria-labelledby="workspace-modal-title">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 id="workspace-modal-title">Create Workspace</h2>
            <form onSubmit={handleCreateWorkspace}>
              <div className="input-group">
                <input
                  type="text"
                  id="workspace-name"
                  className="input"
                  placeholder=" "
                  value={workspaceName}
                  onChange={(e) => setWorkspaceName(e.target.value)}
                  required
                  autoFocus
                  disabled={workspaceLoading}
                  aria-describedby={workspaceError ? 'workspace-error' : undefined}
                  aria-invalid={!!workspaceError}
                />
                <label htmlFor="workspace-name" className="input-label">Workspace name</label>
              </div>
              {workspaceError && (
                <div id="workspace-error" className="input-error-message" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠</span> {workspaceError}
                </div>
              )}
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowWorkspaceModal(false);
                    setWorkspaceError('');
                  }}
                  disabled={workspaceLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={workspaceLoading}>
                  {workspaceLoading ? (
                    <>
                      <span className="spinner"></span>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showChannelModal && (
        <div className="modal-overlay" onClick={() => {
          setShowChannelModal(false);
          setChannelError('');
        }} role="dialog" aria-modal="true" aria-labelledby="channel-modal-title">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 id="channel-modal-title">Create Channel</h2>
            <form onSubmit={handleCreateChannel}>
              <div className="input-group">
                <input
                  type="text"
                  id="channel-name"
                  className="input"
                  placeholder=" "
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  required
                  autoFocus
                  disabled={channelLoading}
                  aria-describedby={channelError ? 'channel-error' : undefined}
                  aria-invalid={!!channelError}
                />
                <label htmlFor="channel-name" className="input-label">Channel name</label>
              </div>
              <label className="checkbox-label" style={{ marginTop: 'var(--space-lg)', display: 'flex', alignItems: 'center', gap: 'var(--space-sm)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  id="enable-encryption"
                  checked={createEncrypted}
                  onChange={(e) => setCreateEncrypted(e.target.checked)}
                  disabled={channelLoading}
                  style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                />
                <span style={{ fontSize: 'var(--font-size-sm)' }}>🔒 enable end-to-end encryption</span>
              </label>
              {channelError && (
                <div id="channel-error" className="input-error-message" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠</span> {channelError}
                </div>
              )}
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowChannelModal(false);
                    setChannelError('');
                  }}
                  disabled={channelLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={channelLoading}>
                  {channelLoading ? (
                    <>
                      <span className="spinner"></span>
                      Creating...
                    </>
                  ) : (
                    'Create'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showSettings && (
        <WorkspaceSettings onClose={() => setShowSettings(false)} />
      )}

      {showEncryptionModal && newEncryptedChannel && (
        <EncryptionModal
          channelName={newEncryptedChannel.name}
          mode="create"
          onSubmit={(password) => {
            setPassword(newEncryptedChannel.id, password);
            setShowEncryptionModal(false);
            setNewEncryptedChannel(null);
            // Switch to the new encrypted channel
            setCurrentChannel(newEncryptedChannel);
          }}
          onCancel={() => {
            setShowEncryptionModal(false);
            setNewEncryptedChannel(null);
          }}
        />
      )}
    </aside>
  );
}