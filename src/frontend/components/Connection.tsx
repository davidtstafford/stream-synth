import React, { useState } from 'react';

const { ipcRenderer } = window.require('electron');

const TWITCH_CLIENT_ID = 'ju6sit0u97ta9fbzxr8egs2v75k0ic';

interface ConnectionProps {
  onConnected: (clientId: string, accessToken: string, userId: string, userLogin: string) => void;
  onDisconnected: () => void;
}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

export const Connection: React.FC<ConnectionProps> = ({ onConnected, onDisconnected }) => {
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
      const result: any = await ipcRenderer.invoke('twitch-oauth', TWITCH_CLIENT_ID);
      
      if (result.success && result.accessToken) {
        setAccessToken(result.accessToken);
        
        // Fetch user info to get their ID and username
        const userResponse = await fetch('https://api.twitch.tv/helix/users', {
          headers: {
            'Authorization': `Bearer ${result.accessToken}`,
            'Client-Id': TWITCH_CLIENT_ID
          }
        });
        
        const userData = await userResponse.json();
        const user = userData.data[0];
        
        setUserId(user.id);
        setUserLogin(user.login);
        
        setStatusMessage({
          type: 'success',
          message: `Successfully authenticated as ${user.display_name}!`
        });
        
        onConnected(TWITCH_CLIENT_ID, result.accessToken, user.id, user.login);
      } else {
        throw new Error(result.error || 'Authentication failed');
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

  const handleDisconnect = () => {
    setAccessToken('');
    setUserId('');
    setUserLogin('');
    setStatusMessage(null);
    onDisconnected();
  };

  return (
    <div>
      <h1 className="screen-title">Connection</h1>
      
      {!accessToken ? (
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
              {userLogin} (ID: {userId})
            </div>
          </div>
          
          <button
            className="btn"
            onClick={handleDisconnect}
          >
            Disconnect
          </button>
        </>
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
