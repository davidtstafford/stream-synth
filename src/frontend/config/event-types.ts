export interface EventSubscriptions {
  // Channel Events
  'channel.update': boolean;
  'channel.follow': boolean; // Testing if it works via WebSocket despite docs
  'channel.subscribe': boolean;
  'channel.subscription.end': boolean;
  'channel.subscription.gift': boolean;  'channel.subscription.message': boolean;
  'channel.cheer': boolean;
  'channel.raid': boolean;
  'channel.ban': boolean;
  'channel.unban': boolean;
  'channel.moderator.add': boolean;
  'channel.moderator.remove': boolean;
  'channel.vip.add': boolean;
  'channel.vip.remove': boolean;
  
  // Chat Events
  'channel.chat.message': boolean;
  'channel.chat.clear': boolean;
  'channel.chat.clear_user_messages': boolean;
  'channel.chat.message_delete': boolean;
  'channel.chat_settings.update': boolean;
  
  // Point/Reward Events
  'channel.channel_points_custom_reward.add': boolean;
  'channel.channel_points_custom_reward.update': boolean;
  'channel.channel_points_custom_reward.remove': boolean;
  'channel.channel_points_custom_reward_redemption.add': boolean;
  'channel.channel_points_custom_reward_redemption.update': boolean;
  
  // Hype Train
  'channel.hype_train.begin': boolean;
  'channel.hype_train.progress': boolean;
  'channel.hype_train.end': boolean;
  
  // Polls & Predictions
  'channel.poll.begin': boolean;
  'channel.poll.progress': boolean;
  'channel.poll.end': boolean;
  'channel.prediction.begin': boolean;
  'channel.prediction.progress': boolean;
  'channel.prediction.lock': boolean;
  'channel.prediction.end': boolean;
  
  // Stream Events
  'stream.online': boolean;
  'stream.offline': boolean;
  
  // Goal Events
  'channel.goal.begin': boolean;
  'channel.goal.progress': boolean;
  'channel.goal.end': boolean;
  
  // IRC Events (not available via EventSub)
  'irc.chat.join': boolean;
  'irc.chat.part': boolean;
  
  // Shield Mode
  'channel.shield_mode.begin': boolean;
  'channel.shield_mode.end': boolean;
  
  // Shoutout Events
  'channel.shoutout.create': boolean;
  'channel.shoutout.receive': boolean;
}

export const EVENT_GROUPS: Record<string, string[]> = {
  'Channel Events': [
    'channel.update',
    'channel.follow', // Testing if it works via WebSocket
    'channel.subscribe',
    'channel.subscription.end',
    'channel.subscription.gift',
    'channel.subscription.message',
    'channel.cheer',
    'channel.raid',
    'channel.ban',
    'channel.unban',
    'channel.moderator.add',
    'channel.moderator.remove',
    'channel.vip.add',
    'channel.vip.remove'
  ],
  'Chat Events': [
    'channel.chat.message',
    'channel.chat.clear',
    'channel.chat.clear_user_messages',
    'channel.chat.message_delete',
    'channel.chat_settings.update'
  ],
  'Point/Reward Events': [
    'channel.channel_points_custom_reward.add',
    'channel.channel_points_custom_reward.update',
    'channel.channel_points_custom_reward.remove',
    'channel.channel_points_custom_reward_redemption.add',
    'channel.channel_points_custom_reward_redemption.update'
  ],
  'Hype Train': [
    'channel.hype_train.begin',
    'channel.hype_train.progress',
    'channel.hype_train.end'
  ],
  'Polls & Predictions': [
    'channel.poll.begin',
    'channel.poll.progress',
    'channel.poll.end',
    'channel.prediction.begin',
    'channel.prediction.progress',
    'channel.prediction.lock',
    'channel.prediction.end'
  ],
  'Stream Events': [
    'stream.online',
    'stream.offline'
  ],
  'Goal Events': [
    'channel.goal.begin',
    'channel.goal.progress',
    'channel.goal.end'
  ],
  'Shield Mode': [
    'channel.shield_mode.begin',
    'channel.shield_mode.end'
  ],
  'Shoutout Events': [
    'channel.shoutout.create',
    'channel.shoutout.receive'
  ],
  'IRC Events': [
    'irc.chat.join',
    'irc.chat.part'
  ]
};

