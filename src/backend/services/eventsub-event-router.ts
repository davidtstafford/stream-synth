import { EventEmitter } from 'events';
import { BrowserWindow } from 'electron';
import { FollowerHistoryRepository } from '../database/repositories/follower-history';
import { ViewerRolesRepository } from '../database/repositories/viewer-roles';
import { SubscriptionsRepository } from '../database/repositories/subscriptions';
import { ViewersRepository } from '../database/repositories/viewers';
import { EventsRepository } from '../database/repositories/events';
import { SessionsRepository } from '../database/repositories/sessions';
import { ModerationHistoryRepository } from '../database/repositories/moderation-history';
import { EventActionProcessor } from './event-action-processor';
import { ChatCommandHandler, ChatCommandContext } from './chat-command-handler';
import { twitchIRCService } from './twitch-irc';

/**
 * EventSub Event Router
 * 
 * Routes incoming EventSub events to appropriate handlers.
 * Applies the same business logic that polling was doing.
 * Integrated with EventActionProcessor for alert processing (Phase 11).
 */
export class EventSubEventRouter extends EventEmitter {
  private followerHistoryRepo = new FollowerHistoryRepository();
  private viewerRolesRepo = new ViewerRolesRepository();
  private subscriptionsRepo = new SubscriptionsRepository();
  private viewersRepo = new ViewersRepository();
  private eventsRepo = new EventsRepository();
  private sessionsRepo = new SessionsRepository();
  private moderationHistoryRepo = new ModerationHistoryRepository();
  private mainWindow: BrowserWindow | null = null;
  private ttsInitializer: (() => Promise<any>) | null = null;
  private eventActionProcessor: EventActionProcessor | null = null;
  private chatCommandHandler: ChatCommandHandler = new ChatCommandHandler();

  constructor(mainWindow?: BrowserWindow | null, ttsInitializer?: () => Promise<any>) {
    super();
    this.mainWindow = mainWindow || null;
    this.ttsInitializer = ttsInitializer || null;
  }
  /**
   * Set main window for IPC communication
   */
  setMainWindow(mainWindow: BrowserWindow | null): void {
    this.mainWindow = mainWindow;
  }
  /**
   * Set TTS initializer for chat message handling
   */
  setTTSInitializer(ttsInitializer: () => Promise<any>): void {
    this.ttsInitializer = ttsInitializer;
  }

  /**
   * Set Event Action Processor for alert processing (Phase 11)
   */
  setEventActionProcessor(eventActionProcessor: EventActionProcessor): void {
    this.eventActionProcessor = eventActionProcessor;
    console.log('[EventSubEventRouter] Event Action Processor connected');
  }

