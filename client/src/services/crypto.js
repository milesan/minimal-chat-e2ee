export class CryptoService {
  // Derive a key from password using PBKDF2
  static async deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  // Encrypt text with password
  static async encrypt(text, password) {
    try {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await this.deriveKey(password, salt);
      
      const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(text)
      );
      
      // Convert to base64 for storage
      const encryptedArray = new Uint8Array(encrypted);
      const encryptedBase64 = btoa(String.fromCharCode(...encryptedArray));
      
      // Store salt and IV with the ciphertext
      const metadata = {
        salt: Array.from(salt),
        iv: Array.from(iv)
      };
      
      return {
        ciphertext: encryptedBase64,
        metadata: btoa(JSON.stringify(metadata))
      };
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt message');
    }
  }

  // Decrypt text with password
  static async decrypt(ciphertext, metadataStr, password) {
    try {
      // Parse metadata
      const metadata = JSON.parse(atob(metadataStr));
      const salt = new Uint8Array(metadata.salt);
      const iv = new Uint8Array(metadata.iv);
      
      // Derive key
      const key = await this.deriveKey(password, salt);
      
      // Convert base64 back to array
      const encryptedData = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
      
      // Decrypt
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv },
        key,
        encryptedData
      );
      
      return new TextDecoder().decode(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt message - wrong password?');
    }
  }

  // Generate a strong random password
  static generatePassword() {
    const words = [
      'alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot', 'golf', 'hotel',
      'india', 'juliet', 'kilo', 'lima', 'mike', 'november', 'oscar', 'papa',
      'quebec', 'romeo', 'sierra', 'tango', 'uniform', 'victor', 'whiskey', 'xray',
      'yankee', 'zulu', 'red', 'blue', 'green', 'yellow', 'purple', 'orange',
      'black', 'white', 'silver', 'gold', 'bronze', 'copper', 'iron', 'steel'
    ];
    
    // Use crypto.getRandomValues for secure randomness
    const randomValues = new Uint32Array(5);
    crypto.getRandomValues(randomValues);
    
    // Pick 4 random words
    const selected = [];
    for (let i = 0; i < 4; i++) {
      const index = randomValues[i] % words.length;
      selected.push(words[index]);
    }
    
    // Add a random number
    const number = randomValues[4] % 100;
    
    return selected.join('-') + '-' + number;
  }
}