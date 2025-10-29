/**
 * Twitch Moderators Service
 * 
 * Syncs moderators from Twitch Helix API to the viewer_roles table
 */

import { ViewerRolesRepository } from '../database/repositories/viewer-roles';
import { ViewersRepository } from '../database/repositories/viewers';
import { TokensRepository } from '../database/repositories/tokens';

export class TwitchModeratorsService {
  private rolesRepo = new ViewerRolesRepository();
  private viewersRepo = new ViewersRepository();
  private tokensRepo = new TokensRepository();
  /**
   * Sync moderators from Twitch Helix API
   */
  async syncModerators(broadcasterId: string): Promise<{ success: boolean; count: number; error?: string }> {
    try {
      // Get access token - use broadcaster ID as user ID (they are the same for the channel owner)
      const token = this.tokensRepo.get(broadcasterId);
      
      if (!token || !token.accessToken) {
        return { success: false, count: 0, error: 'Twitch not authenticated' };
      }

      const moderators: Array<{ user_id: string; user_login: string; user_name: string }> = [];
      let cursor: string | undefined;
      let hasMore = true;

      // Fetch all moderators with pagination
      while (hasMore) {
        const url = new URL('https://api.twitch.tv/helix/moderation/moderators');
        url.searchParams.set('broadcaster_id', broadcasterId);
        url.searchParams.set('first', '100'); // Max per page
        
        if (cursor) {
          url.searchParams.set('after', cursor);
        }

        const response = await fetch(url.toString(), {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Client-Id': token.clientId
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Moderators Sync] API error:', response.status, errorText);
          return { success: false, count: 0, error: `Twitch API error: ${response.status}` };
        }

        const data = await response.json();
        
        if (data.data && data.data.length > 0) {
          moderators.push(...data.data);
        }

        // Check pagination
        cursor = data.pagination?.cursor;
        hasMore = !!cursor;
      }

      console.log(`[Moderators Sync] Fetched ${moderators.length} moderators from Twitch`);

      // Ensure all moderators exist in viewers table
      const viewerIds: string[] = [];
      
      for (const mod of moderators) {
        const viewer = this.viewersRepo.getOrCreate(
          mod.user_id,
          mod.user_login,
          mod.user_name
        );
        
        if (viewer) {
          viewerIds.push(viewer.id);
        }
      }

      // Sync to viewer_roles table
      this.rolesRepo.syncModerators(viewerIds);

      return { success: true, count: moderators.length };
    } catch (error: any) {
      console.error('[Moderators Sync] Error:', error);
      return { success: false, count: 0, error: error.message };
    }
  }
}
