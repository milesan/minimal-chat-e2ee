import React, { useState } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import './AuthView.css';

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState({ username: false, password: false });
  const { login, register } = useAuth();

  const validateUsername = () => {
    if (!username) return 'Username is required';
    if (username.length < 3) return 'Username must be at least 3 characters';
    return '';
  };

  const validatePassword = () => {
    if (!password) return 'Password is required';
    if (password.length < 8) return 'Password must be at least 8 characters';
    return '';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setTouched({ username: true, password: true });

    const usernameError = validateUsername();
    const passwordError = validatePassword();
    
    if (usernameError || passwordError) {
      setError(usernameError || passwordError);
      return;
    }

    setLoading(true);

    try {
      if (isLogin) {
        await login(username, password);
      } else {
        await register(username, password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <div className="auth-logo">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="48" height="48">
            <circle cx="32" cy="32" r="30" fill="none" stroke="currentColor" strokeWidth="2"/>
            <path d="M20 28 Q32 36 44 28" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            <circle cx="20" cy="28" r="2" fill="currentColor"/>
            <circle cx="32" cy="32" r="2" fill="currentColor"/>
            <circle cx="44" cy="28" r="2" fill="currentColor"/>
          </svg>
        </div>

        <h1 className="auth-title" id="auth-title">{isLogin ? 'Welcome back' : 'Create account'}</h1>

        <form onSubmit={handleSubmit} className="auth-form" aria-labelledby="auth-title">
          <div className="input-group">
            <input
              type="text"
              id="username"
              className={`input ${touched.username && validateUsername() ? 'input-error' : ''}`}
              placeholder=" "
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched({ ...touched, username: true })}
              required
              autoFocus
              aria-describedby={touched.username && validateUsername() ? 'username-error' : undefined}
              aria-invalid={touched.username && !!validateUsername()}
            />
            <label htmlFor="username" className="input-label">Username</label>
            {touched.username && validateUsername() && (
              <div id="username-error" className="input-error-message" role="alert">
                <span aria-hidden="true">⚠</span> {validateUsername()}
              </div>
            )}
          </div>

          <div className="input-group password-input-group">
            <input
              type={showPassword ? 'text' : 'password'}
              id="password"
              className={`input ${touched.password && validatePassword() ? 'input-error' : ''}`}
              placeholder=" "
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched({ ...touched, password: true })}
              required
              minLength={8}
              aria-describedby={touched.password && validatePassword() ? 'password-error' : 'password-hint'}
              aria-invalid={touched.password && !!validatePassword()}
            />
            <label htmlFor="password" className="input-label">Password</label>
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPassword ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              )}
            </button>
            {touched.password && validatePassword() ? (
              <div id="password-error" className="input-error-message" role="alert">
                <span aria-hidden="true">⚠</span> {validatePassword()}
              </div>
            ) : (
              <div id="password-hint" className="input-hint">
                {isLogin ? '' : 'Must be at least 8 characters'}
              </div>
            )}
          </div>

          {error && <div className="error" role="alert" aria-live="polite">{error}</div>}

          <button type="submit" className="btn btn-primary auth-submit" disabled={loading}>
            {loading ? (
              <div className="spinner"></div>
            ) : (
              isLogin ? 'Sign in' : 'Sign up'
            )}
          </button>
        </form>

        <div className="auth-switch">
          {isLogin ? "Don't have an account? " : "Already have an account? "}
          <button
            type="button"
            className="auth-switch-btn"
            onClick={() => {
              setIsLogin(!isLogin);
              setError('');
              setTouched({ username: false, password: false });
            }}
            aria-label={isLogin ? 'Switch to sign up' : 'Switch to sign in'}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}