  /**
   * Emit IPC event to frontend
   */
  private emitToFrontend(channel: string, data: any): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send(channel, data);
    }
  }
  /**
   * Store event and emit to frontend for real-time UI updates
   */
  private storeAndEmitEvent(
    eventType: string,
    eventData: any,
    channelId: string,
    viewerId: string,
    viewerUsername?: string,
    viewerDisplayName?: string
  ): number {
    // Store event in database
    const eventId = this.eventsRepo.storeEvent(eventType, eventData, channelId, viewerId);

    // Emit to frontend for real-time updates
    if (eventId) {
      this.emitToFrontend('event:stored', {
        id: eventId,
        event_type: eventType,
        event_data: typeof eventData === 'string' ? eventData : JSON.stringify(eventData),
        channel_id: channelId,
        viewer_id: viewerId,
        viewer_username: viewerUsername,
        viewer_display_name: viewerDisplayName,
        created_at: new Date().toISOString()
      });
    }

    // Process event actions (Phase 11)
    if (this.eventActionProcessor) {
      this.eventActionProcessor.processEvent({
        event_type: eventType,
        event_data: eventData,
        viewer_username: viewerUsername,
        viewer_display_name: viewerDisplayName,
        channel_id: channelId,
        created_at: new Date().toISOString()
      }).catch((error) => {
        console.error('[EventSubEventRouter] Error processing event action:', error);
      });
    }

    return eventId;
  }

  /**
   * Route an event to the appropriate handler
   */
  async routeEvent(eventType: string, eventData: any, timestamp: string): Promise<void> {
    try {
      console.log(`[EventRouter] Routing event: ${eventType}`);

      switch (eventType) {
        case 'channel.follow':
          await this.handleFollowEvent(eventData, timestamp);
          break;

        case 'channel.subscribe':
          await this.handleSubscribeEvent(eventData, timestamp);
          break;

        case 'channel.subscription.end':
          await this.handleSubscriptionEndEvent(eventData, timestamp);
          break;

        case 'channel.subscription.gift':
          await this.handleSubscriptionGiftEvent(eventData, timestamp);
          break;

        case 'channel.moderator.add':
          await this.handleModeratorAddEvent(eventData, timestamp);
          break;

        case 'channel.moderator.remove':
          await this.handleModeratorRemoveEvent(eventData, timestamp);
          break;

        case 'channel.vip.add':
          await this.handleVIPAddEvent(eventData, timestamp);
          break;

        case 'channel.vip.remove':
          await this.handleVIPRemoveEvent(eventData, timestamp);
          break;        case 'channel.ban':
          await this.handleBanEvent(eventData, timestamp);
          break;        case 'channel.unban':
          await this.handleUnbanEvent(eventData, timestamp);
          break;        case 'channel.chat.message':
          await this.handleChatMessageEvent(eventData, timestamp);
          break;

        case 'channel.chat.clear':
        case 'channel.chat.clear_user_messages':
        case 'channel.chat.message_delete':
        case 'channel.chat_settings.update':
        case 'channel.cheer':
        case 'channel.channel_points_custom_reward.add':
        case 'channel.channel_points_custom_reward.remove':
        case 'channel.channel_points_custom_reward.update':
        case 'channel.channel_points_custom_reward_redemption.add':
        case 'channel.channel_points_custom_reward_redemption.update':
        case 'channel.goal.begin':
        case 'channel.goal.end':
        case 'channel.goal.progress':
        case 'channel.hype_train.begin':
        case 'channel.hype_train.end':
        case 'channel.hype_train.progress':
        case 'channel.poll.begin':
        case 'channel.poll.end':
        case 'channel.poll.progress':
        case 'channel.prediction.begin':
        case 'channel.prediction.end':
        case 'channel.prediction.lock':
        case 'channel.prediction.progress':
        case 'channel.update':
        case 'stream.online':
        case 'stream.offline':
          // These events are logged but don't need special routing
          console.log(`[EventRouter] Received ${eventType} event`);
          break;

        default:
          console.warn(`[EventRouter] Unknown event type: ${eventType}`);
      }
    } catch (error) {
      console.error(`[EventRouter] Error routing ${eventType}:`, error);
      this.emit('error', { eventType, error });
    }
  }

  /**
   * Handle channel.follow event
   */
  private async handleFollowEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing follow event:', event.user_login);

    const followerId = event.user_id;
    const followerLogin = event.user_login;
    const followerDisplayName = event.user_name;
    const followedAt = event.followed_at;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for follow event');
      return;
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(followerId, followerLogin, followerDisplayName);
    if (!viewer) {
      console.warn('[EventRouter] Could not create viewer for follow:', followerLogin);
      return;
    }

    // Record to follower_history
    this.followerHistoryRepo.batchInsertFollowerHistory([
      {
        channelId: currentSession.channel_id,
        viewerId: viewer.id,
        followerUserId: followerId,
        followerUserLogin: followerLogin,
        followerUserName: followerDisplayName,
        action: 'follow' as const,
        followedAt,
      },
    ]);    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.follow',
      { user_login: followerLogin },
      currentSession.channel_id,
      viewer.id,
      followerLogin,
      followerDisplayName
    );

    console.log('[EventRouter] ✓ Follow event recorded for:', followerLogin);
    this.emit('follow', { viewer, followerId });
  }

  /**
   * Handle channel.subscribe event
   */
  private async handleSubscribeEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing subscribe event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;
    const userDisplayName = event.user_name;
    const tier = event.tier; // '1000', '2000', '3000'

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for subscribe event');
      return;
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(userId, userLogin, userDisplayName);
    if (!viewer) {
      console.warn('[EventRouter] Could not create viewer for subscribe:', userLogin);
      return;
    }    // Record subscription
    this.subscriptionsRepo.upsert({
      id: `${userId}-${Date.now()}`,
      viewer_id: viewer.id,
      tier,
      is_gift: 0,
      start_date: new Date().toISOString(),
    });    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.subscribe',
      { user_login: userLogin, tier },
      currentSession.channel_id,
      viewer.id,
      userLogin,
      userDisplayName
    );

    console.log('[EventRouter] ✓ Subscribe event recorded for:', userLogin);
    this.emit('subscribe', { viewer, userId, tier });
    
    // Notify frontend to refresh viewers
    this.emitToFrontend('eventsub:role-changed', {
      eventType: 'subscribe',
      userId,
      userLogin,
      userName: userDisplayName,
      tier,
    });
  }

  /**
   * Handle channel.subscription.end event
   */
  private async handleSubscriptionEndEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing subscription end event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;
    const userDisplayName = event.user_name;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for subscription end event');
      return;
    }    // Get viewer
    const viewer = this.viewersRepo.getViewerById(userId);
    if (!viewer) {
      console.warn('[EventRouter] Viewer not found for subscription end:', userLogin);
      return;
    }

    // Update subscription with end date
    const subscription = this.subscriptionsRepo.getByViewerId(viewer.id);
    if (subscription) {
      this.subscriptionsRepo.upsert({
        id: subscription.id,
        viewer_id: viewer.id,
        tier: subscription.tier,
        is_gift: subscription.is_gift,
        start_date: subscription.start_date,
        end_date: new Date().toISOString(),
      });
    }    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.subscription.end',
      { user_login: userLogin },
      currentSession.channel_id,
      viewer.id,
      userLogin,
      userDisplayName
    );

    console.log('[EventRouter] ✓ Subscription end event recorded for:', userLogin);
    this.emit('subscription_end', { viewer, userId });
  }

  /**
   * Handle channel.subscription.gift event
   */
  private async handleSubscriptionGiftEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing subscription gift event:', event.user_login);

    const gifter = event.user_id;
    const gifterLogin = event.user_login;
    const gifterName = event.user_name;
    const tier = event.tier;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for gift subscription event');
      return;
    }

    // Get or create gifter viewer
    const gifterViewer = this.viewersRepo.getOrCreate(gifter, gifterLogin, gifterName);
    if (!gifterViewer) {
      console.warn('[EventRouter] Could not create gifter viewer:', gifterLogin);
      return;
    }

    // Record gift subscription
    this.subscriptionsRepo.upsert({
      id: `gift-${gifter}-${Date.now()}`,
      viewer_id: gifterViewer.id,
      tier: tier || '1000',
      is_gift: 1,
      start_date: new Date().toISOString(),
    });    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.subscription.gift',
      { user_login: gifterLogin, tier },
      currentSession.channel_id,
      gifterViewer.id,
      gifterLogin,
      gifter.display_name
    );

    console.log('[EventRouter] ✓ Gift subscription event recorded for:', gifterLogin);
    this.emit('subscription_gift', { viewer: gifterViewer, gifter, tier });
  }

  /**
   * Handle channel.moderator.add event
   */
  private async handleModeratorAddEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing moderator add event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;
    const userDisplayName = event.user_name;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for moderator add event');
      return;
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(userId, userLogin, userDisplayName);
    if (!viewer) {
      console.warn('[EventRouter] Could not create viewer for moderator add:', userLogin);
      return;
    }    // Update or create role
    this.viewerRolesRepo.grantRole(viewer.id, 'moderator');

    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.moderator.add',
      { user_login: userLogin },
      currentSession.channel_id,
      viewer.id,
      userLogin,
      userDisplayName
    );

    console.log('[EventRouter] ✓ Moderator add event recorded for:', userLogin);
    this.emit('moderator_add', { viewer, userId });
    
    // Notify frontend to refresh viewers
    this.emitToFrontend('eventsub:role-changed', {
      eventType: 'moderator.add',
      userId,
      userLogin,
      userName: userDisplayName,
      role: 'moderator',
    });
  }

  /**
   * Handle channel.moderator.remove event
   */
  private async handleModeratorRemoveEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing moderator remove event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for moderator remove event');
      return;
    }    // Get viewer
    const viewer = this.viewersRepo.getViewerById(userId);
    if (viewer) {
      // Revoke moderator role
      this.viewerRolesRepo.revokeRole(viewer.id, 'moderator');      // Record event and emit to frontend
      this.storeAndEmitEvent(
        'channel.moderator.remove',
        { user_login: userLogin },
        currentSession.channel_id,
        viewer.id,
        userLogin,
        viewer.display_name || undefined
      );

      console.log('[EventRouter] ✓ Moderator remove event recorded for:', userLogin);
      this.emit('moderator_remove', { viewer, userId });
      
      // Notify frontend to refresh viewers
      this.emitToFrontend('eventsub:role-changed', {
        eventType: 'moderator.remove',
        userId,
        userLogin,
        userName: viewer.display_name,
        role: 'moderator',
      });
    }
  }

  /**
   * Handle channel.vip.add event
   */
  private async handleVIPAddEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing VIP add event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;
    const userDisplayName = event.user_name;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for VIP add event');
      return;
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(userId, userLogin, userDisplayName);
    if (!viewer) {
      console.warn('[EventRouter] Could not create viewer for VIP add:', userLogin);
      return;
    }    // Update or create role
    this.viewerRolesRepo.grantRole(viewer.id, 'vip');

    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.vip.add',
      { user_login: userLogin },
      currentSession.channel_id,
      viewer.id,
      userLogin,
      userDisplayName
    );

    console.log('[EventRouter] ✓ VIP add event recorded for:', userLogin);
    this.emit('vip_add', { viewer, userId });
    
    // Notify frontend to refresh viewers
    this.emitToFrontend('eventsub:role-changed', {
      eventType: 'vip.add',
      userId,
      userLogin,
      userName: userDisplayName,
      role: 'vip',
    });
  }

  /**
   * Handle channel.vip.remove event
   */
  private async handleVIPRemoveEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing VIP remove event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for VIP remove event');
      return;
    }    // Get viewer
    const viewer = this.viewersRepo.getViewerById(userId);
    if (viewer) {
      // Revoke VIP role
      this.viewerRolesRepo.revokeRole(viewer.id, 'vip');      // Record event and emit to frontend
      this.storeAndEmitEvent(
        'channel.vip.remove',
        { user_login: userLogin },
        currentSession.channel_id,
        viewer.id,
        userLogin,
        viewer.display_name || undefined
      );

      console.log('[EventRouter] ✓ VIP remove event recorded for:', userLogin);
      this.emit('vip_remove', { viewer, userId });
      
      // Notify frontend to refresh viewers
      this.emitToFrontend('eventsub:role-changed', {
        eventType: 'vip.remove',
        userId,
        userLogin,
        userName: viewer.display_name,
        role: 'vip',
      });
    }
  }  /**
   * Handle channel.ban event
   * NOTE: This event fires for BOTH permanent bans AND temporary timeouts
   * Use is_permanent and ends_at to distinguish between them
   */
  private async handleBanEvent(event: any, timestamp: string): Promise<void> {
    const isPermanent = event.is_permanent ?? true; // Default to true if not specified
    const actionType = isPermanent ? 'ban' : 'timeout';
    
    console.log(`[EventRouter] Processing ${actionType} event:`, event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;
    const userDisplayName = event.user_name;
    const moderatorId = event.moderator_user_id;
    const moderatorLogin = event.moderator_user_login;
    const reason = event.reason;
    const bannedAt = event.banned_at || timestamp;
    const endsAt = event.ends_at; // Only present for timeouts

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn(`[EventRouter] No active session for ${actionType} event`);
      return;
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(userId, userLogin, userDisplayName);
    if (!viewer) {
      console.warn(`[EventRouter] Could not create viewer for ${actionType}:`, userLogin);
      return;
    }

    // Calculate duration for timeouts
    let durationSeconds: number | undefined;
    if (!isPermanent && endsAt && bannedAt) {
      const start = new Date(bannedAt).getTime();
      const end = new Date(endsAt).getTime();
      durationSeconds = Math.floor((end - start) / 1000);
    }

    // Record moderation action in moderation_history table
    this.moderationHistoryRepo.record({
      channel_id: currentSession.channel_id,
      viewer_id: viewer.id,
      user_id: userId,
      user_login: userLogin,
      user_name: userDisplayName,
      action: actionType, // 'ban' or 'timeout'
      reason: reason || undefined,
      duration_seconds: durationSeconds,
      moderator_id: moderatorId,
      moderator_login: moderatorLogin,
      action_at: bannedAt,
    });    // Record event and emit to frontend
    this.storeAndEmitEvent(
      'channel.ban',
      { 
        user_login: userLogin, 
        reason: reason || undefined, 
        moderator_login: moderatorLogin,
        is_permanent: isPermanent,
        duration_seconds: durationSeconds
      },
      currentSession.channel_id,
      viewer.id,
      userLogin,
      userDisplayName
    );

    console.log(`[EventRouter] ✓ ${actionType} event recorded for:`, userLogin, durationSeconds ? `(${durationSeconds}s)` : '(permanent)');
    this.emit(actionType, { viewer, userId, isPermanent, durationSeconds });
    
    // Notify frontend to refresh moderation screen (if exists)
    this.emitToFrontend('eventsub:moderation-changed', {
      eventType: actionType,
      userId,
      userLogin,
      userName: userDisplayName,
      moderatorLogin,
      reason,
      isPermanent,
      durationSeconds,
      expiresAt: endsAt,
    });
  }
  /**
   * Handle channel.unban event
   */
  private async handleUnbanEvent(event: any, timestamp: string): Promise<void> {
    console.log('[EventRouter] Processing unban event:', event.user_login);

    const userId = event.user_id;
    const userLogin = event.user_login;
    const userDisplayName = event.user_name;
    const moderatorId = event.moderator_user_id;
    const moderatorLogin = event.moderator_user_login;
    const unbannedAt = timestamp;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for unban event');
      return;
    }

    // Get viewer
    const viewer = this.viewersRepo.getViewerById(userId);
    if (viewer) {
      // Record moderation action in moderation_history table
      this.moderationHistoryRepo.record({
        channel_id: currentSession.channel_id,
        viewer_id: viewer.id,
        user_id: userId,
        user_login: userLogin,
        user_name: userDisplayName,
        action: 'unban',
        moderator_id: moderatorId,
        moderator_login: moderatorLogin,
        action_at: unbannedAt,
      });      // Record event and emit to frontend
      this.storeAndEmitEvent(
        'channel.unban',
        { user_login: userLogin, moderator_login: moderatorLogin },
        currentSession.channel_id,
        viewer.id,
        userLogin,
        userDisplayName
      );

      console.log('[EventRouter] ✓ Unban event recorded for:', userLogin);
      this.emit('unban', { viewer, userId });
      
      // Notify frontend to refresh viewers (if there's a moderation screen)
      this.emitToFrontend('eventsub:moderation-changed', {
        eventType: 'unban',
        userId,
        userLogin,
        userName: viewer.display_name,
        moderatorLogin,
      });    }
  }

  /**
   * Handle chat message event
   */
  private async handleChatMessageEvent(event: any, timestamp: string): Promise<void> {
    console.log(`[EventRouter] Processing chat message from: ${event.chatter_user_login}`);

    const userId = event.chatter_user_id;
    const userLogin = event.chatter_user_login;
    const userDisplayName = event.chatter_user_name;
    const messageText = event.message?.text || '';
    const badges = event.badges || [];
    const broadcasterId = event.broadcaster_user_id;

    const currentSession = this.sessionsRepo.getCurrentSession();
    if (!currentSession) {
      console.warn('[EventRouter] No active session for chat message event');
      return;
    }

    // Get or create viewer
    const viewer = this.viewersRepo.getOrCreate(userId, userLogin, userDisplayName);
    if (!viewer) {
      console.error(`[EventRouter] Failed to get/create viewer ${userLogin}`);
      return;
    }

    // Determine user permissions from badges
    const isBroadcaster = userId === broadcasterId;
    const isModerator = badges.some((badge: any) => badge.set_id === 'moderator') || isBroadcaster;
    const isSubscriber = badges.some((badge: any) => badge.set_id === 'subscriber' || badge.set_id === 'founder');
    const isVip = badges.some((badge: any) => badge.set_id === 'vip');

    // Store chat message event and emit to frontend
    const eventId = this.storeAndEmitEvent(
      'channel.chat.message',
      event,
      currentSession.channel_id,
      viewer.id,
      userLogin,
      userDisplayName
    );

    console.log(`[EventRouter] ✓ Chat message stored from: ${userLogin} (ID: ${eventId})`);

    // Check for chat commands
    if (messageText && (messageText.startsWith('!') || messageText.startsWith('~'))) {
      try {
        const commandContext: ChatCommandContext = {
          username: userLogin,
          userId: userId,
          isModerator,
          isBroadcaster,
          isSubscriber,
          isVip
        };

        const response = await this.chatCommandHandler.handleMessage(messageText, commandContext);
        
        if (response) {
          console.log(`[EventRouter→Commands] Command executed, sending response: ${response}`);
          // Send response via IRC
          try {
            await twitchIRCService.sendMessage(response);
          } catch (err) {
            console.error('[EventRouter→Commands] Failed to send command response:', err);
          }
        }
      } catch (err) {
        console.error('[EventRouter→Commands] Error processing command:', err);
      }
    }

    // Forward to TTS manager (EventSub chat messages only, not IRC)
    if (this.ttsInitializer && messageText) {
      console.log('[EventRouter→TTS] Forwarding chat to TTS:', userLogin, '-', messageText);
      
      // Initialize and invoke TTS manager in background (don't block)
      this.ttsInitializer()
        .then(manager => {
          if (manager) {
            try {
              manager.handleChatMessage(userLogin, messageText, viewer.id);
            } catch (err) {
              console.warn('[TTS] Failed to handle chat message:', err);
            }
          }
        })
        .catch(err => {
          console.warn('[TTS] Failed to initialize manager for chat forwarding:', err);
        });
    }
  }

  /**
   * Destroy router
   */
  destroy(): void {
    console.log('[EventRouter] Destroying router');
    this.removeAllListeners();
  }
}

// Global instance
let eventSubRouter: EventSubEventRouter | null = null;

/**
 * Get or create EventSub router instance
 */
export function getEventSubRouter(mainWindow?: BrowserWindow | null, ttsInitializer?: () => Promise<any>): EventSubEventRouter {
  if (!eventSubRouter) {
    eventSubRouter = new EventSubEventRouter(mainWindow, ttsInitializer);
  } else {
    // Update references if provided
    if (mainWindow) {
      eventSubRouter.setMainWindow(mainWindow);
    }
    if (ttsInitializer) {
      eventSubRouter.setTTSInitializer(ttsInitializer);
    }
  }
  return eventSubRouter;
}

/**
 * Reset EventSub router instance (for testing)
 */
export function resetEventSubRouter(): void {
  if (eventSubRouter) {
    eventSubRouter.destroy();
    eventSubRouter = null;
  }
}
