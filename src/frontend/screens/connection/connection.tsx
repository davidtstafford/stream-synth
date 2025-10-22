import React, { useState } from 'react';
import { Connection } from '../../components/Connection';
import { ChannelSelector } from '../../components/ChannelSelector';
import { EventSubscriptions } from '../../components/EventSubscriptions';
import { createWebSocketConnection } from '../../services/websocket';

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

  const handleConnected = async (clientIdValue: string, accessTokenValue: string, userIdValue: string, userLoginValue: string) => {
    setClientId(clientIdValue);
    setAccessToken(accessTokenValue);
    setUserId(userIdValue);
    setUserLogin(userLoginValue);
    
    // Auto-connect to own channel
    setBroadcasterId(userIdValue);
    setBroadcasterLogin(userLoginValue);
    setIsBroadcaster(true);
    
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
      onNotification: (data: any) => {
        // Handle notifications
        console.log('Event received:', data);
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

  const handleChannelSelected = (channelId: string, channelLogin: string, isBroadcasterFlag: boolean) => {
    setBroadcasterId(channelId);
    setBroadcasterLogin(channelLogin);
    setIsBroadcaster(isBroadcasterFlag);
    setShowChannelSelector(false);
    
    // Update status message
    setStatusMessage({
      type: 'success',
      message: `Now monitoring: ${channelLogin}`
    });
  };

  const handleDisconnected = () => {
    if (wsConnection) {
      wsConnection.close();
      setWsConnection(null);
    }
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

  return (
    <div className="content">
      <Connection 
        onConnected={handleConnected}
        onDisconnected={handleDisconnected}
      />

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
          userId={userId}
          isBroadcaster={isBroadcaster}
        />
      )}
    </div>
  );
};
