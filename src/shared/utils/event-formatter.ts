
/**
 * Shared Event Formatter
 * 
 * Central formatting logic for all Twitch events.
 * Used by:
 * 1. Events screen (Details column)
 * 2. Event Actions (in-app alerts)
 * 3. Browser Source (OBS overlays)
 */

export interface EventData {
  event_type: string;
  event_data: string | object;  // JSON string or parsed object
  viewer_username?: string;
  viewer_display_name?: string;
  channel_id: string;
  created_at: string;
}

export interface FormattedEvent {
  html: string;              // HTML markup for display
  plainText: string;         // Plain text version
  emoji: string;             // Leading emoji
  variables: Record<string, any>; // Extracted variables for templates
}

// ===== Helper Functions =====

const formatTier = (tier: string): string => {
  const tierMap: Record<string, string> = {
    '1000': 'Tier 1',
    '2000': 'Tier 2',
    '3000': 'Tier 3'
  };
  return tierMap[tier] || 'Tier 1';
};

const formatNumber = (num: number): string => {
  return num.toLocaleString();
};

const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

const getLeadingChoice = (choices: any[]): any => {
  if (!choices || choices.length === 0) return null;
  return choices.reduce((leading, current) => {
    const leadingVotes = leading.votes || leading.channel_points_votes || 0;
    const currentVotes = current.votes || current.channel_points_votes || 0;
    return currentVotes > leadingVotes ? current : leading;
  });
};

/**
 * Format an event for display
 * Returns HTML, plain text, emoji, and extracted variables
 */
