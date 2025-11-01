# Event Actions Feature

## Overview

This feature adds customizable actions that trigger when events occur in Stream Synth. Users can configure visual alerts (text/images/video), audio alerts, or combinations for any event type (EventSub, IRC, or Polled events). Actions can be displayed in-app or exposed via browser source for OBS integration.

## Why This Feature?

- **Customizable Alerts**: Users want personalized notifications for important events
- **OBS Integration**: Streamers need browser sources for on-stream alerts
- **Flexibility**: Different events need different alert styles
- **Reusability**: Share event display logic between Events screen and alerts
- **Extensibility**: Easy to add new action types in the future

## Core Concepts

### Action Types

1. **In-App Popup**: Modal/toast notification within Stream Synth
2. **Browser Source**: HTTP server serving HTML for OBS/external apps

### Media Types

- **Text**: Display formatted event information
- **Sound**: Play audio file when event triggers
- **Image**: Show static image or GIF
- **Video**: Play video clip
- **Combination**: Mix multiple media types (e.g., text + sound)

### Event Sources

- **EventSub (WebSocket)**: All 41 Twitch EventSub subscriptions
- **IRC**: JOIN/PART chat events
- **Polled**: Moderators, VIPs, Clips (future)

## Technical Architecture

### 1. Database Schema

**New Table: `event_actions`**

```sql
CREATE TABLE event_actions (
  id TEXT PRIMARY KEY,                    -- UUID
  channel_id TEXT NOT NULL,               -- FK to channels table
  event_type TEXT NOT NULL,               -- e.g., 'channel.subscribe', 'irc.chat.join'
  enabled INTEGER DEFAULT 1,              -- 0 = disabled, 1 = enabled
  
  -- Display settings
  show_in_app INTEGER DEFAULT 1,          -- Show in-app popup
  show_in_browser_source INTEGER DEFAULT 0, -- Expose via browser source
  
  -- Media configuration (JSON)
  text_config TEXT,                       -- JSON: { enabled, template, style }
  sound_config TEXT,                      -- JSON: { enabled, file_path, volume }
  image_config TEXT,                      -- JSON: { enabled, file_path, duration }
  video_config TEXT,                      -- JSON: { enabled, file_path, volume }
  
  -- Display behavior
  duration_ms INTEGER DEFAULT 5000,       -- How long to show alert
  priority INTEGER DEFAULT 0,             -- Higher priority shows first
  
  -- Metadata
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  
  FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
  UNIQUE(channel_id, event_type)          -- One action config per event type per channel
);

-- Indexes
CREATE INDEX idx_event_actions_channel_id ON event_actions(channel_id);
CREATE INDEX idx_event_actions_event_type ON event_actions(event_type);
CREATE INDEX idx_event_actions_enabled ON event_actions(enabled);
```

**Configuration JSON Schemas**:

```typescript
interface TextConfig {
  enabled: boolean;
  template: string;              // e.g., "{{username}} just subscribed!"
  font_size: number;             // px
  font_family: string;
  color: string;                 // hex color
  background_color?: string;
  position: 'top' | 'center' | 'bottom';
  animation?: 'slide' | 'fade' | 'bounce';
}

interface SoundConfig {
  enabled: boolean;
  file_path: string;             // Absolute path or URL
  volume: number;                // 0.0 - 1.0
}

interface ImageConfig {
  enabled: boolean;
  file_path: string;             // Absolute path or URL
  duration_ms: number;           // How long to show
  width?: number;                // px (optional, auto if not set)
  height?: number;               // px (optional, auto if not set)
  position: 'top' | 'center' | 'bottom';
}

interface VideoConfig {
  enabled: boolean;
  file_path: string;             // Absolute path or URL
  volume: number;                // 0.0 - 1.0
  loop: boolean;
}
```

### 2. Shared Event Formatter

To avoid duplicating the event display logic from the Events screen, create a shared utility.

**File**: `src/shared/utils/event-formatter.ts` (NEW)

