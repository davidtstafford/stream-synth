const { ipcRenderer } = window.require('electron');

export interface ConnectionSession {
  id?: number;
  user_id: string;
  user_login: string;
  channel_id: string;
  channel_login: string;
  is_broadcaster: boolean;
  is_current?: boolean;
}

export interface OAuthToken {
  userId: string;
  accessToken: string;
  clientId: string;
  createdAt?: string;
  expiresAt?: string;
  isValid?: boolean;
}

// Settings
export async function getSetting(key: string): Promise<string | null> {
  return await ipcRenderer.invoke('db:get-setting', key);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ipcRenderer.invoke('db:set-setting', key, value);
}

export async function getAllSettings(): Promise<Array<{ key: string; value: string }>> {
  return await ipcRenderer.invoke('db:get-all-settings');
}

// Sessions
export async function createSession(session: ConnectionSession): Promise<number> {
  const result = await ipcRenderer.invoke('db:create-session', session);
  return result.id;
}

export async function getCurrentSession(): Promise<ConnectionSession | null> {
  return await ipcRenderer.invoke('db:get-current-session');
}

export async function endCurrentSession(): Promise<void> {
  await ipcRenderer.invoke('db:end-current-session');
}

export async function getRecentSessions(limit: number = 10): Promise<ConnectionSession[]> {
  return await ipcRenderer.invoke('db:get-recent-sessions', limit);
}

// Event Subscriptions
export async function saveSubscription(userId: string, channelId: string, eventType: string, isEnabled: boolean): Promise<void> {
  await ipcRenderer.invoke('db:save-subscription', userId, channelId, eventType, isEnabled);
}

export async function getSubscriptions(userId: string, channelId: string): Promise<Array<{ event_type: string; is_enabled: boolean }>> {
  return await ipcRenderer.invoke('db:get-subscriptions', userId, channelId);
}

export async function getEnabledEvents(userId: string, channelId: string): Promise<string[]> {
  return await ipcRenderer.invoke('db:get-enabled-events', userId, channelId);
}

export async function clearSubscriptions(userId: string, channelId: string): Promise<void> {
  await ipcRenderer.invoke('db:clear-subscriptions', userId, channelId);
}

// OAuth Tokens
export async function saveToken(token: OAuthToken): Promise<void> {
  await ipcRenderer.invoke('db:save-token', token);
}

export async function getToken(userId: string): Promise<OAuthToken | null> {
  return await ipcRenderer.invoke('db:get-token', userId);
}

export async function invalidateToken(userId: string): Promise<void> {
  await ipcRenderer.invoke('db:invalidate-token', userId);
}

export async function deleteToken(userId: string): Promise<void> {
  await ipcRenderer.invoke('db:delete-token', userId);
}

// Export/Import
export async function exportSettings(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  return await ipcRenderer.invoke('export-settings');
}

export async function importSettings(): Promise<{ success: boolean; message?: string; error?: string; imported?: any }> {
  return await ipcRenderer.invoke('import-settings');
}

export async function getExportPreview(): Promise<{ success: boolean; preview?: any; error?: string }> {
  return await ipcRenderer.invoke('get-export-preview');
}
