/**
 * IRC IPC Handlers
 * 
 * Handles IRC (Twitch Chat) operations via IPC:
 * - Connect/Disconnect
 * - Send messages
 * - Join/Leave channels
 * - IRC event forwarding
 */

import { ipcMain, BrowserWindow } from 'electron';
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
  // IRC: Connect
  ipcMain.handle('irc:connect', async (event, username: string, token: string, channel?: string) => {
    try {
      await twitchIRCService.connect(username, token, channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Disconnect
  ipcMain.handle('irc:disconnect', async () => {
    try {
      await twitchIRCService.disconnect();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Send message
  ipcMain.handle('irc:send-message', async (event, message: string, channel?: string) => {
    try {
      await twitchIRCService.sendMessage(message, channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Get status
  ipcMain.handle('irc:get-status', async () => {
    return twitchIRCService.getStatus();
  });

  // IRC: Join channel
  ipcMain.handle('irc:join-channel', async (event, channel: string) => {
    try {
      await twitchIRCService.joinChannel(channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

  // IRC: Leave channel
  ipcMain.handle('irc:leave-channel', async (event, channel: string) => {
    try {
      await twitchIRCService.leaveChannel(channel);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });

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
