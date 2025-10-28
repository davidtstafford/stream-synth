import { TokensRepository } from '../database/repositories/tokens';
import { SubscriptionsRepository } from '../database/repositories/subscriptions';
import { ViewersRepository } from '../database/repositories/viewers';

export class TwitchSubscriptionsService {
  private tokensRepo: TokensRepository;
  private subscriptionsRepo: SubscriptionsRepository;
  private viewersRepo: ViewersRepository;

  constructor() {
    this.tokensRepo = new TokensRepository();
    this.subscriptionsRepo = new SubscriptionsRepository();
    this.viewersRepo = new ViewersRepository();
  }

  /**
   * Fetch subscriptions from Twitch API and upsert them into the database
   * @param broadcasterId The broadcaster's Twitch ID
   * @param userId The user's ID (for OAuth token lookup)
   */
  async syncSubscriptionsFromTwitch(broadcasterId: string, userId: string): Promise<{ success: boolean; count?: number; error?: string }> {    try {
      console.log('[TwitchSubscriptions] Syncing subscriptions for broadcaster:', broadcasterId);

      // Get OAuth token
      const token = this.tokensRepo.get(userId);
      if (!token || !token.accessToken) {
        console.warn('[TwitchSubscriptions] No valid OAuth token found for user:', userId);
        return { success: false, error: 'No OAuth token available' };
      }

      const clientId = token.clientId;
      if (!clientId) {
        return { success: false, error: 'No Client ID in stored token' };
      }

      // Fetch subscriptions from Twitch API
      const subscriptions = await this.fetchSubscriptionsFromAPI(
        broadcasterId,
        token.accessToken,
        clientId
      );

      console.log('[TwitchSubscriptions] Fetched', subscriptions.length, 'subscriptions from Twitch API');

      let upsertCount = 0;

      // Process each subscription
      for (const sub of subscriptions) {
        try {
          // Get or create viewer
          const viewer = this.viewersRepo.getOrCreate(
            sub.user_id,
            sub.user_login,
            sub.user_name
          );

          if (!viewer) {
            console.warn('[TwitchSubscriptions] Could not create viewer for subscription:', sub.user_login);
            continue;
          }

          // Determine if it's a gift subscription
          const isGift = sub.is_gift ? 1 : 0;

          // Upsert subscription
          this.subscriptionsRepo.upsert({
            id: `${broadcasterId}_${sub.user_id}_sub`,
            viewer_id: viewer.id,
            tier: sub.tier,
            is_gift: isGift,
            start_date: new Date().toISOString(),
            end_date: null
          });

          upsertCount++;
        } catch (err) {
          console.warn('[TwitchSubscriptions] Error processing subscription for user', sub.user_login, ':', err);
        }
      }

      console.log('[TwitchSubscriptions] Upserted', upsertCount, 'subscriptions into database');
      return { success: true, count: upsertCount };
    } catch (error: any) {
      console.error('[TwitchSubscriptions] Error syncing subscriptions:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch subscriptions from Twitch Helix API
   * Handles pagination to get all subscriptions
   */
  private async fetchSubscriptionsFromAPI(
    broadcasterId: string,
    accessToken: string,
    clientId: string
  ): Promise<any[]> {
    const allSubscriptions: any[] = [];
    let after: string | null = null;
    const maxPages = 100; // Safety limit
    let pageCount = 0;

    do {
      pageCount++;
      if (pageCount > maxPages) {
        console.warn('[TwitchSubscriptions] Reached max pages limit, stopping pagination');
        break;
      }

      try {
        const url = new URL('https://api.twitch.tv/helix/subscriptions');
        url.searchParams.set('broadcaster_id', broadcasterId);
        url.searchParams.set('first', '100');
        if (after) {
          url.searchParams.set('after', after);
        }

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId
          }
        });

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const subscriptions = data.data || [];

        allSubscriptions.push(...subscriptions);
        console.log('[TwitchSubscriptions] Fetched page', pageCount, 'with', subscriptions.length, 'subscriptions');

        // Check if there are more pages
        after = data.pagination?.cursor || null;

        if (!after || subscriptions.length < 100) {
          // No more pages
          break;
        }
      } catch (error: any) {
        console.error('[TwitchSubscriptions] Error fetching page', pageCount, ':', error);
        throw error;
      }
    } while (after);

    return allSubscriptions;
  }

  /**
   * Check if a specific viewer is subscribed
   */
  async checkSubscriptionStatus(viewerId: string): Promise<{ isSubscribed: boolean; status?: string }> {
    try {
      const subscription = this.subscriptionsRepo.getByViewerId(viewerId);
      if (!subscription) {
        return { isSubscribed: false };
      }

      let status = subscription.tier;
      if (subscription.is_gift) {
        status += ' (Gift)';
      }
      status += ' Subscriber';
    return { isSubscribed: true, status };
    } catch (error: any) {
      console.error('[TwitchSubscriptions] Error checking subscription status:', error);
      return { isSubscribed: false };
    }
  }
}
