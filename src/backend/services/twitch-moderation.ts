import { ModerationHistoryRepository, ModerationHistoryEntry } from '../database/repositories/moderation-history';
import { EventsRepository } from '../database/repositories/events';
import { ViewersRepository } from '../database/repositories/viewers';
import { PollingEventFormatter } from './polling-event-formatter';

interface TwitchBannedUser {
  user_id: string;
  user_login: string;
  user_name: string;
  expires_at: string | null;  // null for permanent bans
  created_at: string;
  reason: string;
  moderator_id: string;
  moderator_login: string;
  moderator_name: string;
}

type ModerationStatusType = 'banned' | 'timed_out';

export class TwitchModerationService {
  private moderationHistoryRepo: ModerationHistoryRepository;
  private eventsRepo: EventsRepository;
  private viewerRepo: ViewersRepository;
  private knownStatuses: Map<string, Map<string, ModerationStatusType>>;

  constructor() {
    this.moderationHistoryRepo = new ModerationHistoryRepository();
    this.eventsRepo = new EventsRepository();
    this.viewerRepo = new ViewersRepository();
    this.knownStatuses = new Map();
  }
  /**
   * Determine if a ban is permanent based on expires_at field
   * Handles Twitch API quirks:
   * - null = permanent ban
   * - "" (empty string) = permanent ban (API bug - MOST COMMON!)
   * - "0001-01-01T00:00:00Z" = permanent ban (API bug)
   * - Far future date (>1 year) = permanent ban (API workaround)
   * - Reasonable timestamp = timeout
   */
  private isPermanentBan(expiresAt: string | null): boolean {
    if (expiresAt === null || expiresAt === '') {
      return true; // null or empty string = permanent ban
    }

    // Check for "0001-01-01T00:00:00Z" pattern (Twitch API bug)
    if (expiresAt.startsWith('0001-01-01')) {
      return true;
    }

    // Check if expires_at is > 1 year in the future (unrealistic timeout)
    const expiresDate = new Date(expiresAt);
    const oneYearFromNow = new Date();
    oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

    if (expiresDate > oneYearFromNow) {
      return true; // Far future = permanent ban
    }

    return false; // Reasonable timestamp = timeout
  }

  /**
   * Initialize known moderation statuses from database
   */
  private async initializeKnownStatuses(channelId: string): Promise<void> {
    const statusMap = new Map<string, ModerationStatusType>();

    // Load currently banned users
    const banned = this.moderationHistoryRepo.getAllBanned(channelId);
    for (const entry of banned) {
      statusMap.set(entry.user_id, 'banned');
    }

    // Load currently timed out users
    const timedOut = this.moderationHistoryRepo.getAllTimedOut(channelId);
    for (const entry of timedOut) {
      statusMap.set(entry.user_id, 'timed_out');
    }

    this.knownStatuses.set(channelId, statusMap);
    console.log(`[Moderation] Initialized ${statusMap.size} known moderation statuses for channel ${channelId}`);
  }