export const DEFAULT_SUBSCRIPTIONS: (keyof EventSubscriptions)[] = [
  'channel.chat.message', // Mandatory for app to work
  'channel.follow', // Testing if it works
  'channel.subscribe',
  'channel.subscription.gift',
  'channel.cheer',
  'channel.raid',
  'channel.ban', // Real-time ban tracking
  'channel.unban', // Real-time unban tracking
  'channel.moderator.add', // Real-time moderator grants
  'channel.moderator.remove', // Real-time moderator revokes
  'channel.vip.add', // Real-time VIP grants
  'channel.vip.remove', // Real-time VIP revokes
  'channel.channel_points_custom_reward_redemption.add',
  'stream.online',
  'stream.offline'
];

export const MANDATORY_SUBSCRIPTIONS: (keyof EventSubscriptions)[] = [
  'channel.chat.message',
  'channel.channel_points_custom_reward_redemption.add' // Required for TTS channel point grants
];

// Events that require broadcaster permissions (not available to moderators)
export const BROADCASTER_ONLY_EVENTS: (keyof EventSubscriptions)[] = [
  'channel.update',
  'channel.subscribe',
  'channel.subscription.end',
  'channel.subscription.gift',
  'channel.subscription.message',
  'channel.cheer',  'channel.raid',
  'channel.ban',
  'channel.unban',
  'channel.moderator.add',
  'channel.moderator.remove',
  'channel.vip.add',
  'channel.vip.remove',
  'channel.channel_points_custom_reward.add',
  'channel.channel_points_custom_reward.update',
  'channel.channel_points_custom_reward.remove',
  'channel.channel_points_custom_reward_redemption.add',
  'channel.channel_points_custom_reward_redemption.update',
  'channel.hype_train.begin',
  'channel.hype_train.progress',
  'channel.hype_train.end',
  'channel.poll.begin',
  'channel.poll.progress',
  'channel.poll.end',
  'channel.prediction.begin',
  'channel.prediction.progress',
  'channel.prediction.lock',
  'channel.prediction.end',
  'stream.online',
  'stream.offline',
  'channel.goal.begin',
  'channel.goal.progress',
  'channel.goal.end',
  'channel.shield_mode.begin',
  'channel.shield_mode.end',
  'channel.shoutout.create',
  'channel.shoutout.receive'
];

