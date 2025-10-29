import { TokensRepository } from '../database/repositories/tokens';
import { ViewerRolesRepository } from '../database/repositories/viewer-roles';
import { ViewersRepository } from '../database/repositories/viewers';

export class TwitchVIPService {
  private tokensRepo: TokensRepository;
  private rolesRepo: ViewerRolesRepository;
  private viewersRepo: ViewersRepository;

  constructor() {
    this.tokensRepo = new TokensRepository();
    this.rolesRepo = new ViewerRolesRepository();
    this.viewersRepo = new ViewersRepository();
  }

  /**
   * Fetch VIPs from Twitch API and sync them into the database
   * @param broadcasterId The broadcaster's Twitch ID
   * @param userId The user's ID (for OAuth token lookup)
   */
  async syncVIPsFromTwitch(
    broadcasterId: string, 
    userId: string
  ): Promise<{ success: boolean; count?: number; error?: string }> {
    try {
      console.log('[TwitchVIP] Syncing VIPs for broadcaster:', broadcasterId);

      // Get OAuth token
      const token = this.tokensRepo.get(userId);
      if (!token || !token.accessToken) {
        console.warn('[TwitchVIP] No valid OAuth token found for user:', userId);
        return { success: false, error: 'No OAuth token available' };
      }

      const clientId = token.clientId;
      if (!clientId) {
        return { success: false, error: 'No Client ID in stored token' };
      }

      // Fetch VIPs from Twitch API
      const vips = await this.fetchVIPsFromAPI(
        broadcasterId,
        token.accessToken,
        clientId
      );

      console.log('[TwitchVIP] Fetched', vips.length, 'VIPs from Twitch API');

      const viewerIds: string[] = [];

      // Process each VIP
      for (const vip of vips) {
        try {
          // Get or create viewer
          const viewer = this.viewersRepo.getOrCreate(
            vip.user_id,
            vip.user_login,
            vip.user_name
          );

          if (!viewer) {
            console.warn('[TwitchVIP] Could not create viewer for VIP:', vip.user_login);
            continue;
          }

          viewerIds.push(viewer.id);
        } catch (err) {
          console.warn('[TwitchVIP] Error processing VIP for user', vip.user_login, ':', err);
        }
      }

      // Sync VIP roles (grant to current VIPs, revoke from others)
      this.rolesRepo.syncVIPs(viewerIds);

      console.log('[TwitchVIP] Synced', viewerIds.length, 'VIPs into database');
      return { success: true, count: viewerIds.length };
    } catch (error: any) {
      console.error('[TwitchVIP] Error syncing VIPs:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Fetch VIPs from Twitch Helix API
   * Handles pagination to get all VIPs
   */
  private async fetchVIPsFromAPI(
    broadcasterId: string,
    accessToken: string,
    clientId: string
  ): Promise<any[]> {
    const allVIPs: any[] = [];
    let after: string | null = null;
    const maxPages = 100; // Safety limit
    let pageCount = 0;

    do {
      pageCount++;
      if (pageCount > maxPages) {
        console.warn('[TwitchVIP] Reached max pages limit, stopping pagination');
        break;
      }

      try {
        const url = new URL('https://api.twitch.tv/helix/channels/vips');
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
          // If 401 or 403, might be missing scope
          if (response.status === 401 || response.status === 403) {
            throw new Error(`API returned status ${response.status}: Missing required scope 'channel:read:vips' or 'channel:manage:vips'`);
          }
          throw new Error(`API returned status ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        const vips = data.data || [];

        allVIPs.push(...vips);
        console.log('[TwitchVIP] Fetched page', pageCount, 'with', vips.length, 'VIPs');

        // Check if there are more pages
        after = data.pagination?.cursor || null;

        if (!after || vips.length < 100) {
          // No more pages
          break;
        }
      } catch (error: any) {
        console.error('[TwitchVIP] Error fetching page', pageCount, ':', error);
        throw error;
      }
    } while (after);

    return allVIPs;
  }

  /**
   * Check if a specific viewer is VIP
   */
  isViewerVIP(viewerId: string): boolean {
    return this.rolesRepo.isViewerVIP(viewerId);
  }

  /**
   * Get all active VIPs
   */
  getAllVIPs(): Array<{ viewer_id: string; granted_at: string }> {
    return this.rolesRepo.getAllVIPs();
  }
}
