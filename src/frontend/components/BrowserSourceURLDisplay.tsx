import React from 'react';
import { getBrowserSourceURLs } from '../services/network';

interface BrowserSourceURLDisplayProps {
  path?: string;
  port?: number;
  title?: string;
  description?: string;
}

export const BrowserSourceURLDisplay: React.FC<BrowserSourceURLDisplayProps> = ({
  path = '/browser-source',
  port = 3737,
  title = '🔗 Browser Source URLs:',
  description = 'Add either URL as a Browser Source in OBS (recommended size: 800x600)'
}) => {
  const urls = getBrowserSourceURLs(path, port);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Could add a toast notification here
  };

  return (
    <div style={{ 
      padding: '12px', 
      backgroundColor: '#0d1f2d', 
      border: '1px solid #0078d4', 
      borderRadius: '4px',
      marginBottom: '15px'
    }}>
      <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{title}</div>
      
      {/* Localhost URL */}
      <div style={{ marginBottom: '10px' }}>
        <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>
          Local (same computer):
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ 
            flex: 1,
            fontFamily: 'monospace', 
            padding: '8px', 
            backgroundColor: '#1a1a1a', 
            borderRadius: '4px',
            wordBreak: 'break-all',
            fontSize: '13px'
          }}>
            {urls.localhost}
          </div>
          <button
            onClick={() => copyToClipboard(urls.localhost)}
            style={{
              padding: '8px 12px',
              backgroundColor: '#444',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              whiteSpace: 'nowrap'
            }}
            title="Copy to clipboard"
          >
            📋 Copy
          </button>
        </div>
      </div>

      {/* Network IP URL */}
      {urls.localIP ? (
        <div style={{ marginBottom: '10px' }}>
          <div style={{ fontSize: '0.85em', color: '#888', marginBottom: '4px' }}>
            Network (other computers on same network):
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ 
              flex: 1,
              fontFamily: 'monospace', 
              padding: '8px', 
              backgroundColor: '#1a1a1a', 
              borderRadius: '4px',
              wordBreak: 'break-all',
              fontSize: '13px'
            }}>
              {urls.localIP}
            </div>
            <button
              onClick={() => copyToClipboard(urls.localIP!)}
              style={{
                padding: '8px 12px',
                backgroundColor: '#444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px',
                whiteSpace: 'nowrap'
              }}
              title="Copy to clipboard"
            >
              📋 Copy
            </button>
          </div>
        </div>
      ) : (
        <div style={{ 
          fontSize: '0.85em', 
          color: '#ff8800', 
          padding: '8px',
          backgroundColor: '#2a2a1a',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          ⚠️ Could not detect network IP address. Use localhost URL if OBS is on the same computer.
        </div>
      )}

      {/* Description */}
      <div style={{ fontSize: '0.85em', color: '#888', marginTop: '8px' }}>
        {description}
      </div>
    </div>
  );
};