export function formatEvent(event: EventData): FormattedEvent {
  const data = typeof event.event_data === 'string' 
    ? JSON.parse(event.event_data) 
    : event.event_data;
  
  // Get display name with fallback
  let displayName = event.viewer_display_name || event.viewer_username;
  if (!displayName && (event.event_type === 'irc.chat.join' || event.event_type === 'irc.chat.part')) {
    displayName = data.username;
  }
  if (!displayName) {
    displayName = 'Unknown';
  }
  // Base variables available for all events
  const variables: Record<string, any> = {
    username: displayName,
    display_name: displayName,  // Alias for username
    user_name: displayName,      // Alias for username (matches EventSub field)
    event_type: event.event_type,
    timestamp: event.created_at,
    ...data  // Include all event data as variables
  };

  // Format based on event type
  switch (event.event_type) {
    // ===== Chat Events =====
    case 'channel.chat.message': {
      const message = data.message?.text || '';
      return {
        html: `<strong>${displayName}:</strong> ${truncateText(message, 100)}`,
        plainText: `${displayName}: ${truncateText(message, 100)}`,
        emoji: '💬',
        variables: { ...variables, message }
      };
    }

    case 'channel.chat.clear':
      return {
        html: `🧹 <strong>All chat messages cleared</strong> by moderators`,
        plainText: `All chat messages cleared by moderators`,
        emoji: '🧹',
        variables
      };

    case 'channel.chat.clear_user_messages': {
      const targetUser = data.target_user_name || data.target_user_login || 'User';
      return {
        html: `🧹 All messages from <strong>${targetUser}</strong> cleared (timeout/ban)`,
        plainText: `All messages from ${targetUser} cleared (timeout/ban)`,
        emoji: '🧹',
        variables: { ...variables, target_user: targetUser }
      };
    }

    case 'channel.chat.message_delete': {
      const deletedUser = data.target_user_name || data.target_user_login || 'User';
      return {
        html: `🗑️ Message from <strong>${deletedUser}</strong> deleted by moderators`,
        plainText: `Message from ${deletedUser} deleted by moderators`,
        emoji: '🗑️',
        variables: { ...variables, deleted_user: deletedUser }
      };
    }

    case 'channel.chat_settings.update': {
      const settings: string[] = [];
      if (data.slow_mode) settings.push(`Slow mode (${data.slow_mode_wait_time_seconds}s)`);
      if (data.follower_mode) settings.push(`Follower mode (${data.follower_mode_duration_minutes}min)`);
      if (data.subscriber_mode) settings.push('Subscriber-only');
      if (data.emote_mode) settings.push('Emote-only');
      if (data.unique_chat_mode) settings.push('Unique chat');
      const settingsText = settings.length > 0 ? settings.join(', ') : 'All restrictions disabled';
      return {
        html: `⚙️ <strong>Chat settings:</strong> ${settingsText}`,
        plainText: `Chat settings: ${settingsText}`,
        emoji: '⚙️',
        variables: { ...variables, settings: settingsText }
      };
    }

    // ===== IRC Events =====
    case 'irc.chat.join':
      return {
        html: `<strong style="color: #4CAF50">→ ${displayName}</strong> joined the chat`,
        plainText: `${displayName} joined the chat`,
        emoji: '→',
        variables
      };

    case 'irc.chat.part':
      return {
        html: `<strong style="color: #f44336">← ${displayName}</strong> left the chat`,
        plainText: `${displayName} left the chat`,
        emoji: '←',
        variables
      };

    // ===== Stream Events =====
    case 'stream.online': {
      const type = data.type || '';
      const startedAt = data.started_at ? new Date(data.started_at).toLocaleTimeString() : '';
      return {
        html: `<strong style="color: #9146FF">🔴 Stream went live</strong>${type ? ` (${type})` : ''}${startedAt ? ` at ${startedAt}` : ''}`,
        plainText: `Stream went live${type ? ` (${type})` : ''}${startedAt ? ` at ${startedAt}` : ''}`,
        emoji: '🔴',
        variables: { ...variables, stream_type: type, started_at: startedAt }
      };
    }

    case 'stream.offline':
      return {
        html: `<strong style="color: #808080">⚫ Stream ended</strong>`,
        plainText: `Stream ended`,
        emoji: '⚫',
        variables
      };

    // ===== Channel Events =====
    case 'channel.update': {
      const title = truncateText(data.title || '', 40);
      const category = data.category_name || '';
      return {
        html: `📝 <strong>Stream updated:</strong> "${title}" → ${category}`,
        plainText: `Stream updated: "${title}" → ${category}`,
        emoji: '📝',
        variables: { ...variables, title: data.title, category }
      };
    }

    case 'channel.subscribe': {
      const tier = formatTier(data.tier);
      const isGift = data.is_gift;
      if (isGift) {
        return {
          html: `🎁 <strong>${displayName}</strong> received a gift sub (${tier})`,
          plainText: `${displayName} received a gift sub (${tier})`,
          emoji: '🎁',
          variables: { ...variables, tier, is_gift: true }
        };
      }
      return {
        html: `🎉 <strong>${displayName}</strong> subscribed (${tier})`,
        plainText: `${displayName} subscribed (${tier})`,
        emoji: '🎉',
        variables: { ...variables, tier, is_gift: false }
      };
    }

    case 'channel.subscription.end': {
      const tier = formatTier(data.tier);
      return {
        html: `📉 <strong>${displayName}'s</strong> ${tier} subscription ended`,
        plainText: `${displayName}'s ${tier} subscription ended`,
        emoji: '📉',
        variables: { ...variables, tier }
      };
    }

    case 'channel.subscription.gift': {
      const tier = formatTier(data.tier);
      const giftCount = data.total || 1;
      const cumulative = data.cumulative_total;
      const gifterName = data.is_anonymous ? 'Anonymous' : displayName;
      return {
        html: `🎁 <strong>${gifterName}</strong> gifted ${giftCount} ${tier} sub${giftCount > 1 ? 's' : ''}${cumulative ? ` (${formatNumber(cumulative)} total)` : ''}`,
        plainText: `${gifterName} gifted ${giftCount} ${tier} sub${giftCount > 1 ? 's' : ''}${cumulative ? ` (${formatNumber(cumulative)} total)` : ''}`,
        emoji: '🎁',
        variables: { ...variables, tier, gift_count: giftCount, cumulative, gifter: gifterName }
      };
    }

    case 'channel.subscription.message': {
      const tier = formatTier(data.tier);
      const months = data.cumulative_months || 0;
      const streak = data.streak_months;
      const message = truncateText(data.message?.text || '', 50);
      return {
        html: `💬 <strong>${displayName}</strong> resubbed for ${months} month${months !== 1 ? 's' : ''}${streak ? ` (${streak} streak)` : ''} (${tier})${message ? `: "${message}"` : ''}`,
        plainText: `${displayName} resubbed for ${months} month${months !== 1 ? 's' : ''}${streak ? ` (${streak} streak)` : ''} (${tier})${message ? `: "${message}"` : ''}`,
        emoji: '💬',
        variables: { ...variables, tier, months, streak, message: data.message?.text }
      };
    }

    case 'channel.cheer': {
      const bits = data.bits || 0;
      const message = truncateText(data.message || '', 30);
      return {
        html: `<strong>${displayName}</strong> cheered <strong>${formatNumber(bits)} bits</strong>${message ? `: "${message}"` : ''}`,
        plainText: `${displayName} cheered ${formatNumber(bits)} bits${message ? `: "${message}"` : ''}`,
        emoji: '💎',
        variables: { ...variables, bits, message: data.message }
      };
    }

    case 'channel.raid': {
      const viewers = data.viewers || 0;
      return {
        html: `🎯 <strong>${displayName}</strong> raided with <strong>${formatNumber(viewers)} viewer${viewers !== 1 ? 's' : ''}</strong>`,
        plainText: `${displayName} raided with ${formatNumber(viewers)} viewer${viewers !== 1 ? 's' : ''}`,
        emoji: '🎯',
        variables: { ...variables, viewers }
      };
    }

    // ===== Channel Points Events =====
    case 'channel.channel_points_custom_reward.add': {
      const title = truncateText(data.title || '', 30);
      const cost = data.cost || 0;
      return {
        html: `➕ Created reward: <strong>"${title}"</strong> (${formatNumber(cost)} points)`,
        plainText: `Created reward: "${title}" (${formatNumber(cost)} points)`,
        emoji: '➕',
        variables: { ...variables, reward_title: data.title, cost }
      };
    }

    case 'channel.channel_points_custom_reward.update': {
      const title = truncateText(data.title || '', 30);
      const cost = data.cost || 0;
      return {
        html: `✏️ Updated reward: <strong>"${title}"</strong> (${formatNumber(cost)} points)`,
        plainText: `Updated reward: "${title}" (${formatNumber(cost)} points)`,
        emoji: '✏️',
        variables: { ...variables, reward_title: data.title, cost }
      };
    }

    case 'channel.channel_points_custom_reward.remove': {
      const title = truncateText(data.title || '', 30);
      return {
        html: `🗑️ Deleted reward: <strong>"${title}"</strong>`,
        plainText: `Deleted reward: "${title}"`,
        emoji: '🗑️',
        variables: { ...variables, reward_title: data.title }
      };
    }

    case 'channel.channel_points_custom_reward_redemption.add': {
      const title = truncateText(data.reward?.title || '', 30);
      const userInput = truncateText(data.user_input || '', 40);
      return {
        html: `🎁 <strong>${displayName}</strong> redeemed <strong>"${title}"</strong>${userInput ? `: "${userInput}"` : ''}`,
        plainText: `${displayName} redeemed "${title}"${userInput ? `: "${userInput}"` : ''}`,
        emoji: '🎁',
        variables: { ...variables, reward_title: data.reward?.title, user_input: data.user_input }
      };
    }

    case 'channel.channel_points_custom_reward_redemption.update': {
      const title = truncateText(data.reward?.title || '', 30);
      const status = data.status;
      if (status === 'fulfilled') {
        return {
          html: `✅ <strong>"${title}"</strong> redemption fulfilled`,
          plainText: `"${title}" redemption fulfilled`,
          emoji: '✅',
          variables: { ...variables, reward_title: data.reward?.title, status }
        };
      } else if (status === 'canceled') {
        return {
          html: `❌ <strong>"${title}"</strong> redemption canceled`,
          plainText: `"${title}" redemption canceled`,
          emoji: '❌',
          variables: { ...variables, reward_title: data.reward?.title, status }
        };
      }
      return {
        html: `<strong>"${title}"</strong> redemption updated (${status})`,
        plainText: `"${title}" redemption updated (${status})`,
        emoji: '📝',
        variables: { ...variables, reward_title: data.reward?.title, status }
      };
    }

    // ===== Hype Train Events =====
    case 'channel.hype_train.begin': {
      const level = data.level || 1;
      return {
        html: `🚂 <strong>Hype Train started</strong> at Level ${level}!`,
        plainText: `Hype Train started at Level ${level}!`,
        emoji: '🚂',
        variables: { ...variables, level }
      };
    }

    case 'channel.hype_train.progress': {
      const level = data.level || 1;
      const progress = data.progress || 0;
      const goal = data.goal || 0;
      return {
        html: `🚂 <strong>Hype Train Level ${level}!</strong> (${formatNumber(progress)}/${formatNumber(goal)} points to next level)`,
        plainText: `Hype Train Level ${level}! (${formatNumber(progress)}/${formatNumber(goal)} points to next level)`,
        emoji: '🚂',
        variables: { ...variables, level, progress, goal }
      };
    }

    case 'channel.hype_train.end': {
      const level = data.level || 1;
      const total = data.total || 0;
      return {
        html: `🚂 <strong>Hype Train ended at Level ${level}!</strong> (${formatNumber(total)} points)`,
        plainText: `Hype Train ended at Level ${level}! (${formatNumber(total)} points)`,
        emoji: '🚂',
        variables: { ...variables, level, total }
      };
    }

    // ===== Poll Events =====
    case 'channel.poll.begin': {
      const question = truncateText(data.title || '', 40);
      const choiceCount = data.choices?.length || 0;
      return {
        html: `📊 <strong>Poll started:</strong> "${question}" (${choiceCount} choices)`,
        plainText: `Poll started: "${question}" (${choiceCount} choices)`,
        emoji: '📊',
        variables: { ...variables, poll_title: data.title, choice_count: choiceCount }
      };
    }

    case 'channel.poll.progress': {
      const question = truncateText(data.title || '', 30);
      const leadingChoice = getLeadingChoice(data.choices);
      const leadingTitle = leadingChoice ? truncateText(leadingChoice.title, 20) : 'Unknown';
      const leadingVotes = leadingChoice ? (leadingChoice.votes || 0) : 0;
      return {
        html: `📊 <strong>Poll:</strong> "${question}" - Leading: <strong>${leadingTitle}</strong> (${formatNumber(leadingVotes)} votes)`,
        plainText: `Poll: "${question}" - Leading: ${leadingTitle} (${formatNumber(leadingVotes)} votes)`,
        emoji: '📊',
        variables: { ...variables, poll_title: data.title, leading_choice: leadingTitle, leading_votes: leadingVotes }
      };
    }

    case 'channel.poll.end': {
      const question = truncateText(data.title || '', 30);
      const status = data.status;
      if (status === 'completed') {
        const winningChoice = getLeadingChoice(data.choices);
        const winnerTitle = winningChoice ? truncateText(winningChoice.title, 20) : 'Unknown';
        const winnerVotes = winningChoice ? (winningChoice.votes || 0) : 0;
        return {
          html: `📊 <strong>Poll ended:</strong> "${question}" - Winner: <strong>${winnerTitle}</strong> (${formatNumber(winnerVotes)} votes)`,
          plainText: `Poll ended: "${question}" - Winner: ${winnerTitle} (${formatNumber(winnerVotes)} votes)`,
          emoji: '📊',
          variables: { ...variables, poll_title: data.title, winner: winnerTitle, winner_votes: winnerVotes, status }
        };
      }
      return {
        html: `📊 <strong>Poll ${status}:</strong> "${question}"`,
        plainText: `Poll ${status}: "${question}"`,
        emoji: '📊',
        variables: { ...variables, poll_title: data.title, status }
      };
    }

    // ===== Prediction Events =====
    case 'channel.prediction.begin': {
      const question = truncateText(data.title || '', 40);
      const outcomes = data.outcomes || [];
      const outcomeNames = outcomes.map((o: any) => o.title).join(' vs ');
      return {
        html: `🔮 <strong>Prediction started:</strong> "${question}" (${truncateText(outcomeNames, 30)})`,
        plainText: `Prediction started: "${question}" (${truncateText(outcomeNames, 30)})`,
        emoji: '🔮',
        variables: { ...variables, prediction_title: data.title, outcomes: outcomeNames }
      };
    }

    case 'channel.prediction.progress': {
      const question = truncateText(data.title || '', 30);
      const outcomes = data.outcomes || [];
      const outcomeStats = outcomes.map((o: any) => 
        `${o.title}: ${formatNumber(o.channel_points || 0)} pts (${o.users || 0} users)`
      ).join(', ');
      return {
        html: `🔮 <strong>Prediction:</strong> "${question}" - ${truncateText(outcomeStats, 50)}`,
        plainText: `Prediction: "${question}" - ${truncateText(outcomeStats, 50)}`,
        emoji: '🔮',
        variables: { ...variables, prediction_title: data.title, outcome_stats: outcomeStats }
      };
    }

    case 'channel.prediction.lock': {
      const question = truncateText(data.title || '', 30);
      const outcomes = data.outcomes || [];
      const stats = outcomes.map((o: any) => 
        `${o.title}: ${formatNumber(o.channel_points || 0)} pts`
      ).join(', ');
      return {
        html: `🔒 <strong>Prediction locked:</strong> "${question}" - ${truncateText(stats, 40)}`,
        plainText: `Prediction locked: "${question}" - ${truncateText(stats, 40)}`,
        emoji: '🔒',
        variables: { ...variables, prediction_title: data.title, outcome_stats: stats }
      };
    }

    case 'channel.prediction.end': {
      const question = truncateText(data.title || '', 30);
      const status = data.status;
      if (status === 'resolved') {
        const winningOutcomeId = data.winning_outcome_id;
        const winningOutcome = data.outcomes?.find((o: any) => o.id === winningOutcomeId);
        const winnerName = winningOutcome ? winningOutcome.title : 'Unknown';
        const winnerPoints = winningOutcome ? (winningOutcome.channel_points || 0) : 0;
        return {
          html: `🏆 <strong>Prediction ended:</strong> "${question}" - Winner: <strong>${winnerName}</strong> (${formatNumber(winnerPoints)} pts paid out)`,
          plainText: `Prediction ended: "${question}" - Winner: ${winnerName} (${formatNumber(winnerPoints)} pts paid out)`,
          emoji: '🏆',
          variables: { ...variables, prediction_title: data.title, winner: winnerName, winner_points: winnerPoints, status }
        };
      } else if (status === 'canceled') {
        return {
          html: `❌ <strong>Prediction canceled:</strong> "${question}" (refunded)`,
          plainText: `Prediction canceled: "${question}" (refunded)`,
          emoji: '❌',
          variables: { ...variables, prediction_title: data.title, status }
        };
      }
      return {
        html: `🔮 <strong>Prediction ${status}:</strong> "${question}"`,
        plainText: `Prediction ${status}: "${question}"`,
        emoji: '🔮',
        variables: { ...variables, prediction_title: data.title, status }
      };
    }

    // ===== Goal Events =====
    case 'channel.goal.begin': {
      const goalType = data.type || 'follower';
      const goalDesc = truncateText(data.description || '', 30);
      const current = data.current_amount || 0;
      const target = data.target_amount || 0;
      const goalTypeMap: Record<string, string> = {
        'follower': 'follower',
        'subscription': 'subscription',
        'subscription_count': 'subscriber',
        'new_subscription': 'new sub',
        'new_subscription_count': 'new subscriber'
      };
      const typeName = goalTypeMap[goalType] || goalType;
      return {
        html: `🎯 <strong>New ${typeName} goal:</strong> ${formatNumber(target)} (currently ${formatNumber(current)})${goalDesc ? ` - "${goalDesc}"` : ''}`,
        plainText: `New ${typeName} goal: ${formatNumber(target)} (currently ${formatNumber(current)})${goalDesc ? ` - "${goalDesc}"` : ''}`,
        emoji: '🎯',
        variables: { ...variables, goal_type: typeName, current, target, description: data.description }
      };
    }

    case 'channel.goal.progress': {
      const current = data.current_amount || 0;
      const target = data.target_amount || 0;
      const percent = target > 0 ? Math.round((current / target) * 100) : 0;
      return {
        html: `🎯 <strong>Goal progress:</strong> ${formatNumber(current)}/${formatNumber(target)} (${percent}%)`,
        plainText: `Goal progress: ${formatNumber(current)}/${formatNumber(target)} (${percent}%)`,
        emoji: '🎯',
        variables: { ...variables, current, target, percent }
      };
    }

    case 'channel.goal.end': {
      const current = data.current_amount || 0;
      const target = data.target_amount || 0;
      const isAchieved = data.is_achieved;
      if (isAchieved) {
        return {
          html: `🎉 <strong>Goal achieved!</strong> ${formatNumber(current)}/${formatNumber(target)}`,
          plainText: `Goal achieved! ${formatNumber(current)}/${formatNumber(target)}`,
          emoji: '🎉',
          variables: { ...variables, current, target, achieved: true }
        };
      }
      return {
        html: `❌ <strong>Goal ended:</strong> ${formatNumber(current)}/${formatNumber(target)} (not achieved)`,
        plainText: `Goal ended: ${formatNumber(current)}/${formatNumber(target)} (not achieved)`,
        emoji: '❌',
        variables: { ...variables, current, target, achieved: false }
      };
    }

    // ===== Shield Mode Events =====
    case 'channel.shield_mode.begin': {
      const modName = data.moderator_user_name || data.moderator_user_login || 'Moderator';
      return {
        html: `🛡️ <strong>Shield Mode activated</strong> by ${modName}`,
        plainText: `Shield Mode activated by ${modName}`,
        emoji: '🛡️',
        variables: { ...variables, moderator: modName }
      };
    }

    case 'channel.shield_mode.end': {
      const modName = data.moderator_user_name || data.moderator_user_login || 'Moderator';
      return {
        html: `🛡️ <strong>Shield Mode deactivated</strong> by ${modName}`,
        plainText: `Shield Mode deactivated by ${modName}`,
        emoji: '🛡️',
        variables: { ...variables, moderator: modName }
      };
    }

    // ===== Shoutout Events =====
    case 'channel.shoutout.create': {
      const shoutoutTo = data.to_broadcaster_user_name || data.to_broadcaster_user_login || 'Broadcaster';
      const viewers = data.viewer_count || 0;
      return {
        html: `📢 <strong>Shouted out ${shoutoutTo}</strong> to ${formatNumber(viewers)} viewer${viewers !== 1 ? 's' : ''}`,
        plainText: `Shouted out ${shoutoutTo} to ${formatNumber(viewers)} viewer${viewers !== 1 ? 's' : ''}`,
        emoji: '📢',
        variables: { ...variables, shoutout_to: shoutoutTo, viewers }
      };
    }

    case 'channel.shoutout.receive': {
      const shoutoutFrom = data.from_broadcaster_user_name || data.from_broadcaster_user_login || 'Broadcaster';
      const viewers = data.viewer_count || 0;
      return {
        html: `📢 <strong>Received shoutout from ${shoutoutFrom}</strong> (${formatNumber(viewers)} viewers)`,
        plainText: `Received shoutout from ${shoutoutFrom} (${formatNumber(viewers)} viewers)`,
        emoji: '📢',
        variables: { ...variables, shoutout_from: shoutoutFrom, viewers }
      };
    }

    // ===== Follower Events (Polling) =====
    case 'channel.follow': {
      const followedAt = data.followed_at ? new Date(data.followed_at).toLocaleString() : '';
      return {
        html: `💜 <strong>${displayName}</strong> followed the channel${followedAt ? ` (${followedAt})` : ''}`,
        plainText: `${displayName} followed the channel${followedAt ? ` (${followedAt})` : ''}`,
        emoji: '💜',
        variables: { ...variables, followed_at: followedAt }
      };
    }

    case 'channel.unfollow':
      return {
        html: `💔 <strong>${displayName}</strong> unfollowed the channel`,
        plainText: `${displayName} unfollowed the channel`,
        emoji: '💔',
        variables
      };

    // ===== Role Events =====
    case 'channel.vip.add':
      return {
        html: `⭐ <strong>${displayName}</strong> was granted VIP status`,
        plainText: `${displayName} was granted VIP status`,
        emoji: '⭐',
        variables
      };

    case 'channel.vip.remove':
      return {
        html: `⭐ <strong>${displayName}</strong> had VIP status removed`,
        plainText: `${displayName} had VIP status removed`,
        emoji: '⭐',
        variables
      };

    case 'channel.moderator.add':
      return {
        html: `🛡️ <strong>${displayName}</strong> was granted moderator status`,
        plainText: `${displayName} was granted moderator status`,
        emoji: '🛡️',
        variables
      };

    case 'channel.moderator.remove':
      return {
        html: `🛡️ <strong>${displayName}</strong> had moderator status removed`,
        plainText: `${displayName} had moderator status removed`,
        emoji: '🛡️',
        variables
      };

    // ===== Moderation Events =====
    case 'channel.ban': {
      const reason = data.reason ? ` (Reason: ${data.reason})` : '';
      const moderator = data.moderator_username ? ` by ${data.moderator_username}` : '';
      return {
        html: `🚫 <strong>${displayName}</strong> was banned${moderator}${reason}`,
        plainText: `${displayName} was banned${moderator}${reason}`,
        emoji: '🚫',
        variables: { ...variables, reason: data.reason, moderator: data.moderator_username }
      };
    }

    case 'channel.unban':
      return {
        html: `✅ <strong>${displayName}</strong> was unbanned`,
        plainText: `${displayName} was unbanned`,
        emoji: '✅',
        variables
      };

    case 'channel.timeout': {
      const durationSec = data.duration_seconds || 0;
      const duration = durationSec < 60 
        ? `${durationSec}s`
        : durationSec < 3600
        ? `${Math.floor(durationSec / 60)}m`
        : `${Math.floor(durationSec / 3600)}h`;
      const reason = data.reason ? ` (Reason: ${data.reason})` : '';
      const moderator = data.moderator_username ? ` by ${data.moderator_username}` : '';
      return {
        html: `⏰ <strong>${displayName}</strong> was timed out for ${duration}${moderator}${reason}`,
        plainText: `${displayName} was timed out for ${duration}${moderator}${reason}`,
        emoji: '⏰',
        variables: { ...variables, duration, duration_seconds: durationSec, reason: data.reason, moderator: data.moderator_username }
      };
    }

    case 'channel.timeout_lifted':
      return {
        html: `⏰ <strong>${displayName}</strong>'s timeout was lifted`,
        plainText: `${displayName}'s timeout was lifted`,
        emoji: '⏰',
        variables
      };

    // ===== Default =====
    default:
      return {
        html: `${displayName && displayName !== 'Unknown' ? `<strong>${displayName}</strong> - ` : ''}${event.event_type}`,
        plainText: `${displayName && displayName !== 'Unknown' ? `${displayName} - ` : ''}${event.event_type}`,
        emoji: '📢',
        variables
      };
  }
}

