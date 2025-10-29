/**
 * IRC API - Frontend wrapper for IRC functionality
 * 
 * Provides methods to interact with Twitch IRC (via tmi.js in backend)
 * This is used alongside EventSub for JOIN/PART events and sending messages
 */

const { ipcRenderer } = window.require('electron');

interface IRCConnectionStatus {
  connected: boolean;
  channel: string | null;
  username: string | null;
  error: string | null;
}

interface IRCChatEvent {
  type: 'irc.chat.join' | 'irc.chat.part';
  channel: string;
  username: string;
  timestamp: string;
}

/**
 * Connect to Twitch IRC
 * @param username - Twitch username
 * @param token - OAuth access token (without 'oauth:' prefix)
 * @param channel - Optional channel to join (defaults to own channel)
 */
export async function connectIRC(
  username: string,
  token: string,
  channel?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ipcRenderer.invoke('irc:connect', { username, token, channel });
    if (response.success) {
      return { success: true };
    } else {
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('[IRC API] Connection error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Disconnect from Twitch IRC
 */
export async function disconnectIRC(): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ipcRenderer.invoke('irc:disconnect');
    if (response.success) {
      return { success: true };
    } else {
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('[IRC API] Disconnect error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Send a chat message
 * @param message - Message to send
 * @param channel - Optional channel (defaults to current channel)
 */
export async function sendChatMessage(
  message: string,
  channel?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ipcRenderer.invoke('irc:send-message', { message, channel });
    if (response.success) {
      return { success: true };
    } else {
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('[IRC API] Send message error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get IRC connection status
 */
export async function getIRCStatus(): Promise<IRCConnectionStatus> {
  try {
    const response = await ipcRenderer.invoke('irc:get-status');
    if (response.success) {
      return response.data;
    } else {
      return {
        connected: false,
        channel: null,
        username: null,
        error: response.error || 'Unknown error',
      };
    }
  } catch (error) {
    console.error('[IRC API] Get status error:', error);
    return {
      connected: false,
      channel: null,
      username: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Join a channel
 * @param channel - Channel name to join
 */
export async function joinChannel(channel: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ipcRenderer.invoke('irc:join-channel', channel);
    if (response.success) {
      return { success: true };
    } else {
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('[IRC API] Join channel error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Leave a channel
 * @param channel - Channel name to leave
 */
export async function leaveChannel(channel: string): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await ipcRenderer.invoke('irc:leave-channel', channel);
    if (response.success) {
      return { success: true };
    } else {
      return { success: false, error: response.error };
    }
  } catch (error) {
    console.error('[IRC API] Leave channel error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Listen for JOIN events
 * @param callback - Function to call when user joins chat
 * @returns Cleanup function to remove listener
 */
export function onChatJoin(callback: (event: IRCChatEvent) => void): () => void {
  const listener = (event: any, data: IRCChatEvent) => callback(data);
  ipcRenderer.on('irc:chat-join', listener);
  
  // Return cleanup function
  return () => {
    ipcRenderer.removeListener('irc:chat-join', listener);
  };
}

/**
 * Listen for PART events
 * @param callback - Function to call when user leaves chat
 * @returns Cleanup function to remove listener
 */
export function onChatPart(callback: (event: IRCChatEvent) => void): () => void {
  const listener = (event: any, data: IRCChatEvent) => callback(data);
  ipcRenderer.on('irc:chat-part', listener);
  
  // Return cleanup function
  return () => {
    ipcRenderer.removeListener('irc:chat-part', listener);
  };
}

/**
 * Listen for IRC status changes
 * @param callback - Function to call when status changes
 * @returns Cleanup function to remove listener
 */
export function onIRCStatusChange(callback: (status: IRCConnectionStatus) => void): () => void {
  const listener = (event: any, data: IRCConnectionStatus) => callback(data);
  ipcRenderer.on('irc:status', listener);
  
  // Return cleanup function
  return () => {
    ipcRenderer.removeListener('irc:status', listener);
  };
}
