// API Configuration
const isDevelopment = window.location.hostname === 'localhost';

export const API_BASE_URL = isDevelopment 
  ? 'http://localhost:3035'
  : ''; // Empty string means use same domain in production

export const SOCKET_URL = isDevelopment
  ? 'http://localhost:3035'
  : window.location.origin; // Use same domain for WebSocket in production