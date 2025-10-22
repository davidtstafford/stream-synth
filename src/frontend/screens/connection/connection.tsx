import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');
const WebSocket = window.require('ws');

interface ConnectionScreenProps {}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface EventSubscriptions {
  // Channel Events
  'channel.update': boolean;
  'channel.follow': boolean;
  'channel.subscribe': boolean;
  'channel.subscription.end': boolean;
  'channel.subscription.gift': boolean;
  'channel.subscription.message': boolean;
  'channel.cheer': boolean;
  'channel.raid': boolean;
  'channel.ban': boolean;
  'channel.unban': boolean;
  'channel.moderator.add': boolean;
  'channel.moderator.remove': boolean;
  
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
  
  // Shield Mode
  'channel.shield_mode.begin': boolean;
  'channel.shield_mode.end': boolean;
  
  // Shoutout Events
  'channel.shoutout.create': boolean;
  'channel.shoutout.receive': boolean;
}

const EVENT_GROUPS = {
  'Channel Events': [
    'channel.update',
    'channel.follow',
    'channel.subscribe',
    'channel.subscription.end',
    'channel.subscription.gift',
    'channel.subscription.message',
    'channel.cheer',
    'channel.raid',
    'channel.ban',
    'channel.unban',
    'channel.moderator.add',
    'channel.moderator.remove'
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
  ]
};

const DEFAULT_SUBSCRIPTIONS: (keyof EventSubscriptions)[] = [
  'channel.chat.message', // Mandatory for app to work
  'channel.follow',
  'channel.subscribe',
  'channel.subscription.gift',
  'channel.cheer',
  'channel.raid',
  'channel.channel_points_custom_reward_redemption.add',
  'stream.online',
  'stream.offline'
];

const MANDATORY_SUBSCRIPTIONS: (keyof EventSubscriptions)[] = [
  'channel.chat.message'
];

