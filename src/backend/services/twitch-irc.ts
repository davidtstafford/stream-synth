/**
 * Twitch IRC Service
 * 
 * Handles Twitch IRC/TMI connection for events not available via EventSub:
 * - JOIN events (user enters chat)
 * - PART events (user leaves chat)
 * - Sending chat messages (bot functionality)
 * 
 * This service is designed to work alongside EventSub WebSocket,
 * NOT as a replacement. EventSub handles the majority of events.
 */

import tmi from 'tmi.js';
import { EventEmitter } from 'events';

interface IRCChatEvent {
  type: 'irc.chat.join' | 'irc.chat.part';
  channel: string;
  username: string;
  timestamp: string;
}

interface IRCConnectionStatus {
  connected: boolean;
  channel: string | null;
  username: string | null;
  error: string | null;
}

export class TwitchIRCService extends EventEmitter {
  private client: tmi.Client | null = null;
  private username: string | null = null;
  private currentChannel: string | null = null;
  private connectionStatus: IRCConnectionStatus = {
    connected: false,
    channel: null,
    username: null,
    error: null,
  };

  /**
   * Connect to Twitch IRC
   * @param username - Twitch username (for identity)
   * @param token - OAuth token (without 'oauth:' prefix)
   * @param channel - Channel to join (defaults to own channel)
   */
  async connect(username: string, token: string, channel?: string): Promise<void> {
    // Disconnect existing connection if any
    if (this.client) {
      await this.disconnect();
    }

    this.username = username;
    this.currentChannel = channel || username;

    try {
      this.client = new tmi.Client({
        options: {
          debug: false, // Set to true for debugging
          skipUpdatingEmotesets: true, // We don't need emote data
        },
        identity: {
          username: username,
          password: `oauth:${token}`,
        },
        channels: [this.currentChannel],
      });

      // Setup event listeners BEFORE connecting
      this.setupEventListeners();

      // Connect to IRC
      await this.client.connect();

      this.connectionStatus = {
        connected: true,
        channel: this.currentChannel,
        username: this.username,
        error: null,
      };

      this.emit('status', this.connectionStatus);
      console.log(`[IRC] Connected to #${this.currentChannel}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.connectionStatus = {
        connected: false,
        channel: null,
        username: null,
        error: errorMessage,
      };
      this.emit('status', this.connectionStatus);
      console.error('[IRC] Connection failed:', errorMessage);
      throw error;
    }
  }

  /**
   * Setup IRC event listeners
   * Only listens to JOIN/PART events (not available in EventSub)
   */
  private setupEventListeners(): void {
    if (!this.client) return;

    // JOIN event - User enters chat
    this.client.on('join', (channel: string, username: string, self: boolean) => {
      // Don't emit for our own join
      if (self) return;

      const event: IRCChatEvent = {
        type: 'irc.chat.join',
        channel: channel.replace('#', ''), // Remove # prefix
        username,
        timestamp: new Date().toISOString(),
      };

      this.emit('chat.join', event);
      console.log(`[IRC] User joined: ${username}`);
    });

    // PART event - User leaves chat
    this.client.on('part', (channel: string, username: string, self: boolean) => {
      // Don't emit for our own part
      if (self) return;

      const event: IRCChatEvent = {
        type: 'irc.chat.part',
        channel: channel.replace('#', ''), // Remove # prefix
        username,
        timestamp: new Date().toISOString(),
      };

      this.emit('chat.part', event);
      console.log(`[IRC] User left: ${username}`);
    });

    // Connection events
    this.client.on('connected', (address: string, port: number) => {
      console.log(`[IRC] Connected to ${address}:${port}`);
    });

    this.client.on('disconnected', (reason: string) => {
      console.log(`[IRC] Disconnected: ${reason}`);
      this.connectionStatus.connected = false;
      this.emit('status', this.connectionStatus);
    });

    // Error handling
    this.client.on('notice' as any, (channel: string, msgid: string, message: string) => {
      console.warn('[IRC] Notice:', msgid, message);
    });

    // Reconnect handling
    this.client.on('reconnect', () => {
      console.log('[IRC] Attempting to reconnect...');
    });
  }

  /**
   * Send a chat message
   * This is the main reason to use IRC alongside EventSub
   * (EventSub is read-only, can't send messages)
   * 
   * @param message - Message to send
   * @param channel - Optional channel (defaults to connected channel)
   */
  async sendMessage(message: string, channel?: string): Promise<void> {
    if (!this.client || !this.connectionStatus.connected) {
      throw new Error('IRC client not connected');
    }

    const targetChannel = channel || this.currentChannel;
    if (!targetChannel) {
      throw new Error('No channel specified');
    }

    try {
      await this.client.say(targetChannel, message);
      console.log(`[IRC] Message sent to #${targetChannel}: ${message}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('[IRC] Failed to send message:', errorMessage);
      throw error;
    }
  }

  /**
   * Join additional channels
   * @param channel - Channel name to join
   */
  async joinChannel(channel: string): Promise<void> {
    if (!this.client || !this.connectionStatus.connected) {
      throw new Error('IRC client not connected');
    }

    try {
      await this.client.join(channel);
      console.log(`[IRC] Joined channel: #${channel}`);
    } catch (error) {
      console.error(`[IRC] Failed to join channel #${channel}:`, error);
      throw error;
    }
  }

  /**
   * Leave a channel
   * @param channel - Channel name to leave
   */
  async leaveChannel(channel: string): Promise<void> {
    if (!this.client || !this.connectionStatus.connected) {
      throw new Error('IRC client not connected');
    }

    try {
      await this.client.part(channel);
      console.log(`[IRC] Left channel: #${channel}`);
    } catch (error) {
      console.error(`[IRC] Failed to leave channel #${channel}:`, error);
      throw error;
    }
  }

  /**
   * Disconnect from IRC
   */
  async disconnect(): Promise<void> {
    if (!this.client) {
      return;
    }

    try {
      await this.client.disconnect();
      this.client = null;
      this.username = null;
      this.currentChannel = null;
      this.connectionStatus = {
        connected: false,
        channel: null,
        username: null,
        error: null,
      };
      this.emit('status', this.connectionStatus);
      console.log('[IRC] Disconnected');
    } catch (error) {
      console.error('[IRC] Error during disconnect:', error);
    }
  }

  /**
   * Get current connection status
   */
  getStatus(): IRCConnectionStatus {
    return { ...this.connectionStatus };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionStatus.connected;
  }

  /**
   * Get current channel
   */
  getCurrentChannel(): string | null {
    return this.currentChannel;
  }

  /**
   * Get username
   */
  getUsername(): string | null {
    return this.username;
  }
}

// Export singleton instance
export const twitchIRCService = new TwitchIRCService();