  /**
   * Poll for banned and timed out users
   */
  async pollModerationStatus(channelId: string, broadcasterId: string, accessToken: string, clientId: string): Promise<void> {
    try {
      console.log(`[Moderation] Polling moderation status for channel ${channelId}`);

      if (!this.knownStatuses.has(channelId)) {
        await this.initializeKnownStatuses(channelId);
      }

      const bannedUsers = await this.fetchBannedUsers(broadcasterId, accessToken, clientId);
      const statusMap = this.knownStatuses.get(channelId)!;

      // Track which users are currently moderated
      const currentlyModerated = new Set<string>();      // Process all banned/timed out users
      for (const bannedUser of bannedUsers) {
        currentlyModerated.add(bannedUser.user_id);
        
        // Detect permanent ban vs timeout
        // Twitch API quirks:
        // - Permanent bans: expires_at is null OR "0001-01-01T00:00:00Z" OR far future date
        // - Timeouts: expires_at is a reasonable timestamp (typically < 2 weeks from now)
        const isBan = this.isPermanentBan(bannedUser.expires_at);
        const newStatus: ModerationStatusType = isBan ? 'banned' : 'timed_out';
        const previousStatus = statusMap.get(bannedUser.user_id);

        // DEBUG: Log what Twitch API returned
        console.log(`[Moderation] User ${bannedUser.user_login}: expires_at="${bannedUser.expires_at}", isBan=${isBan}, status=${newStatus}`);

        // New ban or timeout detected
        if (previousStatus !== newStatus) {
          if (isBan) {
            await this.processBanAction(channelId, bannedUser);
          } else {
            await this.processTimeoutAction(channelId, bannedUser);
          }
          statusMap.set(bannedUser.user_id, newStatus);
        }
      }// Check for unbans and timeout lifts
      for (const [userId, status] of statusMap.entries()) {
        if (!currentlyModerated.has(userId)) {
          // User was previously moderated but is no longer in the list
          const viewer = this.viewerRepo.getViewerById(userId);
          if (viewer) {
            if (status === 'banned') {
              await this.processUnbanAction(channelId, viewer, userId);
            } else if (status === 'timed_out') {
              await this.processTimeoutLiftAction(channelId, viewer, userId);
            }
            statusMap.delete(userId);
          }
        }
      }

    } catch (error) {
      console.error('[Moderation] Error polling moderation status:', error);
    }
  }

