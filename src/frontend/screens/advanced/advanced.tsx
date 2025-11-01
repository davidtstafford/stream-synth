import React, { useState } from 'react';
import { BackupRestoreTab } from './tabs/BackupRestoreTab';
import { TwitchPollingTab } from './tabs/TwitchPollingTab';
import { EventSubStatusTab } from './tabs/EventSubStatusTab';

type TabType = 'backup' | 'polling' | 'eventsub';

interface AdvancedScreenProps {
  userId?: string;
  clientId?: string;
  accessToken?: string;
  sessionId?: string;
  broadcasterId?: string;
  broadcasterLogin?: string;
  isBroadcaster?: boolean;
}

export const AdvancedScreen: React.FC<AdvancedScreenProps> = ({
  userId,
  clientId = '',
  accessToken = '',
  sessionId = '',
  broadcasterId = '',
  broadcasterLogin = '',
  isBroadcaster = false
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('backup');

  const handleImportComplete = () => {
    console.log('Import completed');
  };

  return (
    <div className="content">
      <h1 className="screen-title">Advanced Settings</h1>

      <div style={{ color: '#aaa', marginBottom: '20px', fontSize: '14px' }}>
        <p style={{ margin: 0 }}>Advanced options for managing your application data, API polling, and EventSub connections.</p>
      </div>

      {/* Tab Navigation */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: '1px solid #444',
        paddingBottom: '0'
      }}>
        <button
          onClick={() => setActiveTab('backup')}
          style={{
            padding: '12px 20px',
            backgroundColor: activeTab === 'backup' ? '#9147ff' : 'transparent',
            color: activeTab === 'backup' ? '#fff' : '#aaa',
            border: 'none',
            borderBottom: activeTab === 'backup' ? '3px solid #9147ff' : 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'backup' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          💾 Backup & Restore
        </button>
        <button
          onClick={() => setActiveTab('polling')}
          style={{
            padding: '12px 20px',
            backgroundColor: activeTab === 'polling' ? '#9147ff' : 'transparent',
            color: activeTab === 'polling' ? '#fff' : '#aaa',
            border: 'none',
            borderBottom: activeTab === 'polling' ? '3px solid #9147ff' : 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'polling' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          🔄 Twitch Polling
        </button>
        <button
          onClick={() => setActiveTab('eventsub')}
          style={{
            padding: '12px 20px',
            backgroundColor: activeTab === 'eventsub' ? '#9147ff' : 'transparent',
            color: activeTab === 'eventsub' ? '#fff' : '#aaa',
            border: 'none',
            borderBottom: activeTab === 'eventsub' ? '3px solid #9147ff' : 'none',
            borderRadius: '4px 4px 0 0',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: activeTab === 'eventsub' ? 'bold' : 'normal',
            transition: 'all 0.2s ease'
          }}
        >
          📡 EventSub Status
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'backup' && (
        <BackupRestoreTab
          userId={userId}
          onImportComplete={handleImportComplete}
        />
      )}

      {activeTab === 'polling' && (
        <TwitchPollingTab />
      )}

      {activeTab === 'eventsub' && (
        <EventSubStatusTab
          userId={userId}
          accessToken={accessToken}
          clientId={clientId}
          broadcasterId={broadcasterId}
        />
      )}
    </div>
  );
};
