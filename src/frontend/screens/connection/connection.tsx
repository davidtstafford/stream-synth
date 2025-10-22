import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');
const WebSocket = window.require('ws');

interface ConnectionScreenProps {}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ConnectionScreen: React.FC<ConnectionScreenProps> = () => {
  const [clientId, setClientId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [wsConnection, setWsConnection] = useState<any>(null);

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
        
        if (message.metadata?.message_type === 'session_welcome') {
          setStatusMessage({
            type: 'success',
            message: `WebSocket session established! Session ID: ${message.payload?.session?.id?.substring(0, 8)}...`
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
    setStatusMessage(null);
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
    </div>
  );
};
