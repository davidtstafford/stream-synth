import { EventEmitter } from 'events';
import { SessionsRepository } from '../database/repositories/sessions';
import { TokensRepository } from '../database/repositories/tokens';

interface WebSocketMessage {
  metadata: {
    message_id: string;
    message_type: 'session_welcome' | 'session_keepalive' | 'session_reconnect' | 'notification' | 'revocation';
    message_timestamp: string;
    subscription_type?: string;
    subscription_version?: string;
  };
  payload?: {
    subscription?: {
      id: string;
      type: string;
      version: string;
      status: string;
      cost: number;
      condition: any;
      transport: any;
      created_at: string;
    };
    session?: {
      id: string;
      status: 'connected' | 'reconnecting' | 'failed';
      connected_at: string;
      keepalive_timeout_seconds?: number;
      reconnect_url?: string;
    };
    event?: any;
  };
  // Deprecated fields (keeping for backward compatibility)
  subscription?: {
    id: string;
    type: string;
    version: string;
    status: string;
    cost: number;
    condition: any;
    transport: any;
    created_at: string;
  };
  session?: {
    id: string;
    status: 'connected' | 'reconnecting' | 'failed';
    connected_at: string;
    reconnect_url?: string;
  };
  event?: any;
}

interface EventSubStatus {
  isConnected: boolean;
  sessionId: string | null;
  subscriptions: string[];
  subscriptionCount: number;
  lastConnectedAt: string | null;
  nextKeepaliveAt: string | null;
  reconnectAttempts: number;
}

/**
 * EventSub WebSocket Manager
 * 
 * Manages connection to Twitch EventSub WebSocket for real-time events.
 * Handles subscription lifecycle, reconnection, and event routing.
 */
export class EventSubManager extends EventEmitter {
  private ws: WebSocket | null = null;
  private sessionId: string | null = null;  private keepaliveTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private subscriptions: Set<string> = new Set();
  private userId: string | null = null;
  private channelId: string | null = null;
  private accessToken: string | null = null;
  private clientId: string | null = null;
  private connectionResolver: (() => void) | null = null; // ✅ ADDED

  private sessionsRepo = new SessionsRepository();
  private tokensRepo = new TokensRepository();

  constructor() {
    super();
    this.setupEventListeners();
  }

  /**
   * Initialize EventSub connection
   */
  async initialize(userId: string, channelId: string): Promise<void> {
    try {
      console.log('[EventSub] Initializing...');
      this.userId = userId;
      this.channelId = channelId;      // Get tokens
      const tokenData = this.tokensRepo.get(userId);
      if (!tokenData) {
        throw new Error('No OAuth token found');
      }

      this.accessToken = tokenData.accessToken;
      this.clientId = tokenData.clientId;

      // Connect to WebSocket
      await this.connect();
    } catch (error) {
      console.error('[EventSub] Initialization failed:', error);
      throw error;
    }
  }  /**
   * Connect to EventSub WebSocket
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const wsUrl = 'wss://eventsub.wss.twitch.tv/ws';
        console.log('[EventSub] Connecting to', wsUrl);

        // Store resolver to call when welcome message is received
        this.connectionResolver = resolve;

        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('[EventSub] WebSocket connected');
        };

        this.ws.onmessage = (event: MessageEvent) => {
          this.handleMessage(JSON.parse(event.data) as WebSocketMessage);
        };

        this.ws.onerror = (error: Event) => {
          console.error('[EventSub] WebSocket error:', error);
          this.emit('error', error);
          this.connectionResolver = null; // Clear resolver on error
          reject(error);
        };

        this.ws.onclose = () => {
          console.log('[EventSub] WebSocket closed');
          this.clearKeepalive();
          this.emit('disconnected');
          this.connectionResolver = null; // Clear resolver on close
          this.attemptReconnect();
        };

        // Give WebSocket time to connect
        setTimeout(() => {
          if (this.sessionId) {
            resolve();
          } else if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            reject(new Error('WebSocket connection failed'));
          }
        }, 5000);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(message: WebSocketMessage): void {
    const { metadata } = message;

    switch (metadata.message_type) {
      case 'session_welcome':
        this.handleWelcome(message);
        break;

      case 'session_keepalive':
        this.handleKeepalive();
        break;

      case 'session_reconnect':
        this.handleReconnect(message);
        break;

      case 'notification':
        this.handleEvent(message);
        break;

      case 'revocation':
        this.handleRevocation(message);
        break;

      default:
        console.warn('[EventSub] Unknown message type:', metadata.message_type);
    }
  }  /**
   * Handle welcome message - subscribe to events
   */
  private handleWelcome(message: WebSocketMessage): void {
    console.log('[EventSub] Welcome message received:', JSON.stringify(message, null, 2));
    
    // Twitch sends session data in payload.session
    const session = message.payload?.session || message.session;
    
    if (!session) {
      console.error('[EventSub] No session in welcome message');
      console.error('[EventSub] Message structure:', Object.keys(message));
      if (message.payload) {
        console.error('[EventSub] Payload structure:', Object.keys(message.payload));
      }
      return;
    }

    this.sessionId = session.id;
    this.reconnectAttempts = 0;

    console.log('[EventSub] Connected with session:', this.sessionId);

    // Set up keepalive
    this.setupKeepalive();

    // Subscribe to events
    this.subscribeToEvents();

    this.emit('ready', {
      sessionId: this.sessionId,
      connectedAt: new Date().toISOString(),
    });

    // Resolve the connection promise
    if (this.connectionResolver) {
      this.connectionResolver();
      this.connectionResolver = null;
    }
  }