export const ConnectionScreen: React.FC<ConnectionScreenProps> = () => {
  const [clientId, setClientId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [wsConnection, setWsConnection] = useState<any>(null);
  const [sessionId, setSessionId] = useState<string>('');
  const [showEventSubscriptions, setShowEventSubscriptions] = useState<boolean>(false);
  const [eventSubscriptions, setEventSubscriptions] = useState<EventSubscriptions>(() => {
    const initial = {} as EventSubscriptions;
    Object.values(EVENT_GROUPS).flat().forEach(event => {
      // Set mandatory events to true by default
      initial[event as keyof EventSubscriptions] = MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptions);
    });
    return initial;
  });

  const handleConnect = async () => {
    if (!clientId.trim()) {
      setStatusMessage({
        type: 'error',
        message: 'Please enter a Twitch Client ID'
      });
      return;
    }

    setIsConnecting(true);
    setStatusMessage({
      type: 'info',
      message: 'Opening Twitch authentication...'
    });

    try {
      const result: any = await ipcRenderer.invoke('twitch-oauth', clientId);
      
      if (result.success && result.accessToken) {
        setAccessToken(result.accessToken);
        setStatusMessage({
          type: 'success',
          message: 'Successfully authenticated with Twitch!'
        });

        // Initialize WebSocket connection
        await initializeWebSocket(result.accessToken);
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        message: `Authentication failed: ${error.message}`
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const initializeWebSocket = async (token: string) => {
    try {
      setStatusMessage({
        type: 'info',
        message: 'Connecting to Twitch WebSocket...'
      });

      // Connect to Twitch EventSub WebSocket
      const ws = new WebSocket('wss://eventsub.wss.twitch.tv/ws');

      ws.on('open', () => {
        console.log('WebSocket connection opened');
        setStatusMessage({
          type: 'success',
          message: 'WebSocket connected successfully!'
        });
      });

      ws.on('message', (data: any) => {
        const message = JSON.parse(data.toString());
        console.log('WebSocket message:', message);
        
        const messageType = message.metadata?.message_type;
        
        if (messageType === 'session_welcome') {
          const sessionIdValue = message.payload?.session?.id;
          setSessionId(sessionIdValue);
          setStatusMessage({
            type: 'success',
            message: `WebSocket session established! Session ID: ${sessionIdValue?.substring(0, 8)}...`
          });
          
          // Automatically subscribe to mandatory events
          // Use a longer timeout to ensure state is updated
          setTimeout(() => {
            MANDATORY_SUBSCRIPTIONS.forEach(event => {
              subscribeToEvent(event, token, clientId, sessionIdValue);
            });
          }, 2000);
        } else if (messageType === 'session_keepalive') {
          // Twitch sends keepalive messages to maintain the connection
          // We don't need to respond, just need to handle it so the connection stays alive
          console.log('Received keepalive message');
        } else if (messageType === 'notification') {
          // Handle event notifications here
          console.log('Received event notification:', message);
        } else if (messageType === 'session_reconnect') {
          // Twitch is asking us to reconnect
          console.log('Received reconnect request');
          setStatusMessage({
            type: 'info',
            message: 'Reconnecting to Twitch...'
          });
        }
      });

      ws.on('error', (error: Error) => {
        console.error('WebSocket error:', error);
        setStatusMessage({
          type: 'error',
          message: `WebSocket error: ${error.message}`
        });
      });

      ws.on('close', () => {
        console.log('WebSocket connection closed');
        setStatusMessage({
          type: 'info',
          message: 'WebSocket connection closed'
        });
      });

      setWsConnection(ws);
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        message: `WebSocket connection failed: ${error.message}`
      });
    }
  };

  const handleDisconnect = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
    setAccessToken('');
    setSessionId('');
    setStatusMessage(null);
  };

  const subscribeToEvent = async (eventType: string, token?: string, client?: string, sessionIdParam?: string) => {
    const authToken = token || accessToken;
    const authClientId = client || clientId;
    const currentSessionId = sessionIdParam || sessionId;
    
    if (!authToken || !currentSessionId) {
      console.error('Cannot subscribe: missing token or session', { 
        hasToken: !!authToken, 
        hasSession: !!currentSessionId 
      });
      return;
    }

    try {
      // Get broadcaster user ID first
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Client-Id': authClientId
        }
      });
      
      const userData = await userResponse.json();
      const broadcasterId = userData.data[0].id;

      // Create subscription condition based on event type
      const condition: any = {};
      
      // Different events require different condition fields
      if (eventType.startsWith('channel.chat')) {
        // Chat events need both broadcaster and user
        condition.broadcaster_user_id = broadcasterId;
        condition.user_id = broadcasterId;
      } else if (eventType === 'channel.follow') {
        // Follow needs broadcaster and moderator
        condition.broadcaster_user_id = broadcasterId;
        condition.moderator_user_id = broadcasterId;
      } else if (eventType.includes('moderator') || eventType.includes('shield_mode')) {
        // Moderator events
        condition.broadcaster_user_id = broadcasterId;
        condition.moderator_user_id = broadcasterId;
      } else if (eventType.startsWith('channel.shoutout')) {
        // Shoutout events
        condition.broadcaster_user_id = broadcasterId;
        condition.moderator_user_id = broadcasterId;
      } else {
        // Most other events just need broadcaster_user_id
        condition.broadcaster_user_id = broadcasterId;
      }

      // Determine the correct version for each event type
      let version = '1';
      // Note: As of 2024, channel.chat.message uses version "1", not "beta"
      // Beta versions are deprecated for most events

      const subscriptionResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Client-Id': authClientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          type: eventType,
          version: version,
          condition: condition,
          transport: {
            method: 'websocket',
            session_id: currentSessionId
          }
        })
      });

      const result = await subscriptionResponse.json();
      
      if (subscriptionResponse.ok) {
        console.log(`✅ Subscribed to ${eventType}`, result);
      } else {
        console.error(`❌ Failed to subscribe to ${eventType}:`, result);
        console.error('Request details:', {
          type: eventType,
          version: version,
          condition,
          sessionId: currentSessionId,
          status: subscriptionResponse.status,
          statusText: subscriptionResponse.statusText
        });
      }
    } catch (error) {
      console.error(`Error subscribing to ${eventType}:`, error);
    }
  };

  const unsubscribeFromEvent = async (eventType: string) => {
    if (!accessToken) return;

    try {
      // First, get all subscriptions to find the ID
      const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });

      const data = await response.json();
      const subscription = data.data?.find((sub: any) => sub.type === eventType);

      if (subscription) {
        await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscription.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Client-Id': clientId
          }
        });
        console.log(`Unsubscribed from ${eventType}`);
      }
    } catch (error) {
      console.error(`Error unsubscribing from ${eventType}:`, error);
    }
  };

  const handleEventToggle = async (eventType: keyof EventSubscriptions) => {
    // Prevent toggling mandatory subscriptions
    if (MANDATORY_SUBSCRIPTIONS.includes(eventType)) {
      return;
    }
    
    const newValue = !eventSubscriptions[eventType];
    setEventSubscriptions(prev => ({
      ...prev,
      [eventType]: newValue
    }));

    if (newValue) {
      await subscribeToEvent(eventType);
    } else {
      await unsubscribeFromEvent(eventType);
    }
  };

  const handleSelectDefault = () => {
    const newSubscriptions = { ...eventSubscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      newSubscriptions[key as keyof EventSubscriptions] = DEFAULT_SUBSCRIPTIONS.includes(key as keyof EventSubscriptions);
    });
    setEventSubscriptions(newSubscriptions);

    // Subscribe to defaults
    if (sessionId && accessToken) {
      DEFAULT_SUBSCRIPTIONS.forEach(event => subscribeToEvent(event));
    }
  };

  const handleSelectAll = () => {
    const newSubscriptions = { ...eventSubscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      newSubscriptions[key as keyof EventSubscriptions] = true;
    });
    setEventSubscriptions(newSubscriptions);

    // Subscribe to all
    if (sessionId && accessToken) {
      Object.keys(newSubscriptions).forEach(event => subscribeToEvent(event));
    }
  };

  const handleDeselectAll = () => {
    const newSubscriptions = { ...eventSubscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      // Keep mandatory subscriptions enabled
      if (MANDATORY_SUBSCRIPTIONS.includes(key as keyof EventSubscriptions)) {
        newSubscriptions[key as keyof EventSubscriptions] = true;
      } else {
        newSubscriptions[key as keyof EventSubscriptions] = false;
      }
    });
    setEventSubscriptions(newSubscriptions);

    // Unsubscribe from all except mandatory
    if (accessToken) {
      Object.keys(newSubscriptions).forEach(event => {
        if (!MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptions)) {
          unsubscribeFromEvent(event);
        }
      });
    }
  };

  return (
    <div className="content">
      <h1 className="screen-title">Connection</h1>
      
      <div className="form-group">
        <label className="form-label" htmlFor="client-id">
          Twitch Client ID
        </label>
        <input
          id="client-id"
          type="text"
          className="form-input"
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          placeholder="Enter your Twitch Client ID"
          disabled={isConnecting || !!accessToken}
        />
      </div>

      {!accessToken ? (
        <button
          className="btn"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect to Twitch'}
        </button>
      ) : (
        <button
          className="btn"
          onClick={handleDisconnect}
        >
          Disconnect
        </button>
      )}

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {accessToken && (
        <div className="form-group" style={{ marginTop: '30px' }}>
          <label className="form-label">
            Access Token (truncated)
          </label>
          <div className="form-input" style={{ opacity: 0.7 }}>
            {accessToken.substring(0, 20)}...
          </div>
        </div>
      )}

      {accessToken && sessionId && (
        <div style={{ marginTop: '40px' }}>
          <div 
            onClick={() => setShowEventSubscriptions(!showEventSubscriptions)}
            style={{ 
              cursor: 'pointer', 
              display: 'flex', 
              alignItems: 'center',
              marginBottom: '20px'
            }}
          >
            <h2 style={{ fontSize: '24px', fontWeight: '500' }}>
              Event Subscriptions {showEventSubscriptions ? '▼' : '▶'}
            </h2>
          </div>

          {showEventSubscriptions && (
            <div style={{ 
              background: '#252525', 
              padding: '20px', 
              borderRadius: '8px',
              border: '1px solid #333'
            }}>
              <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
                <button className="btn" onClick={handleSelectDefault}>
                  Select Default
                </button>
                <button className="btn" onClick={handleSelectAll}>
                  Select All
                </button>
                <button 
                  className="btn" 
                  onClick={handleDeselectAll}
                  style={{ background: '#555' }}
                >
                  Deselect All
                </button>
              </div>

              {Object.entries(EVENT_GROUPS).map(([groupName, events]) => (
                <div key={groupName} style={{ marginBottom: '30px' }}>
                  <h3 style={{ 
                    fontSize: '18px', 
                    marginBottom: '15px',
                    color: '#9147ff',
                    fontWeight: '500'
                  }}>
                    {groupName}
                  </h3>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: '10px'
                  }}>
                    {events.map((event) => {
                      const isMandatory = MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptions);
                      return (
                        <label 
                          key={event}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center',
                            cursor: isMandatory ? 'not-allowed' : 'pointer',
                            padding: '8px',
                            background: isMandatory ? '#2d3d2d' : '#2d2d2d',
                            borderRadius: '4px',
                            transition: 'background 0.2s',
                            border: isMandatory ? '1px solid #4d7a45' : 'none'
                          }}
                          onMouseEnter={(e) => {
                            if (!isMandatory) e.currentTarget.style.background = '#353535';
                          }}
                          onMouseLeave={(e) => {
                            if (!isMandatory) e.currentTarget.style.background = '#2d2d2d';
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={eventSubscriptions[event as keyof EventSubscriptions]}
                            onChange={() => handleEventToggle(event as keyof EventSubscriptions)}
                            disabled={isMandatory}
                            style={{ 
                              marginRight: '10px',
                              cursor: isMandatory ? 'not-allowed' : 'pointer',
                              width: '16px',
                              height: '16px'
                            }}
                          />
                          <span style={{ fontSize: '13px', userSelect: 'none' }}>
                            {event}
                            {isMandatory && (
                              <span style={{ 
                                marginLeft: '8px', 
                                fontSize: '11px', 
                                color: '#6dff8e',
                                fontWeight: 'bold'
                              }}>
                                (REQUIRED)
                              </span>
                            )}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
