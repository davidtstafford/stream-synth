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
  const response = await ipcRenderer.invoke('db:get-setting', key);
  return response.success ? response.data : null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ipcRenderer.invoke('db:set-setting', { key, value });
}

export async function getAllSettings(): Promise<Array<{ key: string; value: string }>> {
  const response = await ipcRenderer.invoke('db:get-all-settings');
  return response.success ? response.data : [];
}

// Sessions
export async function createSession(session: ConnectionSession): Promise<number> {
  const response = await ipcRenderer.invoke('db:create-session', session);
  return response.success ? response.data.id : 0;
}

export async function getCurrentSession(): Promise<ConnectionSession | null> {
  const response = await ipcRenderer.invoke('db:get-current-session');
  return response.success ? response.data : null;
}

export async function endCurrentSession(): Promise<void> {
  await ipcRenderer.invoke('db:end-current-session');
}

export async function getRecentSessions(limit: number = 10): Promise<ConnectionSession[]> {
  const response = await ipcRenderer.invoke('db:get-recent-sessions', limit);
  return response.success ? response.data : [];
}

// Event Subscriptions
export async function saveSubscription(userId: string, channelId: string, eventType: string, isEnabled: boolean): Promise<void> {
  await ipcRenderer.invoke('db:save-subscription', { userId, channelId, eventType, isEnabled });
}

export async function getSubscriptions(userId: string, channelId: string): Promise<Array<{ event_type: string; is_enabled: boolean }>> {
  const response = await ipcRenderer.invoke('db:get-subscriptions', { userId, channelId });
  return response.success ? response.data : [];
}

export async function getEnabledEvents(userId: string, channelId: string): Promise<string[]> {
  const response = await ipcRenderer.invoke('db:get-enabled-events', { userId, channelId });
  return response.success ? response.data : [];
}

export async function clearSubscriptions(userId: string, channelId: string): Promise<void> {
  await ipcRenderer.invoke('db:clear-subscriptions', { userId, channelId });
}

// OAuth Tokens
export async function saveToken(token: OAuthToken): Promise<void> {
  await ipcRenderer.invoke('db:save-token', token);
}

export async function getToken(userId: string): Promise<OAuthToken | null> {
  const response = await ipcRenderer.invoke('db:get-token', userId);
  return response.success ? response.data : null;
}

export async function invalidateToken(userId: string): Promise<void> {
  await ipcRenderer.invoke('db:invalidate-token', userId);
}

export async function deleteToken(userId: string): Promise<void> {
  await ipcRenderer.invoke('db:delete-token', userId);
}

// Export/Import
export async function exportSettings(): Promise<{ success: boolean; filePath?: string; error?: string }> {
  const response = await ipcRenderer.invoke('export-settings');
  if (response.success && response.data) {
    return { success: true, filePath: response.data };
  }
  return { success: response.success, error: response.error };
}

export async function importSettings(): Promise<{ success: boolean; message?: string; error?: string; imported?: any }> {
  const response = await ipcRenderer.invoke('import-settings');
  if (response.success && response.data) {
    return { 
      success: true, 
      message: response.data.message, 
      imported: response.data.imported 
    };
  }
  return { success: response.success, error: response.error };
}

export async function getExportPreview(): Promise<{ success: boolean; preview?: any; error?: string }> {
  const response = await ipcRenderer.invoke('get-export-preview');
  if (response.success && response.data) {
    return { success: true, preview: response.data };
  }
  return { success: response.success, error: response.error };
}

// Events Storage
export interface StoredEvent {
  id: number;
  event_type: string;
  event_data: string;
  viewer_id: string | null;
  channel_id: string;
  created_at: string;
  viewer_username?: string;
  viewer_display_name?: string;
}

export interface EventFilters {
  channelId?: string;
  eventType?: string;
  viewerId?: string;
  startDate?: string;
  endDate?: string;
  searchText?: string;
  limit?: number;
  offset?: number;
}

export async function storeEvent(
  eventType: string,
  eventData: any,
  channelId: string,
  viewerId?: string
): Promise<{ success: boolean; id?: number; error?: string }> {
  return await ipcRenderer.invoke('db:store-event', eventType, eventData, channelId, viewerId);
}

export async function getEvents(filters: EventFilters): Promise<{ success: boolean; events?: StoredEvent[]; error?: string }> {
  const response = await ipcRenderer.invoke('db:get-events', filters);
  return response.success ? { success: true, events: response.data.events } : response;
}

export async function getChatEvents(channelId: string, limit?: number): Promise<{ success: boolean; events?: StoredEvent[]; error?: string }> {
  const response = await ipcRenderer.invoke('db:get-chat-events', { channelId, limit });
  return response.success ? { success: true, events: response.data.events } : response;
}

export async function getEventCount(channelId?: string, eventType?: string): Promise<{ success: boolean; count?: number; error?: string }> {
  const response = await ipcRenderer.invoke('db:get-event-count', { channelId, eventType });
  return response.success ? { success: true, count: response.data.count } : response;
}

// Viewers
export interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

export async function getOrCreateViewer(
  id: string,
  username: string,
  displayName?: string
): Promise<{ success: boolean; viewer?: Viewer; error?: string }> {
  return await ipcRenderer.invoke('db:get-or-create-viewer', { id, username, displayName });
}

export async function getViewer(id: string): Promise<{ success: boolean; viewer?: Viewer | null; error?: string }> {
  return await ipcRenderer.invoke('db:get-viewer', id);
}