```typescript
/**
 * Shared event formatting logic used by:
 * 1. Events screen (Details column)
 * 2. In-app popup alerts
 * 3. Browser source alerts
 */

export interface EventData {
  event_type: string;
  event_data: string | object;  // JSON string or parsed object
  viewer_username?: string;
  viewer_display_name?: string;
  channel_id: string;
  created_at: string;
}

export interface FormattedEvent {
  html: string;              // HTML markup for display
  plainText: string;         // Plain text version
  emoji: string;             // Leading emoji
  variables: Record<string, any>; // Extracted variables for templates
}

// Helper functions (move from events.tsx)
const formatTier = (tier: string): string => {
  const tierMap: Record<string, string> = {
    '1000': 'Tier 1',
    '2000': 'Tier 2',
    '3000': 'Tier 3'
  };
  return tierMap[tier] || 'Tier 1';
};

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const getLeadingChoice = (choices: any[]): any => {
  if (!choices || choices.length === 0) return null;
  return choices.reduce((leading, current) => {
    const leadingVotes = leading.votes || leading.channel_points_votes || 0;
    const currentVotes = current.votes || current.channel_points_votes || 0;
    return currentVotes > leadingVotes ? current : leading;
  });
};

/**
 * Format an event for display
 * Returns HTML, plain text, emoji, and extracted variables
 */
export function formatEvent(event: EventData): FormattedEvent {
  const data = typeof event.event_data === 'string' 
    ? JSON.parse(event.event_data) 
    : event.event_data;
  
  let displayName = event.viewer_display_name || event.viewer_username;
  if (!displayName && (event.event_type === 'irc.chat.join' || event.event_type === 'irc.chat.part')) {
    displayName = data.username;
  }
  if (!displayName) {
    displayName = 'Unknown';
  }

  const variables: Record<string, any> = {
    username: displayName,
    event_type: event.event_type,
    timestamp: event.created_at,
    ...data  // Include all event data as variables
  };

  // This switch contains ALL the logic from events.tsx renderEventPreview()
  switch (event.event_type) {
    case 'channel.chat.message':
      return {
        html: `<strong>${displayName}:</strong> ${truncateText(data.message?.text || '', 100)}`,
        plainText: `${displayName}: ${truncateText(data.message?.text || '', 100)}`,
        emoji: '💬',
        variables: { ...variables, message: data.message?.text }
      };
    
    case 'channel.chat.message_delete':
      const deletedUser = data.target_user_name || data.target_user_login || 'User';
      return {
        html: `🗑️ Message from <strong>${deletedUser}</strong> deleted by moderators`,
        plainText: `Message from ${deletedUser} deleted by moderators`,
        emoji: '🗑️',
        variables: { ...variables, deleted_user: deletedUser }
      };
    
    case 'channel.subscribe':
      const subTier = formatTier(data.tier);
      if (data.is_gift) {
        return {
          html: `🎁 <strong>${displayName}</strong> received a gift sub (${subTier})`,
          plainText: `${displayName} received a gift sub (${subTier})`,
          emoji: '🎁',
          variables: { ...variables, tier: subTier, is_gift: true }
        };
      }
      return {
        html: `🎉 <strong>${displayName}</strong> subscribed (${subTier})`,
        plainText: `${displayName} subscribed (${subTier})`,
        emoji: '🎉',
        variables: { ...variables, tier: subTier, is_gift: false }
      };
    
    case 'channel.subscription.gift':
      const giftTier = formatTier(data.tier);
      const giftCount = data.total || 1;
      const cumulativeGifts = data.cumulative_total;
      const gifterName = data.is_anonymous ? 'Anonymous' : displayName;
      return {
        html: `🎁 <strong>${gifterName}</strong> gifted ${giftCount} ${giftTier} sub${giftCount > 1 ? 's' : ''}${cumulativeGifts ? ` (${formatNumber(cumulativeGifts)} total)` : ''}`,
        plainText: `${gifterName} gifted ${giftCount} ${giftTier} sub${giftCount > 1 ? 's' : ''}`,
        emoji: '🎁',
        variables: { ...variables, gift_count: giftCount, tier: giftTier, cumulative: cumulativeGifts }
      };
    
    case 'channel.cheer':
      const bits = data.bits || 0;
      const cheerMsg = truncateText(data.message || '', 30);
      return {
        html: `<strong>${displayName}</strong> cheered <strong>${formatNumber(bits)} bits</strong>${cheerMsg ? `: "${cheerMsg}"` : ''}`,
        plainText: `${displayName} cheered ${formatNumber(bits)} bits`,
        emoji: '💎',
        variables: { ...variables, bits, message: cheerMsg }
      };
    
    case 'channel.raid':
      const viewers = data.viewers || 0;
      return {
        html: `🎯 <strong>${displayName}</strong> raided with <strong>${formatNumber(viewers)} viewer${viewers !== 1 ? 's' : ''}</strong>`,
        plainText: `${displayName} raided with ${formatNumber(viewers)} viewers`,
        emoji: '🎯',
        variables: { ...variables, viewers }
      };
    
    case 'irc.chat.join':
      return {
        html: `<strong style="color: #4CAF50">→ ${displayName}</strong> joined the chat`,
        plainText: `${displayName} joined the chat`,
        emoji: '→',
        variables
      };
    
    case 'irc.chat.part':
      return {
        html: `<strong style="color: #f44336">← ${displayName}</strong> left the chat`,
        plainText: `${displayName} left the chat`,
        emoji: '←',
        variables
      };
    
    // ... ALL OTHER EVENT TYPES FROM events.tsx ...
    // (Include all 41 event types - abbreviated here for space)
    
    default:
      return {
        html: `${displayName && displayName !== 'Unknown' ? `<strong>${displayName}</strong> - ` : ''}${event.event_type}`,
        plainText: `${displayName && displayName !== 'Unknown' ? `${displayName} - ` : ''}${event.event_type}`,
        emoji: '📢',
        variables
      };
  }
}

/**
 * Process a template string with variables
 * Example: "{{username}} just subscribed!" -> "JohnDoe just subscribed!"
 */
export function processTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value));
  }
  
  return result;
}

/**
 * Get available template variables for an event type
 */
export function getAvailableVariables(eventType: string): string[] {
  const commonVars = ['username', 'event_type', 'timestamp'];
  
  const eventSpecificVars: Record<string, string[]> = {
    'channel.subscribe': ['tier', 'is_gift'],
    'channel.subscription.gift': ['gift_count', 'tier', 'cumulative'],
    'channel.cheer': ['bits', 'message'],
    'channel.raid': ['viewers'],
    'channel.chat.message': ['message'],
    // ... add more as needed
  };
  
  return [...commonVars, ...(eventSpecificVars[eventType] || [])];
}
```