  /**
   * Fetch banned and timed out users from Twitch API
   */
  private async fetchBannedUsers(broadcasterId: string, accessToken: string, clientId: string): Promise<TwitchBannedUser[]> {
    let allBanned: TwitchBannedUser[] = [];
    let cursor: string | undefined;

    do {
      const queryParams = new URLSearchParams({
        broadcaster_id: broadcasterId,
        first: '100'
      });

      if (cursor) {
        queryParams.append('after', cursor);
      }

      const response = await fetch(`https://api.twitch.tv/helix/moderation/banned?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to fetch banned users: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      allBanned = allBanned.concat(data.data || []);
      cursor = data.pagination?.cursor;

    } while (cursor);

    console.log(`[Moderation] Fetched ${allBanned.length} banned/timed out users from Twitch API`);
    return allBanned;
  }
  /**
   * Process a new ban action
   */
  private async processBanAction(channelId: string, bannedUser: TwitchBannedUser): Promise<void> {
    console.log(`[Moderation] New ban detected: ${bannedUser.user_login}`);

    // Ensure viewer exists
    const viewer = this.viewerRepo.getOrCreate(
      bannedUser.user_id,
      bannedUser.user_login,
      bannedUser.user_name
    );

    if (!viewer) {
      console.error(`[Moderation] Failed to get/create viewer ${bannedUser.user_login}`);
      return;
    }

    const historyEntry: Omit<ModerationHistoryEntry, 'id' | 'detected_at'> = {
      channel_id: channelId,
      viewer_id: bannedUser.user_id,
      user_id: bannedUser.user_id,
      user_login: bannedUser.user_login,
      user_name: bannedUser.user_name,
      action: 'ban',
      reason: bannedUser.reason || undefined,
      moderator_id: bannedUser.moderator_id,
      moderator_login: bannedUser.moderator_login,
      action_at: bannedUser.created_at
    };

    // Write to moderation_history table
    this.moderationHistoryRepo.record(historyEntry);

    // Write to events table (dual-write pattern)
    const event = PollingEventFormatter.formatModerationEvent(
      bannedUser.user_id,
      bannedUser.user_login,
      bannedUser.user_name,
      channelId,
      'channel.ban',
      bannedUser.reason,
      undefined,
      bannedUser.moderator_login
    );
    this.eventsRepo.storeEvent(event.event_type, event.details, channelId, event.viewer_id || undefined);
  }
  /**
   * Process a new timeout action
   */
  private async processTimeoutAction(channelId: string, bannedUser: TwitchBannedUser): Promise<void> {
    console.log(`[Moderation] New timeout detected: ${bannedUser.user_login}`);

    // Calculate duration in seconds
    const durationSeconds = bannedUser.expires_at 
      ? Math.floor((new Date(bannedUser.expires_at).getTime() - new Date(bannedUser.created_at).getTime()) / 1000)
      : undefined;

    // Ensure viewer exists
    const viewer = this.viewerRepo.getOrCreate(
      bannedUser.user_id,
      bannedUser.user_login,
      bannedUser.user_name
    );

    if (!viewer) {
      console.error(`[Moderation] Failed to get/create viewer ${bannedUser.user_login}`);
      return;
    }

    const historyEntry: Omit<ModerationHistoryEntry, 'id' | 'detected_at'> = {
      channel_id: channelId,
      viewer_id: bannedUser.user_id,
      user_id: bannedUser.user_id,
      user_login: bannedUser.user_login,
      user_name: bannedUser.user_name,
      action: 'timeout',
      reason: bannedUser.reason || undefined,
      duration_seconds: durationSeconds,
      moderator_id: bannedUser.moderator_id,
      moderator_login: bannedUser.moderator_login,
      action_at: bannedUser.created_at
    };

    // Write to moderation_history table
    this.moderationHistoryRepo.record(historyEntry);

    // Write to events table (dual-write pattern)
    const event = PollingEventFormatter.formatModerationEvent(
      bannedUser.user_id,
      bannedUser.user_login,
      bannedUser.user_name,
      channelId,
      'channel.timeout',
      bannedUser.reason,
      durationSeconds,
      bannedUser.moderator_login
    );
    this.eventsRepo.storeEvent(event.event_type, event.details, channelId, event.viewer_id || undefined);
  }
  /**
   * Process an unban action
   */
  private async processUnbanAction(channelId: string, viewer: any, userId: string): Promise<void> {
    console.log(`[Moderation] Unban detected: ${viewer.username}`);

    const historyEntry: Omit<ModerationHistoryEntry, 'id' | 'detected_at'> = {
      channel_id: channelId,
      viewer_id: userId,
      user_id: userId,
      user_login: viewer.username,
      user_name: viewer.display_name,
      action: 'unban',
      action_at: new Date().toISOString()
    };

    // Write to moderation_history table
    this.moderationHistoryRepo.record(historyEntry);

    // Write to events table (dual-write pattern)
    const event = PollingEventFormatter.formatModerationEvent(
      userId,
      viewer.username,
      viewer.display_name,
      channelId,
      'channel.unban'
    );
    this.eventsRepo.storeEvent(event.event_type, event.details, channelId, event.viewer_id || undefined);
  }

  /**
   * Process a timeout lift action
   */
  private async processTimeoutLiftAction(channelId: string, viewer: any, userId: string): Promise<void> {
    console.log(`[Moderation] Timeout lifted: ${viewer.username}`);

    const historyEntry: Omit<ModerationHistoryEntry, 'id' | 'detected_at'> = {
      channel_id: channelId,
      viewer_id: userId,
      user_id: userId,
      user_login: viewer.username,
      user_name: viewer.display_name,
      action: 'timeout_lifted',
      action_at: new Date().toISOString()
    };

    // Write to moderation_history table
    this.moderationHistoryRepo.record(historyEntry);

    // Write to events table (dual-write pattern)
    const event = PollingEventFormatter.formatModerationEvent(
      userId,
      viewer.username,
      viewer.display_name,
      channelId,
      'channel.timeout_lifted'
    );
    this.eventsRepo.storeEvent(event.event_type, event.details, channelId, event.viewer_id || undefined);
  }

  /**
   * Sync moderation status (for manual sync)
   */
  async syncModerationStatus(channelId: string, broadcasterId: string, accessToken: string, clientId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.pollModerationStatus(channelId, broadcasterId, accessToken, clientId);
      return { success: true };
    } catch (error: any) {
      console.error('[Moderation] Error syncing moderation status:', error);
      return { success: false, error: error.message };
    }
  }
}
