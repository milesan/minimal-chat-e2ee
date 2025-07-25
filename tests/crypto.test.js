import { describe, it, expect } from 'vitest';
import { CryptoService } from '../client/src/services/crypto.js';

describe('CryptoService', () => {
  describe('generatePassword', () => {
    it('should generate passwords in the correct format', () => {
      const password = CryptoService.generatePassword();
      
      // Should be in format: word-word-word-word-number
      const parts = password.split('-');
      expect(parts.length).toBe(5);
      
      // Last part should be a number
      const number = parseInt(parts[4]);
      expect(number).toBeGreaterThanOrEqual(0);
      expect(number).toBeLessThan(100);
      
      // First 4 parts should be words
      const validWords = [
        'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
        'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
        'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
        'yankee', 'zulu', 'red', 'blue', 'green', 'yellow', 'purple', 'orange',
        'black', 'white', 'silver', 'gold', 'bronze', 'copper', 'iron', 'steel'
      ];
      
      for (let i = 0; i < 4; i++) {
        expect(validWords).toContain(parts[i]);
      }
    });

    it('should generate different passwords on each call', () => {
      const passwords = new Set();
      
      // Generate 10 passwords
      for (let i = 0; i < 10; i++) {
        passwords.add(CryptoService.generatePassword());
      }
      
      // Should have at least 8 unique passwords out of 10
      // (allowing for some collisions but very unlikely to have many)
      expect(passwords.size).toBeGreaterThanOrEqual(8);
    });

    it('should use crypto.getRandomValues (not Math.random)', () => {
      // Test that the function doesn't use Math.random by checking
      // that it still works when Math.random is overridden
      const originalRandom = Math.random;
      Math.random = () => {
        throw new Error('Math.random should not be used');
      };
      
      try {
        // Should not throw
        const password = CryptoService.generatePassword();
        expect(password).toBeTruthy();
      } finally {
        Math.random = originalRandom;
      }
    });
  });

  describe('encrypt/decrypt', () => {
    it('should encrypt and decrypt text correctly', async () => {
      const text = 'Hello, World!';
      const password = 'test-password-123';
      
      const encrypted = await CryptoService.encrypt(text, password);
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.metadata).toBeTruthy();
      
      const decrypted = await CryptoService.decrypt(
        encrypted.ciphertext,
        encrypted.metadata,
        password
      );
      expect(decrypted).toBe(text);
    });

    it('should fail to decrypt with wrong password', async () => {
      const text = 'Secret message';
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      
      const encrypted = await CryptoService.encrypt(text, password);
      
      await expect(
        CryptoService.decrypt(encrypted.ciphertext, encrypted.metadata, wrongPassword)
      ).rejects.toThrow('Failed to decrypt message');
    });
  });
});