### 3. Backend Implementation

#### 3.1 Event Actions Repository

**File**: `src/backend/database/repositories/event-actions.ts` (NEW)

```typescript
import { Database } from 'better-sqlite3';
import { getDatabase } from '../connection';
import { v4 as uuidv4 } from 'uuid';

export interface EventAction {
  id: string;
  channel_id: string;
  event_type: string;
  enabled: boolean;
  show_in_app: boolean;
  show_in_browser_source: boolean;
  text_config?: string;        // JSON
  sound_config?: string;       // JSON
  image_config?: string;       // JSON
  video_config?: string;       // JSON
  duration_ms: number;
  priority: number;
  created_at: string;
  updated_at: string;
}

export class EventActionsRepository {
  private db: Database;

  constructor() {
    this.db = getDatabase();
  }

  async create(action: Omit<EventAction, 'id' | 'created_at' | 'updated_at'>): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const id = uuidv4();
      const now = new Date().toISOString();
      
      const stmt = this.db.prepare(`
        INSERT INTO event_actions (
          id, channel_id, event_type, enabled,
          show_in_app, show_in_browser_source,
          text_config, sound_config, image_config, video_config,
          duration_ms, priority, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        id,
        action.channel_id,
        action.event_type,
        action.enabled ? 1 : 0,
        action.show_in_app ? 1 : 0,
        action.show_in_browser_source ? 1 : 0,
        action.text_config || null,
        action.sound_config || null,
        action.image_config || null,
        action.video_config || null,
        action.duration_ms,
        action.priority,
        now,
        now
      );

      return { success: true, id };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async update(id: string, updates: Partial<EventAction>): Promise<{ success: boolean; error?: string }> {
    try {
      const fields: string[] = [];
      const values: any[] = [];
      
      // Build dynamic UPDATE query
      if (updates.enabled !== undefined) {
        fields.push('enabled = ?');
        values.push(updates.enabled ? 1 : 0);
      }
      if (updates.show_in_app !== undefined) {
        fields.push('show_in_app = ?');
        values.push(updates.show_in_app ? 1 : 0);
      }
      if (updates.show_in_browser_source !== undefined) {
        fields.push('show_in_browser_source = ?');
        values.push(updates.show_in_browser_source ? 1 : 0);
      }
      if (updates.text_config !== undefined) {
        fields.push('text_config = ?');
        values.push(updates.text_config);
      }
      if (updates.sound_config !== undefined) {
        fields.push('sound_config = ?');
        values.push(updates.sound_config);
      }
      if (updates.image_config !== undefined) {
        fields.push('image_config = ?');
        values.push(updates.image_config);
      }
      if (updates.video_config !== undefined) {
        fields.push('video_config = ?');
        values.push(updates.video_config);
      }
      if (updates.duration_ms !== undefined) {
        fields.push('duration_ms = ?');
        values.push(updates.duration_ms);
      }
      if (updates.priority !== undefined) {
        fields.push('priority = ?');
        values.push(updates.priority);
      }
      
      fields.push('updated_at = ?');
      values.push(new Date().toISOString());
      values.push(id);
      
      const stmt = this.db.prepare(`
        UPDATE event_actions SET ${fields.join(', ')} WHERE id = ?
      `);
      
      stmt.run(...values);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getByChannelId(channelId: string): Promise<{ success: boolean; actions?: EventAction[]; error?: string }> {
    try {
      const stmt = this.db.prepare('SELECT * FROM event_actions WHERE channel_id = ? ORDER BY priority DESC, event_type');
      const rows = stmt.all(channelId) as any[];
      
      const actions = rows.map(row => ({
        ...row,
        enabled: row.enabled === 1,
        show_in_app: row.show_in_app === 1,
        show_in_browser_source: row.show_in_browser_source === 1
      }));
      
      return { success: true, actions };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }

  async getByEventType(channelId: string, eventType: string): Promise<EventAction | null> {
    const stmt = this.db.prepare('SELECT * FROM event_actions WHERE channel_id = ? AND event_type = ?');
    const row = stmt.get(channelId, eventType) as any;
    
    if (!row) return null;
    
    return {
      ...row,
      enabled: row.enabled === 1,
      show_in_app: row.show_in_app === 1,
      show_in_browser_source: row.show_in_browser_source === 1
    };
  }

  async delete(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const stmt = this.db.prepare('DELETE FROM event_actions WHERE id = ?');
      stmt.run(id);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  }
}
```

#### 3.2 Event Action Processor

**File**: `src/backend/services/event-action-processor.ts` (NEW)

```typescript
import { EventActionsRepository, EventAction } from '../database/repositories/event-actions';
import { BrowserWindow } from 'electron';
import { formatEvent, processTemplate } from '../../shared/utils/event-formatter';

export class EventActionProcessor {
  private repo: EventActionsRepository;
  private mainWindow: BrowserWindow | null;
  private browserSourceServer: any; // HTTP server for browser sources

  constructor(mainWindow: BrowserWindow | null) {
    this.repo = new EventActionsRepository();
    this.mainWindow = mainWindow;
  }

  /**
   * Process an event and trigger configured actions
   */
  async processEvent(eventData: any): Promise<void> {
    try {
      const channelId = eventData.channel_id;
      const eventType = eventData.event_type;
      
      // Get action configuration for this event type
      const action = await this.repo.getByEventType(channelId, eventType);
      
      if (!action || !action.enabled) {
        return; // No action configured or disabled
      }
      
      // Format event data
      const formatted = formatEvent({
        event_type: eventType,
        event_data: eventData.event_data,
        viewer_username: eventData.viewer_username,
        viewer_display_name: eventData.viewer_display_name,
        channel_id: channelId,
        created_at: eventData.created_at || new Date().toISOString()
      });
      
      // Build alert payload
      const alertPayload = {
        id: Date.now().toString(),
        event_type: eventType,
        formatted,
        text_config: action.text_config ? JSON.parse(action.text_config) : null,
        sound_config: action.sound_config ? JSON.parse(action.sound_config) : null,
        image_config: action.image_config ? JSON.parse(action.image_config) : null,
        video_config: action.video_config ? JSON.parse(action.video_config) : null,
        duration_ms: action.duration_ms,
        priority: action.priority
      };
      
      // Process text template if enabled
      if (alertPayload.text_config?.enabled && alertPayload.text_config.template) {
        alertPayload.text_config.processed_text = processTemplate(
          alertPayload.text_config.template,
          formatted.variables
        );
      }
      
      // Trigger in-app alert
      if (action.show_in_app && this.mainWindow) {
        this.mainWindow.webContents.send('alert:show', alertPayload);
      }
      
      // Trigger browser source alert
      if (action.show_in_browser_source) {
        this.broadcastToBrowserSource(alertPayload);
      }
      
      console.log(`[Event Actions] Processed action for ${eventType}`);
    } catch (error) {
      console.error('[Event Actions] Error processing event:', error);
    }
  }

  /**
   * Broadcast alert to browser source clients
   */
  private broadcastToBrowserSource(alertPayload: any): void {
    // This will be implemented when we create the browser source server
    // For now, just log it
    console.log('[Event Actions] Browser source alert:', alertPayload);
  }

  /**
   * Start HTTP server for browser sources
   */
  startBrowserSourceServer(port: number = 7474): void {
    // Implementation in next section
  }
}
```

#### 3.3 Browser Source HTTP Server

**File**: `src/backend/services/browser-source-server.ts` (NEW)

```typescript
import express from 'express';
import { Server as HttpServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import path from 'path';
import fs from 'fs';

export class BrowserSourceServer {
  private app: express.Application;
  private httpServer: HttpServer | null = null;
  private io: SocketIOServer | null = null;
  private port: number;

  constructor(port: number = 7474) {
    this.port = port;
    this.app = express();
    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Serve static HTML page for browser source
    this.app.get('/alert', (req, res) => {
      const html = this.generateAlertHTML();
      res.send(html);
    });

    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ status: 'ok', server: 'Stream Synth Browser Source' });
    });
  }

  private generateAlertHTML(): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Stream Synth Alerts</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      width: 1920px;
      height: 1080px;
      overflow: hidden;
      font-family: 'Arial', sans-serif;
    }
    
    #alert-container {
      position: absolute;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    
    .alert {
      background: rgba(0, 0, 0, 0.8);
      color: white;
      padding: 20px 40px;
      border-radius: 10px;
      font-size: 32px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.5);
      animation: slideIn 0.5s ease-out;
      max-width: 80%;
      text-align: center;
    }
    
    .alert.fade-out {
      animation: fadeOut 0.5s ease-out forwards;
    }
    
    @keyframes slideIn {
      from {
        transform: translateY(-100px);
        opacity: 0;
      }
      to {
        transform: translateY(0);
        opacity: 1;
      }
    }
    
    @keyframes fadeOut {
      from {
        opacity: 1;
      }
      to {
        opacity: 0;
      }
    }
    
    .alert-image {
      max-width: 400px;
      max-height: 400px;
      margin-bottom: 20px;
    }
    
    .alert-video {
      max-width: 800px;
      max-height: 600px;
    }
  </style>
