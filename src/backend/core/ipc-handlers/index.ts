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
import { setupTTSAccessHandlers } from './tts-access';
import { setupChatCommandHandlers } from './chat-commands';
import { ViewerTTSRulesRepository } from '../../database/repositories/viewer-tts-rules';
import './twitch-polling'; // Auto-registers handlers

export function setupIpcHandlers(): void {
  setupDatabaseHandlers();
  setupTwitchHandlers();
  setupTTSHandlers();
  setupDiscordHandlers();
  setupIRCHandlers();
  setupTTSAccessHandlers();
  setupChatCommandHandlers(); // Phase 5: Chat Commands
  // setupEventSubHandlers(); // Phase 7: EventSub WebSocket - temporarily disabled
  // twitch-polling handlers auto-registered on import
}

export function setMainWindow(mainWindow: BrowserWindow): void {
  setMainWindowForTwitch(mainWindow);
  setMainWindowForTTS(mainWindow);
  setMainWindowForIRC(mainWindow);
  ViewerTTSRulesRepository.setMainWindow(mainWindow);
  
  // Setup the event storage handler which needs mainWindow reference
  setupEventStorageHandler(initializeTTS, mainWindow);
}

export function setupAllIpcHandlers(mainWindow: BrowserWindow): void {
  setupIpcHandlers();
  setMainWindow(mainWindow);
}

export { runStartupTasks } from './startup';
export { initializeTTS };

