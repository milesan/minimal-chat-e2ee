import { describe, it, expect } from 'vitest';
import {
  validateUsername,
  validateName,
  validateUrl,
  validateMessage,
  validateImageUrl,
  validateText,
  validateImageData
} from '../server/utils/validation.js';

describe('Validation Utilities', () => {
  describe('validateUsername', () => {
    it('should accept valid usernames', () => {
      const validUsernames = [
        'john_doe',
        'user123',
        'Jane Smith',
        'test-user',
        'ABC_123-xyz',
        '   trimmed   '
      ];
      
      validUsernames.forEach(username => {
        const result = validateUsername(username);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(username.trim());
      });
    });

    it('should reject invalid usernames', () => {
      const invalidCases = [
        { input: null, error: 'Username is required' },
        { input: undefined, error: 'Username is required' },
        { input: '', error: 'Username is required' },
        { input: 123, error: 'Username is required' },
        { input: '  ', error: 'Username must be at least 3 characters' },
        { input: 'ab', error: 'Username must be at least 3 characters' },
        { input: 'a'.repeat(31), error: 'Username must be less than 30 characters' },
        { input: 'user@email', error: 'Username can only contain letters, numbers, spaces, dashes, and underscores' },
        { input: 'user!name', error: 'Username can only contain letters, numbers, spaces, dashes, and underscores' },
        { input: 'user#123', error: 'Username can only contain letters, numbers, spaces, dashes, and underscores' },
        { input: 'user$name', error: 'Username can only contain letters, numbers, spaces, dashes, and underscores' }
      ];
      
      invalidCases.forEach(({ input, error }) => {
        const result = validateUsername(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(error);
      });
    });
  });

  describe('validateName', () => {
    it('should accept valid names', () => {
      const validNames = [
        'General',
        'My Server',
        'Test-Channel',
        '🎮 Gaming',
        '   Trimmed Name   '
      ];
      
      validNames.forEach(name => {
        const result = validateName(name);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(name.trim());
      });
    });

    it('should use custom type in error messages', () => {
      const result = validateName(null, 'Channel name');
      expect(result.error).toBe('Channel name is required');
    });

    it('should reject invalid names', () => {
      const invalidCases = [
        { input: null, error: 'name is required' },
        { input: undefined, error: 'name is required' },
        { input: '', error: 'name cannot be empty' },
        { input: '   ', error: 'name cannot be empty' },
        { input: 'a'.repeat(51), error: 'name must be less than 50 characters' },
        { input: '<script>alert("xss")</script>', error: 'name cannot contain HTML tags' },
        { input: 'Name <b>bold</b>', error: 'name cannot contain HTML tags' },
        { input: '<div>test</div>', error: 'name cannot contain HTML tags' }
      ];
      
      invalidCases.forEach(({ input, error }) => {
        const result = validateName(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(error);
      });
    });
  });

  describe('validateUrl', () => {
    it('should accept valid URLs', () => {
      const validUrls = [
        'https://example.com',
        'http://test.com/path',
        '//cdn.example.com/image.jpg',
        '/relative/path',
        'example.com',
        'subdomain.example.com/path?query=123',
        'https://example.com:8080/path',
        '   https://trimmed.com   '
      ];
      
      validUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(url.trim());
      });
    });

    it('should reject dangerous protocols', () => {
      const dangerousUrls = [
        'javascript:alert("xss")',
        'data:text/html,<script>alert("xss")</script>',
        'vbscript:msgbox("xss")',
        'file:///etc/passwd',
        'about:blank',
        'chrome://settings',
        'JavaScript:void(0)',
        'DATA:text/plain,test'
      ];
      
      dangerousUrls.forEach(url => {
        const result = validateUrl(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Invalid URL protocol');
      });
    });

    it('should reject invalid URLs', () => {
      const invalidCases = [
        { input: null, error: 'URL is required' },
        { input: undefined, error: 'URL is required' },
        { input: '', error: 'URL is required' },
        { input: '   ', error: 'URL cannot be empty' },
        { input: 'a'.repeat(2001), error: 'URL is too long' },
        { input: 'http://[invalid', error: 'Invalid URL format' },
        { input: '///', error: 'Invalid URL format' },
        { input: '/path<script>', error: 'Invalid characters in URL' },
        { input: '/path>redirect', error: 'Invalid characters in URL' }
      ];
      
      invalidCases.forEach(({ input, error }) => {
        const result = validateUrl(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(error);
      });
    });
  });

  describe('validateMessage', () => {
    it('should accept valid messages', () => {
      const validMessages = [
        'Hello world!',
        'A',
        '🎉 Unicode emoji test',
        'Multi\nline\nmessage',
        '   Trimmed message   ',
        'a'.repeat(5000)
      ];
      
      validMessages.forEach(message => {
        const result = validateMessage(message);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(message.trim());
      });
    });

    it('should reject invalid messages', () => {
      const invalidCases = [
        { input: null, error: 'Message content is required' },
        { input: undefined, error: 'Message content is required' },
        { input: '', error: 'Message content is required' },
        { input: '   ', error: 'Message cannot be empty' },
        { input: 'a'.repeat(5001), error: 'Message is too long (max 5000 characters)' }
      ];
      
      invalidCases.forEach(({ input, error }) => {
        const result = validateMessage(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(error);
      });
    });
  });

  describe('validateImageUrl', () => {
    it('should accept valid image URLs', () => {
      const validImageUrls = [
        'https://example.com/image.jpg',
        'http://test.com/photo.png',
        '//cdn.example.com/avatar.gif',
        '/images/banner.webp',
        'example.com/logo.svg',
        'https://example.com/path/to/image.JPEG',
        'https://example.com/image.bmp'
      ];
      
      validImageUrls.forEach(url => {
        const result = validateImageUrl(url);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(url.trim());
      });
    });

    it('should reject non-image URLs', () => {
      const nonImageUrls = [
        'https://example.com/document.pdf',
        'http://test.com/video.mp4',
        '//cdn.example.com/script.js',
        '/styles/main.css',
        'example.com/data.json',
        'https://example.com/page.html',
        'https://example.com/archive.zip'
      ];
      
      nonImageUrls.forEach(url => {
        const result = validateImageUrl(url);
        expect(result.valid).toBe(false);
        expect(result.error).toBe('URL must point to an image file');
      });
    });

    it('should inherit URL validation rules', () => {
      const result = validateImageUrl('javascript:alert("xss")');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Invalid URL protocol');
    });
  });

  describe('validateText', () => {
    it('should accept valid text including empty strings', () => {
      const validTexts = [
        { input: 'Valid text', expected: 'Valid text' },
        { input: '   Trimmed   ', expected: 'Trimmed' },
        { input: '', expected: '' },
        { input: null, expected: '' },
        { input: undefined, expected: '' }
      ];
      
      validTexts.forEach(({ input, expected }) => {
        const result = validateText(input, 'Description');
        expect(result.valid).toBe(true);
        expect(result.value).toBe(expected);
      });
    });

    it('should respect custom max length', () => {
      const text = 'a'.repeat(51);
      const result1 = validateText(text, 'Topic', 50);
      expect(result1.valid).toBe(false);
      expect(result1.error).toBe('Topic must be less than 50 characters');
      
      const result2 = validateText(text, 'Description', 100);
      expect(result2.valid).toBe(true);
    });

    it('should reject HTML tags', () => {
      const htmlTexts = [
        '<script>alert("xss")</script>',
        'Text with <b>HTML</b>',
        '<div>content</div>',
        'Before<br>After'
      ];
      
      htmlTexts.forEach(text => {
        const result = validateText(text, 'Field');
        expect(result.valid).toBe(false);
        expect(result.error).toBe('Field cannot contain HTML tags');
      });
    });
  });

  describe('validateImageData', () => {
    it('should accept valid image data URLs', () => {
      const validDataUrls = [
        'data:image/jpeg;base64,/9j/4AAQSkZJRg==',
        'data:image/png;base64,iVBORw0KGgo=',
        'data:image/gif;base64,R0lGODlh',
        'data:image/webp;base64,UklGRg=='
      ];
      
      validDataUrls.forEach(dataUrl => {
        const result = validateImageData(dataUrl);
        expect(result.valid).toBe(true);
        expect(result.value).toBe(dataUrl);
      });
    });

    it('should validate filenames', () => {
      const dataUrl = 'data:image/png;base64,iVBORw0KGgo=';
      
      const validFilenames = ['image.png', 'photo.jpg', 'avatar.JPEG', '  trimmed.gif  '];
      validFilenames.forEach(filename => {
        const result = validateImageData(dataUrl, filename);
        expect(result.valid).toBe(true);
        expect(result.filename).toBe(filename.trim());
      });
      
      const invalidFilenames = [
        { name: 'document.pdf', error: 'Filename must have a valid image extension' },
        { name: 'a'.repeat(101) + '.jpg', error: 'Filename must be less than 100 characters' },
        { name: '<script>.jpg', error: 'Filename cannot contain HTML tags' }
      ];
      
      invalidFilenames.forEach(({ name, error }) => {
        const result = validateImageData(dataUrl, name);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(error);
      });
    });

    it('should reject invalid image data', () => {
      const invalidCases = [
        { input: null, error: 'Image data is required' },
        { input: undefined, error: 'Image data is required' },
        { input: '', error: 'Image data is required' },
        { input: 'not-a-data-url', error: 'Invalid image format. Must be JPEG, PNG, GIF, or WebP' },
        { input: 'data:text/plain;base64,dGV4dA==', error: 'Invalid image format. Must be JPEG, PNG, GIF, or WebP' },
        { input: 'data:image/svg+xml;base64,PHN2Zz4=', error: 'Invalid image format. Must be JPEG, PNG, GIF, or WebP' },
        { input: 'data:image/png;base64,', error: 'Invalid image data' }
      ];
      
      invalidCases.forEach(({ input, error }) => {
        const result = validateImageData(input);
        expect(result.valid).toBe(false);
        expect(result.error).toBe(error);
      });
    });

    it('should reject oversized images', () => {
      // Create a data URL that would exceed 5MB when decoded
      const largeBase64 = 'A'.repeat(7 * 1024 * 1024); // ~5.25MB when decoded
      const largeDataUrl = `data:image/png;base64,${largeBase64}`;
      
      const result = validateImageData(largeDataUrl);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Image size must be less than 5MB');
    });

    it('should calculate size correctly for different base64 padding', () => {
      // Test with different padding scenarios
      const testCases = [
        'data:image/png;base64,YWJj', // No padding
        'data:image/png;base64,YWI=', // One padding
        'data:image/png;base64,YQ=='  // Two padding
      ];
      
      testCases.forEach(dataUrl => {
        const result = validateImageData(dataUrl);
        expect(result.valid).toBe(true);
      });
    });
  });
});