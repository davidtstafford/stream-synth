/**
 * EventSub Integration Service
 * 
 * Bridges EventSubManager and EventSubEventRouter to process real-time events.
 * This service listens to EventSub WebSocket events and routes them to handlers
 * that update the database (viewer roles, subscriptions, events, etc.)
 */

import { BrowserWindow, ipcMain } from 'electron';
import { getEventSubManager } from './eventsub-manager';
import { getEventSubRouter } from './eventsub-event-router';
import { initializeTTS } from '../core/ipc-handlers/tts';

let integrationActive = false;

/**
 * Initialize EventSub integration
 * Connects EventSubManager to EventSubEventRouter for event processing
 */
export function initializeEventSubIntegration(mainWindow: BrowserWindow): void {
  if (integrationActive) {
    console.log('[EventSubIntegration] Already initialized');
    return;
  }
  console.log('[EventSubIntegration] 🚀 Initializing event routing...');
  const manager = getEventSubManager();
  const router = getEventSubRouter(mainWindow, initializeTTS);
  console.log('[EventSubIntegration] Manager instance:', manager ? 'OK' : 'NULL');
  console.log('[EventSubIntegration] Router instance:', router ? 'OK' : 'NULL');
  console.log('[EventSubIntegration] MainWindow:', mainWindow ? 'OK' : 'NULL');

  // Listen to EventSub events from WebSocket
  manager.on('event', async (eventData: any) => {
    const { type, data, timestamp } = eventData;
    
    console.log(`[EventSubIntegration] ⚡ RECEIVED EVENT: ${type}`);
    console.log(`[EventSubIntegration] Event data:`, JSON.stringify(data, null, 2));

    try {
      // Route event to handler which updates database
      console.log(`[EventSubIntegration] Routing event to handler...`);
      await router.routeEvent(type, data, timestamp);
      console.log(`[EventSubIntegration] ✓ Event routed successfully`);
      
      // Emit IPC event to frontend for UI updates
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('eventsub-event', type, data);
        console.log(`[EventSubIntegration] ✓ Sent IPC event to frontend`);
      }
    } catch (error) {
      console.error(`[EventSubIntegration] ❌ Error processing ${type}:`, error);
    }
  });

  // Forward connection events to frontend
  manager.on('ready', (data: any) => {
    console.log('[EventSubIntegration] EventSub ready');
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('eventsub-connected', data);
    }
  });

  manager.on('error', (error: any) => {
    console.error('[EventSubIntegration] EventSub error:', error);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('eventsub-error', error);
    }
  });
  integrationActive = true;
  console.log('[EventSubIntegration] ✓ Event routing active (IPC listener registered)');
}

/**
 * Shutdown EventSub integration
 */
export function shutdownEventSubIntegration(): void {
  if (!integrationActive) {
    return;
  }

  console.log('[EventSubIntegration] Shutting down...');
  
  const manager = getEventSubManager();
  manager.removeAllListeners('event');
  manager.removeAllListeners('ready');
  manager.removeAllListeners('error');

  integrationActive = false;
  console.log('[EventSubIntegration] ✓ Shutdown complete');
}
