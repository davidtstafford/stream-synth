import React, { useState, useEffect } from 'react';
import { Connection } from '../../components/Connection';
import { EventSubscriptions } from '../../components/EventSubscriptions';
import { createWebSocketConnection } from '../../services/websocket';
import * as db from '../../services/database';

interface ConnectionScreenProps {}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = () => {
  const [clientId, setClientId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [userLogin, setUserLogin] = useState<string>('');
  const [broadcasterId, setBroadcasterId] = useState<string>('');
  const [broadcasterLogin, setBroadcasterLogin] = useState<string>('');
  const [isBroadcaster, setIsBroadcaster] = useState<boolean>(false);
  const [sessionId, setSessionId] = useState<string>('');  const [wsConnection, setWsConnection] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [isAutoReconnecting, setIsAutoReconnecting] = useState<boolean>(true);

  // Auto-reconnect on mount
  useEffect(() => {
    async function autoReconnect() {
      setIsAutoReconnecting(true);
      
      try {
        // Check for saved session
        const lastUserId = await db.getSetting('last_connected_user_id');
        if (!lastUserId) {
          console.log('No saved session found');
          setIsAutoReconnecting(false);
          return;
        }

        // Try to get saved token
        const savedToken = await db.getToken(lastUserId);
        if (!savedToken || !savedToken.isValid) {
          console.log('No valid token found, clearing saved state');
          await db.setSetting('last_connected_user_id', '');
          setIsAutoReconnecting(false);
          return;
        }

        setStatusMessage({
          type: 'info',
          message: 'Restoring previous session...'
        });

        // Validate token with Twitch
        const response = await fetch('https://api.twitch.tv/helix/users', {
          headers: {
            'Authorization': `Bearer ${savedToken.accessToken}`,
            'Client-Id': savedToken.clientId
          }
        });

        if (!response.ok) {
          console.log('Token expired, clearing saved state');
          await db.deleteToken(lastUserId);
          await db.setSetting('last_connected_user_id', '');
          setStatusMessage({
            type: 'error',
            message: 'Previous session expired. Please log in again.'
          });
          setIsAutoReconnecting(false);
          return;
        }

        const data = await response.json();
        const user = data.data[0];

        // Get saved channel
        const lastChannelId = await db.getSetting('last_connected_channel_id');
        const lastChannelLogin = await db.getSetting('last_connected_channel_login');
        const lastIsBroadcaster = await db.getSetting('last_is_broadcaster');

        // Set connection state
        setClientId(savedToken.clientId);
        setAccessToken(savedToken.accessToken);
        setUserId(user.id);
        setUserLogin(user.login);
        setBroadcasterId(lastChannelId || user.id);
        setBroadcasterLogin(lastChannelLogin || user.login);
        setIsBroadcaster(lastIsBroadcaster === 'true');

        setStatusMessage({
          type: 'success',
          message: `Reconnected as ${user.login}! Connecting to WebSocket...`
        });

        // Initialize WebSocket
        const ws = createWebSocketConnection({
          onSessionWelcome: async (sessionIdValue: string) => {
            setSessionId(sessionIdValue);
            setStatusMessage({
              type: 'success',
              message: `Auto-reconnected! Monitoring: ${lastChannelLogin || user.login}`
            });
              // Connect to IRC for JOIN/PART events
            try {
              console.log('🔌 Connecting to IRC (auto-reconnect)...');
              const { ipcRenderer } = window.require('electron');
              const channelToJoin = lastChannelLogin || user.login;
              const ircResult = await ipcRenderer.invoke('irc:connect', {
                username: user.login,
                token: savedToken.accessToken,
                channel: channelToJoin
              });
              if (ircResult.success) {
                console.log('✅ IRC connected');
                setStatusMessage({
                  type: 'success',
                  message: `Auto-reconnected! Monitoring: ${channelToJoin} (EventSub + IRC)`
                });
              } else {
                console.error('❌ IRC connection failed:', ircResult.error);
              }
            } catch (error) {
              console.error('❌ IRC connection error:', error);
            }
          },          onKeepalive: () => {},
          onNotification: async (data: any) => {
            console.log('🔔 Event received (full):', JSON.stringify(data, null, 2));
            
            // Extract event type and payload
            const eventType = data.subscription?.type || data.payload?.subscription?.type;
            const eventPayload = data.event || data.payload?.event;
            const eventTimestamp = data.metadata?.message_timestamp || new Date().toISOString();
            
            console.log('📝 Event type:', eventType);
            console.log('📦 Event payload:', eventPayload);
            
            if (eventType && eventPayload) {
              // Forward event to backend for role processing
              const { ipcRenderer } = window.require('electron');
              console.log('📤 Forwarding event to backend router...');
              ipcRenderer.send('eventsub-event-received', {
                type: eventType,
                data: eventPayload,
                timestamp: eventTimestamp
              });
              
              // Extract viewer info if available based on event type
              let viewerId: string | undefined;
              let viewerUsername: string | undefined;
              let viewerDisplayName: string | undefined;
              
              // Chat message events
              if (eventType === 'channel.chat.message') {
                viewerId = eventPayload.chatter_user_id;
                viewerUsername = eventPayload.chatter_user_login;
                viewerDisplayName = eventPayload.chatter_user_name;
                console.log('💬 Chat message from:', viewerUsername, '(ID:', viewerId, ')');
              }
              // Most other events use user_id, user_login, user_name
              else if (eventPayload.user_id) {
                viewerId = eventPayload.user_id;
                viewerUsername = eventPayload.user_login;
                viewerDisplayName = eventPayload.user_name;
                console.log('👤 Event from user:', viewerUsername, '(ID:', viewerId, ')');
              }
              // Raid events use from_broadcaster_*
              else if (eventPayload.from_broadcaster_user_id) {
                viewerId = eventPayload.from_broadcaster_user_id;
                viewerUsername = eventPayload.from_broadcaster_user_login;
                viewerDisplayName = eventPayload.from_broadcaster_user_name;
                console.log('🎯 Raid from:', viewerUsername, '(ID:', viewerId, ')');
              }
              
              // Create or update viewer if we have their info
              if (viewerId && viewerUsername) {
                console.log('👥 Creating/updating viewer:', viewerUsername);
                const viewerResult = await db.getOrCreateViewer(viewerId, viewerUsername, viewerDisplayName);
                console.log('👥 Viewer result:', viewerResult);
              }          // Store the event using broadcaster_user_id from the event
          const eventChannelId = eventPayload.broadcaster_user_id || lastChannelId || user.id;
          console.log('💾 Storing event for channel:', eventChannelId);
          const result = await db.storeEvent(eventType, eventPayload, eventChannelId, viewerId);
              console.log('💾 Store result:', result);
              if (result.success) {
                console.log('✅ Event stored with ID:', result.id);
              } else {
                console.error('❌ Failed to store event:', result.error);
              }
            } else {
              console.log('⚠️ Missing event type or payload');
            }
          },
          onReconnect: () => {
            setStatusMessage({
              type: 'info',
              message: 'Reconnecting to Twitch...'
            });
          },
          onError: (error: Error) => {
            setStatusMessage({
              type: 'error',
              message: `WebSocket error: ${error.message}`
            });
          },
          onClose: () => {
            setStatusMessage({
              type: 'info',
              message: 'WebSocket connection closed'
            });
          }
        });

        setWsConnection(ws);
        
      } catch (error) {
        console.error('Auto-reconnect failed:', error);
        setStatusMessage({
          type: 'error',
          message: 'Failed to restore previous session'
        });
      } finally {
        setIsAutoReconnecting(false);
      }
    }

    autoReconnect();
  }, []);

  const handleConnected = async (clientIdValue: string, accessTokenValue: string, userIdValue: string, userLoginValue: string) => {
    setClientId(clientIdValue);
    setAccessToken(accessTokenValue);
    setUserId(userIdValue);
    setUserLogin(userLoginValue);
    
    // Auto-connect to own channel
    setBroadcasterId(userIdValue);
    setBroadcasterLogin(userLoginValue);
    setIsBroadcaster(true);
    
    // Save token to database for auto-reconnect
    await db.saveToken({
      userId: userIdValue,
      accessToken: accessTokenValue,
      clientId: clientIdValue
    });

    // Save session to database
    await db.createSession({
      user_id: userIdValue,
      user_login: userLoginValue,
      channel_id: userIdValue,
      channel_login: userLoginValue,
      is_broadcaster: true
    });    // Save settings for auto-reconnect
    await db.setSetting('last_connected_user_id', userIdValue);
    await db.setSetting('last_connected_channel_id', userIdValue);
    await db.setSetting('last_connected_channel_login', userLoginValue);
    await db.setSetting('last_is_broadcaster', 'true');
    
    // Sync viewer roles from Twitch (subscriptions, VIPs, moderators)
    setStatusMessage({
      type: 'info',
      message: 'Syncing viewer roles from Twitch...'
    });
    
    try {
      const { ipcRenderer } = window.require('electron');
      const syncResult = await ipcRenderer.invoke('twitch:sync-subscriptions-from-twitch');
      if (syncResult.success) {
        console.log(`✅ Role sync complete: ${syncResult.subCount} subs, ${syncResult.vipCount} VIPs, ${syncResult.modCount} mods`);
      } else {
        console.warn('⚠️ Role sync had errors:', syncResult.error);
      }
    } catch (error) {
      console.error('❌ Role sync failed:', error);
      // Don't block connection on sync failure
    }
    
    // Initialize WebSocket immediately
    setStatusMessage({
      type: 'info',
      message: 'Connecting to Twitch WebSocket...'
    });

    const ws = createWebSocketConnection({
      onSessionWelcome: async (sessionIdValue: string) => {
        setSessionId(sessionIdValue);
        setStatusMessage({
          type: 'success',
          message: `WebSocket session established! Monitoring: ${userLoginValue}`
        });
          // Connect to IRC for JOIN/PART events
        try {
          console.log('🔌 Connecting to IRC...');
          const { ipcRenderer } = window.require('electron');
          const ircResult = await ipcRenderer.invoke('irc:connect', {
            username: userLoginValue,
            token: accessTokenValue,
            channel: userLoginValue
          });
          if (ircResult.success) {
            console.log('✅ IRC connected');
            setStatusMessage({
              type: 'success',
              message: `Connected! Monitoring: ${userLoginValue} (EventSub + IRC)`
            });
          } else {
            console.error('❌ IRC connection failed:', ircResult.error);
          }
        } catch (error) {
          console.error('❌ IRC connection error:', error);
        }
      },      onKeepalive: () => {
        // Keepalive received
      },
      onNotification: async (data: any) => {
        console.log('🔔 Event received (full):', JSON.stringify(data, null, 2));
        
        // Extract event type and payload
        const eventType = data.subscription?.type || data.payload?.subscription?.type;
        const eventPayload = data.event || data.payload?.event;
        const eventTimestamp = data.metadata?.message_timestamp || new Date().toISOString();
        
        console.log('📝 Event type:', eventType);
        console.log('📦 Event payload:', eventPayload);
        
        if (eventType && eventPayload) {
          // Forward event to backend for role processing
          const { ipcRenderer } = window.require('electron');
          console.log('📤 Forwarding event to backend router...');
          ipcRenderer.send('eventsub-event-received', {
            type: eventType,
            data: eventPayload,
            timestamp: eventTimestamp
          });
          
          // Extract viewer info if available based on event type
          let viewerId: string | undefined;
          let viewerUsername: string | undefined;
          let viewerDisplayName: string | undefined;
          
          // Chat message events
          if (eventType === 'channel.chat.message') {
            viewerId = eventPayload.chatter_user_id;
            viewerUsername = eventPayload.chatter_user_login;
            viewerDisplayName = eventPayload.chatter_user_name;
            console.log('💬 Chat message from:', viewerUsername, '(ID:', viewerId, ')');
          }
          // Most other events use user_id, user_login, user_name
          else if (eventPayload.user_id) {
            viewerId = eventPayload.user_id;
            viewerUsername = eventPayload.user_login;
            viewerDisplayName = eventPayload.user_name;
            console.log('👤 Event from user:', viewerUsername, '(ID:', viewerId, ')');
          }
          // Raid events use from_broadcaster_*
          else if (eventPayload.from_broadcaster_user_id) {
            viewerId = eventPayload.from_broadcaster_user_id;
            viewerUsername = eventPayload.from_broadcaster_user_login;
            viewerDisplayName = eventPayload.from_broadcaster_user_name;
            console.log('🎯 Raid from:', viewerUsername, '(ID:', viewerId, ')');
          }
            // Create or update viewer if we have their info
          if (viewerId && viewerUsername) {
            console.log('👥 Creating/updating viewer:', viewerUsername);
            const viewerResult = await db.getOrCreateViewer(viewerId, viewerUsername, viewerDisplayName);
            console.log('👥 Viewer result:', viewerResult);
          }
          
          // Store the event - use broadcaster_user_id from event, fallback to userIdValue
          const eventChannelId = eventPayload.broadcaster_user_id || userIdValue;
          console.log('💾 Storing event for channel:', eventChannelId);
          const result = await db.storeEvent(eventType, eventPayload, eventChannelId, viewerId);
          console.log('💾 Store result:', result);
          if (result.success) {
            console.log('✅ Event stored with ID:', result.id);
          } else {
            console.error('❌ Failed to store event:', result.error);
          }
        } else {
          console.log('⚠️ Missing event type or payload');
        }
      },
      onReconnect: () => {
        setStatusMessage({
          type: 'info',
          message: 'Reconnecting to Twitch...'
        });
      },
      onError: (error: Error) => {
        setStatusMessage({
          type: 'error',
          message: `WebSocket error: ${error.message}`
        });
      },
      onClose: () => {
        setStatusMessage({
          type: 'info',
          message: 'WebSocket connection closed'
        });
      }
    });    setWsConnection(ws);
  };

  const handleDisconnected = async () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
    
    // End current session in database
    await db.endCurrentSession();
    
    // Keep token for auto-reconnect (don't delete it)
    // If you want to force re-login, uncomment this:
    // await db.deleteToken(userId);
    
    setClientId('');
    setAccessToken('');
    setUserId('');
    setUserLogin('');
    setBroadcasterId('');
    setBroadcasterLogin('');
    setIsBroadcaster(false);    setSessionId('');
    setStatusMessage(null);
  };  return (
    <div className="content">
      {isAutoReconnecting ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Restoring previous session...</h2>
          <p style={{ color: '#888' }}>Please wait</p>
        </div>
      ) : (
        <>          <Connection 
            onConnected={handleConnected}
            onDisconnected={handleDisconnected}
            isConnected={!!accessToken}
            connectedUserLogin={userLogin}
            connectedUserId={userId}
          />
          
          {sessionId && (
            <EventSubscriptions
              userId={userId}
              accessToken={accessToken}
              clientId={clientId}
              sessionId={sessionId}
              broadcasterId={broadcasterId}
              broadcasterLogin={broadcasterLogin}
              isBroadcaster={isBroadcaster}
            />
          )}
        </>
      )}
    </div>
  );
};
