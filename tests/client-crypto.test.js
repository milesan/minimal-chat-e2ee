import { describe, it, expect, beforeEach } from 'vitest';
import { CryptoService } from '../client/src/services/crypto.js';

describe('Client CryptoService', () => {
  describe('Password Generation', () => {
    it('should generate passwords with correct format', () => {
      const password = CryptoService.generatePassword();
      expect(password).toMatch(/^[a-z]+-[a-z]+-[a-z]+-[a-z]+-\d{1,2}$/);
    });

    it('should generate different passwords each time', () => {
      const passwords = new Set();
      for (let i = 0; i < 10; i++) {
        passwords.add(CryptoService.generatePassword());
      }
      expect(passwords.size).toBe(10);
    });

    it('should use secure random number generation', () => {
      // Test that numbers are well distributed (0-99)
      const numbers = [];
      for (let i = 0; i < 100; i++) {
        const password = CryptoService.generatePassword();
        const num = parseInt(password.split('-').pop());
        numbers.push(num);
      }
      expect(Math.min(...numbers)).toBeLessThan(20);
      expect(Math.max(...numbers)).toBeGreaterThan(80);
    });
  });

  describe('Key Derivation', () => {
    it('should derive consistent keys from same password and salt', async () => {
      const password = 'test-password';
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      
      // Test by encrypting/decrypting with derived keys
      const testData = 'test data';
      const iv = new Uint8Array(12);
      
      const key1 = await CryptoService.deriveKey(password, salt);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        new TextEncoder().encode(testData)
      );
      
      const key2 = await CryptoService.deriveKey(password, salt);
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key2,
        encrypted
      );
      
      expect(new TextDecoder().decode(decrypted)).toBe(testData);
    });

    it('should derive different keys for different passwords', async () => {
      const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const testData = 'test data';
      const iv = new Uint8Array(12);
      
      const key1 = await CryptoService.deriveKey('password1', salt);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        new TextEncoder().encode(testData)
      );
      
      const key2 = await CryptoService.deriveKey('password2', salt);
      
      // Should fail to decrypt with different password
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted)
      ).rejects.toThrow();
    });

    it('should derive different keys for different salts', async () => {
      const password = 'test-password';
      const salt1 = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
      const salt2 = new Uint8Array([16, 15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]);
      const testData = 'test data';
      const iv = new Uint8Array(12);
      
      const key1 = await CryptoService.deriveKey(password, salt1);
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key1,
        new TextEncoder().encode(testData)
      );
      
      const key2 = await CryptoService.deriveKey(password, salt2);
      
      // Should fail to decrypt with different salt
      await expect(
        crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key2, encrypted)
      ).rejects.toThrow();
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt and decrypt text successfully', async () => {
      const plaintext = 'Hello, this is a secret message!';
      const password = 'test-password-123';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      expect(encrypted).toHaveProperty('ciphertext');
      expect(encrypted).toHaveProperty('metadata');
      expect(encrypted.ciphertext).toBeTruthy();
      expect(encrypted.metadata).toBeTruthy();
      
      const decrypted = await CryptoService.decrypt(
        encrypted.ciphertext,
        encrypted.metadata,
        password
      );
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty strings', async () => {
      const plaintext = '';
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const decrypted = await CryptoService.decrypt(
        encrypted.ciphertext,
        encrypted.metadata,
        password
      );
      expect(decrypted).toBe(plaintext);
    });

    it('should handle very long strings', async () => {
      const plaintext = 'A'.repeat(10000);
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const decrypted = await CryptoService.decrypt(
        encrypted.ciphertext,
        encrypted.metadata,
        password
      );
      expect(decrypted).toBe(plaintext);
    });

    it('should handle Unicode characters', async () => {
      const plaintext = '🔐 Encrypting emojis! 你好世界 مرحبا بالعالم';
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const decrypted = await CryptoService.decrypt(
        encrypted.ciphertext,
        encrypted.metadata,
        password
      );
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for same plaintext', async () => {
      const plaintext = 'Same message';
      const password = 'test-password';
      
      const encrypted1 = await CryptoService.encrypt(plaintext, password);
      const encrypted2 = await CryptoService.encrypt(plaintext, password);
      
      expect(encrypted1.ciphertext).not.toBe(encrypted2.ciphertext);
      expect(encrypted1.metadata).not.toBe(encrypted2.metadata);
      
      // But both should decrypt to same plaintext
      const decrypted1 = await CryptoService.decrypt(
        encrypted1.ciphertext,
        encrypted1.metadata,
        password
      );
      const decrypted2 = await CryptoService.decrypt(
        encrypted2.ciphertext,
        encrypted2.metadata,
        password
      );
      expect(decrypted1).toBe(plaintext);
      expect(decrypted2).toBe(plaintext);
    });

    it('should fail to decrypt with wrong password', async () => {
      const plaintext = 'Secret message';
      const password = 'correct-password';
      const wrongPassword = 'wrong-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      
      await expect(
        CryptoService.decrypt(encrypted.ciphertext, encrypted.metadata, wrongPassword)
      ).rejects.toThrow('Failed to decrypt message');
    });

    it('should fail to decrypt with corrupted ciphertext', async () => {
      const plaintext = 'Secret message';
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const corruptedCiphertext = encrypted.ciphertext.slice(0, -4) + 'XXXX';
      
      await expect(
        CryptoService.decrypt(corruptedCiphertext, encrypted.metadata, password)
      ).rejects.toThrow('Failed to decrypt message');
    });

    it('should fail to decrypt with corrupted metadata', async () => {
      const plaintext = 'Secret message';
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const corruptedMetadata = 'invalid-base64-metadata';
      
      await expect(
        CryptoService.decrypt(encrypted.ciphertext, corruptedMetadata, password)
      ).rejects.toThrow();
    });

    it('should handle metadata with modified salt', async () => {
      const plaintext = 'Secret message';
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const metadata = JSON.parse(atob(encrypted.metadata));
      metadata.salt[0] = (metadata.salt[0] + 1) % 256;
      const modifiedMetadata = btoa(JSON.stringify(metadata));
      
      await expect(
        CryptoService.decrypt(encrypted.ciphertext, modifiedMetadata, password)
      ).rejects.toThrow('Failed to decrypt message');
    });

    it('should handle metadata with modified IV', async () => {
      const plaintext = 'Secret message';
      const password = 'test-password';
      
      const encrypted = await CryptoService.encrypt(plaintext, password);
      const metadata = JSON.parse(atob(encrypted.metadata));
      metadata.iv[0] = (metadata.iv[0] + 1) % 256;
      const modifiedMetadata = btoa(JSON.stringify(metadata));
      
      await expect(
        CryptoService.decrypt(encrypted.ciphertext, modifiedMetadata, password)
      ).rejects.toThrow('Failed to decrypt message');
    });
  });

  describe('Base64 Encoding Edge Cases', () => {
    it('should handle binary data patterns correctly', async () => {
      // Test with text that could cause base64 encoding issues
      const patterns = [
        String.fromCharCode(0, 1, 2, 3, 4, 5),
        String.fromCharCode(255, 254, 253, 252),
        '\x00\xFF\x00\xFF',
        'a'.repeat(100) + '\x00' + 'b'.repeat(100)
      ];
      
      const password = 'test-password';
      
      for (const pattern of patterns) {
        const encrypted = await CryptoService.encrypt(pattern, password);
        const decrypted = await CryptoService.decrypt(
          encrypted.ciphertext,
          encrypted.metadata,
          password
        );
        expect(decrypted).toBe(pattern);
      }
    });
  });

  describe('Error Handling', () => {
    it('should throw meaningful error on encryption failure', async () => {
      // Force an error by passing invalid input
      const invalidText = { toString: () => { throw new Error('Cannot convert'); } };
      
      await expect(
        CryptoService.encrypt(invalidText, 'password')
      ).rejects.toThrow('Failed to encrypt message');
    });

    it('should handle null/undefined inputs gracefully', async () => {
      const password = 'test-password';
      
      await expect(
        CryptoService.decrypt(null, 'metadata', password)
      ).rejects.toThrow();
      
      await expect(
        CryptoService.decrypt('ciphertext', null, password)
      ).rejects.toThrow();
      
      await expect(
        CryptoService.decrypt('ciphertext', 'metadata', null)
      ).rejects.toThrow();
    });
  });
});