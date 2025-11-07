import React, { useState, useEffect } from 'react';
import * as db from '../../services/database';
import { ViewerDetailsTab } from './tabs/ViewerDetailsTab';
import { ViewerHistoryTab } from './tabs/ViewerHistoryTab';
import { ModerationActionsTab } from './tabs/ModerationActionsTab';
import { EntranceSoundsTab } from './tabs/EntranceSoundsTab';

type TabType = 'details' | 'history' | 'moderation' | 'entrance-sounds';

export const ViewersScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [selectedViewerId, setSelectedViewerId] = useState<string | undefined>(undefined);
  const [broadcasterId, setBroadcasterId] = useState<string>('');
  const [accessToken, setAccessToken] = useState<string>('');
  const [clientId, setClientId] = useState<string>('');

  // Load credentials for moderation actions
  useEffect(() => {
    const loadCredentials = async () => {
      try {
        const session = await db.getCurrentSession();
        if (session) {
          const token = await db.getToken(session.user_id);
          if (token) {
            setBroadcasterId(session.channel_id);
            setAccessToken(token.accessToken);
            setClientId(token.clientId);
          }
        }
      } catch (err) {
        console.error('[Viewers] Failed to load credentials:', err);
      }
    };

    loadCredentials();
  }, []);

  const handleViewerClick = (viewer: db.ViewerWithSubscription) => {
    setSelectedViewerId(viewer.id);
    setActiveTab('history');
  };
  const renderTabButtons = () => (
    <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', borderBottom: '2px solid #333' }}>
      <button
        onClick={() => setActiveTab('details')}
        style={{
          padding: '12px 24px',
          backgroundColor: activeTab === 'details' ? '#9147ff' : 'transparent',
          color: activeTab === 'details' ? 'white' : '#888',
          border: 'none',
          borderBottom: activeTab === 'details' ? '3px solid #9147ff' : '3px solid transparent',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        Viewer Details
      </button>
      <button
        onClick={() => setActiveTab('history')}
        style={{
          padding: '12px 24px',
          backgroundColor: activeTab === 'history' ? '#9147ff' : 'transparent',
          color: activeTab === 'history' ? 'white' : '#888',
          border: 'none',
          borderBottom: activeTab === 'history' ? '3px solid #9147ff' : '3px solid transparent',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        Viewer History
      </button>
      <button
        onClick={() => setActiveTab('moderation')}
        style={{
          padding: '12px 24px',
          backgroundColor: activeTab === 'moderation' ? '#9147ff' : 'transparent',
          color: activeTab === 'moderation' ? 'white' : '#888',
          border: 'none',
          borderBottom: activeTab === 'moderation' ? '3px solid #9147ff' : '3px solid transparent',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        Moderation Actions
      </button>
      <button
        onClick={() => setActiveTab('entrance-sounds')}
        style={{
          padding: '12px 24px',
          backgroundColor: activeTab === 'entrance-sounds' ? '#9147ff' : 'transparent',
          color: activeTab === 'entrance-sounds' ? 'white' : '#888',
          border: 'none',
          borderBottom: activeTab === 'entrance-sounds' ? '3px solid #9147ff' : '3px solid transparent',
          cursor: 'pointer',
          fontSize: '14px',
          fontWeight: 'bold',
          transition: 'all 0.2s'
        }}
      >
        Entrance Sounds
      </button>
    </div>
  );

  return (
    <div className="content">
      <h2>Viewers</h2>
      
      {renderTabButtons()}

      {activeTab === 'details' && (
        <ViewerDetailsTab onViewerClick={handleViewerClick} />
      )}      {activeTab === 'history' && (
        <ViewerHistoryTab preselectedViewerId={selectedViewerId} />
      )}

      {activeTab === 'moderation' && (
        <ModerationActionsTab
          preselectedViewerId={selectedViewerId}
          broadcasterId={broadcasterId}
          accessToken={accessToken}
          clientId={clientId}
        />
      )}

      {activeTab === 'entrance-sounds' && (
        <EntranceSoundsTab />
      )}
    </div>
  );
};
