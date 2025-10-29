import Store from 'electron-store';

export interface OAuthToken {
  userId: string;
  accessToken: string;
  clientId: string;
  createdAt: string;
  expiresAt?: string;
  isValid: boolean;
}

/**
 * TokensRepository - Encrypted storage for OAuth tokens using electron-store
 * Uses secure encryption instead of SQLite for sensitive token data
 */
const store = new Store({
  name: 'secure-tokens',
  encryptionKey: 'stream-synth-encryption-key-2025' // In production, generate this securely
});

export class TokensRepository {
  /**
   * Save a new token
   */
  save(token: Omit<OAuthToken, 'createdAt' | 'isValid'>): void {
    const tokenData: OAuthToken = {
      ...token,
      createdAt: new Date().toISOString(),
      isValid: true
    };
    
    const key = `token:${token.userId}`;
    (store as any).set(key, tokenData);
  }

  /**
   * Get token by user ID
   */
  get(userId: string): OAuthToken | null {
    const key = `token:${userId}`;
    return (store as any).get(key) || null;
  }

  /**
   * Invalidate a token
   */
  invalidate(userId: string): void {
    const tokenData = this.get(userId);
    if (tokenData) {
      tokenData.isValid = false;
      const key = `token:${userId}`;
      (store as any).set(key, tokenData);
    }
  }

  /**
   * Delete a token
   */
  delete(userId: string): void {
    const key = `token:${userId}`;
    (store as any).delete(key);
  }

  /**
   * Get all stored tokens
   */
  getAll(): OAuthToken[] {
    const allData = (store as any).store || {};
    return Object.values(allData).filter((item: any) => item && item.userId) as OAuthToken[];
  }

  /**
   * Clear all tokens
   */
  clear(): void {
    (store as any).clear();
  }
}