</head>
<body>
  <div id="alert-container"></div>
  <audio id="alert-sound" preload="auto"></audio>
  <script src="/socket.io/socket.io.js"></script>
  <script>
    const socket = io();
    const container = document.getElementById('alert-container');
    const soundElement = document.getElementById('alert-sound');
    
    socket.on('alert', (data) => {
      showAlert(data);
    });
    
    function showAlert(data) {
      // Clear existing alerts
      container.innerHTML = '';
      
      const alertDiv = document.createElement('div');
      alertDiv.className = 'alert';
      
      // Add image if configured
      if (data.image_config?.enabled) {
        const img = document.createElement('img');
        img.src = data.image_config.file_path;
        img.className = 'alert-image';
        alertDiv.appendChild(img);
      }
      
      // Add text if configured
      if (data.text_config?.enabled) {
        const textDiv = document.createElement('div');
        textDiv.innerHTML = data.text_config.processed_text || data.formatted.html;
        textDiv.style.fontSize = (data.text_config.font_size || 32) + 'px';
        textDiv.style.color = data.text_config.color || '#ffffff';
        textDiv.style.fontFamily = data.text_config.font_family || 'Arial';
        alertDiv.appendChild(textDiv);
      }
      
      // Add video if configured
      if (data.video_config?.enabled) {
        const video = document.createElement('video');
        video.src = data.video_config.file_path;
        video.className = 'alert-video';
        video.autoplay = true;
        video.loop = data.video_config.loop || false;
        video.volume = data.video_config.volume || 1.0;
        alertDiv.appendChild(video);
      }
      
      // Play sound if configured
      if (data.sound_config?.enabled) {
        soundElement.src = data.sound_config.file_path;
        soundElement.volume = data.sound_config.volume || 1.0;
        soundElement.play().catch(err => console.error('Sound play error:', err));
      }
      
      container.appendChild(alertDiv);
      
      // Auto-hide after duration
      setTimeout(() => {
        alertDiv.classList.add('fade-out');
        setTimeout(() => {
          container.innerHTML = '';
        }, 500); // Wait for fade-out animation
      }, data.duration_ms || 5000);
    }
    
    console.log('Stream Synth Browser Source connected');
  </script>
