/**
 * Polling Event Formatter
 * 
 * Centralized utility for building event payloads from polling state changes.
 * This ensures consistent event structure across all pollers (followers, moderation, clips, etc.)
 */

export interface EventData {
  event_type: string;
  viewer_id: string | null;
  details: Record<string, any>;
}

export class PollingEventFormatter {
  /**
   * Format follower state changes (follow/unfollow)
   */
  static formatFollowerEvent(
    action: 'follow' | 'unfollow',
    username: string,
    viewerId: string,
    followedAt?: Date
  ): EventData {
    return {
      event_type: action === 'follow' ? 'channel.follow' : 'channel.unfollow',
      viewer_id: viewerId,
      details: {
        username,
        action,
        followed_at: followedAt?.toISOString() || new Date().toISOString()
      }
    };
  }
  /**
   * Format moderation state changes (ban/unban/timeout/timeout_lifted)
   * Overload: new signature for TwitchModerationService
   */
  static formatModerationEvent(
    viewerId: string,
    username: string,
    displayName: string,
    channelId: string,
    eventType: 'channel.ban' | 'channel.unban' | 'channel.timeout' | 'channel.timeout_lifted',
    reason?: string,
    durationSeconds?: number,
    moderatorUsername?: string
  ): EventData {
    const details: Record<string, any> = {
      username,
      display_name: displayName,
      channel_id: channelId
    };

    if (moderatorUsername) {
      details.moderator_username = moderatorUsername;
    }

    if (durationSeconds) {
      details.duration_seconds = durationSeconds;
      details.expires_at = new Date(Date.now() + durationSeconds * 1000).toISOString();
    }

    if (reason) {
      details.reason = reason;
    }

    return {
      event_type: eventType,
      viewer_id: viewerId,
      details
    };
  }

  /**
   * Format role state changes (VIP/Moderator granted/revoked)
   */
  static formatRoleEvent(
    action: 'granted' | 'revoked',
    roleType: 'vip' | 'moderator' | 'subscriber',
    username: string,
    viewerId: string,
    additionalInfo?: Record<string, any>
  ): EventData {
    const eventTypeMap: Record<string, Record<string, string>> = {
      'vip': {
        'granted': 'channel.vip.add',
        'revoked': 'channel.vip.remove'
      },
      'moderator': {
        'granted': 'channel.moderator.add',
        'revoked': 'channel.moderator.remove'
      },
      'subscriber': {
        'granted': 'channel.subscribe',
        'revoked': 'channel.subscription.end'
      }
    };

    return {
      event_type: eventTypeMap[roleType][action],
      viewer_id: viewerId,
      details: {
        username,
        action,
        role_type: roleType,
        ...additionalInfo
      }
    };
  }

  /**
   * Format subscription state changes (subscribed/resubscribed/unsubscribed)
   */
  static formatSubscriptionEvent(
    action: 'subscribed' | 'resubscribed' | 'unsubscribed',
    username: string,
    viewerId: string,
    tier?: string,
    cumulativeMonths?: number,
    isGift?: boolean
  ): EventData {
    const eventTypeMap: Record<string, string> = {
      'subscribed': 'channel.subscribe',
      'resubscribed': 'channel.subscription.message',
      'unsubscribed': 'channel.subscription.end'
    };

    const details: Record<string, any> = {
      username,
      action,
      tier
    };

    if (cumulativeMonths) {
      details.cumulative_months = cumulativeMonths;
    }

    if (isGift !== undefined) {
      details.is_gift = isGift;
    }

    return {
      event_type: eventTypeMap[action],
      viewer_id: viewerId,
      details
    };
  }

  /**
   * Format clip created events
   */
  static formatClipCreatedEvent(
    clipTitle: string,
    clipUrl: string,
    creatorUsername: string,
    creatorId: string,
    viewCount?: number,
    duration?: number,
    thumbnailUrl?: string
  ): EventData {
    return {
      event_type: 'channel.clip.create',
      viewer_id: creatorId,
      details: {
        clip_title: clipTitle,
        clip_url: clipUrl,
        creator_username: creatorUsername,
        view_count: viewCount || 0,
        duration,
        thumbnail_url: thumbnailUrl
      }
    };
  }

  /**
   * Generic polling event formatter for custom events
   */
  static formatGenericPollingEvent(
    eventType: string,
    viewerId: string | null,
    details: Record<string, any>
  ): EventData {
    return {
      event_type: eventType,
      viewer_id: viewerId,
      details
    };
  }
}
