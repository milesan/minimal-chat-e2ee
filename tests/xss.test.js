import { describe, it, expect } from 'vitest';
import { escapeHtml, isValidImageUrl, sanitizeUsername } from '../client/src/utils/sanitize.js';

describe('XSS Protection', () => {
  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      expect(escapeHtml('<script>alert("XSS")</script>'))
        .toBe('&lt;script&gt;alert(&quot;XSS&quot;)&lt;&#x2F;script&gt;');
      
      expect(escapeHtml('Hello & "World" <div>'))
        .toBe('Hello &amp; &quot;World&quot; &lt;div&gt;');
      
      expect(escapeHtml("It's a test"))
        .toBe("It&#x27;s a test");
    });

    it('should handle normal text', () => {
      expect(escapeHtml('Normal message text'))
        .toBe('Normal message text');
    });
  });

  describe('isValidImageUrl', () => {
    it('should reject javascript URLs', () => {
      expect(isValidImageUrl('javascript:alert("XSS")')).toBe(false);
      expect(isValidImageUrl('data:text/html,<script>alert("XSS")</script>')).toBe(false);
    });

    it('should reject non-image URLs', () => {
      expect(isValidImageUrl('https://example.com/file.pdf')).toBe(false);
      expect(isValidImageUrl('https://example.com/page')).toBe(false);
    });

    it('should accept valid image URLs', () => {
      expect(isValidImageUrl('https://example.com/image.jpg')).toBe(true);
      expect(isValidImageUrl('https://example.com/photo.png')).toBe(true);
      expect(isValidImageUrl('http://example.com/pic.gif')).toBe(true);
    });

    it('should handle invalid inputs', () => {
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl('')).toBe(false);
      expect(isValidImageUrl(123)).toBe(false);
    });
  });

  describe('sanitizeUsername', () => {
    it('should remove dangerous characters', () => {
      expect(sanitizeUsername('<script>evil</script>'))
        .toBe('scriptevilscript');
      
      expect(sanitizeUsername('user@<img src=x onerror=alert("XSS")>'))
        .toBe('userimg srcx onerroralertXSS');
    });

    it('should allow safe characters', () => {
      expect(sanitizeUsername('john_doe-123'))
        .toBe('john_doe-123');
      
      expect(sanitizeUsername('Jane Smith'))
        .toBe('Jane Smith');
    });

    it('should limit length', () => {
      const longName = 'a'.repeat(100);
      expect(sanitizeUsername(longName).length).toBe(50);
    });

    it('should handle invalid inputs', () => {
      expect(sanitizeUsername(null)).toBe('');
      expect(sanitizeUsername(undefined)).toBe('');
      expect(sanitizeUsername(123)).toBe('');
    });
  });
});