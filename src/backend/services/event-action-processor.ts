import { BrowserWindow } from 'electron';
import { EventActionsRepository, EventAction } from '../database/repositories/event-actions';
import { formatEvent, processTemplate } from '../../shared/utils/event-formatter';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Event data from EventSub
 */
export interface EventSubEventData {
  event_type: string;
  event_data: any;
  viewer_username?: string;
  viewer_display_name?: string;
  channel_id: string;
  created_at: string;
}

/**
 * Processed alert payload
 */
export interface AlertPayload {
  event_type: string;
  channel_id: string;
  
  // Browser Source Channel Assignment (Phase 10.5)
  channel: string;  // Browser source channel name (e.g., 'default', 'main-alerts', 'tts')
  
  // Formatted event
  formatted: {
    html: string;
    plainText: string;
    emoji: string;
    variables: Record<string, any>;
  };
  
  // Text alert
  text?: {
    content: string;  // Processed template
    duration: number;
    position: string;
    style?: any;      // Parsed JSON
  };
  
  // Sound alert
  sound?: {
    file_path: string;
    volume: number;
  };
  
  // Image alert
  image?: {
    file_path: string;
    duration: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  // Video alert
  video?: {
    file_path: string;
    volume: number;
    position: string;
    width?: number;
    height?: number;
  };
  
  // Metadata
  timestamp: string;
}

/**
 * Browser Source Server interface
 */
export interface BrowserSourceServer {
  io: any; // Socket.IO server instance
}

/**
 * Event Action Processor Service
 * 
 * Processes incoming events and triggers customizable alerts:
 * 1. Loads action configuration from database
 * 2. Formats event using shared formatter
 * 3. Processes template variables
 * 4. Validates media files
 * 5. Sends alerts to:
 *    - Frontend (in-app alerts)
 *    - Browser Source (OBS overlays)
 */
export class EventActionProcessor {
  private repository: EventActionsRepository;
  private mainWindow: BrowserWindow | null;
  private browserSourceServer: BrowserSourceServer | null = null;
  private alertQueue: AlertPayload[] = [];
  private isProcessingQueue = false;

  constructor(mainWindow: BrowserWindow | null) {
    this.repository = new EventActionsRepository();
    this.mainWindow = mainWindow;
    
    console.log('[EventActionProcessor] Initialized');
  }

  /**
   * Set browser source server for OBS overlay support
   */
  setBrowserSourceServer(server: BrowserSourceServer): void {
    this.browserSourceServer = server;
    console.log('[EventActionProcessor] Browser source server connected');
  }

  /**
   * Process an incoming event
   */
  async processEvent(eventData: EventSubEventData): Promise<void> {
    try {
      const { event_type, channel_id } = eventData;

      // Get action configuration for this event type
      const action = this.repository.getByEventType(channel_id, event_type);

      // No action configured or action disabled
      if (!action || !action.is_enabled) {
        return;
      }

      // Check if any media type is enabled
      const hasAnyMedia = action.text_enabled || action.sound_enabled || 
                          action.image_enabled || action.video_enabled;
      
      if (!hasAnyMedia) {
        console.log(`[EventActionProcessor] No media enabled for ${event_type}`);
        return;
      }      // Format event using shared formatter
      const formatted = formatEvent(eventData);

      // Build alert payload
      const payload: AlertPayload = {
        event_type,
        channel_id,
        channel: action.browser_source_channel || 'default',  // Browser source channel assignment
        formatted,
        timestamp: new Date().toISOString()
      };

      // Process text alert
      if (action.text_enabled && action.text_template) {
        const content = processTemplate(action.text_template, formatted.variables);
        payload.text = {
          content,
          duration: action.text_duration,
          position: action.text_position,
          style: action.text_style ? this.parseJSON(action.text_style) : undefined
        };
      }

      // Process sound alert
      if (action.sound_enabled && action.sound_file_path) {
        if (await this.validateFile(action.sound_file_path, ['mp3', 'wav', 'ogg', 'aac'])) {
          payload.sound = {
            file_path: action.sound_file_path,
            volume: action.sound_volume
          };
        } else {
          console.warn(`[EventActionProcessor] Sound file not found: ${action.sound_file_path}`);
        }
      }

      // Process image alert
      if (action.image_enabled && action.image_file_path) {
        if (await this.validateFile(action.image_file_path, ['png', 'jpg', 'jpeg', 'gif', 'webp'])) {
          payload.image = {
            file_path: action.image_file_path,
            duration: action.image_duration,
            position: action.image_position,
            width: action.image_width || undefined,
            height: action.image_height || undefined
          };
        } else {
          console.warn(`[EventActionProcessor] Image file not found: ${action.image_file_path}`);
        }
      }

      // Process video alert
      if (action.video_enabled && action.video_file_path) {
        if (await this.validateFile(action.video_file_path, ['mp4', 'webm', 'ogg', 'mov'])) {
          payload.video = {
            file_path: action.video_file_path,
            volume: action.video_volume,
            position: action.video_position,
            width: action.video_width || undefined,
            height: action.video_height || undefined
          };
        } else {
          console.warn(`[EventActionProcessor] Video file not found: ${action.video_file_path}`);
        }
      }

      // Add to queue and process
      this.enqueueAlert(payload);

      console.log(`[EventActionProcessor] Processed ${event_type} for channel ${channel_id}`);
    } catch (error) {
      console.error('[EventActionProcessor] Error processing event:', error);
    }
  }

