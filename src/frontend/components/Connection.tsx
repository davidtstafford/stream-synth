import React, { useState } from 'react';
import * as db from '../services/database';

const { ipcRenderer } = window.require('electron');

const TWITCH_CLIENT_ID = 'ju6sit0u97ta9fbzxr8egs2v75k0ic';

interface ConnectionProps {
  onConnected: (clientId: string, accessToken: string, userId: string, userLogin: string) => void;
  onDisconnected: () => void;
  isConnected?: boolean;
  connectedUserLogin?: string;
  connectedUserId?: string;
}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

export const Connection: React.FC<ConnectionProps> = ({ 
  onConnected, 
  onDisconnected,
  isConnected = false,
  connectedUserLogin = '',
  connectedUserId = ''
}) => {
  const [accessToken, setAccessToken] = useState<string>('');
  const [userLogin, setUserLogin] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [isConnecting, setIsConnecting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const handleConnect = async () => {
    setIsConnecting(true);
    setStatusMessage({
      type: 'info',
      message: 'Opening Twitch authentication...'
    });

    try {
      const response: any = await ipcRenderer.invoke('twitch-oauth', TWITCH_CLIENT_ID);
      
      if (!response.success) {
        throw new Error(response.error || 'Authentication failed');
      }

      const accessToken = response.data; // IPC Framework wraps return value in { success, data }

      if (!accessToken) {
        throw new Error('No access token returned');
      }

      setAccessToken(accessToken);
      
      // Fetch user info to get their ID and username
      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': TWITCH_CLIENT_ID
        }
      });
      
      if (!userResponse.ok) {
        throw new Error(`Failed to fetch user info: ${userResponse.statusText}`);
      }

      const userData = await userResponse.json();
      const user = userData.data[0];
      
      setUserId(user.id);
      setUserLogin(user.login);
      
      setStatusMessage({
        type: 'success',
        message: `Successfully authenticated as ${user.display_name}!`
      });
      
      onConnected(TWITCH_CLIENT_ID, accessToken, user.id, user.login);
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        message: `Authentication failed: ${error.message}`
      });
    } finally {
      setIsConnecting(false);
    }
  };
  const handleDisconnect = () => {
    setAccessToken('');
    setUserId('');
    setUserLogin('');
    setStatusMessage(null);
    onDisconnected();
  };

  const handleForgetCredentials = async () => {
    if (!confirm('Are you sure? This will delete all saved tokens and session information. You will need to log in again.')) {
      return;
    }
    
    try {
      setStatusMessage({
        type: 'info',
        message: 'Removing credentials...'
      });

      const userIdToForget = userId || connectedUserId;
      const savedToken = await db.getToken(userIdToForget);
      
      if (savedToken) {
        await db.deleteToken(userIdToForget);
      }
      
      // Clear saved settings
      await db.setSetting('last_connected_user_id', '');
      await db.setSetting('last_connected_channel_id', '');
      await db.setSetting('last_connected_channel_login', '');
      await db.setSetting('last_is_broadcaster', '');

      setAccessToken('');
      setUserId('');
      setUserLogin('');
      
      setStatusMessage({
        type: 'success',
        message: 'Credentials removed. You are now logged out.'
      });
      
      onDisconnected();
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        message: `Error: ${error.message}`
      });
    }
  };
  return (
    <div>
      <h1 className="screen-title">Connection</h1>
      
      {!accessToken && !isConnected ? (
        <button
          className="btn"
          onClick={handleConnect}
          disabled={isConnecting}
        >
          {isConnecting ? 'Connecting...' : 'Connect to Twitch'}
        </button>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">
              Connected as
            </label>
            <div className="form-input" style={{ opacity: 0.7 }}>
              {userLogin || connectedUserLogin} (ID: {userId || connectedUserId})
            </div>
          </div>
          
          <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
            <button
              className="btn"
              onClick={handleDisconnect}
              style={{ flex: 1 }}
            >
              Disconnect
            </button>
            <button
              className="btn"
              onClick={handleForgetCredentials}
              style={{ flex: 1, backgroundColor: '#c14d3d' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#a13d2d'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#c14d3d'}
            >
              Forget Credentials
            </button>
          </div>
        </>
      )}

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {(accessToken || isConnected) && (
        <div className="form-group" style={{ marginTop: '30px' }}>
          <label className="form-label">
            Access Token (truncated)
          </label>
          <div className="form-input" style={{ opacity: 0.7 }}>
            {(accessToken || '••••••••••••••••••••').substring(0, 20)}...
          </div>
        </div>
      )}
    </div>
  );
};