  /**
   * Handle keepalive to reset timeout
   */
  private handleKeepalive(): void {
    console.log('[EventSub] Keepalive received');
    this.setupKeepalive();
  }

  /**
   * Handle reconnect request
   */  private handleReconnect(message: WebSocketMessage): void {
    console.log('[EventSub] Reconnect requested');
    const session = message.payload?.session || message.session;
    if (session?.reconnect_url) {
      this.closeConnection();
      this.connectToUrl(session.reconnect_url);
    }
  }
  /**
   * Handle event notification
   */  private handleEvent(message: WebSocketMessage): void {
    // Check both payload and root level for backward compatibility
    const subscription = message.payload?.subscription || message.subscription;
    const event = message.payload?.event || message.event;
    
    if (!subscription || !event) {
      console.warn('[EventSub] Invalid event notification');
      return;
    }

    const eventType = subscription.type;
    console.log('[EventSub] 📨 Event received:', eventType);

    const eventData = {
      type: eventType,
      version: subscription.version,
      data: event,
      timestamp: message.metadata.message_timestamp,
    };

    console.log('[EventSub] 🔊 Emitting event to listeners...');
    console.log('[EventSub] Listener count:', this.listenerCount('event'));
    
    this.emit('event', eventData);
    
    console.log('[EventSub] ✓ Event emitted');
  }

