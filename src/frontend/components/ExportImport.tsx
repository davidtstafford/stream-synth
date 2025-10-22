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
      )}

      {showPreview && preview && (
        <div style={{
          marginTop: '20px',
          padding: '15px',
          backgroundColor: '#1a1a1a',
          borderRadius: '4px',
          border: '1px solid #444'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
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
            <p><strong>Version:</strong> {preview.version}</p>
            <p><strong>Exported At:</strong> {new Date(preview.exported_at).toLocaleString()}</p>
            
            <div style={{ marginTop: '15px' }}>
              <p><strong>📊 What will be exported:</strong></p>
              <ul style={{ marginLeft: '20px', marginTop: '8px' }}>
                <li>⚙️ {preview.settings?.length || 0} app settings</li>
                <li>🎯 {preview.event_profiles?.length || 0} event profiles (
                  {preview.event_profiles?.reduce((sum: number, p: any) => sum + p.events.length, 0) || 0} total events)
                </li>
                <li>📜 {preview.connection_history?.length || 0} connection history entries</li>
              </ul>
            </div>

            {preview.event_profiles && preview.event_profiles.length > 0 && (
              <div style={{ marginTop: '15px' }}>
                <p><strong>Event Profiles:</strong></p>
                {preview.event_profiles.slice(0, 3).map((profile: any, idx: number) => (
                  <div key={idx} style={{ 
                    marginLeft: '20px', 
                    marginTop: '8px',
                    padding: '8px',
                    backgroundColor: '#252525',
                    borderRadius: '4px'
                  }}>
                    <p>👤 {profile.user_login || 'Unknown'} → 📺 {profile.channel_login || 'Unknown'}</p>
                    <p style={{ fontSize: '12px', color: '#888' }}>
                      {profile.events.length} events configured
                    </p>
                  </div>
                ))}
                {preview.event_profiles.length > 3 && (
                  <p style={{ marginLeft: '20px', marginTop: '8px', color: '#888' }}>
                    ... and {preview.event_profiles.length - 3} more
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