/**
 * Process a template string with variables
 * Example: "{{username}} just subscribed!" -> "JohnDoe just subscribed!"
 */
export function processTemplate(template: string, variables: Record<string, any>): string {
  let result = template;
  
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, String(value ?? ''));
  }
  
  return result;
}

/**
 * Get available template variables for an event type
 */
export function getAvailableVariables(eventType: string): string[] {
  const commonVars = ['username', 'display_name', 'user_name', 'event_type', 'timestamp'];
  
  const eventSpecificVars: Record<string, string[]> = {
    'channel.chat.message': ['message'],
    'channel.subscribe': ['tier', 'is_gift'],
    'channel.subscription.end': ['tier'],
    'channel.subscription.gift': ['tier', 'gift_count', 'cumulative', 'gifter'],
    'channel.subscription.message': ['tier', 'months', 'streak', 'message'],
    'channel.cheer': ['bits', 'message'],
    'channel.raid': ['viewers'],
    'channel.follow': ['followed_at', 'user_login', 'user_id'],
    'stream.online': ['stream_type', 'started_at'],
    'channel.update': ['title', 'category'],
    'channel.channel_points_custom_reward.add': ['reward_title', 'cost'],
    'channel.channel_points_custom_reward.update': ['reward_title', 'cost'],
    'channel.channel_points_custom_reward.remove': ['reward_title'],
    'channel.channel_points_custom_reward_redemption.add': ['reward_title', 'user_input'],
    'channel.channel_points_custom_reward_redemption.update': ['reward_title', 'status'],
    'channel.hype_train.begin': ['level'],
    'channel.hype_train.progress': ['level', 'progress', 'goal'],
    'channel.hype_train.end': ['level', 'total'],
    'channel.poll.begin': ['poll_title', 'choice_count'],
    'channel.poll.progress': ['poll_title', 'leading_choice', 'leading_votes'],
    'channel.poll.end': ['poll_title', 'winner', 'winner_votes', 'status'],
    'channel.prediction.begin': ['prediction_title', 'outcomes'],
    'channel.prediction.progress': ['prediction_title', 'outcome_stats'],
    'channel.prediction.lock': ['prediction_title', 'outcome_stats'],
    'channel.prediction.end': ['prediction_title', 'winner', 'winner_points', 'status'],
    'channel.goal.begin': ['goal_type', 'current', 'target', 'description'],
    'channel.goal.progress': ['current', 'target', 'percent'],
    'channel.goal.end': ['current', 'target', 'achieved'],
    'channel.shield_mode.begin': ['moderator'],
    'channel.shield_mode.end': ['moderator'],
    'channel.shoutout.create': ['shoutout_to', 'viewers'],
    'channel.shoutout.receive': ['shoutout_from', 'viewers'],
    'channel.ban': ['reason', 'moderator'],
    'channel.timeout': ['duration', 'duration_seconds', 'reason', 'moderator'],
    'channel.chat.clear_user_messages': ['target_user'],
    'channel.chat.message_delete': ['deleted_user'],
    'channel.chat_settings.update': ['settings'],
  };
  
  return [...commonVars, ...(eventSpecificVars[eventType] || [])];
}
