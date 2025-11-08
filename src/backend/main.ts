import { app, BrowserWindow } from 'electron';
import { createMainWindow } from './core/window';
import { setupAllIpcHandlers, runStartupTasks } from './core/ipc-handlers';
import { PlatformTTSFactory } from './core/platform-tts';
import { initializeDatabase, closeDatabase } from './database/connection';
import { ViewerTTSRulesRepository } from './database/repositories/viewer-tts-rules';
import { DiscordSettingsRepository } from './database/repositories/discord-settings';
import { BrowserSourceServer } from './services/browser-source-server';
import { EventActionProcessor } from './services/event-action-processor';
import { TTSBrowserSourceBridge } from './services/tts-browser-source-bridge';
import { initializeDiscordBot, registerGlobalCommands } from './services/discord-bot-client';
import { decryptToken } from './services/crypto-utils';

let mainWindow: BrowserWindow | null = null;
let cleanupInterval: NodeJS.Timeout | null = null;
let browserSourceServer: BrowserSourceServer | null = null;
let eventActionProcessor: EventActionProcessor | null = null;
let ttsBrowserSourceBridge: TTSBrowserSourceBridge | null = null;

async function initialize(): Promise<void> {
  // Initialize database first
  initializeDatabase();
  
  // Start background cleanup job for expired TTS rules (every 5 minutes)
  const viewerTTSRulesRepo = new ViewerTTSRulesRepository();
  cleanupInterval = setInterval(() => {
    try {
      viewerTTSRulesRepo.cleanupExpiredRules();
    } catch (error) {
      console.error('[Main] Error running TTS rules cleanup:', error);
    }
  }, 5 * 60 * 1000); // 5 minutes
  
  // Create main window
  mainWindow = await createMainWindow();
  setupAllIpcHandlers(mainWindow);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
  
  // Initialize Event Action Processor
  eventActionProcessor = new EventActionProcessor(mainWindow);
  // Start Browser Source Server for OBS overlays
  try {
    browserSourceServer = new BrowserSourceServer(3737);
    await browserSourceServer.start();
    console.log('[Main] Browser Source Server started - OBS URL: http://localhost:3737/browser-source');
    
    // Connect processor to browser source server
    eventActionProcessor.setBrowserSourceServer(browserSourceServer);
    console.log('[Main] Event Action Processor connected to Browser Source Server');
    
    // Initialize TTS Browser Source Bridge
    ttsBrowserSourceBridge = new TTSBrowserSourceBridge();
    ttsBrowserSourceBridge.initialize(browserSourceServer, mainWindow);
    browserSourceServer.setTTSBridge(ttsBrowserSourceBridge);
    console.log('[Main] TTS Browser Source Bridge initialized and connected');
  } catch (error) {
    console.error('[Main] Failed to start Browser Source Server:', error);
  }
  
  // Run startup tasks after window is ready
  mainWindow.webContents.on('did-finish-load', () => {
    runStartupTasks(mainWindow);
    
    // Check for Discord bot auto-start after a short delay
    setTimeout(() => checkDiscordAutoStart(), 3000);
  });
}

/**
 * Check if Discord bot should auto-start and start it if enabled
 */
async function checkDiscordAutoStart(): Promise<void> {
  try {
    const discordSettingsRepo = new DiscordSettingsRepository();
    const settings = discordSettingsRepo.getSettings();
    
    if (settings.auto_start_enabled === 1 && settings.bot_token) {
      console.log('[Main] Discord bot auto-start is enabled, starting bot...');
      
      try {
        const decryptedToken = decryptToken(settings.bot_token);
        await initializeDiscordBot(decryptedToken);
        
        // Register global commands on auto-start
        await registerGlobalCommands(decryptedToken);
        
        console.log('[Main] ✓ Discord bot auto-started successfully');
      } catch (err: any) {
        console.error('[Main] ✗ Failed to auto-start Discord bot:', err.message);
      }
    } else {
      console.log('[Main] Discord bot auto-start not enabled');
    }
  } catch (err: any) {
    console.error('[Main] Error checking Discord auto-start:', err.message);
  }
}

app.on('ready', initialize);

app.on('window-all-closed', () => {
  closeDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    initialize();
  }
});

/**
 * Get Event Action Processor instance
 * (Used by IPC handlers and EventSub router)
 */
export function getEventActionProcessor(): EventActionProcessor | null {
  return eventActionProcessor;
}

/**
 * Get Browser Source Server instance
 * (Used for testing and monitoring)
 */
export function getBrowserSourceServer(): BrowserSourceServer | null {
  return browserSourceServer;
}

/**
 * Get TTS Browser Source Bridge instance
 * (Used by TTS IPC handlers)
 */
export function getTTSBrowserSourceBridge(): TTSBrowserSourceBridge | null {
  return ttsBrowserSourceBridge;
}

app.on('before-quit', async () => {
  // Stop cleanup interval
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
  
  // Stop Browser Source Server
  if (browserSourceServer) {
    try {
      await browserSourceServer.stop();
      console.log('[Main] Browser Source Server stopped');
    } catch (error) {
      console.error('[Main] Error stopping Browser Source Server:', error);
    }
    browserSourceServer = null;
  }
  
  // Stop Discord bot if running
  try {
    const { disconnectDiscordBot } = require('./services/discord-bot-client');
    await disconnectDiscordBot();
    console.log('[Main] Discord bot stopped');
  } catch (error) {
    console.error('[Main] Error stopping Discord bot:', error);
  }
  
  // Cleanup platform TTS handler
  try {
    await PlatformTTSFactory.cleanup();
  } catch (error) {
    console.error('Error cleaning up TTS handler:', error);
  }
  
  closeDatabase();
});