  /**
   * Handle revocation of subscription
   */
  private handleRevocation(message: WebSocketMessage): void {
    if (!message.subscription) {
      console.warn('[EventSub] Revocation without subscription');
      return;
    }

    console.warn('[EventSub] Subscription revoked:', message.subscription.type);
    this.subscriptions.delete(message.subscription.type);
    this.emit('subscription-revoked', message.subscription.type);
  }  /**
   * Subscribe to all EventSub events
   */
  private async subscribeToEvents(): Promise<void> {
    if (!this.sessionId || !this.accessToken || !this.clientId || !this.channelId || !this.userId) {
      console.error('[EventSub] Missing required data for subscription');
      return;
    }

    // Load enabled events from database instead of hardcoded list
    const { EventsRepository } = require('../database/repositories/events');
    const eventsRepo = new EventsRepository();
    let eventTypes: string[] = eventsRepo.getEnabledEvents(this.userId, this.channelId);

    // Filter out IRC events (not available via EventSub WebSocket)
    eventTypes = eventTypes.filter((type: string) => !type.startsWith('irc.'));

    if (eventTypes.length === 0) {
      console.warn('[EventSub] No enabled events found in database, using defaults');
      // Fallback to safe defaults if nothing is enabled
      eventTypes = [
        'channel.follow',
        'channel.subscribe',
        'channel.ban',
        'channel.unban',
        'channel.moderator.add',
        'channel.moderator.remove',
        'channel.vip.add',
        'channel.vip.remove',
      ];
    }

    console.log('[EventSub] Subscribing to', eventTypes.length, 'event types');

    // Subscribe to all events in parallel to minimize startup window
    // Use Promise.allSettled to continue even if some fail
    const subscriptionPromises = eventTypes.map((eventType) =>
      this.subscribeToEvent(eventType)
        .then(() => this.subscriptions.add(eventType))
        .catch((error) => {
          console.error(`[EventSub] Failed to subscribe to ${eventType}:`, error);
        })
    );

    await Promise.allSettled(subscriptionPromises);

    console.log('[EventSub] Subscription complete');
  }  /**
   * Subscribe to a specific event type
   */
  private async subscribeToEvent(eventType: string): Promise<void> {
    const url = 'https://api.twitch.tv/helix/eventsub/subscriptions';    // Build condition based on event type
    const condition: any = { broadcaster_user_id: this.channelId };

    // Special conditions for specific event types
    if (eventType === 'channel.follow') {
      // channel.follow v2 requires moderator_user_id
      condition.moderator_user_id = this.channelId;
    } else if (eventType === 'channel.chat.message' || 
               eventType === 'channel.chat.clear' ||
               eventType === 'channel.chat.clear_user_messages' ||
               eventType === 'channel.chat.message_delete' ||
               eventType === 'channel.chat_settings.update') {
      // Chat events require user_id to be the authenticated user's ID
      condition.user_id = this.userId;
    }

    // Determine the correct version for each event type
    // Most events use v1, but some require v2
    let version = '1';
    if (eventType === 'channel.follow') {
      version = '2'; // channel.follow v1 was deprecated
    } else if (eventType === 'channel.chat.message' ||
               eventType === 'channel.chat.notification') {
      version = '1'; // Chat events use v1
    }
    // All other events default to v1

    const payload = {
      type: eventType,
      version,
      condition,
      transport: {
        method: 'websocket',
        session_id: this.sessionId,
      },
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Client-ID': this.clientId!,
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to subscribe: ${response.status} - ${error}`);
    }

    const data = await response.json();
    console.log(`[EventSub] Subscribed to ${eventType}:`, data.data?.[0]?.id);
  }

  /**
   * Set up keepalive timeout (10 seconds)
   */  private setupKeepalive(): void {
    this.clearKeepalive();
    // Twitch sends keepalives every 10 seconds
    // Set timeout to 15 seconds to account for network delays
    this.keepaliveTimeout = setTimeout(() => {
      console.error('[EventSub] Keepalive timeout - connection may be dead');
      this.closeConnection();
    }, 15000);
  }

  /**
   * Clear keepalive timeout
   */
  private clearKeepalive(): void {
    if (this.keepaliveTimeout) {
      clearTimeout(this.keepaliveTimeout);
      this.keepaliveTimeout = null;
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('[EventSub] Max reconnection attempts reached');
      this.emit('error', new Error('Failed to reconnect after max attempts'));
      return;
    }

    this.reconnectAttempts++;
    const backoff = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);

    console.log(`[EventSub] Attempting reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${backoff}ms`);

    setTimeout(() => {
      if (this.userId && this.channelId) {
        this.initialize(this.userId, this.channelId).catch((error) => {
          console.error('[EventSub] Reconnection failed:', error);
        });
      }
    }, backoff);
  }

  /**
   * Connect to specific URL (for reconnects)
   */
  private connectToUrl(url: string): void {
    console.log('[EventSub] Reconnecting to:', url);
    this.ws = new WebSocket(url);
    this.ws.onmessage = (event: MessageEvent) => {
      this.handleMessage(JSON.parse(event.data) as WebSocketMessage);
    };
    this.ws.onclose = () => {
      this.closeConnection();
      this.attemptReconnect();
    };
  }

  /**
   * Close connection
   */
  private closeConnection(): void {
    this.clearKeepalive();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.sessionId = null;
  }

  /**
   * Setup event listeners
   */
  private setupEventListeners(): void {
    // Can be used for logging or other setup
  }

  /**
   * Get current status
   */
  getStatus(): EventSubStatus {
    return {
      isConnected: this.ws?.readyState === WebSocket.OPEN && !!this.sessionId,
      sessionId: this.sessionId,
      subscriptions: Array.from(this.subscriptions),
      subscriptionCount: this.subscriptions.size,
      lastConnectedAt: this.sessionId ? new Date().toISOString() : null,
      nextKeepaliveAt: this.keepaliveTimeout ? new Date(Date.now() + 10000).toISOString() : null,
      reconnectAttempts: this.reconnectAttempts,
    };
  }

  /**
   * Destroy manager and clean up
   */
  destroy(): void {
    console.log('[EventSub] Destroying manager');
    this.clearKeepalive();
    this.closeConnection();
    this.removeAllListeners();
  }
}

// Global instance
let eventSubManager: EventSubManager | null = null;

/**
 * Get or create EventSub manager instance
 */
export function getEventSubManager(): EventSubManager {
  if (!eventSubManager) {
    eventSubManager = new EventSubManager();
  }
  return eventSubManager;
}

/**
 * Reset EventSub manager instance (for testing)
 */
export function resetEventSubManager(): void {
  if (eventSubManager) {
    eventSubManager.destroy();
    eventSubManager = null;
  }
}
