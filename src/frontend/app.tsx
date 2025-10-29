import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Menu } from './components/Menu';
import { ConnectionScreen } from './screens/connection/connection';
import { EventsScreen } from './screens/events/events';
import { ChatScreen } from './screens/chat/chat';
import { ViewersScreen } from './screens/viewers/viewers';
import { TTS } from './screens/tts/tts';
import { Discord } from './screens/discord/discord';
import { AdvancedScreen } from './screens/advanced/advanced';
import * as db from './services/database';
import * as ttsService from './services/tts';

const { ipcRenderer } = window.require('electron');

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<string>('connection');
  const [channelId, setChannelId] = useState<string>('');
  const [connectionState, setConnectionState] = useState({
    userId: '',
    clientId: '',
    accessToken: '',
    sessionId: '',
    broadcasterId: '',
    broadcasterLogin: '',
    isBroadcaster: false
  });

  // Initialize voice syncing on app startup
  useEffect(() => {
    const initializeVoiceSync = async () => {
      try {
        console.log('[App] Initializing voice sync on startup...');
        const result = await ttsService.initializeVoiceSync();
        console.log('[App] Voice sync initialization result:', result);
      } catch (err: any) {
        console.error('[App] Error initializing voice sync:', err);
      }
    };
    
    initializeVoiceSync();
  }, []);

  // Load current session to get channel ID and connection state
  useEffect(() => {
    const loadSession = async () => {
      const session = await db.getCurrentSession();
      if (session) {
        setChannelId(session.channel_id);
        
        // Try to restore connection state
        const lastUserId = await db.getSetting('last_connected_user_id');
        const lastChannelId = await db.getSetting('last_connected_channel_id');
        const lastChannelLogin = await db.getSetting('last_connected_channel_login');
        const lastIsBroadcaster = await db.getSetting('last_is_broadcaster');
        
        if (lastUserId) {
          const token = await db.getToken(lastUserId);
          if (token && token.isValid) {
            setConnectionState({
              userId: lastUserId,
              clientId: token.clientId,
              accessToken: token.accessToken,
              sessionId: session.id?.toString() || '',
              broadcasterId: lastChannelId || session.channel_id,
              broadcasterLogin: lastChannelLogin || session.channel_login,
              isBroadcaster: lastIsBroadcaster === 'true'
            });
          }
        }
      }
    };
    loadSession();

    // Also listen for session changes
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, []);
  // Note: TTS speak handler is registered in services/tts.ts to prevent duplicate listeners
  const menuItems = [
    { id: 'connection', label: 'Connection' },
    { id: 'events', label: 'Events' },
    { id: 'chat', label: 'Chat' },
    { id: 'viewers', label: 'Viewers' },
    { id: 'tts', label: 'TTS' },
    { id: 'discord', label: 'Discord' },
    { id: 'advanced', label: 'Advanced', isBottom: true }
  ];  const renderScreen = () => {
    switch (activeScreen) {
      case 'connection':
        return <ConnectionScreen />;
      case 'events':
        return <EventsScreen channelId={channelId} />;
      case 'chat':
        return <ChatScreen channelId={channelId} />;
      case 'viewers':
        return <ViewersScreen />;
      case 'tts':
        return <TTS />;
      case 'discord':
        return <Discord />;
      case 'advanced':
        return <AdvancedScreen 
          userId={connectionState.userId}
          clientId={connectionState.clientId}
          accessToken={connectionState.accessToken}
          sessionId={connectionState.sessionId}
          broadcasterId={connectionState.broadcasterId}
          broadcasterLogin={connectionState.broadcasterLogin}
          isBroadcaster={connectionState.isBroadcaster}
        />;
      default:
        return <ConnectionScreen />;
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw' }}>
      <Menu
        items={menuItems}
        activeScreen={activeScreen}
        onNavigate={setActiveScreen}
      />
      {renderScreen()}
    </div>
  );
};

ReactDOM.render(<App />, document.getElementById('root'));
