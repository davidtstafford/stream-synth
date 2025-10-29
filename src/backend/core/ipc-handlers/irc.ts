/**
 * IRC IPC Handlers
 * 
 * Handles IRC (Twitch Chat) operations via IPC using centralized IPC Framework:
 * - Connect/Disconnect
 * - Send messages
 * - Join/Leave channels
 * - IRC event forwarding
 * - Status monitoring
 * 
 * Phase 3: Migrated to use IPCRegistry for consistent error handling
 */

import { BrowserWindow } from 'electron';
import { ipcRegistry } from '../ipc/ipc-framework';
import { twitchIRCService } from '../../services/twitch-irc';
import { SessionsRepository } from '../../database/repositories/sessions';
import { EventsRepository } from '../../database/repositories/events';
import { ViewersRepository } from '../../database/repositories/viewers';

let mainWindow: BrowserWindow | null = null;

const sessionsRepo = new SessionsRepository();
const eventsRepo = new EventsRepository();
const viewersRepo = new ViewersRepository();

export function setMainWindowForIRC(window: BrowserWindow | null): void {
  mainWindow = window;
}

export function setupIRCHandlers(): void {
  // ===== IRC: Connection Management =====
  ipcRegistry.register<{ username: string; token: string; channel?: string }, void>(
    'irc:connect',
    {
      validate: (input) => {
        if (!input.username) return 'Username is required';
        if (!input.token) return 'Token is required';
        return null;
      },
      execute: async (input) => {
        console.log('[IRC] Connecting with username:', input.username);
        await twitchIRCService.connect(input.username, input.token, input.channel);
      }
    }
  );

  ipcRegistry.register<void, void>(
    'irc:disconnect',
    {
      execute: async () => {
        console.log('[IRC] Disconnecting...');
        await twitchIRCService.disconnect();
      }
    }
  );

  // ===== IRC: Messaging =====
  ipcRegistry.register<{ message: string; channel?: string }, void>(
    'irc:send-message',
    {
      validate: (input) => input.message ? null : 'Message is required',
      execute: async (input) => {
        console.log('[IRC] Sending message:', input.message);
        await twitchIRCService.sendMessage(input.message, input.channel);
      }
    }
  );

  // ===== IRC: Channel Management =====
  ipcRegistry.register<string, void>(
    'irc:join-channel',
    {
      validate: (channel) => channel ? null : 'Channel is required',
      execute: async (channel) => {
        console.log('[IRC] Joining channel:', channel);
        await twitchIRCService.joinChannel(channel);
      }
    }
  );

  ipcRegistry.register<string, void>(
    'irc:leave-channel',
    {
      validate: (channel) => channel ? null : 'Channel is required',
      execute: async (channel) => {
        console.log('[IRC] Leaving channel:', channel);
        await twitchIRCService.leaveChannel(channel);
      }
    }
  );

  // ===== IRC: Status =====
  ipcRegistry.register<void, any>(
    'irc:get-status',
    {
      execute: async () => {
        return twitchIRCService.getStatus();
      }
    }
  );

  // IRC: Forward events to renderer AND store in database
  twitchIRCService.on('chat.join', async (event) => {
    // Only act at all if the subscription for this event is enabled.
    // This prevents any forwarding or storage when the user has unchecked the option.
    try {
      const session = await sessionsRepo.getCurrentSession();
      if (!session) return;

      const enabledEvents = eventsRepo.getEnabledEvents(session.user_id, session.channel_id);
      if (!enabledEvents.includes('irc.chat.join')) {
        // Subscription not enabled: do nothing (no UI broadcast, no DB write)
        return;
      }

      // Broadcast to renderer for live UI updates
      mainWindow?.webContents.send('irc:chat-join', event);

      // Get or create viewer (may be null for IRC)
      const viewer = await viewersRepo.getOrCreate(
        event.username,
        event.username,
        event.username
      );

      if (viewer) {
        const eventId = eventsRepo.storeEvent('irc.chat.join', event, session.channel_id, viewer.id);
        console.log(`[IRC] JOIN event stored with ID: ${eventId}`);
        mainWindow?.webContents.send('event:stored', {
          id: eventId,
          event_type: 'irc.chat.join',
          event_data: JSON.stringify(event),
          viewer_id: viewer.id,
          channel_id: session.channel_id,
          created_at: new Date().toISOString(),
          viewer_username: viewer.username,
          viewer_display_name: viewer.display_name
        });
      } else {
        const eventId = eventsRepo.storeEvent('irc.chat.join', event, session.channel_id, undefined);
        console.log(`[IRC] JOIN event stored without viewer ID, event ID: ${eventId}`);
        mainWindow?.webContents.send('event:stored', {
          id: eventId,
          event_type: 'irc.chat.join',
          event_data: JSON.stringify(event),
          viewer_id: undefined,
          channel_id: session.channel_id,
          created_at: new Date().toISOString(),
          viewer_username: event.username,
          viewer_display_name: event.username
        });
      }
    } catch (error) {
      console.error('[IRC] Failed to store JOIN event:', error);
    }
  });

  twitchIRCService.on('chat.part', async (event) => {
    // Only act at all if the subscription for this event is enabled.
    // Prevent any forwarding or storage when the option is disabled.
    try {
      const session = await sessionsRepo.getCurrentSession();
      if (!session) return;

      const enabledEvents = eventsRepo.getEnabledEvents(session.user_id, session.channel_id);
      if (!enabledEvents.includes('irc.chat.part')) {
        // Subscription not enabled: do nothing
        return;
      }

      // Broadcast to renderer for live UI updates
      mainWindow?.webContents.send('irc:chat-part', event);

      const viewer = await viewersRepo.getOrCreate(
        event.username,
        event.username,
        event.username
      );

      if (viewer) {
        const eventId = eventsRepo.storeEvent('irc.chat.part', event, session.channel_id, viewer.id);
        console.log(`[IRC] PART event stored with ID: ${eventId}`);
        mainWindow?.webContents.send('event:stored', {
          id: eventId,
          event_type: 'irc.chat.part',
          event_data: JSON.stringify(event),
          viewer_id: viewer.id,
          channel_id: session.channel_id,
          created_at: new Date().toISOString(),
          viewer_username: viewer.username,
          viewer_display_name: viewer.display_name
        });
      } else {
        const eventId = eventsRepo.storeEvent('irc.chat.part', event, session.channel_id, undefined);
        console.log(`[IRC] PART event stored without viewer ID, event ID: ${eventId}`);
        mainWindow?.webContents.send('event:stored', {
          id: eventId,
          event_type: 'irc.chat.part',
          event_data: JSON.stringify(event),
          viewer_id: undefined,
          channel_id: session.channel_id,
          created_at: new Date().toISOString(),
          viewer_username: event.username,
          viewer_display_name: event.username
        });
      }
    } catch (error) {
      console.error('[IRC] Failed to store PART event:', error);
    }
  });

  twitchIRCService.on('status', (status) => {
    mainWindow?.webContents.send('irc:status', status);
  });

  // NOTE: IRC chat messages are intentionally NOT forwarded to the TTS pipeline.
  // The application uses the WebSocket/EventSub stream as the canonical source
  // for chat messages to avoid duplicates and to respect subscription settings.
  twitchIRCService.on('chat.message', async (event: any) => {
    // Log for debugging purposes only
    console.log('[IRC] chat.message received (ignored for TTS):', event.username, event.message);
  });
}