// Display names and descriptions for events
export const EVENT_DISPLAY_INFO: Record<keyof EventSubscriptions, { name: string; description: string }> = {
  // Channel Events
  'channel.update': { 
    name: 'Channel Update', 
    description: 'Channel information (title, category, language) is updated' 
  },
  'channel.follow': { 
    name: 'New Follower', 
    description: 'User follows the channel (TESTING - may not work via WebSocket)' 
  },
  'channel.subscribe': { 
    name: 'New Subscription', 
    description: 'User subscribes to the channel' 
  },
  'channel.subscription.end': { 
    name: 'Subscription Ended', 
    description: 'User subscription expires' 
  },
  'channel.subscription.gift': { 
    name: 'Gift Subscription', 
    description: 'User gifts subscriptions to other users' 
  },
  'channel.subscription.message': { 
    name: 'Resub Message', 
    description: 'User sends a resubscription message' 
  },
  'channel.cheer': { 
    name: 'Bits Cheered', 
    description: 'User cheers bits in the channel' 
  },  'channel.raid': { 
    name: 'Incoming Raid', 
    description: 'Channel receives a raid from another broadcaster' 
  },
  'channel.ban': { 
    name: 'User Banned', 
    description: 'User is banned from the channel' 
  },
  'channel.unban': { 
    name: 'User Unbanned', 
    description: 'User ban is removed from the channel' 
  },
  'channel.moderator.add': { 
    name: 'Moderator Added', 
    description: 'User is granted moderator status' 
  },  'channel.moderator.remove': { 
    name: 'Moderator Removed', 
    description: 'User moderator status is removed' 
  },
  'channel.vip.add': { 
    name: 'VIP Added', 
    description: 'User is granted VIP status' 
  },
  'channel.vip.remove': { 
    name: 'VIP Removed', 
    description: 'User VIP status is removed' 
  },
  
  // Chat Events
  'channel.chat.message': { 
    name: 'Chat Message', 
    description: 'User sends a message in chat' 
  },
  'channel.chat.clear': { 
    name: 'Chat Cleared', 
    description: 'All messages in chat are cleared' 
  },
  'channel.chat.clear_user_messages': { 
    name: 'User Messages Cleared', 
    description: 'All messages from a specific user are cleared' 
  },
  'channel.chat.message_delete': { 
    name: 'Message Deleted', 
    description: 'A specific chat message is deleted' 
  },
  'channel.chat_settings.update': { 
    name: 'Chat Settings Changed', 
    description: 'Chat settings (slow mode, follower mode, etc.) are updated' 
  },
  
  // Point/Reward Events
  'channel.channel_points_custom_reward.add': { 
    name: 'Reward Created', 
    description: 'Custom channel points reward is created' 
  },
  'channel.channel_points_custom_reward.update': { 
    name: 'Reward Updated', 
    description: 'Custom channel points reward is updated' 
  },
  'channel.channel_points_custom_reward.remove': { 
    name: 'Reward Deleted', 
    description: 'Custom channel points reward is deleted' 
  },
  'channel.channel_points_custom_reward_redemption.add': { 
    name: 'Reward Redeemed', 
    description: 'User redeems a channel points reward' 
  },
  'channel.channel_points_custom_reward_redemption.update': { 
    name: 'Redemption Updated', 
    description: 'Reward redemption status is updated (fulfilled/canceled)' 
  },
  
  // Hype Train
  'channel.hype_train.begin': { 
    name: 'Hype Train Started', 
    description: 'Hype Train event begins in the channel' 
  },
  'channel.hype_train.progress': { 
    name: 'Hype Train Progress', 
    description: 'Hype Train level or progress updates' 
  },
  'channel.hype_train.end': { 
    name: 'Hype Train Ended', 
    description: 'Hype Train event concludes' 
  },
  
  // Polls & Predictions
  'channel.poll.begin': { 
    name: 'Poll Started', 
    description: 'New poll is created and voting begins' 
  },
  'channel.poll.progress': { 
    name: 'Poll Progress', 
    description: 'Poll voting progress updates' 
  },
  'channel.poll.end': { 
    name: 'Poll Ended', 
    description: 'Poll voting concludes and results are finalized' 
  },
  'channel.prediction.begin': { 
    name: 'Prediction Started', 
    description: 'New prediction is created and betting begins' 
  },
  'channel.prediction.progress': { 
    name: 'Prediction Progress', 
    description: 'Prediction betting progress updates' 
  },
  'channel.prediction.lock': { 
    name: 'Prediction Locked', 
    description: 'Prediction betting is locked and no more bets accepted' 
  },
  'channel.prediction.end': { 
    name: 'Prediction Ended', 
    description: 'Prediction concludes and outcome is determined' 
  },
  
  // Stream Events
  'stream.online': { 
    name: 'Stream Started', 
    description: 'Broadcaster goes live' 
  },
  'stream.offline': { 
    name: 'Stream Ended', 
    description: 'Broadcaster stops streaming' 
  },
  
  // Goal Events
  'channel.goal.begin': { 
    name: 'Goal Started', 
    description: 'Creator goal is created' 
  },
  'channel.goal.progress': { 
    name: 'Goal Progress', 
    description: 'Progress towards creator goal updates' 
  },
  'channel.goal.end': { 
    name: 'Goal Ended', 
    description: 'Creator goal concludes or is removed' 
  },
  
  // Shield Mode
  'channel.shield_mode.begin': { 
    name: 'Shield Mode Activated', 
    description: 'Shield Mode is enabled to protect from raids/harassment' 
  },
  'channel.shield_mode.end': { 
    name: 'Shield Mode Deactivated', 
    description: 'Shield Mode is disabled' 
  },
  
  // Shoutout Events
  'channel.shoutout.create': { 
    name: 'Shoutout Sent', 
    description: 'Broadcaster sends a shoutout to another channel' 
  },
  'channel.shoutout.receive': { 
    name: 'Shoutout Received', 
    description: 'Broadcaster receives a shoutout from another channel' 
  },
  
  // IRC Events (not available via EventSub)
  'irc.chat.join': {
    name: 'User Joined Chat',
    description: 'User enters the chat room (IRC only)'
  },
  'irc.chat.part': {
    name: 'User Left Chat',
    description: 'User leaves the chat room (IRC only)'
  }
};
