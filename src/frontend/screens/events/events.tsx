import React, { useState, useEffect } from 'react';
import * as db from '../../services/database';
import { EVENT_DISPLAY_INFO } from '../../config/event-types';

const { ipcRenderer } = window.require('electron');

interface EventsScreenProps {
  channelId?: string;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({ channelId }) => {
  const [events, setEvents] = useState<db.StoredEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination
  const [limit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selected event for detail view
  const [selectedEvent, setSelectedEvent] = useState<db.StoredEvent | null>(null);

  // Load events
  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: db.EventFilters = {
        limit,
        offset
      };

      if (channelId) {
        filters.channelId = channelId;
      }

      if (eventTypeFilter) {
        filters.eventType = eventTypeFilter;
      }

      if (searchText) {
        filters.searchText = searchText;
      }

      if (startDate) {
        filters.startDate = new Date(startDate).toISOString();
      }

      if (endDate) {
        filters.endDate = new Date(endDate).toISOString();
      }

      const result = await db.getEvents(filters);
      
      if (result.success && result.events) {
        setEvents(result.events);
      } else {
        setError(result.error || 'Failed to load events');
      }

      // Get total count
      const countResult = await db.getEventCount(channelId, eventTypeFilter);
      if (countResult.success && countResult.count !== undefined) {
        setTotalCount(countResult.count);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Load events on mount and when filters change
  useEffect(() => {
    loadEvents();
  }, [channelId, eventTypeFilter, searchText, startDate, endDate, offset]);

  // Listen for real-time event updates
  useEffect(() => {
    const handleNewEvent = (_event: any, eventData: any) => {
      console.log('[Events Screen] New event received:', eventData);
      
      // Only add events from our current channel if channelId is set
      if (channelId && eventData.channel_id !== channelId) {
        return;
      }
      
      // If we have filters active, just refresh to re-query with filters
      // Otherwise, if on first page with no filters, prepend the new event
      if (eventTypeFilter || searchText || startDate || endDate || offset > 0) {
        // Refresh to respect filters
        loadEvents();
      } else {
        // Add to beginning of list if on first page
        const newEvent: db.StoredEvent = {
          id: eventData.id,
          event_type: eventData.event_type,
          event_data: typeof eventData.event_data === 'string' 
            ? eventData.event_data 
            : JSON.stringify(eventData.event_data),
          viewer_id: eventData.viewer_id || null,
          channel_id: eventData.channel_id,
          created_at: eventData.created_at || new Date().toISOString(),
          viewer_username: eventData.viewer_username,
          viewer_display_name: eventData.viewer_display_name
        };
        
        setEvents(prev => {
          // Check if event already exists (deduplicate by id)
          if (prev.some(evt => evt.id === newEvent.id)) {
            console.log('[Events Screen] Duplicate event detected, skipping:', newEvent.id);
            return prev;
          }
          
          const updated = [newEvent, ...prev];
          // Limit to our page size
          if (updated.length > limit) {
            return updated.slice(0, limit);
          }
          return updated;
        });
        
        // Update total count
        setTotalCount(prev => prev + 1);
      }
    };

    ipcRenderer.on('event:stored', handleNewEvent);

    return () => {
      ipcRenderer.removeListener('event:stored', handleNewEvent);
    };
  }, [channelId, eventTypeFilter, searchText, startDate, endDate, offset, limit]);

  const handleClearFilters = () => {
    setEventTypeFilter('');
    setSearchText('');
    setStartDate('');
    setEndDate('');
    setOffset(0);
  };

  const handlePreviousPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < totalCount) {
      setOffset(offset + limit);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Show local time (24-hour format)
    const localTime = date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return localTime;
  };

  const parseEventData = (eventDataString: string) => {
    try {
      return JSON.parse(eventDataString);
    } catch {
      return {};
    }
  };

  const getEventDisplayName = (eventType: string) => {
    const info = EVENT_DISPLAY_INFO[eventType as keyof typeof EVENT_DISPLAY_INFO];
    return info ? info.name : eventType;
  };
  // Helper functions for formatting
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

  const renderEventPreview = (event: db.StoredEvent) => {
    const data = parseEventData(event.event_data);
    
    // For IRC events, get username from event_data if not in viewer fields
    let displayName = event.viewer_display_name || event.viewer_username;
    if (!displayName && (event.event_type === 'irc.chat.join' || event.event_type === 'irc.chat.part')) {
      displayName = data.username;
    }
    if (!displayName) {
      displayName = 'Unknown';
    }

    switch (event.event_type) {      // ===== Chat Events =====
      case 'channel.chat.message':
        return (
          <span>
            <strong>{displayName}:</strong> {truncateText(data.message?.text || '', 100)}
          </span>
        );
      
      case 'channel.chat.clear':
        return (
          <span>
            🧹 <strong>All chat messages cleared</strong> by moderators
          </span>
        );
      
      case 'channel.chat.clear_user_messages':
        const targetUser = data.target_user_name || data.target_user_login || 'User';
        return (
          <span>
            🧹 All messages from <strong>{targetUser}</strong> cleared (timeout/ban)
          </span>
        );
      
      case 'channel.chat.message_delete':
        const deletedUser = data.target_user_name || data.target_user_login || 'User';
        return (
          <span>
            🗑️ Message from <strong>{deletedUser}</strong> deleted by moderators
          </span>
        );
      
      case 'channel.chat_settings.update':
        const settings: string[] = [];
        if (data.slow_mode) settings.push(`Slow mode (${data.slow_mode_wait_time_seconds}s)`);
        if (data.follower_mode) settings.push(`Follower mode (${data.follower_mode_duration_minutes}min)`);
        if (data.subscriber_mode) settings.push('Subscriber-only');
        if (data.emote_mode) settings.push('Emote-only');
        if (data.unique_chat_mode) settings.push('Unique chat');
        const settingsText = settings.length > 0 ? settings.join(', ') : 'All restrictions disabled';
        return (
          <span>
            ⚙️ <strong>Chat settings:</strong> {settingsText}
          </span>
        );

      // ===== IRC Events =====
      case 'irc.chat.join':
        return (
          <span>
            <strong style={{ color: '#4CAF50' }}>→ {displayName}</strong> joined the chat
          </span>
        );
      
      case 'irc.chat.part':
        return (
          <span>
            <strong style={{ color: '#f44336' }}>← {displayName}</strong> left the chat
          </span>
        );

      // ===== Stream Events =====
      case 'stream.online':
        return (
          <span>
            <strong style={{ color: '#9146FF' }}>🔴 Stream went live</strong>
            {data.type && ` (${data.type})`}
            {data.started_at && ` at ${new Date(data.started_at).toLocaleTimeString()}`}
          </span>
        );
      
      case 'stream.offline':
        return (
          <span>
            <strong style={{ color: '#808080' }}>⚫ Stream ended</strong>
          </span>
        );

      // ===== Channel Events =====
      case 'channel.update':
        const title = truncateText(data.title || '', 40);
        const category = data.category_name || '';
        return (
          <span>
            📝 <strong>Stream updated:</strong> "{title}" → {category}
          </span>
        );
      
      case 'channel.subscribe':
        const subTier = formatTier(data.tier);
        if (data.is_gift) {
          return (
            <span>
              🎁 <strong>{displayName}</strong> received a gift sub ({subTier})
            </span>
          );
        }
        return (
          <span>
            🎉 <strong>{displayName}</strong> subscribed ({subTier})
          </span>
        );
      
      case 'channel.subscription.end':
        const endTier = formatTier(data.tier);
        return (
          <span>
            📉 <strong>{displayName}'s</strong> {endTier} subscription ended
          </span>
        );
      
      case 'channel.subscription.gift':
        const giftTier = formatTier(data.tier);
        const giftCount = data.total || 1;
        const cumulativeGifts = data.cumulative_total;
        const gifterName = data.is_anonymous ? 'Anonymous' : displayName;
        return (
          <span>
            🎁 <strong>{gifterName}</strong> gifted {giftCount} {giftTier} sub{giftCount > 1 ? 's' : ''}
            {cumulativeGifts && ` (${formatNumber(cumulativeGifts)} total)`}
          </span>
        );
      
      case 'channel.subscription.message':
        const resubTier = formatTier(data.tier);
        const months = data.cumulative_months || 0;
        const streak = data.streak_months;
        const message = truncateText(data.message?.text || '', 50);
        return (
          <span>
            💬 <strong>{displayName}</strong> resubbed for {months} month{months !== 1 ? 's' : ''}
            {streak && ` (${streak} streak)`} ({resubTier})
            {message && `: "${message}"`}
          </span>
        );
      
      case 'channel.cheer':
        const bits = data.bits || 0;
        const cheerMsg = truncateText(data.message || '', 30);
        return (
          <span>
            <strong>{displayName}</strong> cheered <strong>{formatNumber(bits)} bits</strong>
            {cheerMsg && `: "${cheerMsg}"`}
          </span>
        );
      
      case 'channel.raid':
        const viewers = data.viewers || 0;
        return (
          <span>
            🎯 <strong>{displayName}</strong> raided with <strong>{formatNumber(viewers)} viewer{viewers !== 1 ? 's' : ''}</strong>
          </span>
        );

      // ===== Channel Points Events =====
      case 'channel.channel_points_custom_reward.add':
        const addRewardTitle = truncateText(data.title || '', 30);
        const addCost = data.cost || 0;
        return (
          <span>
            ➕ Created reward: <strong>"{addRewardTitle}"</strong> ({formatNumber(addCost)} points)
          </span>
        );
      
      case 'channel.channel_points_custom_reward.update':
        const updateRewardTitle = truncateText(data.title || '', 30);
        const updateCost = data.cost || 0;
        return (
          <span>
            ✏️ Updated reward: <strong>"{updateRewardTitle}"</strong> ({formatNumber(updateCost)} points)
          </span>
        );
      
      case 'channel.channel_points_custom_reward.remove':
        const removeRewardTitle = truncateText(data.title || '', 30);
        return (
          <span>
            🗑️ Deleted reward: <strong>"{removeRewardTitle}"</strong>
          </span>
        );
      
      case 'channel.channel_points_custom_reward_redemption.add':
        const redeemTitle = truncateText(data.reward?.title || '', 30);
        const userInput = truncateText(data.user_input || '', 40);
        return (
          <span>
            🎁 <strong>{displayName}</strong> redeemed <strong>"{redeemTitle}"</strong>
            {userInput && `: "${userInput}"`}
          </span>
        );
      
      case 'channel.channel_points_custom_reward_redemption.update':
        const updateRedeemTitle = truncateText(data.reward?.title || '', 30);
        const status = data.status;
        if (status === 'fulfilled') {
          return (
            <span>
              ✅ <strong>"{updateRedeemTitle}"</strong> redemption fulfilled
            </span>
          );
        } else if (status === 'canceled') {
          return (
            <span>
              ❌ <strong>"{updateRedeemTitle}"</strong> redemption canceled
            </span>
          );
        }
        return (
          <span>
            <strong>"{updateRedeemTitle}"</strong> redemption updated ({status})
          </span>
        );

      // ===== Hype Train Events =====
      case 'channel.hype_train.begin':
        const beginLevel = data.level || 1;
        return (
          <span>
            🚂 <strong>Hype Train started</strong> at Level {beginLevel}!
          </span>
        );
      
      case 'channel.hype_train.progress':
        const progressLevel = data.level || 1;
        const progress = data.progress || 0;
        const goal = data.goal || 0;
        return (
          <span>
            🚂 <strong>Hype Train Level {progressLevel}!</strong> ({formatNumber(progress)}/{formatNumber(goal)} points to next level)
          </span>
        );
      
      case 'channel.hype_train.end':
        const finalLevel = data.level || 1;
        const totalPoints = data.total || 0;
        return (
          <span>
            🚂 <strong>Hype Train ended at Level {finalLevel}!</strong> ({formatNumber(totalPoints)} points)
          </span>
        );

      // ===== Poll Events =====
      case 'channel.poll.begin':
        const pollQuestion = truncateText(data.title || '', 40);
        const choiceCount = data.choices?.length || 0;
        return (
          <span>
            📊 <strong>Poll started:</strong> "{pollQuestion}" ({choiceCount} choices)
          </span>
        );
      
      case 'channel.poll.progress':
        const progressPollQuestion = truncateText(data.title || '', 30);
        const leadingChoice = getLeadingChoice(data.choices);
        const leadingTitle = leadingChoice ? truncateText(leadingChoice.title, 20) : 'Unknown';
        const leadingVotes = leadingChoice ? (leadingChoice.votes || 0) : 0;
        return (
          <span>
            📊 <strong>Poll:</strong> "{progressPollQuestion}" - Leading: <strong>{leadingTitle}</strong> ({formatNumber(leadingVotes)} votes)
          </span>
        );
      
      case 'channel.poll.end':
        const endPollQuestion = truncateText(data.title || '', 30);
        const pollStatus = data.status;
        if (pollStatus === 'completed') {
          const winningChoice = getLeadingChoice(data.choices);
          const winnerTitle = winningChoice ? truncateText(winningChoice.title, 20) : 'Unknown';
          const winnerVotes = winningChoice ? (winningChoice.votes || 0) : 0;
          return (
            <span>
              📊 <strong>Poll ended:</strong> "{endPollQuestion}" - Winner: <strong>{winnerTitle}</strong> ({formatNumber(winnerVotes)} votes)
            </span>
          );
        }
        return (
          <span>
            📊 <strong>Poll {pollStatus}:</strong> "{endPollQuestion}"
          </span>
        );

      // ===== Prediction Events =====
      case 'channel.prediction.begin':
        const predQuestion = truncateText(data.title || '', 40);
        const outcomes = data.outcomes || [];
        const outcomeNames = outcomes.map((o: any) => o.title).join(' vs ');
        return (
          <span>
            🔮 <strong>Prediction started:</strong> "{predQuestion}" ({truncateText(outcomeNames, 30)})
          </span>
        );
      
      case 'channel.prediction.progress':
        const progressPredQuestion = truncateText(data.title || '', 30);
        const progressOutcomes = data.outcomes || [];
        const outcomeStats = progressOutcomes.map((o: any) => 
          `${o.title}: ${formatNumber(o.channel_points || 0)} pts (${o.users || 0} users)`
        ).join(', ');
        return (
          <span>
            🔮 <strong>Prediction:</strong> "{progressPredQuestion}" - {truncateText(outcomeStats, 50)}
          </span>
        );
      
      case 'channel.prediction.lock':
        const lockPredQuestion = truncateText(data.title || '', 30);
        const lockOutcomes = data.outcomes || [];
        const lockStats = lockOutcomes.map((o: any) => 
          `${o.title}: ${formatNumber(o.channel_points || 0)} pts`
        ).join(', ');
        return (
          <span>
            🔒 <strong>Prediction locked:</strong> "{lockPredQuestion}" - {truncateText(lockStats, 40)}
          </span>
        );
      
      case 'channel.prediction.end':
        const endPredQuestion = truncateText(data.title || '', 30);
        const predStatus = data.status;
        if (predStatus === 'resolved') {
          const winningOutcomeId = data.winning_outcome_id;
          const winningOutcome = data.outcomes?.find((o: any) => o.id === winningOutcomeId);
          const winnerName = winningOutcome ? winningOutcome.title : 'Unknown';
          const winnerPoints = winningOutcome ? (winningOutcome.channel_points || 0) : 0;
          return (
            <span>
              🏆 <strong>Prediction ended:</strong> "{endPredQuestion}" - Winner: <strong>{winnerName}</strong> ({formatNumber(winnerPoints)} pts paid out)
            </span>
          );
        } else if (predStatus === 'canceled') {
          return (
            <span>
              ❌ <strong>Prediction canceled:</strong> "{endPredQuestion}" (refunded)
            </span>
          );
        }
        return (
          <span>
            🔮 <strong>Prediction {predStatus}:</strong> "{endPredQuestion}"
          </span>
        );

      // ===== Goal Events =====
      case 'channel.goal.begin':
        const goalType = data.type || 'follower';
        const goalDesc = truncateText(data.description || '', 30);
        const goalCurrent = data.current_amount || 0;
        const goalTarget = data.target_amount || 0;
        const goalTypeMap: Record<string, string> = {
          'follower': 'follower',
          'subscription': 'subscription',
          'subscription_count': 'subscriber',
          'new_subscription': 'new sub',
          'new_subscription_count': 'new subscriber'
        };
        const goalTypeName = goalTypeMap[goalType] || goalType;
        return (
          <span>
            🎯 <strong>New {goalTypeName} goal:</strong> {formatNumber(goalTarget)} (currently {formatNumber(goalCurrent)})
            {goalDesc && ` - "${goalDesc}"`}
          </span>
        );
      
      case 'channel.goal.progress':
        const progressGoalCurrent = data.current_amount || 0;
        const progressGoalTarget = data.target_amount || 0;
        const progressPercent = progressGoalTarget > 0 ? Math.round((progressGoalCurrent / progressGoalTarget) * 100) : 0;
        return (
          <span>
            🎯 <strong>Goal progress:</strong> {formatNumber(progressGoalCurrent)}/{formatNumber(progressGoalTarget)} ({progressPercent}%)
          </span>
        );
      
      case 'channel.goal.end':
        const endGoalCurrent = data.current_amount || 0;
        const endGoalTarget = data.target_amount || 0;
        const isAchieved = data.is_achieved;
        if (isAchieved) {
          return (
            <span>
              🎉 <strong>Goal achieved!</strong> {formatNumber(endGoalCurrent)}/{formatNumber(endGoalTarget)}
            </span>
          );
        }
        return (
          <span>
            ❌ <strong>Goal ended:</strong> {formatNumber(endGoalCurrent)}/{formatNumber(endGoalTarget)} (not achieved)
          </span>
        );

      // ===== Shield Mode Events =====
      case 'channel.shield_mode.begin':
        const beginModName = data.moderator_user_name || data.moderator_user_login || 'Moderator';
        return (
          <span>
            🛡️ <strong>Shield Mode activated</strong> by {beginModName}
          </span>
        );
      
      case 'channel.shield_mode.end':
        const endModName = data.moderator_user_name || data.moderator_user_login || 'Moderator';
        return (
          <span>
            🛡️ <strong>Shield Mode deactivated</strong> by {endModName}
          </span>
        );

      // ===== Shoutout Events =====
      case 'channel.shoutout.create':
        const shoutoutTo = data.to_broadcaster_user_name || data.to_broadcaster_user_login || 'Broadcaster';
        const shoutoutViewers = data.viewer_count || 0;
        return (
          <span>
            📢 <strong>Shouted out {shoutoutTo}</strong> to {formatNumber(shoutoutViewers)} viewer{shoutoutViewers !== 1 ? 's' : ''}
          </span>
        );      case 'channel.shoutout.receive':
        const shoutoutFrom = data.from_broadcaster_user_name || data.from_broadcaster_user_login || 'Broadcaster';
        const fromViewers = data.viewer_count || 0;
        return (
          <span>
            📢 <strong>Received shoutout from {shoutoutFrom}</strong> ({formatNumber(fromViewers)} viewers)
          </span>
        );

      // ===== Polling Events (Phase 1 & 2) =====
      case 'channel.follow':
        const followedAt = data.followed_at ? new Date(data.followed_at).toLocaleString() : '';
        return (
          <span>
            💜 <strong>{displayName}</strong> followed the channel{followedAt && ` (${followedAt})`}
          </span>
        );
      
      case 'channel.unfollow':
        return (
          <span>
            💔 <strong>{displayName}</strong> unfollowed the channel
          </span>
        );
      
      case 'channel.vip.add':
        return (
          <span>
            ⭐ <strong>{displayName}</strong> was granted VIP status
          </span>
        );
      
      case 'channel.vip.remove':
        return (
          <span>
            ⭐ <strong>{displayName}</strong> had VIP status removed
          </span>
        );
      
      case 'channel.moderator.add':
        return (
          <span>
            🛡️ <strong>{displayName}</strong> was granted moderator status
          </span>
        );
        case 'channel.moderator.remove':
        return (
          <span>
            🛡️ <strong>{displayName}</strong> had moderator status removed
          </span>
        );

      // ===== Moderation Events (Phase 3) =====
      case 'channel.ban':
        const banReason = data.reason ? ` (Reason: ${data.reason})` : '';
        const banModerator = data.moderator_username ? ` by ${data.moderator_username}` : '';
        return (
          <span>
            🚫 <strong>{displayName}</strong> was banned{banModerator}{banReason}
          </span>
        );
      
      case 'channel.unban':
        return (
          <span>
            ✅ <strong>{displayName}</strong> was unbanned
          </span>
        );
      
      case 'channel.timeout':
        const duration = data.duration_seconds 
          ? data.duration_seconds < 60 
            ? `${data.duration_seconds}s`
            : data.duration_seconds < 3600
            ? `${Math.floor(data.duration_seconds / 60)}m`
            : `${Math.floor(data.duration_seconds / 3600)}h`
          : 'unknown duration';
        const timeoutReason = data.reason ? ` (Reason: ${data.reason})` : '';
        const timeoutModerator = data.moderator_username ? ` by ${data.moderator_username}` : '';
        return (
          <span>
            ⏰ <strong>{displayName}</strong> was timed out for {duration}{timeoutModerator}{timeoutReason}
          </span>
        );
      
      case 'channel.timeout_lifted':
        return (
          <span>
            ⏰ <strong>{displayName}</strong>'s timeout was lifted
          </span>
        );

      // ===== Default =====
      default:
        return (
          <span>
            {displayName && displayName !== 'Unknown' && <><strong>{displayName}</strong> - </>}
            {event.event_type}
          </span>
        );
    }
  };

  return (
    <div className="content">
      <h2>Events</h2>

      {/* Filters */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Event Type:</label>
            <select 
              value={eventTypeFilter} 
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            >
              <option value="">All Types</option>
              {Object.keys(EVENT_DISPLAY_INFO).map(type => (
                <option key={type} value={type}>
                  {getEventDisplayName(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Search:</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search in event data..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Start Date:</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>End Date:</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleClearFilters}
            style={{ padding: '8px 16px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Clear Filters
          </button>
          <button 
            onClick={loadEvents}
            style={{ padding: '8px 16px', backgroundColor: '#9147ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: '10px', color: '#888' }}>
        Showing {events.length} of {totalCount} events
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ff4444', color: 'white', borderRadius: '4px', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          Loading events...
        </div>
      )}

      {/* Events List */}
      {!loading && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No events found. Try adjusting your filters or connect to Twitch to start capturing events.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Time</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Details</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>User</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr 
                  key={event.id} 
                  style={{ 
                    backgroundColor: event.id === selectedEvent?.id ? '#333' : 'transparent',
                    borderBottom: '1px solid #333',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <td style={{ padding: '10px' }}>{formatDate(event.created_at)}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      backgroundColor: '#9147ff', 
                      borderRadius: '4px', 
                      fontSize: '0.85em' 
                    }}>
                      {getEventDisplayName(event.event_type)}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>{renderEventPreview(event)}</td>
                  <td style={{ padding: '10px' }}>
                    {(() => {
                      // For IRC events, get username from event_data if not in viewer fields
                      const displayName = event.viewer_display_name || event.viewer_username;
                      if (displayName) return displayName;
                      
                      const data = parseEventData(event.event_data);
                      if ((event.event_type === 'irc.chat.join' || event.event_type === 'irc.chat.part') && data.username) {
                        return data.username;
                      }
                      return '-';
                    })()}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      style={{ 
                        padding: '4px 8px', 
                        backgroundColor: '#555', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '0.85em'
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && events.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handlePreviousPage}
            disabled={offset === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: offset === 0 ? '#333' : '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: offset === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          
          <span style={{ color: '#888' }}>
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(totalCount / limit)}
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={offset + limit >= totalCount}
            style={{
              padding: '8px 16px',
              backgroundColor: offset + limit >= totalCount ? '#333' : '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: offset + limit >= totalCount ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            style={{
              backgroundColor: '#1e1e1e',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>{getEventDisplayName(selectedEvent.event_type)}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Time:</strong> {formatDate(selectedEvent.created_at)}
            </div>

            {(() => {
              // Get username from viewer fields or event_data for IRC events
              const displayName = selectedEvent.viewer_display_name || selectedEvent.viewer_username;
              const data = parseEventData(selectedEvent.event_data);
              const ircUsername = (selectedEvent.event_type === 'irc.chat.join' || selectedEvent.event_type === 'irc.chat.part') 
                ? data.username 
                : null;
              
              if (displayName || ircUsername) {
                return (
                  <div style={{ marginBottom: '15px' }}>
                    <strong>User:</strong> {displayName || ircUsername}
                    {selectedEvent.viewer_id && ` (ID: ${selectedEvent.viewer_id})`}
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ marginBottom: '15px' }}>
              <strong>Channel ID:</strong> {selectedEvent.channel_id}
            </div>

            <div>
              <strong>Event Data:</strong>
              <pre style={{
                backgroundColor: '#2a2a2a',
                padding: '15px',
                borderRadius: '4px',
                overflow: 'auto',
                marginTop: '10px'
              }}>
                {JSON.stringify(parseEventData(selectedEvent.event_data), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
