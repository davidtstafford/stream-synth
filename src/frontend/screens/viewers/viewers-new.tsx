import React, { useState } from 'react';
import * as db from '../../services/database';
import { ViewerDetailsTab } from './tabs/ViewerDetailsTab';
import { ViewerHistoryTab } from './tabs/ViewerHistoryTab';

type TabType = 'details' | 'history';

export const ViewersScreen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('details');
  const [selectedViewerId, setSelectedViewerId] = useState<string | undefined>(undefined);

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
    </div>
  );

  return (
    <div className="content">
      <h2>Viewers</h2>
      
      {renderTabButtons()}

      {activeTab === 'details' && (
        <ViewerDetailsTab onViewerClick={handleViewerClick} />
      )}

      {activeTab === 'history' && (
        <ViewerHistoryTab preselectedViewerId={selectedViewerId} />
      )}
    </div>
  );
};
