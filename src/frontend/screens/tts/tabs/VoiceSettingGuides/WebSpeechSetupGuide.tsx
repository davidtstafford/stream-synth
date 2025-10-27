import React, { useState } from 'react';

export interface WebSpeechSetupGuideProps {
  onClose: () => void;
}

export const WebSpeechSetupGuide: React.FC<WebSpeechSetupGuideProps> = ({ onClose }) => {
  const [os, setOs] = useState<string | null>(null);

  // Detect OS on first render
  React.useEffect(() => {
    const userAgent = navigator.userAgent;
    if (userAgent.indexOf('Win') > -1) {
      setOs('windows');
    } else if (userAgent.indexOf('Mac') > -1) {
      setOs('mac');
    }
  }, []);

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
          <h2 style={{ margin: 0, fontSize: '1.5em' }}>🌐 Web Speech API Setup Guide</h2>
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

        {!os ? (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <p>Detecting your operating system...</p>
          </div>
        ) : os === 'windows' ? (
          <WindowsGuide />
        ) : (
          <MacGuide />
        )}

        {/* Close Button */}
        <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
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
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

const WindowsGuide: React.FC = () => (
  <div>
    <h3 style={{ color: '#0078d4', marginTop: 0 }}>📝 Windows 10/11 Installation Steps</h3>
    
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0', marginTop: '15px' }}>Step 1: Open Settings</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Press <code style={{ backgroundColor: '#1a1a1a', padding: '2px 6px', borderRadius: '3px' }}>Windows Key + I</code> to open Settings</li>
        <li>Or click Start menu and type "Settings"</li>
      </ol>
    </div>

    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0' }}>Step 2: Navigate to Speech Settings</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Go to <strong>Time & language</strong> → <strong>Speech</strong></li>
        <li>Look for "Text-to-speech" section</li>
      </ol>
    </div>

    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0' }}>Step 3: Install Additional Voices</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Click on "Manage voices" or "Add voices" (varies by Windows version)</li>
        <li>Click the <strong>+</strong> button to add new voices</li>
        <li>Select a language and click "Add"</li>
        <li>The voice will download and install automatically</li>
        <li>Repeat for additional languages/voices</li>
      </ol>
    </div>

    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0' }}>Step 4: Verify Installation in Stream Synth</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Return to Stream Synth TTS Settings</li>
        <li>Click the <strong>🔄 Rescan</strong> button next to Web Speech API</li>
        <li>New voices should appear in the voice list</li>
      </ol>
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #0078d4',
      borderRadius: '4px',
      padding: '12px',
      marginTop: '20px'
    }}>
      <strong style={{ color: '#0078d4' }}>💡 Tips:</strong>
      <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0, lineHeight: '1.6' }}>
        <li>Windows includes several default voices, but you can add more languages</li>
        <li>New voices appear automatically after Windows finishes downloading</li>
        <li>You can have multiple voices for the same language</li>
        <li>Click Rescan after installing new voices to refresh the list</li>
      </ul>
    </div>
  </div>
);

const MacGuide: React.FC = () => (
  <div>
    <h3 style={{ color: '#34c759', marginTop: 0 }}>📝 macOS Installation Steps</h3>
    
    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0', marginTop: '15px' }}>Step 1: Open System Settings</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Click the Apple menu (⌘) → <strong>System Settings</strong></li>
        <li>Or use Spotlight: Press <code style={{ backgroundColor: '#1a1a1a', padding: '2px 6px', borderRadius: '3px' }}>Cmd + Space</code> and type "System Settings"</li>
      </ol>
    </div>

    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0' }}>Step 2: Navigate to Accessibility</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Go to <strong>Accessibility</strong> in the sidebar</li>
        <li>Select <strong>Spoken Content</strong></li>
      </ol>
    </div>

    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0' }}>Step 3: Install Additional Voices</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Look for the "Voices" section</li>
        <li>Click on the language or region dropdown</li>
        <li>Select a voice with a download icon next to it</li>
        <li>Click the download icon or "Get" to install</li>
        <li>The voice will download and install automatically</li>
        <li>Repeat for additional voices</li>
      </ol>
    </div>

    <div style={{ marginBottom: '20px' }}>
      <h4 style={{ color: '#e0e0e0' }}>Step 4: Verify Installation in Stream Synth</h4>
      <ol style={{ marginLeft: '20px', lineHeight: '1.6' }}>
        <li>Return to Stream Synth TTS Settings</li>
        <li>Click the <strong>🔄 Rescan</strong> button next to Web Speech API</li>
        <li>New voices should appear in the voice list</li>
      </ol>
    </div>

    <div style={{
      backgroundColor: '#1f3a5f',
      border: '1px solid #34c759',
      borderRadius: '4px',
      padding: '12px',
      marginTop: '20px'
    }}>
      <strong style={{ color: '#34c759' }}>💡 Tips:</strong>
      <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0, lineHeight: '1.6' }}>
        <li>macOS includes "Siri" voice by default in English</li>
        <li>Premium voices (marked with a quality indicator) have enhanced natural sound</li>
        <li>New voices appear in System Settings immediately after download</li>
        <li>You can have multiple voices for the same language</li>
        <li>Click Rescan after installing new voices to refresh the list</li>
      </ul>
    </div>
  </div>
);
