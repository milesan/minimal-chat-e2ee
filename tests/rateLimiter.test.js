import { describe, it, expect, beforeEach } from 'vitest';
import { socketRateLimiter } from '../server/websocket/rateLimiter.js';

describe('Socket Rate Limiter', () => {
  beforeEach(() => {
    // Clear rate limiter data before each test
    socketRateLimiter.userLimits.clear();
  });

  it('should allow requests within limit', () => {
    const userId = 'test-user-1';
    
    // Should allow up to 30 messages per minute
    for (let i = 0; i < 30; i++) {
      expect(socketRateLimiter.checkLimit(userId, 'send_message')).toBe(false);
    }
  });

  it('should block requests exceeding limit', () => {
    const userId = 'test-user-2';
    
    // Send 30 messages (the limit)
    for (let i = 0; i < 30; i++) {
      socketRateLimiter.checkLimit(userId, 'send_message');
    }
    
    // 31st message should be blocked
    expect(socketRateLimiter.checkLimit(userId, 'send_message')).toBe(true);
    
    // Further messages should also be blocked
    expect(socketRateLimiter.checkLimit(userId, 'send_message')).toBe(true);
  });

  it('should have different limits for different events', () => {
    const userId = 'test-user-3';
    
    // Typing has higher limit (60 per minute)
    for (let i = 0; i < 60; i++) {
      expect(socketRateLimiter.checkLimit(userId, 'typing')).toBe(false);
    }
    expect(socketRateLimiter.checkLimit(userId, 'typing')).toBe(true);
    
    // Join workspace has lower limit (10 per minute)
    for (let i = 0; i < 10; i++) {
      expect(socketRateLimiter.checkLimit(userId, 'join_workspace')).toBe(false);
    }
    expect(socketRateLimiter.checkLimit(userId, 'join_workspace')).toBe(true);
  });

  it('should track different users separately', () => {
    const user1 = 'test-user-4';
    const user2 = 'test-user-5';
    
    // User 1 sends 30 messages
    for (let i = 0; i < 30; i++) {
      socketRateLimiter.checkLimit(user1, 'send_message');
    }
    
    // User 1 is blocked
    expect(socketRateLimiter.checkLimit(user1, 'send_message')).toBe(true);
    
    // User 2 can still send messages
    expect(socketRateLimiter.checkLimit(user2, 'send_message')).toBe(false);
  });

  it('should provide accurate stats', () => {
    const userId = 'test-user-6';
    
    // Send 10 messages
    for (let i = 0; i < 10; i++) {
      socketRateLimiter.checkLimit(userId, 'send_message');
    }
    
    const stats = socketRateLimiter.getStats(userId);
    expect(stats.send_message).toBeDefined();
    expect(stats.send_message.count).toBe(10);
    expect(stats.send_message.limit).toBe(30);
    expect(stats.send_message.resetIn).toBeGreaterThan(0);
    expect(stats.send_message.resetIn).toBeLessThanOrEqual(60000);
  });

  it('should not rate limit unauthenticated sockets', () => {
    // Null userId should not be rate limited
    for (let i = 0; i < 100; i++) {
      expect(socketRateLimiter.checkLimit(null, 'send_message')).toBe(false);
    }
  });

  it('should handle unknown event types with default limit', () => {
    const userId = 'test-user-7';
    
    // Unknown events get default limit (100 per minute)
    for (let i = 0; i < 100; i++) {
      expect(socketRateLimiter.checkLimit(userId, 'unknown_event')).toBe(false);
    }
    expect(socketRateLimiter.checkLimit(userId, 'unknown_event')).toBe(true);
  });
});