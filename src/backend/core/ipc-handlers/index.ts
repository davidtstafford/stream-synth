/**
 * IPC Handlers Module - Central registration point
 * 
 * Registers all domain-specific IPC handlers from their respective modules
 */

import { BrowserWindow } from 'electron';
import { setupDatabaseHandlers, setupEventStorageHandler } from './database';
import { setupTwitchHandlers, setMainWindowForTwitch } from './twitch';
import { setupTTSHandlers, setMainWindowForTTS, initializeTTS } from './tts';
import { setupDiscordHandlers } from './discord';
import { setupIRCHandlers, setMainWindowForIRC } from './irc';

export function setupIpcHandlers(): void {
  setupDatabaseHandlers();
  setupTwitchHandlers();
  setupTTSHandlers();
  setupDiscordHandlers();
  setupIRCHandlers();
}

export function setMainWindow(mainWindow: BrowserWindow): void {
  setMainWindowForTwitch(mainWindow);
  setMainWindowForTTS(mainWindow);
  setMainWindowForIRC(mainWindow);
  
  // Setup the event storage handler which needs mainWindow reference
  setupEventStorageHandler(initializeTTS, mainWindow);
}

export function setupAllIpcHandlers(mainWindow: BrowserWindow): void {
  setupIpcHandlers();
  setMainWindow(mainWindow);
}

export { runStartupTasks } from './startup';

