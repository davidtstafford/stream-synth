/**
 * Twitch IRC Service
 * 
 * Handles Twitch IRC/TMI connection for events not available via EventSub:
 * - JOIN events (user enters chat)
 * - PART events (user leaves chat)
 * - Chat messages (for TTS and chat commands)
 * - Sending chat messages (bot functionality)
 * 
 * This service is designed to work alongside EventSub WebSocket,
 * NOT as a replacement. EventSub handles the majority of events.
 */

import tmi from 'tmi.js';
import { EventEmitter } from 'events';
import { ChatCommandHandler, ChatCommandContext } from './chat-command-handler';
import { viewerEntranceTracker } from './viewer-entrance-tracker';
import { ViewerEntranceSoundsRepository } from '../database/repositories/viewer-entrance-sounds';
import { getBrowserSourceServer } from '../main';

interface IRCChatEvent {
  type: 'irc.chat.join' | 'irc.chat.part' | 'irc.chat.message';
  channel: string;
  username: string;
  timestamp: string;
  message?: string;  // For message events
  userId?: string;   // For message events
  userstate?: any;   // Full userstate for command context
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
  private commandHandler: ChatCommandHandler;
  private entranceSoundsRepo: ViewerEntranceSoundsRepository | null = null;
  private connectionStatus: IRCConnectionStatus = {
    connected: false,
    channel: null,
    username: null,
    error: null,
  };

  constructor() {
    super();
    this.commandHandler = new ChatCommandHandler();
    // Don't initialize entrance sounds repo here - database may not be ready
  }

  /**
   * Initialize entrance sounds repository (call after database is ready)
   */
  private ensureEntranceSoundsRepo(): void {
    if (!this.entranceSoundsRepo) {
      this.entranceSoundsRepo = new ViewerEntranceSoundsRepository();
      this.entranceSoundsRepo.ensureTable();
    }
  }

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
          debug: true, // Enable debug to see IRC messages
          skipUpdatingEmotesets: true, // We don't need emote data
        },
        connection: {
          reconnect: true,
          secure: true,
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
    });    // MESSAGE event - Chat messages for TTS and commands
    this.client.on('message', async (channel: string, userstate: any, message: string, self: boolean) => {
      // Don't emit for our own messages
      if (self) return;

      const userId = userstate['user-id'];
      const username = userstate.username || userstate['display-name'] || 'unknown';

      // Check for entrance sound (first message this session)
      if (userId && !viewerEntranceTracker.hasChatted(userId)) {
        this.handleEntranceSound(userId, username);
        viewerEntranceTracker.markChatted(userId);
      }

      const event: IRCChatEvent = {
        type: 'irc.chat.message',
        channel: channel.replace('#', ''), // Remove # prefix
        username,
        userId,
        message,
        timestamp: new Date().toISOString(),
        userstate,
      };

      this.emit('chat.message', event);
      console.log(`[IRC] Message from ${event.username}: ${message}`);

      // Phase 5: Chat commands are now handled by EventSub (not IRC)
      // EventSub processes commands and sends responses via IRC
      // This avoids duplicate command execution
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
   * Handle entrance sound for a viewer's first message
   */
  private handleEntranceSound(userId: string, username: string): void {
    try {
      // Ensure repository is initialized
      this.ensureEntranceSoundsRepo();
      
      // Get entrance sound for this viewer
      const entranceSound = this.entranceSoundsRepo!.getByViewerId(userId);
      
      if (!entranceSound) {
        return; // No entrance sound configured for this viewer
      }

      // Get browser source server
      const browserSourceServer = getBrowserSourceServer();
      if (!browserSourceServer?.io) {
        console.warn('[IRC] Cannot play entrance sound: Browser source server not available');
        return;
      }

      // Send entrance sound to browser source
      browserSourceServer.io.emit('entrance-sound', {
        viewer_username: username,
        sound_file_path: entranceSound.sound_file_path,
        volume: entranceSound.volume,
      });

      console.log(`[IRC] Playing entrance sound for ${username}: ${entranceSound.sound_file_path}`);
    } catch (error) {
      console.error('[IRC] Error handling entrance sound:', error);
    }
  }

  /**
   * Handle chat commands (Phase 5)
   */
  private async handleChatCommand(
    message: string,
    userId: string,
    username: string,
    userstate: any
  ): Promise<void> {
    try {
      // Build command context from userstate
      const context: ChatCommandContext = {
        username,
        userId,
        isModerator: userstate.mod || false,
        isBroadcaster: userstate.badges?.broadcaster === '1',
        isSubscriber: userstate.subscriber || false,
        isVip: userstate.badges?.vip === '1',
      };

      // Process command
      const response = await this.commandHandler.handleMessage(message, context);

      // Send response to chat if command was executed
      if (response) {
        await this.sendMessage(response);
      }
    } catch (error: any) {
      console.error('[IRC] Error handling chat command:', error);
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

  /**
   * Get command handler (for IPC handlers)
   */
  getCommandHandler(): ChatCommandHandler {
    return this.commandHandler;
  }
}

// Export singleton instance
export const twitchIRCService = new TwitchIRCService();
