/**
 * Viewer Moderation Actions Service
 * Handles executing moderation actions (ban, unban, timeout, mod, unmod, vip, unvip)
 * via Twitch Helix API
 */

interface ModerationActionResponse {
  success: boolean;
  action: string;
  userId: string;
  displayName?: string;
  message?: string;
  error?: string;
}

export class ViewerModerationActionsService {
  private helixBaseUrl = 'https://api.twitch.tv/helix';

  /**
   * Ban a user from the channel
   */
  async banUser(
    broadcasterId: string,
    userId: string,
    displayName: string,
    reason: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      const response = await fetch(
        `${this.helixBaseUrl}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            reason: reason || undefined
          })
        }
      );

      if (response.status === 204 || response.ok) {
        return {
          success: true,
          action: 'ban',
          userId,
          displayName,
          message: `${displayName} has been banned${reason ? ` (${reason})` : ''}`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'ban',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Ban error:', error.message);
      return {
        success: false,
        action: 'ban',
        userId,
        displayName,
        error: error.message || 'Failed to ban user'
      };
    }
  }

  /**
   * Unban a user from the channel
   */
  async unbanUser(
    broadcasterId: string,
    userId: string,
    displayName: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      const response = await fetch(
        `${this.helixBaseUrl}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}&user_id=${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId
          }
        }
      );

      if (response.status === 204) {
        return {
          success: true,
          action: 'unban',
          userId,
          displayName,
          message: `${displayName} has been unbanned`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'unban',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Unban error:', error.message);
      return {
        success: false,
        action: 'unban',
        userId,
        displayName,
        error: error.message || 'Failed to unban user'
      };
    }
  }

  /**
   * Timeout a user (temporary ban)
   */
  async timeoutUser(
    broadcasterId: string,
    userId: string,
    displayName: string,
    durationSeconds: number,
    reason: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      // Validate duration: must be between 1 second and 604800 seconds (7 days)
      if (durationSeconds < 1 || durationSeconds > 604800) {
        return {
          success: false,
          action: 'timeout',
          userId,
          displayName,
          error: 'Duration must be between 1 second and 7 days (604800 seconds)'
        };
      }

      const response = await fetch(
        `${this.helixBaseUrl}/moderation/bans?broadcaster_id=${broadcasterId}&moderator_id=${broadcasterId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId,
            duration: durationSeconds,
            reason: reason || undefined
          })
        }
      );

      if (response.status === 204 || response.ok) {
        const durationText = this.formatDuration(durationSeconds);
        return {
          success: true,
          action: 'timeout',
          userId,
          displayName,
          message: `${displayName} has been timed out for ${durationText}${reason ? ` (${reason})` : ''}`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'timeout',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Timeout error:', error.message);
      return {
        success: false,
        action: 'timeout',
        userId,
        displayName,
        error: error.message || 'Failed to timeout user'
      };
    }
  }

  /**
   * Add a user as moderator
   */
  async addModerator(
    broadcasterId: string,
    userId: string,
    displayName: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      const response = await fetch(
        `${this.helixBaseUrl}/moderation/moderators?broadcaster_id=${broadcasterId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId
          })
        }
      );

      if (response.status === 204 || response.ok) {
        return {
          success: true,
          action: 'mod',
          userId,
          displayName,
          message: `${displayName} is now a moderator`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'mod',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Add mod error:', error.message);
      return {
        success: false,
        action: 'mod',
        userId,
        displayName,
        error: error.message || 'Failed to add moderator'
      };
    }
  }

  /**
   * Remove a user as moderator
   */
  async removeModerator(
    broadcasterId: string,
    userId: string,
    displayName: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      const response = await fetch(
        `${this.helixBaseUrl}/moderation/moderators?broadcaster_id=${broadcasterId}&user_id=${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId
          }
        }
      );

      if (response.status === 204) {
        return {
          success: true,
          action: 'unmod',
          userId,
          displayName,
          message: `${displayName} is no longer a moderator`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'unmod',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Remove mod error:', error.message);
      return {
        success: false,
        action: 'unmod',
        userId,
        displayName,
        error: error.message || 'Failed to remove moderator'
      };
    }
  }

  /**
   * Add a user as VIP
   */
  async addVIP(
    broadcasterId: string,
    userId: string,
    displayName: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      const response = await fetch(
        `${this.helixBaseUrl}/channels/vips?broadcaster_id=${broadcasterId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            user_id: userId
          })
        }
      );

      if (response.status === 204 || response.ok) {
        return {
          success: true,
          action: 'vip',
          userId,
          displayName,
          message: `${displayName} is now a VIP`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'vip',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Add VIP error:', error.message);
      return {
        success: false,
        action: 'vip',
        userId,
        displayName,
        error: error.message || 'Failed to add VIP'
      };
    }
  }

  /**
   * Remove a user as VIP
   */
  async removeVIP(
    broadcasterId: string,
    userId: string,
    displayName: string,
    accessToken: string,
    clientId: string
  ): Promise<ModerationActionResponse> {
    try {
      const response = await fetch(
        `${this.helixBaseUrl}/channels/vips?broadcaster_id=${broadcasterId}&user_id=${userId}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-ID': clientId
          }
        }
      );

      if (response.status === 204) {
        return {
          success: true,
          action: 'unvip',
          userId,
          displayName,
          message: `${displayName} is no longer a VIP`
        };
      }

      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        action: 'unvip',
        userId,
        displayName,
        error: errorData.message || `API error: ${response.status}`
      };
    } catch (error: any) {
      console.error('[ModActions] Remove VIP error:', error.message);
      return {
        success: false,
        action: 'unvip',
        userId,
        displayName,
        error: error.message || 'Failed to remove VIP'
      };
    }
  }

  /**
   * Helper: Format duration in seconds to readable string
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${seconds} seconds`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
    return `${Math.floor(seconds / 86400)} days`;
  }
}
