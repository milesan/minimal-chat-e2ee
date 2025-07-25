import React, { useState } from 'react';
import { useAuth } from '../stores/authStore.jsx';
import './AuthView.css';

export default function AuthView() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
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

        <h1 className="auth-title">{isLogin ? 'Welcome back' : 'Create account'}</h1>

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <input
              type="text"
              className={`input ${touched.username && validateUsername() ? 'input-error' : ''}`}
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onBlur={() => setTouched({ ...touched, username: true })}
              required
              autoFocus
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              className={`input ${touched.password && validatePassword() ? 'input-error' : ''}`}
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched({ ...touched, password: true })}
              required
              minLength={8}
            />
          </div>

          {error && <div className="error">{error}</div>}

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
            }}
          >
            {isLogin ? 'Sign up' : 'Sign in'}
          </button>
        </div>
      </div>
    </div>
  );
}