// API Configuration
export const API_URL = import.meta.env.VITE_API_URL || '';
export const WS_URL = import.meta.env.VITE_WS_URL || '';

// For development, Vite proxy handles /api routes
// For production, we need the full URL
export const getApiUrl = (path) => {
  if (import.meta.env.DEV) {
    return path; // Use Vite proxy in development
  }
  // If no API_URL is set, log error and return path (will fail but helps debug)
  if (!API_URL) {
    console.error('VITE_API_URL not set! API calls will fail. Please rebuild after setting environment variables.');
    return path;
  }
  return `${API_URL}${path}`;
};

export const getWebSocketUrl = () => {
  if (import.meta.env.DEV) {
    return window.location.origin; // Use same origin in development
  }
  // In production, if no URL is set, try to use the current origin
  if (!WS_URL && !API_URL) {
    console.warn('Neither VITE_WS_URL nor VITE_API_URL is set. Using current origin for WebSocket connection.');
    return window.location.origin;
  }
  return WS_URL || API_URL; // Use configured URL in production
};