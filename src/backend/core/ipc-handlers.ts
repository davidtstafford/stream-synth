/**
 * IPC Handlers - Main Entry Point
 * 
 * This file serves as the main entry point for all IPC handlers.
 * Actual handler implementations are organized in the ipc-handlers/ directory
 * and imported here for registration.
 * 
 * Domain-specific handlers are in separate modules:
 * - database.ts: Database operations (settings, sessions, events, tokens, viewers)
 * - twitch.ts: Twitch OAuth and websocket
 * - tts.ts: Text-to-Speech operations
 * - viewer-rules.ts: Viewer-specific TTS rules
 * - discord.ts: Discord webhook operations
 * - irc.ts: Twitch IRC chat operations
 * - startup.ts: Application startup tasks
 */

import { BrowserWindow } from 'electron';

// Import handler setup functions
import { setupIpcHandlers, setMainWindow, runStartupTasks } from './ipc-handlers/index';

export function setupAllIpcHandlers(mainWindow: BrowserWindow): void {
  // Register all IPC handlers
  setupIpcHandlers();
  
  // Set main window reference for handlers that need it
  setMainWindow(mainWindow);
}

export { runStartupTasks };