</body>
</html>
    `;
  }

  start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.httpServer = this.app.listen(this.port, () => {
          console.log(`[Browser Source] Server running on http://localhost:${this.port}/alert`);
          
          // Setup Socket.IO for real-time alerts
          this.io = new SocketIOServer(this.httpServer!, {
            cors: {
              origin: '*',
              methods: ['GET', 'POST']
            }
          });
          
          this.io.on('connection', (socket) => {
            console.log('[Browser Source] Client connected');
            socket.on('disconnect', () => {
              console.log('[Browser Source] Client disconnected');
            });
          });
          
          resolve();
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  broadcast(alertPayload: any): void {
    if (this.io) {
      this.io.emit('alert', alertPayload);
      console.log('[Browser Source] Alert broadcasted to all clients');
    }
  }

  stop(): void {
    if (this.httpServer) {
      this.httpServer.close();
      console.log('[Browser Source] Server stopped');
    }
  }
}
```

#### 3.4 Integration with Event System

**File**: `src/backend/services/twitch-subscriptions.ts` (MODIFY)

```typescript
// Add event action processing to existing event handlers
import { EventActionProcessor } from './event-action-processor';

class TwitchSubscriptionsService {
  private eventProcessor: EventActionProcessor;
  
  constructor(mainWindow: BrowserWindow) {
    // ...existing code...
    this.eventProcessor = new EventActionProcessor(mainWindow);
  }
  
