import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Server encryption key management

/**
 * Generate a new server encryption key
 * This key will be used to encrypt all data within a server
 */
export function generateServerKey() {
  return crypto.randomBytes(32).toString('hex'); // 256-bit key
}

/**
 * Generate a salt for key derivation
 */
export function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Derive an encryption key from a server password
 * @param {string} password - The server password
 * @param {string} salt - Salt for key derivation
 * @returns {string} Derived key
 */
export function deriveKeyFromPassword(password, salt) {
  return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
}

/**
 * Hash the server encryption key for storage
 * We store a hash to verify the key without storing the actual key
 * @param {string} key - The encryption key
 * @returns {Promise<string>} Hashed key
 */
export async function hashServerKey(key) {
  return await bcrypt.hash(key, 10);
}

/**
 * Verify a server encryption key against stored hash
 * @param {string} key - The encryption key to verify
 * @param {string} hash - The stored hash
 * @returns {Promise<boolean>} True if valid
 */
export async function verifyServerKey(key, hash) {
  return await bcrypt.compare(key, hash);
}

/**
 * Encrypt data using server key
 * @param {string} data - Data to encrypt
 * @param {string} key - Server encryption key
 * @returns {object} Encrypted data with IV
 */
export function encryptWithServerKey(data, key) {
  const iv = crypto.randomBytes(16);
  const keyBuffer = Buffer.from(key, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', keyBuffer, iv);
  
  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex')
  };
}

/**
 * Decrypt data using server key
 * @param {string} encrypted - Encrypted data
 * @param {string} key - Server encryption key
 * @param {string} iv - Initialization vector
 * @param {string} authTag - Authentication tag
 * @returns {string} Decrypted data
 */
export function decryptWithServerKey(encrypted, key, iv, authTag) {
  const keyBuffer = Buffer.from(key, 'hex');
  const ivBuffer = Buffer.from(iv, 'hex');
  const authTagBuffer = Buffer.from(authTag, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-gcm', keyBuffer, ivBuffer);
  decipher.setAuthTag(authTagBuffer);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

/**
 * Generate an invite package that includes encrypted server key
 * @param {string} inviteCode - The invite code
 * @param {string} serverKey - The server encryption key
 * @param {string} invitePassword - Password to encrypt the server key
 * @returns {object} Encrypted invite package
 */
export function createInvitePackage(inviteCode, serverKey, invitePassword) {
  // Derive a key from the invite password
  const salt = generateSalt();
  const derivedKey = deriveKeyFromPassword(invitePassword, salt);
  
  // Encrypt the server key with the derived key
  const encryptedKey = encryptWithServerKey(serverKey, derivedKey);
  
  return {
    inviteCode,
    encryptedServerKey: encryptedKey.encrypted,
    iv: encryptedKey.iv,
    authTag: encryptedKey.authTag,
    salt
  };
}

/**
 * Decrypt an invite package to get the server key
 * @param {object} invitePackage - The encrypted invite package
 * @param {string} invitePassword - Password to decrypt the server key
 * @returns {string} Decrypted server key
 */
export function decryptInvitePackage(invitePackage, invitePassword) {
  // Derive the key from the invite password
  const derivedKey = deriveKeyFromPassword(invitePassword, invitePackage.salt);
  
  // Decrypt the server key
  return decryptWithServerKey(
    invitePackage.encryptedServerKey,
    derivedKey,
    invitePackage.iv,
    invitePackage.authTag
  );
}