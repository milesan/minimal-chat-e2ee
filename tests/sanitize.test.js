import { describe, it, expect } from 'vitest';
import { escapeHtml, isValidImageUrl, sanitizeUsername } from '../client/src/utils/sanitize.js';

describe('Sanitize Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      const testCases = [
        { input: '<script>alert("xss")</script>', expected: '&lt;script&gt;alert(&quot;xss&quot;)&lt;&#x2F;script&gt;' },
        { input: '<div>Hello & goodbye</div>', expected: '&lt;div&gt;Hello &amp; goodbye&lt;&#x2F;div&gt;' },
        { input: 'Test "quotes" and \'apostrophes\'', expected: 'Test &quot;quotes&quot; and &#x27;apostrophes&#x27;' },
        { input: 'a/b & c<d>e', expected: 'a&#x2F;b &amp; c&lt;d&gt;e' },
        { input: '&lt;&gt;&quot;', expected: '&amp;lt;&amp;gt;&amp;quot;' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(escapeHtml(input)).toBe(expected);
      });
    });

    it('should handle empty and normal strings', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml('Normal text')).toBe('Normal text');
      expect(escapeHtml('Numbers 123 and symbols !@#$%^*()')).toBe('Numbers 123 and symbols !@#$%^*()');
    });

    it('should handle unicode and emoji', () => {
      expect(escapeHtml('Hello 世界 🌍')).toBe('Hello 世界 🌍');
      expect(escapeHtml('Emoji with <script>🎉</script>')).toBe('Emoji with &lt;script&gt;🎉&lt;&#x2F;script&gt;');
    });

    it('should escape multiple occurrences', () => {
      expect(escapeHtml('<<<>>>')).toBe('&lt;&lt;&lt;&gt;&gt;&gt;');
      expect(escapeHtml('&&&')).toBe('&amp;&amp;&amp;');
      expect(escapeHtml('"""')).toBe('&quot;&quot;&quot;');
    });

    it('should handle mixed content', () => {
      const input = 'User said: <a href="javascript:alert(\'xss\')">Click me</a> & "run this"';
      const expected = 'User said: &lt;a href=&quot;javascript:alert(&#x27;xss&#x27;)&quot;&gt;Click me&lt;&#x2F;a&gt; &amp; &quot;run this&quot;';
      expect(escapeHtml(input)).toBe(expected);
    });
  });

  describe('isValidImageUrl', () => {
    it('should accept valid image URLs', () => {
      const validUrls = [
        'https://example.com/image.jpg',
        'http://test.com/photo.png',
        'https://cdn.example.com/path/to/image.jpeg',
        'https://example.com/avatar.gif',
        'https://example.com/banner.webp',
        'https://example.com/logo.svg',
        'https://example.com/IMAGE.JPG',
        'https://example.com:8080/image.png',
        'https://example.com/image.png?size=large'
      ];
      
      validUrls.forEach(url => {
        expect(isValidImageUrl(url)).toBe(true);
      });
    });

    it('should reject non-image URLs', () => {
      const nonImageUrls = [
        'https://example.com/document.pdf',
        'https://example.com/video.mp4',
        'https://example.com/script.js',
        'https://example.com/style.css',
        'https://example.com/data.json',
        'https://example.com/index.html',
        'https://example.com/archive.zip',
        'https://example.com/image', // No extension
        'https://example.com/', // Just domain
        'https://example.com/image.txt.png.exe' // Doesn't end with image extension
      ];
      
      nonImageUrls.forEach(url => {
        expect(isValidImageUrl(url)).toBe(false);
      });
    });

    it('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert("xss")',
        'data:image/png;base64,iVBORw0KGgo=',
        'file:///etc/passwd',
        'ftp://example.com/image.jpg',
        'about:blank',
        'chrome://settings',
        'blob:https://example.com/image.jpg',
        'ws://example.com/image.png',
        'wss://example.com/image.gif'
      ];
      
      dangerousUrls.forEach(url => {
        expect(isValidImageUrl(url)).toBe(false);
      });
    });

    it('should handle invalid inputs', () => {
      expect(isValidImageUrl(null)).toBe(false);
      expect(isValidImageUrl(undefined)).toBe(false);
      expect(isValidImageUrl('')).toBe(false);
      expect(isValidImageUrl(123)).toBe(false);
      expect(isValidImageUrl({})).toBe(false);
      expect(isValidImageUrl([])).toBe(false);
    });

    it('should handle malformed URLs', () => {
      const malformedUrls = [
        'not a url',
        '//example.com/image.jpg', // Protocol-relative
        '/path/to/image.jpg', // Relative path
        'example.com/image.jpg', // No protocol
        'http://[invalid]/image.jpg',
        'https:/image.jpg',
        'https:///image.jpg',
        'ht!tp://example.com/image.jpg'
      ];
      
      malformedUrls.forEach(url => {
        expect(isValidImageUrl(url)).toBe(false);
      });
    });

    it('should handle edge cases with extensions', () => {
      expect(isValidImageUrl('https://example.com/.jpg')).toBe(true); // Hidden file
      expect(isValidImageUrl('https://example.com/jpg')).toBe(false); // No dot
      expect(isValidImageUrl('https://example.com/image.JPG')).toBe(true); // Uppercase
      expect(isValidImageUrl('https://example.com/image.jpeg.bak')).toBe(false); // Wrong final extension
    });

    it('should handle query parameters and fragments correctly', () => {
      expect(isValidImageUrl('https://example.com/image.jpg?size=large')).toBe(true);
      expect(isValidImageUrl('https://example.com/image.png#section')).toBe(true);
      expect(isValidImageUrl('https://example.com/page?image=test.jpg')).toBe(false); // Extension in query
      expect(isValidImageUrl('https://example.com/page#image.jpg')).toBe(false); // Extension in fragment
    });
  });

  describe('sanitizeUsername', () => {
    it('should allow valid characters', () => {
      const validUsernames = [
        { input: 'john_doe', expected: 'john_doe' },
        { input: 'user123', expected: 'user123' },
        { input: 'Jane-Smith', expected: 'Jane-Smith' },
        { input: 'Test User', expected: 'Test User' },
        { input: 'ABC_123-xyz', expected: 'ABC_123-xyz' },
        { input: 'Under_Score-Dash Space', expected: 'Under_Score-Dash Space' }
      ];
      
      validUsernames.forEach(({ input, expected }) => {
        expect(sanitizeUsername(input)).toBe(expected);
      });
    });

    it('should remove invalid characters', () => {
      const testCases = [
        { input: 'user@email.com', expected: 'useremailcom' },
        { input: 'user!@#$%^&*()', expected: 'user' },
        { input: '<script>alert("xss")</script>', expected: 'scriptalertxssscript' },
        { input: 'user"name\'test', expected: 'usernametest' },
        { input: 'user/name\\path', expected: 'usernamepath' },
        { input: 'user[bracket]test{brace}', expected: 'userbrackettestbrace' },
        { input: 'user.period,comma;semicolon:colon', expected: 'userperiodcommasemicoloncolon' }
      ];
      
      testCases.forEach(({ input, expected }) => {
        expect(sanitizeUsername(input)).toBe(expected);
      });
    });

    it('should handle length limits', () => {
      const longUsername = 'a'.repeat(60);
      const result = sanitizeUsername(longUsername);
      expect(result).toBe('a'.repeat(50));
      expect(result.length).toBe(50);
    });

    it('should handle invalid inputs', () => {
      expect(sanitizeUsername(null)).toBe('');
      expect(sanitizeUsername(undefined)).toBe('');
      expect(sanitizeUsername('')).toBe('');
      expect(sanitizeUsername(123)).toBe('');
      expect(sanitizeUsername({})).toBe('');
      expect(sanitizeUsername([])).toBe('');
    });

    it('should handle unicode and emoji', () => {
      expect(sanitizeUsername('user🎉emoji')).toBe('useremoji');
      expect(sanitizeUsername('user世界')).toBe('user');
      expect(sanitizeUsername('user♥heart')).toBe('userheart');
      expect(sanitizeUsername('user™®©')).toBe('user');
    });

    it('should handle whitespace correctly', () => {
      expect(sanitizeUsername('   user   ')).toBe('   user   '); // Preserves spaces
      expect(sanitizeUsername('user\tname')).toBe('user\tname'); // Preserves tabs (part of \s)
      expect(sanitizeUsername('user\nname')).toBe('user\nname'); // Preserves newlines (part of \s)
      expect(sanitizeUsername('user\r\nname')).toBe('user\r\nname'); // Preserves carriage returns (part of \s)
    });

    it('should handle mixed valid and invalid characters', () => {
      const input = '!!!Valid_User-123###';
      const expected = 'Valid_User-123';
      expect(sanitizeUsername(input)).toBe(expected);
    });

    it('should handle SQL injection attempts', () => {
      const sqlInjections = [
        { input: "user'; DROP TABLE users; --", expected: 'user DROP TABLE users --' },
        { input: 'user" OR "1"="1', expected: 'user OR 11' },
        { input: "user`; DELETE FROM users;", expected: 'user DELETE FROM users' }
      ];
      
      sqlInjections.forEach(({ input, expected }) => {
        expect(sanitizeUsername(input)).toBe(expected);
      });
    });
  });
});