  /**
   * Add alert to queue
   */
  private enqueueAlert(payload: AlertPayload): void {
    this.alertQueue.push(payload);
    
    // Start processing queue if not already processing
    if (!this.isProcessingQueue) {
      this.processQueue();
    }
  }

  /**
   * Process alert queue (one at a time)
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.alertQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    while (this.alertQueue.length > 0) {
      const alert = this.alertQueue.shift();
      if (!alert) continue;

      // Send to frontend (in-app alert)
      this.sendToFrontend(alert);

      // Send to browser source (OBS overlay)
      this.sendToBrowserSource(alert);

      // Calculate alert duration (longest media duration)
      const duration = this.calculateAlertDuration(alert);

      // Wait for alert to finish before processing next
      await this.sleep(duration);
    }

    this.isProcessingQueue = false;
  }

  /**
   * Send alert to frontend (in-app)
   */
  private sendToFrontend(alert: AlertPayload): void {
    if (!this.mainWindow) {
      console.warn('[EventActionProcessor] Main window not available');
      return;
    }

    try {
      this.mainWindow.webContents.send('event-action:alert', alert);
      console.log(`[EventActionProcessor] Sent alert to frontend: ${alert.event_type}`);
    } catch (error) {
      console.error('[EventActionProcessor] Error sending to frontend:', error);
    }
  }

  /**
   * Send alert to browser source (OBS)
   */
  private sendToBrowserSource(alert: AlertPayload): void {
    if (!this.browserSourceServer) {
      return;
    }

    try {
      this.browserSourceServer.io.emit('alert', alert);
      console.log(`[EventActionProcessor] Sent alert to browser source: ${alert.event_type}`);
    } catch (error) {
      console.error('[EventActionProcessor] Error sending to browser source:', error);
    }
  }

  /**
   * Calculate total alert duration
   */
  private calculateAlertDuration(alert: AlertPayload): number {
    let duration = 0;

    // Text duration
    if (alert.text) {
      duration = Math.max(duration, alert.text.duration);
    }

    // Image duration
    if (alert.image) {
      duration = Math.max(duration, alert.image.duration);
    }

    // Video duration is handled by the video itself (auto-duration)
    // For now, we'll use a default max duration for video
    if (alert.video) {
      duration = Math.max(duration, 10000); // 10 seconds default
    }

    // Default minimum duration
    return Math.max(duration, 1000);
  }

  /**
   * Validate file exists and has correct extension
   */
  private async validateFile(filePath: string, allowedExtensions: string[]): Promise<boolean> {
    try {
      // Check file exists
      if (!fs.existsSync(filePath)) {
        return false;
      }

      // Check extension
      const ext = path.extname(filePath).toLowerCase().replace('.', '');
      return allowedExtensions.includes(ext);
    } catch (error) {
      console.error('[EventActionProcessor] Error validating file:', error);
      return false;
    }
  }

  /**
   * Parse JSON string safely
   */
  private parseJSON(jsonString: string): any {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      console.warn('[EventActionProcessor] Failed to parse JSON:', jsonString);
      return null;
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get queue length (for debugging/monitoring)
   */
  getQueueLength(): number {
    return this.alertQueue.length;
  }

  /**
   * Clear alert queue (emergency stop)
   */
  clearQueue(): void {
    this.alertQueue = [];
    this.isProcessingQueue = false;
    console.log('[EventActionProcessor] Alert queue cleared');
  }

  /**
   * Get statistics
   */
  getStats(): { queueLength: number; isProcessing: boolean } {
    return {
      queueLength: this.alertQueue.length,
      isProcessing: this.isProcessingQueue
    };
  }
}
