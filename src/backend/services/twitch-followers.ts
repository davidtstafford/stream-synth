import { TokensRepository } from '../database/repositories/tokens';
import { FollowerHistoryRepository } from '../database/repositories/follower-history';
import { ViewersRepository } from '../database/repositories/viewers';
import { EventsRepository } from '../database/repositories/events';
import { PollingEventFormatter } from './polling-event-formatter';

export class TwitchFollowersService {
  private tokensRepo: TokensRepository;
  private followerHistoryRepo: FollowerHistoryRepository;
  private viewersRepo: ViewersRepository;
  private eventsRepo: EventsRepository;

  constructor() {
    this.tokensRepo = new TokensRepository();
    this.followerHistoryRepo = new FollowerHistoryRepository();
    this.viewersRepo = new ViewersRepository();
    this.eventsRepo = new EventsRepository();
  }

  /**
   * Fetch followers from Twitch API and detect changes
   * @param broadcasterId The broadcaster's Twitch ID
   * @param userId The user's ID (for OAuth token lookup)
   * @param channelId The channel ID for database records
   */
  async syncFollowersFromTwitch(
    broadcasterId: string,
    userId: string,
    channelId: string
  ): Promise<{ success: boolean; newFollowers?: number; unfollowers?: number; total?: number; error?: string }> {
    try {
      console.log('[TwitchFollowers] Syncing followers for broadcaster:', broadcasterId);

      // Get OAuth token
      const token = this.tokensRepo.get(userId);
      if (!token || !token.accessToken) {
        console.warn('[TwitchFollowers] No valid OAuth token found for user:', userId);
        return { success: false, error: 'No OAuth token available' };
      }

      const clientId = token.clientId;
      if (!clientId) {
        return { success: false, error: 'No Client ID in stored token' };
      }

      // Fetch current followers from Twitch API
      const apiFollowers = await this.fetchFollowersFromAPI(
        broadcasterId,
        token.accessToken,
        clientId
      );

      console.log('[TwitchFollowers] Fetched', apiFollowers.length, 'followers from Twitch API');

      // Get current followers from database
      const dbFollowerIds = new Set(this.followerHistoryRepo.getAllCurrentFollowerIds(channelId));
      const apiFollowerIds = new Set(apiFollowers.map(f => f.user_id));

      // Detect new followers
      const newFollowerIds = [...apiFollowerIds].filter(id => !dbFollowerIds.has(id));
      
      // Detect unfollowers
      const unfollowerIds = [...dbFollowerIds].filter(id => !apiFollowerIds.has(id));

      console.log('[TwitchFollowers] Changes detected:', {
        newFollowers: newFollowerIds.length,
        unfollowers: unfollowerIds.length,
        total: apiFollowers.length
      });

      // Process new followers
      const newFollowerRecords = [];
      for (const followerId of newFollowerIds) {
        const followerData = apiFollowers.find(f => f.user_id === followerId);
        if (!followerData) continue;

        // Get or create viewer
        const viewer = this.viewersRepo.getOrCreate(
          followerData.user_id,
          followerData.user_login,
          followerData.user_name
        );

        if (!viewer) {
          console.warn('[TwitchFollowers] Could not create viewer for follower:', followerData.user_login);
          continue;
        }

        newFollowerRecords.push({
          channelId,
          viewerId: viewer.id,
          followerUserId: followerData.user_id,
          followerUserLogin: followerData.user_login,
          followerUserName: followerData.user_name,
          action: 'follow' as const,
          followedAt: followerData.followed_at
        });
      }      // Process unfollowers
      const unfollowerRecords = [];
      for (const unfollowerId of unfollowerIds) {
        // Get existing viewer (should already exist from when they followed)
        const viewer = this.viewersRepo.getViewerById(unfollowerId);
        if (!viewer) {
          console.warn('[TwitchFollowers] Could not find viewer for unfollower:', unfollowerId);
          continue;
        }

        // Get user info from database
        const currentFollowers = this.followerHistoryRepo.getCurrentFollowers(channelId);
        const followerData = currentFollowers.find(f => f.follower_user_id === unfollowerId);

        unfollowerRecords.push({
          channelId,
          viewerId: viewer.id,
          followerUserId: unfollowerId,
          followerUserLogin: followerData?.follower_user_login || viewer.username,
          followerUserName: followerData?.follower_user_name || viewer.display_name,
          action: 'unfollow' as const,
          followedAt: null
        });
      }      // Batch insert all changes to follower_history
      const allRecords = [...newFollowerRecords, ...unfollowerRecords];
      if (allRecords.length > 0) {
        this.followerHistoryRepo.batchInsertFollowerHistory(allRecords);
        console.log('[TwitchFollowers] Recorded', allRecords.length, 'follower changes to follower_history');
        
        // Also write events to events table for event actions integration
        const events = [];
        
        // Create events for new followers
        for (const record of newFollowerRecords) {
          const followedAtDate = record.followedAt ? new Date(record.followedAt) : undefined;
          const eventData = PollingEventFormatter.formatFollowerEvent(
            'follow',
            record.followerUserLogin,
            record.viewerId,
            followedAtDate
          );
          events.push({
            eventType: eventData.event_type,
            eventData: eventData.details,
            channelId: record.channelId,
            viewerId: eventData.viewer_id
          });
        }
        
        // Create events for unfollowers
        for (const record of unfollowerRecords) {
          const eventData = PollingEventFormatter.formatFollowerEvent(
            'unfollow',
            record.followerUserLogin,
            record.viewerId,
            undefined // unfollows don't have a followed_at timestamp
          );
          events.push({
            eventType: eventData.event_type,
            eventData: eventData.details,
            channelId: record.channelId,
            viewerId: eventData.viewer_id
          });
        }
        
        // Batch insert events
        if (events.length > 0) {
          this.eventsRepo.batchInsertEvents(events);
          console.log('[TwitchFollowers] Recorded', events.length, 'follower events to events table');
        }
      }

      return {
        success: true,
        newFollowers: newFollowerIds.length,
        unfollowers: unfollowerIds.length,
        total: apiFollowers.length
      };
    } catch (error: any) {
      console.error('[TwitchFollowers] Error syncing followers:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch followers from Twitch Helix API
   * Handles pagination to get all followers
   */
  private async fetchFollowersFromAPI(
    broadcasterId: string,
    accessToken: string,
    clientId: string
  ): Promise<any[]> {
    const allFollowers: any[] = [];
    let after: string | null = null;
    const maxPages = 100; // Safety limit
    let pageCount = 0;

    do {
      const url = new URL('https://api.twitch.tv/helix/channels/followers');
      url.searchParams.append('broadcaster_id', broadcasterId);
      url.searchParams.append('first', '100'); // Max per page

      if (after) {
        url.searchParams.append('after', after);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Twitch API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      
      if (data.data && data.data.length > 0) {
        allFollowers.push(...data.data);
      }

      after = data.pagination?.cursor || null;
      pageCount++;

      // Safety check
      if (pageCount >= maxPages) {
        console.warn('[TwitchFollowers] Reached max page limit, stopping pagination');
        break;
      }

    } while (after);

    return allFollowers;
  }

  /**
   * Get current followers from database
   */
  getCurrentFollowers(channelId: string) {
    return this.followerHistoryRepo.getCurrentFollowers(channelId);
  }

  /**
   * Get follower count
   */
  getFollowerCount(channelId: string): number {
    return this.followerHistoryRepo.getFollowerCount(channelId);
  }

  /**
   * Get recent follower events (follows and unfollows)
   */
  getRecentFollowerEvents(channelId: string, limit: number = 50) {
    return this.followerHistoryRepo.getRecentFollowerEvents(channelId, limit);
  }

  /**
   * Get follower history for a specific user
   */
  getFollowerHistory(channelId: string, followerUserId: string) {
    return this.followerHistoryRepo.getFollowerHistory(channelId, followerUserId);
  }

  /**
   * Check if a user is currently following
   */
  isCurrentlyFollowing(channelId: string, followerUserId: string): boolean {
    return this.followerHistoryRepo.isCurrentlyFollowing(channelId, followerUserId);
  }
}
