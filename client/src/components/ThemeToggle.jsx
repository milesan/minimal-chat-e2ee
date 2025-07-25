import React, { useEffect, useState } from 'react';
import './ThemeToggle.css';

export default function ThemeToggle() {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('theme') || 'light';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const themes = [
    { id: 'light', icon: '☀️' },
    { id: 'dark', icon: '🌙' },
    { id: 'amber', icon: '🔥' }
  ];

  const nextTheme = () => {
    const currentIndex = themes.findIndex(t => t.id === theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex].id);
  };

  const currentTheme = themes.find(t => t.id === theme);

  return (
    <button className="theme-toggle" onClick={nextTheme} title="Change theme">
      <span className="theme-icon">{currentTheme.icon}</span>
    </button>
  );
}