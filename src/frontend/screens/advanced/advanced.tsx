import React, { useState, useEffect } from 'react';
import { ExportImport } from '../../components/ExportImport';
import { 
  getAllPollingConfigs, 
  updatePollingInterval, 
  setPollingEnabled,
  PollingConfig 
} from '../../services/twitch-polling';

interface AdvancedScreenProps {
  userId?: string;
}

export const AdvancedScreen: React.FC<AdvancedScreenProps> = ({ userId }) => {
  const [pollingConfigs, setPollingConfigs] = useState<PollingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);

  // Load polling configs on mount
  useEffect(() => {
    loadPollingConfigs();
  }, []);

  const loadPollingConfigs = async () => {
    try {
      setLoading(true);
      const configs = await getAllPollingConfigs();
      setPollingConfigs(configs);
    } catch (error) {
      console.error('Failed to load polling configs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleIntervalChange = async (apiType: string, newInterval: number) => {
    try {
      await updatePollingInterval(apiType, newInterval);
      
      // Update local state
      setPollingConfigs(prev => 
        prev.map(config => 
          config.api_type === apiType 
            ? { ...config, interval_minutes: newInterval }
            : config
        )
      );

      // Show success message
      setUpdateMessage(`✓ Updated ${apiType} interval to ${newInterval} minutes`);
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update interval:', error);
      setUpdateMessage(`✗ Failed to update ${apiType} interval`);
      setTimeout(() => setUpdateMessage(null), 3000);
    }
  };

  const handleEnabledToggle = async (apiType: string, enabled: boolean) => {
    try {
      await setPollingEnabled(apiType, enabled);
      
      // Update local state
      setPollingConfigs(prev => 
        prev.map(config => 
          config.api_type === apiType 
            ? { ...config, enabled, isRunning: enabled }
            : config
        )
      );

      setUpdateMessage(`✓ ${enabled ? 'Enabled' : 'Disabled'} ${apiType}`);
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (error) {
      console.error('Failed to toggle enabled:', error);
      setUpdateMessage(`✗ Failed to update ${apiType}`);
      setTimeout(() => setUpdateMessage(null), 3000);
    }
  };

  const handleImportComplete = () => {
    console.log('Import completed');
  };

  // Helper to format API type names for display
  const formatApiTypeName = (apiType: string): string => {
    const names: Record<string, string> = {
      role_sync: 'Role Sync (Subs, VIPs, Mods)',
      subscribers: 'Subscribers Only',
      vips: 'VIPs Only',
      moderators: 'Moderators Only',
    };
    return names[apiType] || apiType;
  };

  // Helper to get interval label
  const getIntervalLabel = (minutes: number): string => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (mins === 0) return `${hours}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="content">
      <h1 className="screen-title">Advanced Settings</h1>
      
      <div style={{ color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>
        <p>Advanced options for managing your application data and settings.</p>
      </div>

      {/* Twitch API Polling Configuration */}
      <div style={{ 
        background: '#2a2a2a', 
        border: '1px solid #555', 
        borderRadius: '8px', 
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '10px',
          color: '#fff'
        }}>
          🔄 Twitch API Polling Settings
        </h2>
        
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
          Configure how often the app syncs data from Twitch Helix APIs. Lower values = more frequent updates but more API calls.
        </p>

        {updateMessage && (
          <div style={{
            padding: '10px 15px',
            marginBottom: '15px',
            background: updateMessage.startsWith('✓') ? '#2d5a2d' : '#5a2d2d',
            border: `1px solid ${updateMessage.startsWith('✓') ? '#4a8a4a' : '#8a4a4a'}`,
            borderRadius: '5px',
            color: '#fff',
            fontSize: '14px'
          }}>
            {updateMessage}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>
            Loading configurations...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {pollingConfigs.map(config => (
              <div 
                key={config.api_type}
                style={{
                  background: '#1e1e1e',
                  border: '1px solid #444',
                  borderRadius: '5px',
                  padding: '15px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <div>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 'bold', 
                      color: '#fff',
                      marginBottom: '5px'
                    }}>
                      {formatApiTypeName(config.api_type)}
                    </div>
                    {config.description && (
                      <div style={{ fontSize: '13px', color: '#888' }}>
                        {config.description}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: config.enabled ? '#4CAF50' : '#888'
                    }}>
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => handleEnabledToggle(config.api_type, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      Enabled
                    </label>
                    
                    {config.isRunning && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#4CAF50',
                        padding: '2px 6px',
                        background: '#1a3a1a',
                        borderRadius: '3px'
                      }}>
                        ● Running
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    color: '#ccc',
                    marginBottom: '8px'
                  }}>
                    Sync Frequency: <strong style={{ color: '#fff' }}>{getIntervalLabel(config.interval_minutes)}</strong>
                  </label>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <input
                      type="range"
                      min="5"
                      max="120"
                      step="5"
                      value={config.interval_minutes}
                      onChange={(e) => handleIntervalChange(config.api_type, parseInt(e.target.value))}
                      disabled={!config.enabled}
                      style={{
                        flex: 1,
                        cursor: config.enabled ? 'pointer' : 'not-allowed',
                        opacity: config.enabled ? 1 : 0.5
                      }}
                    />
                    
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#888',
                      minWidth: '100px',
                      textAlign: 'right'
                    }}>
                      5 min ↔ 2 hours
                    </div>
                  </div>

                  {config.last_poll_at && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      marginTop: '8px'
                    }}>
                      Last synced: {new Date(config.last_poll_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '5px',
          fontSize: '13px',
          color: '#aaa'
        }}>
          <strong style={{ color: '#fff' }}>ℹ️ Note:</strong> Changes take effect immediately. 
          Manual sync is always available regardless of these settings. 
          Currently, only "Role Sync" is active; individual syncing coming soon.
        </div>
      </div>

      {/* Export/Import Section */}
      <ExportImport 
        userId={userId}
        onImportComplete={handleImportComplete}
      />
    </div>
  );
};
