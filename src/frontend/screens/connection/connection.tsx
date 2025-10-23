import React, { useState, useEffect } from 'react';
import { Connection } from '../../components/Connection';
import { ChannelSelector } from '../../components/ChannelSelector';
import { EventSubscriptions } from '../../components/EventSubscriptions';
import { ExportImport } from '../../components/ExportImport';
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
  const [sessionId, setSessionId] = useState<string>('');
  const [wsConnection, setWsConnection] = useState<any>(null);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [showChannelSelector, setShowChannelSelector] = useState<boolean>(false);
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
          onSessionWelcome: (sessionIdValue: string) => {
            setSessionId(sessionIdValue);
            setStatusMessage({
              type: 'success',
              message: `Auto-reconnected! Monitoring: ${lastChannelLogin || user.login}`
            });
          },
          onKeepalive: () => {},
          onNotification: async (data: any) => {
            console.log('🔔 Event received (full):', JSON.stringify(data, null, 2));
            
            // Extract event type and payload
            const eventType = data.subscription?.type || data.payload?.subscription?.type;
            const eventPayload = data.event || data.payload?.event;
            
            console.log('📝 Event type:', eventType);
            console.log('📦 Event payload:', eventPayload);
            
            if (eventType && eventPayload) {
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
              
              // Store the event
              const channelId = lastChannelId || user.id;
              console.log('💾 Storing event for channel:', channelId);
              const result = await db.storeEvent(eventType, eventPayload, channelId, viewerId);
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
    });

    // Save settings for auto-reconnect
    await db.setSetting('last_connected_user_id', userIdValue);
    await db.setSetting('last_connected_channel_id', userIdValue);
    await db.setSetting('last_connected_channel_login', userLoginValue);
    await db.setSetting('last_is_broadcaster', 'true');
    
    // Initialize WebSocket immediately
    setStatusMessage({
      type: 'info',
      message: 'Connecting to Twitch WebSocket...'
    });

    const ws = createWebSocketConnection({
      onSessionWelcome: (sessionIdValue: string) => {
        setSessionId(sessionIdValue);
        setStatusMessage({
          type: 'success',
          message: `WebSocket session established! Monitoring: ${userLoginValue}`
        });
      },
      onKeepalive: () => {
        // Keepalive received
      },
      onNotification: async (data: any) => {
        console.log('🔔 Event received (full):', JSON.stringify(data, null, 2));
        
        // Extract event type and payload
        const eventType = data.subscription?.type || data.payload?.subscription?.type;
        const eventPayload = data.event || data.payload?.event;
        
        console.log('📝 Event type:', eventType);
        console.log('📦 Event payload:', eventPayload);
        
        if (eventType && eventPayload) {
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
          
          // Store the event
          console.log('💾 Storing event for channel:', broadcasterId);
          const result = await db.storeEvent(eventType, eventPayload, broadcasterId, viewerId);
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
  };

  const handleChannelSelected = async (channelId: string, channelLogin: string, isBroadcasterFlag: boolean) => {
    setBroadcasterId(channelId);
    setBroadcasterLogin(channelLogin);
    setIsBroadcaster(isBroadcasterFlag);
    setShowChannelSelector(false);
    
    // Update saved channel settings
    await db.setSetting('last_connected_channel_id', channelId);
    await db.setSetting('last_connected_channel_login', channelLogin);
    await db.setSetting('last_is_broadcaster', isBroadcasterFlag.toString());
    
    // Update status message
    setStatusMessage({
      type: 'success',
      message: `Now monitoring: ${channelLogin}`
    });
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
    setIsBroadcaster(false);
    setSessionId('');
    setStatusMessage(null);
    setShowChannelSelector(false);
  };

  const handleImportComplete = () => {
    setStatusMessage({
      type: 'success',
      message: 'Settings imported! Please restart the app to apply changes.'
    });
  };

  return (
    <div className="content">
      {isAutoReconnecting ? (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <h2>Restoring previous session...</h2>
          <p style={{ color: '#888' }}>Please wait</p>
        </div>
      ) : (
        <Connection 
          onConnected={handleConnected}
          onDisconnected={handleDisconnected}
        />
      )}

      {accessToken && broadcasterId && !showChannelSelector && (
        <div style={{ marginTop: '20px', marginBottom: '20px' }}>
          <p>
            <strong>Monitoring Channel:</strong> {broadcasterLogin} (ID: {broadcasterId})
            {isBroadcaster && ' (Your Channel)'}
          </p>
          <button 
            onClick={() => setShowChannelSelector(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Change Channel
          </button>
        </div>
      )}

      {accessToken && showChannelSelector && (
        <ChannelSelector
          clientId={clientId}
          accessToken={accessToken}
          currentUserId={userId}
          onChannelSelected={handleChannelSelected}
        />
      )}

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {accessToken && broadcasterId && sessionId && !showChannelSelector && (
        <EventSubscriptions
          clientId={clientId}
          accessToken={accessToken}
          sessionId={sessionId}
          broadcasterId={broadcasterId}
          broadcasterLogin={broadcasterLogin}
          userId={userId}
          isBroadcaster={isBroadcaster}
        />
      )}

      <ExportImport 
        userId={userId}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};
