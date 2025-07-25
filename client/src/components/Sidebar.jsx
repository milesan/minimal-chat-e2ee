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
  const [showSettings, setShowSettings] = useState(false);
  const [createEncrypted, setCreateEncrypted] = useState(false);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [newEncryptedChannel, setNewEncryptedChannel] = useState(null);
  const { setPassword } = useEncryption();

  const handleCreateWorkspace = async (e) => {
    e.preventDefault();
    setWorkspaceError('');
    try {
      await createWorkspace(workspaceName);
      setWorkspaceName('');
      setShowWorkspaceModal(false);
    } catch (error) {
      console.error('Failed to create workspace:', error);
      setWorkspaceError(error.message || 'Failed to create workspace');
    }
  };

  const handleCreateChannel = async (e) => {
    e.preventDefault();
    setChannelError('');
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
    }
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="workspace-selector">
          <select
            className="workspace-dropdown"
            value={currentWorkspace?.id || ''}
            onChange={(e) => {
              const workspace = workspaces.find(w => w.id === e.target.value);
              setCurrentWorkspace(workspace);
            }}
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
            className="add-workspace-btn"
            onClick={() => setShowWorkspaceModal(true)}
            title="Create workspace"
          >
            +
          </button>
          {currentWorkspace && (
            <button 
              className="settings-btn"
              onClick={() => setShowSettings(true)}
              title="Workspace settings"
            >
              ⚙
            </button>
          )}
        </div>
      </div>

      <div className="view-selector">
        <button 
          className={`view-btn ${view === 'chat' ? 'active' : ''}`}
          onClick={() => setView('chat')}
        >
          chat
        </button>
        <button 
          className={`view-btn ${view === 'dms' ? 'active' : ''}`}
          onClick={() => setView('dms')}
        >
          dms
        </button>
        <button 
          className={`view-btn ${view === 'inbox' ? 'active' : ''}`}
          onClick={() => setView('inbox')}
        >
          inbox
        </button>
        <button 
          className={`view-btn ${view === 'links' ? 'active' : ''}`}
          onClick={() => setView('links')}
        >
          links
        </button>
        <button 
          className={`view-btn ${view === 'greatest' ? 'active' : ''}`}
          onClick={() => setView('greatest')}
        >
          greatest
        </button>
        <button 
          className={`view-btn ${view === 'world' ? 'active' : ''}`}
          onClick={() => setView('world')}
        >
          world
        </button>
      </div>

      {view === 'chat' ? (
        <div className="channels-section">
          <div className="channels-header">
            <span>Channels</span>
            <button 
              className="add-channel-btn"
              onClick={() => setShowChannelModal(true)}
              title="Create channel"
            >
              +
            </button>
          </div>
          <div className="channels-list">
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
                >
                  <span className="channel-hash">{channel.encrypted ? '🔒' : '#'}</span>
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
            <button className="logout-btn" onClick={logout}>Sign out</button>
          </div>
        </div>
      </div>

      {showWorkspaceModal && (
        <div className="modal-overlay" onClick={() => {
          setShowWorkspaceModal(false);
          setWorkspaceError('');
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Workspace</h2>
            <form onSubmit={handleCreateWorkspace}>
              <input
                type="text"
                className="input"
                placeholder="Workspace name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                required
                autoFocus
              />
              {workspaceError && (
                <div className="error-message" style={{ color: 'red', marginTop: '8px' }}>
                  {workspaceError}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowWorkspaceModal(false);
                  setWorkspaceError('');
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
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
        }}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2>Create Channel</h2>
            <form onSubmit={handleCreateChannel}>
              <input
                type="text"
                className="input"
                placeholder="Channel name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                required
                autoFocus
              />
              <label className="checkbox-label" style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="checkbox"
                  checked={createEncrypted}
                  onChange={(e) => setCreateEncrypted(e.target.checked)}
                />
                <span style={{ fontSize: '13px' }}>🔒 enable end-to-end encryption</span>
              </label>
              {channelError && (
                <div className="error-message" style={{ color: 'red', marginTop: '8px' }}>
                  {channelError}
                </div>
              )}
              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => {
                  setShowChannelModal(false);
                  setChannelError('');
                }}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Create
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