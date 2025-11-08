import crypto from 'crypto';

/**
 * Encryption utility for sensitive data like Discord bot tokens
 * Uses AES-256-GCM for authenticated encryption
 */

// Master encryption key - should be loaded from environment or stored securely
// For production, this should be retrieved from a secrets manager
const getMasterKey = (): Buffer => {
  const keyEnv = process.env.DISCORD_ENCRYPTION_KEY;
  
  if (!keyEnv) {
    // Fall back to a deterministic key based on app data - NOT FOR PRODUCTION
    // In production, this should fail or use a proper key management system
    console.warn('[CryptoUtils] DISCORD_ENCRYPTION_KEY not set, using fallback key. This is NOT SECURE for production.');
    return crypto.scryptSync('stream-synth-default-key', 'salt', 32);
  }
  
  // If key is hex-encoded (64 chars = 32 bytes in hex)
  if (keyEnv.length === 64 && /^[0-9a-f]{64}$/i.test(keyEnv)) {
    return Buffer.from(keyEnv, 'hex');
  }
  
  // Otherwise derive it from the string
  return crypto.scryptSync(keyEnv, 'stream-synth', 32);
};

interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
}

/**
 * Encrypt a plaintext string (e.g., Discord bot token)
 * Returns encrypted data as base64-encoded JSON
 */
export function encryptToken(plaintext: string): string {
  try {
    const key = getMasterKey();
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    
    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    const encrypted: EncryptedData = {
      ciphertext,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
    };
    
    // Encode as base64 for storage
    return Buffer.from(JSON.stringify(encrypted)).toString('base64');
  } catch (error) {
    console.error('[CryptoUtils] Encryption failed:', error);
    throw new Error('Failed to encrypt token');
  }
}

/**
 * Decrypt an encrypted token
 * Expects base64-encoded JSON from encryptToken()
 */
export function decryptToken(encryptedBase64: string): string {
  try {
    if (!encryptedBase64) {
      throw new Error('No encrypted token provided');
    }
    
    // Decode from base64
    const encrypted = JSON.parse(
      Buffer.from(encryptedBase64, 'base64').toString('utf8')
    ) as EncryptedData;
    
    const key = getMasterKey();
    const iv = Buffer.from(encrypted.iv, 'hex');
    const authTag = Buffer.from(encrypted.authTag, 'hex');
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    
    let plaintext = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    
    return plaintext;
  } catch (error) {
    console.error('[CryptoUtils] Decryption failed:', error);
    throw new Error('Failed to decrypt token');
  }
}

/**
 * Check if a token is already encrypted (base64-encoded JSON)
 */
export function isEncrypted(token: string): boolean {
  try {
    if (!token || token.length < 20) {
      return false;
    }
    
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const parsed = JSON.parse(decoded) as EncryptedData;
    
    // Check if it has the expected structure
    return (
      typeof parsed.ciphertext === 'string' &&
      typeof parsed.iv === 'string' &&
      typeof parsed.authTag === 'string'
    );
  } catch {
    return false;
  }
}

/**
 * Hash a token for logging/debugging (safe to log, cannot be reversed)
 */
export function hashToken(token: string): string {
  return crypto
    .createHash('sha256')
    .update(token)
    .digest('hex')
    .substring(0, 12);
}
