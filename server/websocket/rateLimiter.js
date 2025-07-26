// Rate limiter for WebSocket connections
class SocketRateLimiter {
  constructor() {
    // Track message counts per user
    this.userLimits = new Map();
    
    // Configuration for different event types
    this.limits = {
      // Event name: { maxRequests, windowMs }
      'send_message': { maxRequests: 30, windowMs: 60000 }, // 30 messages per minute
      'dm_message': { maxRequests: 30, windowMs: 60000 }, // 30 DMs per minute
      'typing': { maxRequests: 60, windowMs: 60000 }, // 60 typing events per minute
      'join_channel': { maxRequests: 20, windowMs: 60000 }, // 20 channel joins per minute
      'join_server': { maxRequests: 10, windowMs: 60000 }, // 10 server joins per minute
      'default': { maxRequests: 100, windowMs: 60000 } // 100 other events per minute
    };
    
    // Clean up old entries every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }
  
  // Check if an event should be rate limited
  checkLimit(userId, eventName) {
    if (!userId) return false; // Don't rate limit unauthenticated sockets
    
    const now = Date.now();
    const limit = this.limits[eventName] || this.limits.default;
    
    // Initialize user data if not exists
    if (!this.userLimits.has(userId)) {
      this.userLimits.set(userId, {});
    }
    
    const userEvents = this.userLimits.get(userId);
    
    // Initialize event data if not exists
    if (!userEvents[eventName]) {
      userEvents[eventName] = {
        count: 0,
        resetTime: now + limit.windowMs
      };
    }
    
    const eventData = userEvents[eventName];
    
    // Reset if window has passed
    if (now > eventData.resetTime) {
      eventData.count = 0;
      eventData.resetTime = now + limit.windowMs;
    }
    
    // Increment count
    eventData.count++;
    
    // Check if limit exceeded
    if (eventData.count > limit.maxRequests) {
      return true; // Rate limited
    }
    
    return false; // Not rate limited
  }
  
  // Clean up old entries
  cleanup() {
    const now = Date.now();
    
    for (const [userId, events] of this.userLimits.entries()) {
      // Remove expired event data
      for (const [eventName, data] of Object.entries(events)) {
        if (now > data.resetTime + 60000) { // 1 minute grace period
          delete events[eventName];
        }
      }
      
      // Remove user if no events left
      if (Object.keys(events).length === 0) {
        this.userLimits.delete(userId);
      }
    }
  }
  
  // Get current usage stats for a user
  getStats(userId) {
    if (!this.userLimits.has(userId)) {
      return {};
    }
    
    const userEvents = this.userLimits.get(userId);
    const stats = {};
    
    for (const [eventName, data] of Object.entries(userEvents)) {
      const limit = this.limits[eventName] || this.limits.default;
      stats[eventName] = {
        count: data.count,
        limit: limit.maxRequests,
        resetIn: Math.max(0, data.resetTime - Date.now())
      };
    }
    
    return stats;
  }
}

// Create a singleton instance
export const socketRateLimiter = new SocketRateLimiter();

// Middleware function to apply rate limiting
export function applyRateLimit(socket, eventName, handler) {
  return async (...args) => {
    // Check rate limit
    if (socketRateLimiter.checkLimit(socket.userId, eventName)) {
      socket.emit('rate_limit_error', {
        error: 'Too many requests. Please slow down.',
        event: eventName,
        retryAfter: 60000 // 1 minute
      });
      
      // Log the rate limit violation in development only
      if (process.env.NODE_ENV === 'development') {
        console.warn(`Rate limit exceeded for user ${socket.userId} on event ${eventName}`);
      }
      
      // Disconnect if too many violations
      if (!socket.rateLimitWarnings) socket.rateLimitWarnings = 0;
      socket.rateLimitWarnings++;
      
      if (socket.rateLimitWarnings > 5) {
        socket.emit('error', { error: 'Too many rate limit violations. Disconnecting.' });
        socket.disconnect();
      }
      
      return;
    }
    
    // Call the original handler
    try {
      await handler(...args);
    } catch (error) {
      // Log internally but don't expose details
      if (process.env.NODE_ENV === 'development') {
        console.error(`Error in ${eventName} handler:`, error);
      }
      socket.emit('error', { error: 'An error occurred processing your request' });
    }
  };
}