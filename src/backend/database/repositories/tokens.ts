import Store from 'electron-store';

export interface OAuthToken {
  userId: string;
  accessToken: string;
  clientId: string;
  createdAt: string;
  expiresAt?: string;
  isValid: boolean;
}

// Encrypted storage for OAuth tokens using electron-store
const store = new Store({
  name: 'secure-tokens',
  encryptionKey: 'stream-synth-encryption-key-2025' // In production, generate this securely
});

export class TokensRepository {
  save(token: Omit<OAuthToken, 'createdAt' | 'isValid'>): void {
    const tokenData: OAuthToken = {
      ...token,
      createdAt: new Date().toISOString(),
      isValid: true
    };
    
    // Store encrypted in electron-store (not SQLite for security)
    const key = `token:${token.userId}`;
    (store as any).set(key, tokenData);
  }

  get(userId: string): OAuthToken | null {
    const key = `token:${userId}`;
    return (store as any).get(key) || null;
  }

  invalidate(userId: string): void {
    const tokenData = this.get(userId);
    if (tokenData) {
      tokenData.isValid = false;
      const key = `token:${userId}`;
      (store as any).set(key, tokenData);
    }
  }

  delete(userId: string): void {
    const key = `token:${userId}`;
    (store as any).delete(key);
  }

  getAll(): OAuthToken[] {
    const allData = (store as any).store || {};
    return Object.values(allData).filter((item: any) => item && item.userId) as OAuthToken[];
  }

  clear(): void {
    (store as any).clear();
  }
}

