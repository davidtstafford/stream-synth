/**
 * EventSub Frontend Service
 * 
 * Wraps EventSub IPC calls for React components
 */

const { ipcRenderer } = window.require('electron');

export interface EventSubStatus {
  connected: boolean;
  sessionId: string | null;
  subscriptionCount: number;
  subscriptions: Array<{
    type: string;
    condition: Record<string, string>;
  }>;
  reconnectAttempts: number;
}

/**
 * Get EventSub connection status
 */
export async function getEventSubStatus(): Promise<{
  success: boolean;
  result?: EventSubStatus;
  error?: string;
}> {
  try {
    const response = await ipcRenderer.invoke('eventsub-get-status');
    if (response.success && response.data) {
      return { success: true, result: response.data };
    }
    return { success: false, error: response.error || 'Unknown error' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Initialize EventSub connection
 */
export async function initializeEventSub(
  userId: string,
  channelId: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await ipcRenderer.invoke('eventsub-initialize', {
      userId,
      channelId,
    });

    if (response.success) {
      return { success: true, message: response.data?.message };
    }
    return { success: false, error: response.error || response.data?.message || 'Unknown error' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Disconnect EventSub
 */
export async function disconnectEventSub(): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const response = await ipcRenderer.invoke('eventsub-disconnect');

    if (response.success) {
      return { success: true, message: response.data?.message };
    }
    return { success: false, error: response.error || response.data?.message || 'Unknown error' };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/**
 * Listen for EventSub connection status changes
 */
export function onEventSubConnected(callback: () => void): () => void {
  const listener = () => callback();
  ipcRenderer.on('eventsub-connected', listener);
  return () => ipcRenderer.removeListener('eventsub-connected', listener);
}

/**
 * Listen for EventSub disconnection
 */
export function onEventSubDisconnected(callback: () => void): () => void {
  const listener = () => callback();
  ipcRenderer.on('eventsub-disconnected', listener);
  return () => ipcRenderer.removeListener('eventsub-disconnected', listener);
}

/**
 * Listen for EventSub events
 */
export function onEventSubEvent(
  callback: (eventType: string, data: any) => void
): () => void {
  const listener = (_event: any, eventType: string, data: any) => callback(eventType, data);
  ipcRenderer.on('eventsub-event', listener);
  return () => ipcRenderer.removeListener('eventsub-event', listener);
}

/**
 * Listen for EventSub errors
 */
export function onEventSubError(callback: (error: any) => void): () => void {
  const listener = (_event: any, error: any) => callback(error);
  ipcRenderer.on('eventsub-error', listener);
  return () => ipcRenderer.removeListener('eventsub-error', listener);
}
