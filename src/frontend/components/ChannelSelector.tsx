import React, { useState } from 'react';

interface ChannelSelectorProps {
  clientId: string;
  accessToken: string;
  currentUserId: string;
  onChannelSelected: (channelId: string, channelLogin: string, isBroadcaster: boolean) => void;
}

interface StatusMessage {
  type: 'success' | 'error' | 'info';
  message: string;
}

export const ChannelSelector: React.FC<ChannelSelectorProps> = ({
  clientId,
  accessToken,
  currentUserId,
  onChannelSelected
}) => {
  const [channelName, setChannelName] = useState<string>('');
  const [isSearching, setIsSearching] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<StatusMessage | null>(null);
  const [selectedChannel, setSelectedChannel] = useState<{ id: string; login: string } | null>(null);

  const handleSearch = async () => {
    if (!channelName.trim()) {
      setStatusMessage({
        type: 'error',
        message: 'Please enter a channel name'
      });
      return;
    }

    setIsSearching(true);
    setStatusMessage({
      type: 'info',
      message: 'Searching for channel...'
    });

    try {
      const response = await fetch(`https://api.twitch.tv/helix/users?login=${channelName.trim()}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });

      const data = await response.json();

      if (data.data && data.data.length > 0) {
        const channel = data.data[0];
        const isBroadcaster = channel.id === currentUserId;
        
        setSelectedChannel({ id: channel.id, login: channel.login });
        setStatusMessage({
          type: 'success',
          message: isBroadcaster 
            ? `Found your channel: ${channel.display_name}` 
            : `Found channel: ${channel.display_name} (monitoring as moderator)`
        });
        
        onChannelSelected(channel.id, channel.login, isBroadcaster);
      } else {
        setStatusMessage({
          type: 'error',
          message: `Channel "${channelName}" not found`
        });
      }
    } catch (error: any) {
      setStatusMessage({
        type: 'error',
        message: `Error searching for channel: ${error.message}`
      });
    } finally {
      setIsSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <div style={{ marginTop: '30px', paddingTop: '30px', borderTop: '1px solid #333' }}>
      <h2 style={{ fontSize: '20px', marginBottom: '20px', fontWeight: '500' }}>
        Channel to Monitor
      </h2>
      
      <div className="form-group">
        <label className="form-label" htmlFor="channel-name">
          Enter Channel Name
        </label>
        <div style={{ display: 'flex', gap: '10px', maxWidth: '400px' }}>
          <input
            id="channel-name"
            type="text"
            className="form-input"
            value={channelName}
            onChange={(e) => setChannelName(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="e.g., ninja, shroud"
            disabled={isSearching}
            style={{ flex: 1 }}
          />
          <button
            className="btn"
            onClick={handleSearch}
            disabled={isSearching || !channelName.trim()}
          >
            {isSearching ? 'Searching...' : 'Find Channel'}
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`status-message status-${statusMessage.type}`}>
          {statusMessage.message}
        </div>
      )}

      {selectedChannel && (
        <div className="form-group" style={{ marginTop: '20px' }}>
          <label className="form-label">
            Monitoring Channel
          </label>
          <div className="form-input" style={{ opacity: 0.7 }}>
            {selectedChannel.login} (ID: {selectedChannel.id})
          </div>
        </div>
      )}
    </div>
  );
};
