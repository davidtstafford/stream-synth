import React, { useState } from 'react';
import * as db from '../services/database';

interface ExportImportProps {
  userId?: string;
  onImportComplete?: () => void;
}

export const ExportImport: React.FC<ExportImportProps> = ({ userId, onImportComplete }) => {
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
  const [preview, setPreview] = useState<any>(null);
  const [showPreview, setShowPreview] = useState(false);

  const handleExport = async () => {
    try {
      setMessage({ type: 'info', text: 'Preparing export...' });
      
      const result = await db.exportSettings();
      
      if (result.success && result.filePath) {
        setMessage({ 
          type: 'success', 
          text: `Settings exported successfully to: ${result.filePath}` 
        });
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Export failed' 
        });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Export failed' 
      });
    }
  };

  const handleImport = async () => {
    try {
      setMessage({ type: 'info', text: 'Importing settings...' });
      
      const result = await db.importSettings();
      
      if (result.success) {
        setMessage({ 
          type: 'success', 
          text: result.message || 'Settings imported successfully! Please restart the app to apply changes.' 
        });
        
        // Notify parent component
        if (onImportComplete) {
          onImportComplete();
        }
      } else {
        setMessage({ 
          type: 'error', 
          text: result.error || 'Import failed' 
        });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: error.message || 'Import failed' 
      });
    }
  };

  const handleShowPreview = async () => {
    try {
      const result = await db.getExportPreview();
      
      if (result.success && result.preview) {
        setPreview(result.preview);
        setShowPreview(true);
      } else {
        setMessage({ 
          type: 'error', 
          text: 'Failed to load preview' 
        });
      }
    } catch (error: any) {
      setMessage({ 
        type: 'error', 
        text: 'Failed to load preview' 
      });
    }
  };

  return (
    <div style={{ 
      marginTop: '40px', 
      padding: '20px', 
      background: '#252525', 
      borderRadius: '8px',
      border: '1px solid #333'
    }}>
      <h2 style={{ fontSize: '20px', marginBottom: '15px' }}>Backup & Restore</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '15px' }}>
          Export your settings, event preferences, and connection history to a backup file. 
          You can import this file later to restore your configuration.
        </p>
        
        <p style={{ color: '#ff6d6d', fontSize: '13px', marginBottom: '15px' }}>
          ⚠️ Note: OAuth tokens are NOT included in exports for security reasons. 
          You will need to log in again after importing.
        </p>
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <button
          onClick={handleExport}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9147ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#7c3dd4'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#9147ff'}
        >
          📤 Export Settings
        </button>

        <button
          onClick={handleImport}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4caf50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#45a049'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#4caf50'}
        >
          📥 Import Settings
        </button>

        <button
          onClick={handleShowPreview}
          style={{
            padding: '10px 20px',
            backgroundColor: '#555',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#666'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#555'}
        >
          👁️ Preview What Will Export
        </button>
      </div>

      {message && (
        <div style={{
          padding: '12px',
          marginBottom: '15px',
          borderRadius: '4px',
          backgroundColor: message.type === 'success' ? '#2d3d2d' : message.type === 'error' ? '#3d2d2d' : '#2d3d3d',
          border: `1px solid ${message.type === 'success' ? '#4d7a45' : message.type === 'error' ? '#7a4545' : '#4d5d7a'}`,
          color: message.type === 'success' ? '#6dff8e' : message.type === 'error' ? '#ff6d6d' : '#6d9eff'
        }}>
          {message.text}
        </div>
      )}      {showPreview && preview && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          border: '1px solid #444',
          maxHeight: '70vh',
          overflowY: 'auto'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ fontSize: '16px' }}>Export Preview</h3>
            <button
              onClick={() => setShowPreview(false)}
              style={{
                padding: '4px 12px',
                backgroundColor: '#444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Close
            </button>
          </div>
          
          <div style={{ fontSize: '13px', color: '#aaa' }}>
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#252525', borderRadius: '4px' }}>
              <p><strong>📅 Exported At:</strong> {new Date(preview.exported_at).toLocaleString()}</p>
              <p><strong>📦 Version:</strong> {preview.version}</p>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#9147ff', marginBottom: '8px' }}>📊 Export Summary</p>
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '10px'
              }}>
                <div style={{ padding: '10px', backgroundColor: '#2d3d2d', borderRadius: '4px', border: '1px solid #4d7a45' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px 0' }}>App Settings</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#6dff8e', margin: 0 }}>{preview.settings?.length || 0}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#2d3d2d', borderRadius: '4px', border: '1px solid #4d7a45' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px 0' }}>Event Profiles</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#6dff8e', margin: 0 }}>{preview.event_profiles?.length || 0}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#2d3d2d', borderRadius: '4px', border: '1px solid #4d7a45' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px 0' }}>TTS Settings</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#6dff8e', margin: 0 }}>{preview.tts_settings?.length || 0}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#2d3d2d', borderRadius: '4px', border: '1px solid #4d7a45' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px 0' }}>Viewer Preferences</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#6dff8e', margin: 0 }}>{preview.viewers?.length || 0}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#2d3d2d', borderRadius: '4px', border: '1px solid #4d7a45' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px 0' }}>Total Events</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#6dff8e', margin: 0 }}>{preview.event_profiles?.reduce((sum: number, p: any) => sum + p.events.length, 0) || 0}</p>
                </div>
                <div style={{ padding: '10px', backgroundColor: '#2d3d2d', borderRadius: '4px', border: '1px solid #4d7a45' }}>
                  <p style={{ fontSize: '11px', color: '#888', margin: '0 0 4px 0' }}>Connection History</p>
                  <p style={{ fontSize: '18px', fontWeight: 'bold', color: '#6dff8e', margin: 0 }}>{preview.connection_history?.length || 0}</p>
                </div>
              </div>
            </div>

            {preview.settings && preview.settings.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#9147ff', marginBottom: '8px' }}>⚙️ App Settings</p>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '8px'
                }}>
                  {preview.settings.slice(0, 6).map((setting: any, idx: number) => (
                    <div key={idx} style={{ 
                      padding: '8px',
                      backgroundColor: '#252525',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', color: '#6dff8e', fontWeight: 'bold' }}>{setting.key}</p>
                      <p style={{ margin: 0, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {typeof setting.value === 'string' ? setting.value.substring(0, 40) : JSON.stringify(setting.value).substring(0, 40)}
                      </p>
                    </div>
                  ))}
                  {preview.settings.length > 6 && (
                    <div style={{ 
                      padding: '8px',
                      backgroundColor: '#252525',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#888'
                    }}>
                      +{preview.settings.length - 6} more settings
                    </div>
                  )}
                </div>
              </div>
            )}

            {preview.tts_settings && preview.tts_settings.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#9147ff', marginBottom: '8px' }}>🔊 TTS Settings</p>
                <div style={{ 
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))',
                  gap: '8px'
                }}>
                  {preview.tts_settings.slice(0, 8).map((setting: any, idx: number) => (
                    <div key={idx} style={{ 
                      padding: '8px',
                      backgroundColor: '#252525',
                      borderRadius: '4px',
                      fontSize: '12px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', color: '#6dff8e', fontWeight: 'bold' }}>{setting.key}</p>
                      <p style={{ margin: 0, color: '#aaa', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {typeof setting.value === 'string' ? setting.value.substring(0, 40) : JSON.stringify(setting.value).substring(0, 40)}
                      </p>
                    </div>
                  ))}
                  {preview.tts_settings.length > 8 && (
                    <div style={{ 
                      padding: '8px',
                      backgroundColor: '#252525',
                      borderRadius: '4px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#888'
                    }}>
                      +{preview.tts_settings.length - 8} more settings
                    </div>
                  )}
                </div>
              </div>
            )}

            {preview.event_profiles && preview.event_profiles.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#9147ff', marginBottom: '8px' }}>🎯 Event Profiles ({preview.event_profiles.length})</p>
                {preview.event_profiles.map((profile: any, idx: number) => (
                  <div key={idx} style={{ 
                    marginBottom: '8px',
                    padding: '10px',
                    backgroundColor: '#252525',
                    borderRadius: '4px',
                    border: '1px solid #333'
                  }}>
                    <p style={{ margin: '0 0 6px 0', fontWeight: 'bold', color: '#9147ff' }}>
                      Profile #{idx + 1}: {profile.user_login || 'Unknown User'}
                    </p>
                    <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#aaa' }}>
                      📺 Monitoring: <strong>{profile.channel_login || 'Unknown Channel'}</strong>
                    </p>
                    <div style={{ fontSize: '12px' }}>
                      <p style={{ margin: '0 0 4px 0', color: '#888' }}>Events Configured: {profile.events.length}</p>
                      <div style={{ marginLeft: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {profile.events.slice(0, 5).map((event: string, eventIdx: number) => (
                          <span 
                            key={eventIdx}
                            style={{ 
                              fontSize: '11px',
                              padding: '2px 6px',
                              backgroundColor: '#1a1a1a',
                              borderRadius: '3px',
                              border: '1px solid #444',
                              color: '#6dff8e'
                            }}
                          >
                            {event}
                          </span>
                        ))}
                        {profile.events.length > 5 && (
                          <span style={{ 
                            fontSize: '11px',
                            padding: '2px 6px',
                            color: '#888'
                          }}>
                            +{profile.events.length - 5} more
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {preview.viewers && preview.viewers.length > 0 && (
              <div style={{ marginBottom: '15px' }}>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#9147ff', marginBottom: '8px' }}>👥 Viewer TTS Preferences ({preview.viewers.length})</p>
                <div style={{ 
                  maxHeight: '300px',
                  overflowY: 'auto',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: '10px'
                }}>
                  {preview.viewers.slice(0, 12).map((viewer: any, idx: number) => (
                    <div key={idx} style={{ 
                      padding: '10px',
                      backgroundColor: '#252525',
                      borderRadius: '4px',
                      border: '1px solid #333',
                      fontSize: '12px'
                    }}>
                      <p style={{ margin: '0 0 4px 0', fontWeight: 'bold', color: '#9147ff' }}>
                        {viewer.display_name || viewer.username}
                      </p>
                      <p style={{ margin: '0 0 4px 0', fontSize: '11px', color: '#aaa' }}>
                        @{viewer.username}
                      </p>
                      <div style={{ fontSize: '11px' }}>
                        <p style={{ margin: '0 0 2px 0', color: '#888' }}>
                          TTS Voice: <span style={{ color: viewer.tts_voice_id ? '#6dff8e' : '#ff9d6d' }}>
                            {viewer.tts_voice_id || 'Default'}
                          </span>
                        </p>
                        <p style={{ margin: 0, color: '#888' }}>
                          Status: <span style={{ color: viewer.tts_enabled ? '#6dff8e' : '#ff6d6d' }}>
                            {viewer.tts_enabled ? '✓ Enabled' : '✗ Disabled'}
                          </span>
                        </p>
                      </div>
                    </div>
                  ))}
                  {preview.viewers.length > 12 && (
                    <div style={{ 
                      padding: '10px',
                      backgroundColor: '#252525',
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#888',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      +{preview.viewers.length - 12} more viewers
                    </div>
                  )}
                </div>
              </div>
            )}

            {preview.connection_history && preview.connection_history.length > 0 && (
              <div>
                <p style={{ fontSize: '14px', fontWeight: 'bold', color: '#9147ff', marginBottom: '8px' }}>📜 Connection History ({preview.connection_history.length})</p>
                <div style={{ 
                  maxHeight: '200px',
                  overflowY: 'auto',
                  backgroundColor: '#252525',
                  borderRadius: '4px',
                  border: '1px solid #333'
                }}>
                  {preview.connection_history.map((entry: any, idx: number) => (
                    <div key={idx} style={{ 
                      padding: '8px 10px',
                      borderBottom: idx < preview.connection_history.length - 1 ? '1px solid #333' : 'none',
                      fontSize: '12px'
                    }}>
                      <p style={{ margin: '0 0 2px 0', color: '#6dff8e' }}>
                        {entry.user_login || 'Unknown'} → {entry.channel_login || 'Unknown'}
                      </p>
                      <p style={{ margin: 0, fontSize: '11px', color: '#888' }}>
                        {new Date(entry.connected_at).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
