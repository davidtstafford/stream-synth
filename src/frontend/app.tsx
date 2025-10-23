import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Menu } from './components/Menu';
import { ConnectionScreen } from './screens/connection/connection';
import { EventsScreen } from './screens/events/events';
import { ChatScreen } from './screens/chat/chat';
import { ViewersScreen } from './screens/viewers/viewers';
import { TTS } from './screens/tts/tts';
import { Discord } from './screens/discord/discord';
import * as db from './services/database';

const { ipcRenderer } = window.require('electron');

const App: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<string>('connection');
  const [channelId, setChannelId] = useState<string>('');

  // Load current session to get channel ID
  useEffect(() => {
    const loadSession = async () => {
      const session = await db.getCurrentSession();
      if (session) {
        setChannelId(session.channel_id);
      }
    };
    loadSession();

    // Also listen for session changes
    const interval = setInterval(loadSession, 5000);
    return () => clearInterval(interval);
  }, []);

  // Listen for TTS speak commands from backend
  useEffect(() => {
    const handleTTSSpeak = (event: any, data: any) => {
      const { text, voiceId, volume, rate, pitch } = data;
      
      // Use Web Speech API
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Find the voice
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find(v => v.voiceURI === voiceId || v.name === voiceId);
      
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.volume = volume / 100; // Convert 0-100 to 0-1
      utterance.rate = rate;
      utterance.pitch = pitch;
      
      console.log('[TTS Renderer] Speaking:', text, 'with voice:', voice?.name || 'default');
      window.speechSynthesis.speak(utterance);
    };

    ipcRenderer.on('tts:speak', handleTTSSpeak);

    // Cleanup
    return () => {
      ipcRenderer.removeListener('tts:speak', handleTTSSpeak);
    };
  }, []);

  const menuItems = [
    { id: 'connection', label: 'Connection' },
    { id: 'events', label: 'Events' },
    { id: 'chat', label: 'Chat' },
    { id: 'viewers', label: 'Viewers' },
    { id: 'tts', label: 'TTS' },
    { id: 'discord', label: 'Discord' }
  ];

  const renderScreen = () => {
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
