import React from 'react';

export interface StreamDeckSetupGuideProps {
  onClose: () => void;
}

export const StreamDeckSetupGuide: React.FC<StreamDeckSetupGuideProps> = ({ onClose }) => {
  const handleClose = () => {
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '700px',
        maxHeight: '90vh',
        overflowY: 'auto',
        color: '#e0e0e0',
        border: '1px solid #444'
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '1.5em' }}>🎮 Stream Deck TTS Integration</h2>
          <button
            onClick={handleClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              fontSize: '1.5em',
              cursor: 'pointer',
              color: '#888',
              padding: '0',
              width: '30px',
              height: '30px'
            }}
          >
            ✕
          </button>
        </div>

        {/* Overview */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ color: '#aaa', lineHeight: '1.6' }}>
            Control the "Enable TTS" button remotely from your Stream Deck. This guide shows you how to set up a button that toggles TTS on and off with a single click.
          </p>
        </div>

        {/* Prerequisites */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#9147ff', marginTop: 0 }}>✓ Prerequisites</h3>
          <ul style={{ marginLeft: '20px', lineHeight: '1.8', color: '#ddd' }}>
            <li><strong>Stream Deck desktop app</strong> installed on your computer</li>
            <li><strong>Stream Synth running</strong> (needs to be active and connected)</li>
            <li><strong>Browser Source Server enabled</strong> (automatic on startup)</li>
            <li><strong>Same network or localhost</strong> (local use recommended)</li>
          </ul>
        </div>

        {/* Setup Steps */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#9147ff', marginTop: '20px' }}>📋 Setup Steps</h3>
          
          {/* Step 1 */}
          <div style={{ marginBottom: '18px', paddingBottom: '15px', borderBottom: '1px solid #444' }}>
            <h4 style={{ color: '#e0e0e0', margin: '0 0 10px 0' }}>Step 1: Open Stream Deck Desktop App</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6', margin: 0 }}>
              <li>Launch the <strong>Stream Deck desktop application</strong></li>
              <li>Select or create the profile where you want the button</li>
              <li>You should see your Stream Deck device in the editor</li>
            </ol>
          </div>

          {/* Step 2 */}
          <div style={{ marginBottom: '18px', paddingBottom: '15px', borderBottom: '1px solid #444' }}>
            <h4 style={{ color: '#e0e0e0', margin: '0 0 10px 0' }}>Step 2: Add an Action</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6', margin: 0 }}>
              <li>On the right panel, look for the <strong>Actions</strong> section</li>
              <li>Search for <strong>"Open URL"</strong> or <strong>"Web Requests"</strong></li>
              <li>Drag the action to an empty button slot on your Stream Deck</li>
              <li>If you don't find these, search for "HTTP" or "Request"</li>
            </ol>
          </div>

          {/* Step 3 */}
          <div style={{ marginBottom: '18px', paddingBottom: '15px', borderBottom: '1px solid #444' }}>
            <h4 style={{ color: '#e0e0e0', margin: '0 0 10px 0' }}>Step 3: Configure the Action</h4>
            <p style={{ margin: '0 0 10px 0', color: '#aaa' }}>In the action settings, set the <strong>URL</strong> to one of these options:</p>
            <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '4px', marginBottom: '10px', fontFamily: 'monospace', fontSize: '12px', lineHeight: '1.6', color: '#6dff8e' }}>
              Toggle: http://localhost:3737/api/tts/toggle<br/>
              Enable: http://localhost:3737/api/tts/enable<br/>
              Disable: http://localhost:3737/api/tts/disable
            </div>
            <p style={{ margin: '0', color: '#aaa', fontSize: '12px' }}>Most common: Use <code style={{ backgroundColor: '#333', padding: '2px 6px', borderRadius: '3px' }}>toggle</code> to switch TTS on/off</p>
          </div>

          {/* Step 4 */}
          <div style={{ marginBottom: '18px', paddingBottom: '15px', borderBottom: '1px solid #444' }}>
            <h4 style={{ color: '#e0e0e0', margin: '0 0 10px 0' }}>Step 4: Customize Button (Optional)</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6', margin: 0 }}>
              <li>Click on the button in the editor to select it</li>
              <li>In the right panel, find <strong>Title</strong> and set it to "Toggle TTS" or your preferred name</li>
              <li>Find the <strong>Icon</strong> or <strong>Image</strong> option</li>
              <li>Choose an emoji or icon: 🎙️ or 🔊 (microphone/speaker) work great</li>
              <li>Adjust <strong>Font Size</strong> and <strong>Layout</strong> to your preference</li>
            </ol>
          </div>

          {/* Step 5 */}
          <div>
            <h4 style={{ color: '#e0e0e0', margin: '0 0 10px 0' }}>Step 5: Test the Button</h4>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6', margin: 0 }}>
              <li>Place your Stream Deck device near you or on your desk</li>
              <li>Make sure <strong>Stream Synth is running</strong> in the background</li>
              <li>Click the button on your physical Stream Deck device</li>
              <li>The TTS should toggle on/off</li>
              <li>Check the <strong>Voice Settings</strong> tab to verify the checkbox changed state</li>
            </ol>
          </div>
        </div>

        {/* Advanced Configuration */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#9147ff' }}>🎯 Advanced Options</h3>
          <div style={{
            backgroundColor: '#1f3a5f',
            border: '1px solid #0078d4',
            borderRadius: '4px',
            padding: '12px',
            marginTop: '10px'
          }}>
            <strong style={{ color: '#6daffff' }}>💡 Pro Tips:</strong>
            <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0, lineHeight: '1.6' }}>
              <li>Use <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>toggle</code> for a simple on/off button</li>
              <li>Use <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>enable</code> + <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>disable</code> in separate buttons for explicit control</li>
              <li>Create multiple profiles for different stream setups</li>
              <li>Combine with other Stream Deck actions for complex workflows</li>
              <li>You can test URLs directly in your browser first</li>
            </ul>
          </div>
        </div>

        {/* Troubleshooting */}
        <div style={{ marginBottom: '20px' }}>
          <h3 style={{ color: '#9147ff' }}>🔧 Troubleshooting</h3>
          
          <div style={{ marginBottom: '15px' }}>
            <strong style={{ color: '#ff9d6d' }}>❌ "Connection Failed" or "URL Not Found"</strong>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6', color: '#ddd', margin: '8px 0 0 0' }}>
              <li>Verify <strong>Stream Synth is running</strong> (check system tray)</li>
              <li>Open browser: <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>http://localhost:3737</code></li>
              <li>If it opens, the server is running - check your URL in Stream Deck</li>
              <li>If it doesn't, restart Stream Synth</li>
            </ol>
          </div>

          <div style={{ marginBottom: '15px' }}>
            <strong style={{ color: '#ff9d6d' }}>❌ TTS Not Toggling</strong>
            <ol style={{ marginLeft: '20px', lineHeight: '1.6', color: '#ddd', margin: '8px 0 0 0' }}>
              <li>Check that TTS has a voice configured (it won't toggle without one)</li>
              <li>Try one of the chat commands: <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>~mutetts</code> or <code style={{ backgroundColor: '#2a2a2a', padding: '2px 6px', borderRadius: '3px' }}>~unmytetts</code></li>
              <li>If commands work but button doesn't, try manual testing with curl in terminal</li>
            </ol>
          </div>

          <div>
            <strong style={{ color: '#ff9d6d' }}>❌ Manual Testing (Debugging)</strong>
            <p style={{ color: '#ddd', margin: '8px 0 0 0' }}>Open Terminal and try:</p>
            <div style={{ backgroundColor: '#1a1a1a', padding: '12px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px', color: '#6dff8e', lineHeight: '1.4', marginTop: '8px' }}>
              curl http://localhost:3737/api/tts/toggle
            </div>
            <p style={{ color: '#aaa', fontSize: '12px', margin: '8px 0 0 0' }}>If it returns success, the API works</p>
          </div>
        </div>

        {/* Network Access */}
        <div style={{ marginBottom: '20px', backgroundColor: '#2a3a2a', border: '1px solid #4a7a45', borderRadius: '4px', padding: '12px' }}>
          <strong style={{ color: '#6dff8e' }}>🌐 Remote Access (Advanced)</strong>
          <p style={{ color: '#aaa', margin: '8px 0', lineHeight: '1.6' }}>
            To access from a different computer, replace <code style={{ backgroundColor: '#1a1a1a', padding: '2px 4px', borderRadius: '2px' }}>localhost</code> with your computer's IP address:
          </p>
          <div style={{ backgroundColor: '#1a1a1a', padding: '8px', borderRadius: '3px', fontFamily: 'monospace', fontSize: '12px', color: '#6dff8e', marginTop: '8px' }}>
            http://192.168.1.100:3737/api/tts/toggle
          </div>
          <p style={{ color: '#ff9d6d', fontSize: '12px', margin: '8px 0 0 0' }}>
            ⚠️ <strong>Security:</strong> Only use on trusted networks. No authentication required.
          </p>
        </div>

        {/* Close Button */}
        <div style={{ marginTop: '30px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            onClick={handleClose}
            style={{
              padding: '10px 20px',
              backgroundColor: '#0078d4',
              border: 'none',
              borderRadius: '4px',
              color: 'white',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Close Guide
          </button>
        </div>
      </div>
    </div>
  );
};