  private async handleEvent(event: any): Promise<void> {
    // ...existing event storage logic...
    
    // NEW: Process event actions
    await this.eventProcessor.processEvent(event);
  }
}
```

### 4. Frontend Implementation

#### 4.1 Event Actions Screen

**File**: `src/frontend/screens/event-actions/event-actions.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';
import { EVENT_DISPLAY_INFO } from '../../config/event-types';

const { ipcRenderer } = window.require('electron');

interface EventAction {
  id: string;
  channel_id: string;
  event_type: string;
  enabled: boolean;
  show_in_app: boolean;
  show_in_browser_source: boolean;
  text_config?: any;
  sound_config?: any;
  image_config?: any;
  video_config?: any;
  duration_ms: number;
  priority: number;
}

export const EventActionsScreen: React.FC<{ channelId?: string }> = ({ channelId }) => {
  const [actions, setActions] = useState<EventAction[]>([]);
  const [selectedAction, setSelectedAction] = useState<EventAction | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (channelId) {
      loadActions();
    }
  }, [channelId]);

  const loadActions = async () => {
    setLoading(true);
    const result = await ipcRenderer.invoke('event-actions:getByChannel', channelId);
    if (result.success) {
      setActions(result.actions || []);
    }
    setLoading(false);
  };

  const createDefaultActions = async () => {
    // Create default action for each event type
    for (const eventType of Object.keys(EVENT_DISPLAY_INFO)) {
      await ipcRenderer.invoke('event-actions:create', {
        channel_id: channelId,
        event_type: eventType,
        enabled: false,
        show_in_app: true,
        show_in_browser_source: false,
        text_config: JSON.stringify({
          enabled: true,
          template: '{{username}} - {{event_type}}',
          font_size: 32,
          font_family: 'Arial',
          color: '#ffffff',
          position: 'center',
          animation: 'slide'
        }),
        duration_ms: 5000,
        priority: 0
      });
    }
    loadActions();
  };

  const testAlert = async (action: EventAction) => {
    // Send test alert
    ipcRenderer.send('alert:test', {
      event_type: action.event_type,
      ...action
    });
  };

  return (
    <div className="content">
      <h2>Event Actions</h2>
      
      {!loading && actions.length === 0 && (
        <div>
          <p>No event actions configured.</p>
          <button onClick={createDefaultActions}>Create Default Actions</button>
        </div>
      )}
      
      {!loading && actions.length > 0 && (
        <div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th>Event Type</th>
                <th>Enabled</th>
                <th>In-App</th>
                <th>Browser Source</th>
                <th>Media Types</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((action) => (
                <tr key={action.id}>
                  <td>{EVENT_DISPLAY_INFO[action.event_type as keyof typeof EVENT_DISPLAY_INFO]?.name || action.event_type}</td>
                  <td>
                    <input
                      type="checkbox"
                      checked={action.enabled}
                      onChange={(e) => {
                        /* toggle enabled */
                      }}
                    />
                  </td>
                  <td>{action.show_in_app ? '✓' : ''}</td>
                  <td>{action.show_in_browser_source ? '✓' : ''}</td>
                  <td>
                    {action.text_config && 'Text '}
                    {action.sound_config && 'Sound '}
                    {action.image_config && 'Image '}
                    {action.video_config && 'Video'}
                  </td>
                  <td>
                    <button onClick={() => setSelectedAction(action)}>Edit</button>
                    <button onClick={() => testAlert(action)}>Test</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Edit Modal - Full UI for configuring text/sound/image/video */}
      {selectedAction && (
        <div className="modal">
          {/* Action configuration UI */}
        </div>
      )}
    </div>
  );
};
```

#### 4.2 In-App Alert Component

**File**: `src/frontend/components/AlertPopup.tsx` (NEW)

```typescript
import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface Alert {
  id: string;
  event_type: string;
  formatted: any;
  text_config: any;
  sound_config: any;
  image_config: any;
  video_config: any;
  duration_ms: number;
}

export const AlertPopup: React.FC = () => {
  const [currentAlert, setCurrentAlert] = useState<Alert | null>(null);

  useEffect(() => {
    const handleAlert = (_event: any, alertData: Alert) => {
      setCurrentAlert(alertData);
      
      // Auto-hide after duration
      setTimeout(() => {
        setCurrentAlert(null);
      }, alertData.duration_ms);
    };

    ipcRenderer.on('alert:show', handleAlert);
    return () => {
      ipcRenderer.removeListener('alert:show', handleAlert);
    };
  }, []);

  if (!currentAlert) return null;

  return (
    <div className="alert-overlay">
      <div className="alert-popup">
        {currentAlert.image_config?.enabled && (
          <img src={currentAlert.image_config.file_path} alt="Alert" />
        )}
        
        {currentAlert.text_config?.enabled && (
          <div
            style={{
              fontSize: currentAlert.text_config.font_size + 'px',
              color: currentAlert.text_config.color,
              fontFamily: currentAlert.text_config.font_family
            }}
            dangerouslySetInnerHTML={{ __html: currentAlert.text_config.processed_text }}
          />
        )}
        
        {currentAlert.video_config?.enabled && (
          <video
            src={currentAlert.video_config.file_path}
            autoPlay
            loop={currentAlert.video_config.loop}
            volume={currentAlert.video_config.volume}
          />
        )}
        
        {currentAlert.sound_config?.enabled && (
          <audio
            src={currentAlert.sound_config.file_path}
            autoPlay
            volume={currentAlert.sound_config.volume}
          />
        )}
      </div>
    </div>
  );
};
```

## Implementation Checklist

### Backend
- [ ] Add `event_actions` table migration
- [ ] Create `EventActionsRepository`
- [ ] Create shared `event-formatter.ts` utility
- [ ] Create `EventActionProcessor` service
- [ ] Create `BrowserSourceServer` with Socket.IO
- [ ] Integrate processor into event handlers
- [ ] Add IPC handlers for CRUD operations
- [ ] Add file picker for media assets

### Frontend
- [ ] Move event formatting logic to shared utility
- [ ] Update Events screen to use shared formatter
- [ ] Create Event Actions screen
- [ ] Create action editor modal
- [ ] Create AlertPopup component
- [ ] Add media upload/selection UI
- [ ] Add template variable helper
- [ ] Add test alert functionality

### Documentation
- [ ] Document template variable syntax
- [ ] Create OBS browser source setup guide
- [ ] Document media file requirements
- [ ] Add troubleshooting guide

## User Experience Flow

### 1. Configure Event Action
- Navigate to Event Actions screen
- Select event type (e.g., "Subscription")
- Enable action
- Configure media:
  - Text: Custom template with variables
  - Sound: Browse for audio file
  - Image: Browse for image/GIF
  - Video: Browse for video file
- Choose display: In-App, Browser Source, or both
- Set duration and priority
- Test alert preview

### 2. In-App Alerts
- Event occurs
- Alert slides in from configured position
- Shows text/image/video with sound
- Auto-dismisses after duration

### 3. OBS Browser Source
- Copy URL: `http://localhost:7474/alert`
- Add Browser Source in OBS
- Set dimensions (1920x1080)
- Alerts appear automatically on stream

## Browser Source URL

**Primary Alert Display**:
```
http://localhost:7474/alert
```

**Configuration Options** (query params):
```
http://localhost:7474/alert?channel=eggieberttestacc&filter=subscriptions
```

## Template Variable Examples

```
Subscription:
{{username}} just subscribed at {{tier}}!

Gift Sub:
{{username}} gifted {{gift_count}} subs!

Raid:
{{username}} raided with {{viewers}} viewers!

Cheer:
{{username}} cheered {{bits}} bits!

Custom:
Thanks {{username}} for the {{tier}} sub! You're viewer #{{cumulative}}
```

## Architecture Benefits

### ✅ No Logic Duplication
- `event-formatter.ts` is single source of truth
- Used by Events screen, in-app alerts, browser source
- Update once, reflected everywhere

### ✅ Extensible
- New media types: Just add config interface
- New event types: Add to formatter switch
- New display targets: Implement processor

### ✅ Well Documented
- TypeScript interfaces for all configs
- JSDoc comments on public methods
- User-facing template documentation

### ✅ OBS Integration
- Standard browser source
- Socket.IO for real-time updates
- Customizable with CSS

## Future Enhancements

### Phase 2
- **Animation Library**: More transition effects
- **Sound Mixer**: Adjust volume per alert
- **Alert Queue**: Queue multiple alerts
- **Alert History**: View recent alerts
- **Conditional Logic**: If viewer is VIP, show special alert

### Phase 3
- **Widget Gallery**: Pre-made alert templates
- **Cloud Sync**: Share alert configs
- **Multi-Language**: Support template translations
- **AI Voice**: TTS for alert text

---

**Status**: Planned (Not Yet Implemented)  
**Priority**: High  
**Dependencies**: 
- Events screen formatter logic (exists)
- EventSub/IRC/Polling events (exists)

**Estimated Time**: 20-30 hours (2.5-4 days)
