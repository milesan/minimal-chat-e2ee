import React, { useState } from 'react';
import { CryptoService } from '../services/crypto.js';
import './EncryptionModal.css';

export default function EncryptionModal({ channelName, onSubmit, onCancel, mode = 'unlock' }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [suggestedPassword] = useState(mode === 'create' ? CryptoService.generatePassword() : '');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (mode === 'create') {
      if (password !== confirmPassword) {
        setError('passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('password must be at least 8 characters');
        return;
      }
    }

    onSubmit(password);
  };

  const useSuggested = () => {
    setPassword(suggestedPassword);
    setConfirmPassword(suggestedPassword);
  };

  return (
    <div className="encryption-modal-overlay" onClick={onCancel}>
      <div className="encryption-modal" onClick={e => e.stopPropagation()}>
        <div className="encryption-header">
          <h3>{mode === 'create' ? 'create encrypted channel' : 'enter encryption password'}</h3>
          <div className="channel-name">#{channelName}</div>
        </div>

        <form onSubmit={handleSubmit} className="encryption-form">
          {mode === 'create' && (
            <div className="suggested-password">
              <div className="suggested-label">suggested password:</div>
              <div className="suggested-value">{suggestedPassword}</div>
              <button type="button" className="use-suggested" onClick={useSuggested}>
                use this
              </button>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="password">password</label>
            <div className="password-input-wrapper">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'create' ? 'choose a strong password' : 'enter shared password'}
                autoFocus
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? '👁' : '👁‍🗨'}
              </button>
            </div>
          </div>

          {mode === 'create' && (
            <div className="form-group">
              <label htmlFor="confirm">confirm password</label>
              <input
                id="confirm"
                type={showPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="confirm password"
                required
              />
            </div>
          )}

          {error && (
            <div className="encryption-error">{error}</div>
          )}

          <div className="encryption-info">
            {mode === 'create' ? (
              <>
                <p>🔒 messages will be end-to-end encrypted</p>
                <p>⚠️ save this password - it cannot be recovered</p>
                <p>📋 share it securely with channel members</p>
              </>
            ) : (
              <>
                <p>🔒 this channel is end-to-end encrypted</p>
                <p>🔑 enter the shared password to decrypt messages</p>
              </>
            )}
          </div>

          <div className="encryption-actions">
            <button type="button" className="btn btn-secondary" onClick={onCancel}>
              cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {mode === 'create' ? 'create encrypted' : 'unlock'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}