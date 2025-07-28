import React, { useState } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import { useServer } from '../stores/serverStore.jsx';
import { useEncryption } from '../stores/encryptionStore.jsx';
import ServerSettings from './ServerSettings.jsx';
import EncryptionModal from './EncryptionModal.jsx';
import FindServerView from './FindServerView.jsx';
import './Sidebar.css';

export default function Sidebar({ view, setView }) {
  const { user, logout } = useAuth();
  const {
    servers,
    currentServer,
    setCurrentServer,
    channels,
    currentChannel,
    setCurrentChannel,
    createServer,
    createChannel
  } = useServer();
  
  const [showServerModal, setShowServerModal] = useState(false);
  const [showChannelModal, setShowChannelModal] = useState(false);
  const [serverName, setServerName] = useState('');
  const [serverDescription, setServerDescription] = useState('');
  const [channelName, setChannelName] = useState('');
  const [serverError, setServerError] = useState('');
  const [channelError, setChannelError] = useState('');
  const [serverLoading, setServerLoading] = useState(false);
  const [channelLoading, setChannelLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showFindServer, setShowFindServer] = useState(false);
  const [createEncrypted, setCreateEncrypted] = useState(false);
  const [showEncryptionModal, setShowEncryptionModal] = useState(false);
  const [newEncryptedChannel, setNewEncryptedChannel] = useState(null);
  const [createEncryptedServer, setCreateEncryptedServer] = useState(false);
  const [showServerKeyModal, setShowServerKeyModal] = useState(false);
  const [newServerKey, setNewServerKey] = useState(null);
  const [createPublicServer, setCreatePublicServer] = useState(false);
  const { setPassword } = useEncryption();

  const handleCreateServer = async (e) => {
    e.preventDefault();
    setServerError('');
    setServerLoading(true);
    try {
      const visibility = createPublicServer ? 'public' : 'private';
      const newServer = await createServer(serverName, serverDescription, visibility, createEncryptedServer);
      setServerName('');
      setServerDescription('');
      setCreateEncryptedServer(false);
      setCreatePublicServer(false);
      setShowServerModal(false);
      
      // If encrypted and key was generated, show it to the user
      if (createEncryptedServer && newServer.encryptionKey) {
        setNewServerKey(newServer.encryptionKey);
        setShowServerKeyModal(true);
      }
    } catch (error) {
      console.error('Failed to create server:', error);
      setServerError(error.message || 'Failed to create server');
    } finally {
      setServerLoading(false);
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
        <div className="realm-selector">
          <select
            className="realm-dropdown"
            value={currentServer?.id || ''}
            onChange={(e) => {
              const server = servers.find(w => w.id === e.target.value);
              setCurrentServer(server);
            }}
            aria-label="Select realm"
          >
            {servers.length === 0 ? (
              <option value="">no realms</option>
            ) : (
              servers.map(server => (
                <option key={server.id} value={server.id}>
                  {server.name}
                </option>
              ))
            )}
          </select>
          <button 
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => setShowServerModal(true)}
            aria-label="Create new realm"
            title="Create realm"
          >
            <span aria-hidden="true">+</span>
          </button>
          <button 
            className="btn btn-icon btn-sm btn-ghost"
            onClick={() => setShowFindServer(true)}
            aria-label="Find realms"
            title="Find realms"
          >
            <span aria-hidden="true">🔍</span>
          </button>
          {currentServer && (
            <button 
              className="btn btn-icon btn-sm btn-ghost"
              onClick={() => setShowSettings(true)}
              aria-label="Realm settings"
              title="Realm settings"
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

      {showServerModal && (
        <div className="modal-overlay" onClick={() => {
          setShowServerModal(false);
          setServerError('');
        }} role="dialog" aria-modal="true" aria-labelledby="server-modal-title">
          <div className="modal" onClick={e => e.stopPropagation()}>
            <h2 id="server-modal-title">Create Realm</h2>
            <form onSubmit={handleCreateServer}>
              <div className="input-group">
                <input
                  type="text"
                  id="server-name"
                  className="input"
                  placeholder=" "
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  required
                  autoFocus
                  disabled={serverLoading}
                  aria-describedby={serverError ? 'server-error' : undefined}
                  aria-invalid={!!serverError}
                />
                <label htmlFor="server-name" className="input-label">Realm name</label>
              </div>
              <div className="input-group">
                <textarea
                  id="server-description"
                  className="input textarea"
                  placeholder=" "
                  value={serverDescription}
                  onChange={(e) => setServerDescription(e.target.value)}
                  disabled={serverLoading}
                  rows="3"
                />
                <label htmlFor="server-description" className="input-label">Description (optional)</label>
              </div>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="server-encrypted"
                  checked={createEncryptedServer}
                  onChange={(e) => setCreateEncryptedServer(e.target.checked)}
                  disabled={serverLoading || createPublicServer}
                />
                <label htmlFor="server-encrypted">
                  Create encrypted realm
                  <span className="checkbox-hint">Realm data will be end-to-end encrypted</span>
                </label>
              </div>
              <div className="checkbox-group">
                <input
                  type="checkbox"
                  id="server-public"
                  checked={createPublicServer}
                  onChange={(e) => {
                    setCreatePublicServer(e.target.checked);
                    if (e.target.checked) {
                      setCreateEncryptedServer(false);
                    }
                  }}
                  disabled={serverLoading}
                />
                <label htmlFor="server-public">
                  Make realm public
                  <span className="checkbox-hint">Anyone can find and join this realm</span>
                </label>
              </div>
              {serverError && (
                <div id="server-error" className="input-error-message" role="alert" aria-live="polite">
                  <span aria-hidden="true">⚠</span> {serverError}
                </div>
              )}
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => {
                    setShowServerModal(false);
                    setServerError('');
                  }}
                  disabled={serverLoading}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={serverLoading}>
                  {serverLoading ? (
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
        <ServerSettings onClose={() => setShowSettings(false)} />
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

      {showFindServer && (
        <FindServerView onClose={() => setShowFindServer(false)} />
      )}

      {showServerKeyModal && newServerKey && (
        <div className="modal-overlay" onClick={() => setShowServerKeyModal(false)} role="dialog" aria-modal="true">
          <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
            <h2>Realm Encryption Key</h2>
            <div className="encryption-key-warning">
              <span className="warning-icon" aria-hidden="true">⚠️</span>
              <p>
                <strong>Save this encryption key immediately!</strong> 
                You'll need it to share with others when inviting them to this realm.
              </p>
            </div>
            <div className="encryption-key-display">
              <code className="key-code">{newServerKey}</code>
              <button 
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  navigator.clipboard.writeText(newServerKey);
                  alert('Encryption key copied to clipboard!');
                }}
                title="Copy to clipboard"
              >
                📋
              </button>
            </div>
            <p className="encryption-key-note">
              This key is required along with an invitation code for others to join your encrypted realm.
              Store it securely - it cannot be recovered if lost!
            </p>
            <div className="modal-actions">
              <button 
                className="btn btn-primary"
                onClick={() => {
                  setShowServerKeyModal(false);
                  setNewServerKey(null);
                }}
              >
                I've saved the key
              </button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
}