export async function getAllViewers(limit?: number, offset?: number): Promise<{ success: boolean; viewers?: Viewer[]; error?: string }> {
  return await ipcRenderer.invoke('db:get-all-viewers', { limit, offset });
}

export async function searchViewers(query: string, limit?: number): Promise<{ success: boolean; viewers?: Viewer[]; error?: string }> {
  return await ipcRenderer.invoke('db:search-viewers', { query, limit });
}

export async function deleteViewer(id: string): Promise<{ success: boolean; error?: string }> {
  return await ipcRenderer.invoke('db:delete-viewer', id);
}

export async function deleteAllViewers(): Promise<{ success: boolean; error?: string }> {
  return await ipcRenderer.invoke('db:delete-all-viewers');
}

export async function getViewerCount(): Promise<{ success: boolean; count?: number; error?: string }> {
  return await ipcRenderer.invoke('db:get-viewer-count');
}

// Subscriptions
export interface ViewerSubscription {
  id: string;
  viewer_id: string;
  tier: string;
  is_gift: number;
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface ViewerWithSubscription {
  id: string;
  display_name: string | null;
  tts_voice_id: string | null;
  tts_enabled: number;
  created_at: string;
  updated_at: string;
  tier: string | null;
  is_gift: number | null;
  start_date: string | null;
  end_date: string | null;
  subscription_status: string;
  is_vip: number | null;
  is_moderator: number | null;
  is_broadcaster: number | null;
  moderation_status: string | null;
  moderation_reason: string | null;
  moderation_expires_at: string | null;
  followed_at: string | null;
  is_follower: number | null;
}

export async function upsertSubscription(
  subscription: Partial<ViewerSubscription>
): Promise<{ success: boolean; error?: string }> {
  return await ipcRenderer.invoke('db:upsert-subscription', subscription);
}

export async function getSubscription(viewerId: string): Promise<{ success: boolean; subscription?: ViewerSubscription | null; error?: string }> {
  return await ipcRenderer.invoke('db:get-subscription', viewerId);
}

export async function getAllViewersWithStatus(limit?: number, offset?: number): Promise<{ success: boolean; viewers?: ViewerWithSubscription[]; error?: string }> {
  const response = await ipcRenderer.invoke('db:get-all-viewers-with-status', { limit, offset });
  if (response.success && response.data) {
    return { success: true, viewers: response.data };
  }
  return { success: response.success, error: response.error };
}

export async function searchViewersWithStatus(query: string, limit?: number): Promise<{ success: boolean; viewers?: ViewerWithSubscription[]; error?: string }> {
  const response = await ipcRenderer.invoke('db:search-viewers-with-status', { query, limit });
  if (response.success && response.data) {
    return { success: true, viewers: response.data };
  }
  return { success: response.success, error: response.error };
}

export async function deleteSubscription(viewerId: string): Promise<{ success: boolean; error?: string }> {
  return await ipcRenderer.invoke('db:delete-subscription', viewerId);
}

export async function syncSubscriptionsFromTwitch(broadcasterId: string, userId: string): Promise<{ success: boolean; count?: number; error?: string }> {
  return await ipcRenderer.invoke('db:sync-subscriptions', { broadcasterId, userId });
}

export async function checkSubscriptionStatus(viewerId: string): Promise<{ success: boolean; isSubscribed?: boolean; status?: string; error?: string }> {
  return await ipcRenderer.invoke('db:check-subscription-status', viewerId);
}

// Viewer History & Details
export async function getViewerDetailedHistory(viewerId: string): Promise<any> {
  const response = await ipcRenderer.invoke('viewer:get-detailed-history', viewerId);
  return response;
}

export async function getViewerStats(viewerId: string): Promise<any> {
  const response = await ipcRenderer.invoke('viewer:get-stats', viewerId);
  return response;
}

// Viewer Moderation Actions
export async function banViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,
  reason: string,
  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:ban', {
    broadcasterId,
    userId,
    displayName,
    reason,
    accessToken,
    clientId
  });
}

export async function unbanViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,
  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:unban', {
    broadcasterId,
    userId,
    displayName,
    accessToken,
    clientId
  });
}

export async function timeoutViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,
  durationSeconds: number,
  reason: string,
  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:timeout', {
    broadcasterId,
    userId,
    displayName,
    durationSeconds,
    reason,
    accessToken,
    clientId
  });
}

export async function addModViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,
  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:add-mod', {
    broadcasterId,
    userId,
    displayName,
    accessToken,
    clientId
  });
}

export async function removeModViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,
  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:remove-mod', {
    broadcasterId,
    userId,
    displayName,
    accessToken,
    clientId
  });
}

export async function addVipViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,
  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:add-vip', {
    broadcasterId,
    userId,
    displayName,
    accessToken,
    clientId
  });
}

export async function removeVipViewer(
  broadcasterId: string,
  userId: string,
  displayName: string,  accessToken: string,
  clientId: string
): Promise<any> {
  return await ipcRenderer.invoke('viewer:remove-vip', {
    broadcasterId,
    userId,
    displayName,
    accessToken,
    clientId
  });
}

// Check viewer's real-time ban status from Twitch
export async function checkViewerBanStatus(userId: string): Promise<any> {
  return await ipcRenderer.invoke('twitch:check-user-ban-status', { userId });
}

export async function debugViewerData(viewerId: string): Promise<any> {
  return await ipcRenderer.invoke('debug:viewer-data', { viewerId });
}


