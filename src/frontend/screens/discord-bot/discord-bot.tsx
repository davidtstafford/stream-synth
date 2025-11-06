import React, { useState, useEffect } from 'react';
import './discord-bot.css';

const { ipcRenderer } = window.require('electron');

interface BotStatus {
  connected: boolean;
  botId?: string;
  latency?: number;
  uptime?: number;
}

interface DiscordSettings {
  bot_token?: string;
  bot_status?: string;
  bot_id?: string;
  auto_start_enabled?: boolean;
}

/**
 * Discord Bot Configuration Screen
 * Simple UI with token input, start/stop, auto-start, and embedded setup guide
 */
export const DiscordBot: React.FC = () => {
  const [botToken, setBotToken] = useState('');
  const [tokenSaved, setTokenSaved] = useState(false);
  const [botStatus, setBotStatus] = useState<BotStatus>({ connected: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [autoStartEnabled, setAutoStartEnabled] = useState(false);
  const [showSetupGuide, setShowSetupGuide] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // Load settings on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Auto-refresh bot status when connected
  useEffect(() => {
    console.log('[DiscordBot UI] useEffect - botStatus.connected:', botStatus.connected);
    if (!botStatus.connected) return;
    
    console.log('[DiscordBot UI] Starting status polling interval');
    const interval = setInterval(async () => {
      try {
        const statusResponse: any = await ipcRenderer.invoke('discord:get-status');
        const status = statusResponse.data || statusResponse;
        console.log('[DiscordBot UI] Polling - status received:', status);
        setBotStatus(status);
      } catch (err) {
        console.error('[DiscordBot UI] Error refreshing bot status:', err);
      }
    }, 5000);
    
    return () => {
      console.log('[DiscordBot UI] Clearing status polling interval');
      clearInterval(interval);
    };
  }, [botStatus.connected]);

  const loadSettings = async () => {
    try {
      console.log('[DiscordBot UI] Loading settings...');
      const response: any = await ipcRenderer.invoke('discord:get-settings');
      console.log('[DiscordBot UI] Raw IPC response:', response);
      
      // Unwrap IPC response (framework wraps in { success, data })
      const settings: DiscordSettings = response.data || response;
      console.log('[DiscordBot UI] Settings loaded:', settings);
      
      // Load token
      if (settings.bot_token) {
        setBotToken(settings.bot_token);
        setTokenSaved(true);
        console.log('[DiscordBot UI] Token loaded from settings');
      } else {
        console.log('[DiscordBot UI] No token in settings');
      }
      
      // Load auto-start setting (convert to boolean)
      const autoStart = Boolean(settings.auto_start_enabled);
      setAutoStartEnabled(autoStart);
      console.log('[DiscordBot UI] Auto-start raw:', settings.auto_start_enabled, 'parsed:', autoStart);
      
      // Check current bot status
      const statusResponse: any = await ipcRenderer.invoke('discord:get-status');
      const status = statusResponse.data || statusResponse;
      console.log('[DiscordBot UI] Bot status received:', status);
      console.log('[DiscordBot UI] Status.connected value:', status?.connected);
      setBotStatus(status || { connected: false });
      console.log('[DiscordBot UI] setBotStatus called');
      
      // Mark settings as loaded
      setSettingsLoaded(true);
    } catch (err: any) {
      console.error('[DiscordBot UI] Error loading settings:', err);
      setMessage({ type: 'error', text: `Failed to load settings: ${err.message}` });
      setSettingsLoaded(true); // Still mark as loaded even on error
    }
  };

  const handleSaveToken = async () => {
    if (!botToken.trim()) {
      setMessage({ type: 'error', text: 'Bot token cannot be empty' });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    try {
      const response: any = await ipcRenderer.invoke('discord:save-settings', {
        bot_token: botToken
      });
      const result = response.data || response;
      
      if (result.success || response.success) {
        setTokenSaved(true);
        setMessage({ type: 'success', text: '✓ Token saved successfully' });
      } else {
        setMessage({ type: 'error', text: result.message || response.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error saving token: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleStartBot = async () => {
    if (!botToken.trim()) {
      setMessage({ type: 'error', text: 'Bot token is required. Please enter and save your token first.' });
      return;
    }

    setLoading(true);
    setMessage(null);
    
    try {
      const response: any = await ipcRenderer.invoke('discord:start-bot', botToken);
      console.log('[DiscordBot UI] Start bot response:', response);
      
      // Unwrap IPC response
      const result = response.data || response;
      
      if (result.success || response.success) {
        setMessage({ type: 'success', text: '✓ Bot started successfully' });
        // Wait longer for bot to fully initialize and ready event to fire
        await new Promise(resolve => setTimeout(resolve, 2000));
        // Refresh status multiple times to catch the connection
        for (let i = 0; i < 3; i++) {
          const statusResponse: any = await ipcRenderer.invoke('discord:get-status');
          const status = statusResponse.data || statusResponse;
          console.log(`[DiscordBot UI] Status check ${i + 1}/3:`, status);
          if (status && typeof status.connected !== 'undefined') {
            setBotStatus(status);
            console.log('[DiscordBot UI] Updated botStatus to:', status);
          }
          if (status?.connected) {
            console.log('[DiscordBot UI] Bot connected, stopping polling');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } else {
        setMessage({ type: 'error', text: result.message || response.error });
      }
    } catch (err: any) {
      console.error('[DiscordBot UI] Error starting bot:', err);
      setMessage({ type: 'error', text: `Error starting bot: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleStopBot = async () => {
    setLoading(true);
    setMessage(null);
    
    try {
      const response: any = await ipcRenderer.invoke('discord:stop-bot');
      const result = response.data || response;
      
      if (result.success || response.success) {
        setMessage({ type: 'success', text: '✓ Bot stopped' });
        setBotStatus({ connected: false });
      } else {
        setMessage({ type: 'error', text: result.message || response.error });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error stopping bot: ${err.message}` });
    } finally {
      setLoading(false);
    }
  };

  const handleAutoStartToggle = async (enabled: boolean) => {
    const previousValue = autoStartEnabled;
    setAutoStartEnabled(enabled);
    
    try {
      const response: any = await ipcRenderer.invoke('discord:save-settings', {
        auto_start_enabled: enabled
      });
      const result = response.data || response;
      
      if (!(result.success || response.success)) {
        setMessage({ type: 'error', text: result.message || response.error });
        setAutoStartEnabled(previousValue);
      } else {
        setMessage({ type: 'success', text: `✓ Auto-start ${enabled ? 'enabled' : 'disabled'}` });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error saving auto-start: ${err.message}` });
      setAutoStartEnabled(previousValue);
    }
  };

  // Show loading state while settings are being loaded
  if (!settingsLoaded) {
    return (
      <div className="discord-bot-screen">
        <div className="discord-bot-container">
          <div className="loading-state">
            <div className="loading-spinner">🔄</div>
            <p>Loading Discord bot settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="discord-bot-screen">
      <div className="discord-bot-container">
        {/* Header */}
        <div className="discord-bot-header">
          <h1>🤖 Discord Bot</h1>
          <p>Voice discovery for your Discord server</p>
        </div>

        {/* Status Card */}
        <div className={`status-card ${botStatus.connected ? 'connected' : 'disconnected'}`}>
          <div className="status-indicator">
            <div className={`status-dot ${botStatus.connected ? 'online' : 'offline'}`} />
            <span className="status-text">
              {botStatus.connected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {botStatus.connected && (
            <div className="status-details">
              <div>Bot ID: <code>{botStatus.botId}</code></div>
              <div>Latency: <code>{botStatus.latency}ms</code></div>
            </div>
          )}
        </div>

        {/* Token Configuration */}
        <div className="config-section">
          <h2>Bot Token</h2>
          <div className="token-input-group">
            <input
              type="password"
              value={botToken}
              onChange={(e) => {
                setBotToken(e.target.value);
                setTokenSaved(false);
              }}
              placeholder="Paste your Discord bot token here"
              className="token-input"
              disabled={loading || botStatus.connected}
            />
            <button
              className="btn btn-secondary"
              onClick={handleSaveToken}
              disabled={loading || botStatus.connected || tokenSaved}
            >
              {tokenSaved ? '✓ Saved' : '💾 Save'}
            </button>
          </div>
          <div className="hint">
            {botStatus.connected 
              ? '⚠️ Stop the bot to change the token'
              : tokenSaved
              ? '✓ Token is saved and encrypted'
              : '⚠️ Don\'t forget to save your token'
            }
          </div>
        </div>

        {/* Control Buttons */}
        <div className="controls-section">
          {!botStatus.connected ? (
            <button
              className="btn btn-primary btn-large"
              onClick={handleStartBot}
              disabled={loading || !botToken.trim()}
            >
              {loading ? '🔄 Starting...' : '▶ Start Bot'}
            </button>
          ) : (
            <button
              className="btn btn-danger btn-large"
              onClick={handleStopBot}
              disabled={loading}
            >
              {loading ? '🔄 Stopping...' : '⏹ Stop Bot'}
            </button>
          )}
        </div>

        {/* Auto-Start Setting */}
        <div className="config-section">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={autoStartEnabled}
              onChange={(e) => handleAutoStartToggle(e.target.checked)}
              disabled={!tokenSaved}
            />
            <span>Auto-start bot on app launch</span>
          </label>
          <div className="hint">
            {!tokenSaved
              ? '⚠️ Save your token first to enable auto-start'
              : autoStartEnabled
              ? '✓ Bot will start automatically when you launch Stream Synth'
              : 'Enable to start the bot automatically on app launch'
            }
          </div>
        </div>

        {/* Messages */}
        {message && (
          <div className={`message ${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Setup Guide Button */}
        <div className="guide-section">
          <button
            className="btn btn-secondary btn-large"
            onClick={() => setShowSetupGuide(true)}
          >
            📋 Need Help? Open Setup Guide
          </button>
        </div>

        {/* Info Cards */}
        <div className="info-cards">
          <div className="info-card">
            <h3>🎯 Voice Discovery</h3>
            <p>Discord users can search voices with <code>/findvoice</code></p>
          </div>

          <div className="info-card">
            <h3>🔌 Activation</h3>
            <p>Viewers activate voices with <code>~setvoice</code> in Twitch chat</p>
          </div>
        </div>
      </div>

      {/* Setup Guide Modal */}
      {showSetupGuide && (
        <SetupGuideModal 
          onClose={() => setShowSetupGuide(false)}
          onTokenEntered={(token: string) => {
            setBotToken(token);
            setTokenSaved(false);
            // Don't close the guide - let user continue with setup
            setMessage({ type: 'success', text: 'Token copied to main screen. Save it when ready!' });
          }}
        />
      )}
    </div>
  );
};

/**
 * Embedded Setup Guide Modal
 */
interface SetupGuideModalProps {
  onClose: () => void;
  onTokenEntered: (token: string) => void;
}

const SetupGuideModal: React.FC<SetupGuideModalProps> = ({ onClose, onTokenEntered }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [tokenInput, setTokenInput] = useState('');

  const steps = [
    {
      title: '1. Create Discord Application',
      content: (
        <>
          <ol>
            <li>Go to <a href="https://discord.com/developers/applications" target="_blank" rel="noopener noreferrer">Discord Developer Portal</a></li>
            <li>Click "New Application" and give it a name</li>
            <li>Go to the "Bot" section (left sidebar)</li>
            <li>Click "Add Bot"</li>
            <li>Copy your bot token (you'll need it in Step 3)</li>
            <li><strong>Important:</strong> You do NOT need to enable any Privileged Gateway Intents (Message Content Intent, etc.) - slash commands don't need them!</li>
          </ol>
          <div className="tip">
            💡 Keep your bot token secret - it's like a password for your bot
          </div>
          <div className="tip">
            ✅ This bot only uses slash commands, so no privileged intents are required
          </div>
        </>
      )
    },
    {
      title: '2. Configure OAuth2 & Get Invite Link',
      content: (
        <>
          <ol>
            <li>Go to "OAuth2" section (left sidebar)</li>
            <li>Under "Redirects", click "Add Redirect"</li>
            <li>Enter: <code>http://localhost:3000</code> and save</li>
            <li>In "OAuth2 URL Generator", select redirect URL: <code>http://localhost:3000</code></li>
            <li>Under "Scopes", check: <strong>bot</strong></li>
            <li>Under "Bot Permissions", check:
              <ul>
                <li>Send Messages</li>
                <li>Embed Links</li>
                <li>Read Message History</li>
                <li>Use Slash Commands</li>
              </ul>
            </li>
            <li>Copy the "Generated URL" at the bottom (you'll use this in Step 4)</li>
          </ol>
          <div className="tip">
            💡 You must select the redirect URL for the generated URL to appear
          </div>
        </>
      )
    },
    {
      title: '3. Enter Your Bot Token',
      content: (
        <>
          <p>Paste the bot token you copied in Step 1:</p>
          <div style={{ marginTop: '12px' }}>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="Paste bot token here"
              className="token-input"
              style={{
                width: '100%',
                padding: '10px',
                borderRadius: '4px',
                border: '1px solid #444',
                backgroundColor: '#2a2a2a',
                color: '#e0e0e0',
                fontSize: '14px',
                fontFamily: 'monospace'
              }}
            />
          </div>
          <div className="tip" style={{ marginTop: '12px' }}>
            ⚠️ This token will be saved and encrypted locally
          </div>
          <button
            className="btn btn-primary"
            onClick={() => {
              if (tokenInput.trim()) {
                onTokenEntered(tokenInput);
              }
            }}
            disabled={!tokenInput.trim()}
            style={{ marginTop: '12px', width: '100%' }}
          >
            Use This Token
          </button>
        </>
      )
    },
    {
      title: '4. Invite Bot to Your Server',
      content: (
        <>
          <ol>
            <li>Open the OAuth2 URL you copied in Step 2</li>
            <li>Select your Discord server from the dropdown</li>
            <li>Review the permissions</li>
            <li>Click "Authorize"</li>
            <li>Complete the CAPTCHA if prompted</li>
          </ol>
          <div className="tip">
            💡 You may see a "localhost connection" error - this is normal! The authorization still succeeded.
          </div>
        </>
      )
    },
    {
      title: '5. Start Using Voice Discovery',
      content: (
        <>
          <ol>
            <li>Close this guide and click "Start Bot" in the main UI</li>
            <li>Go to any channel in your Discord server</li>
            <li>Type <code>/findvoice</code> to search for voices</li>
            <li>Viewers activate voices with <code>~setvoice</code> in your Twitch chat</li>
          </ol>
          <div className="tip">
            ✓ All done! Your bot is ready to help viewers discover voices.
          </div>
        </>
      )
    }
  ];

  const step = steps[currentStep];

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h2>Discord Bot Setup Guide</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <h3>{step.title}</h3>
          {step.content}
        </div>

        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}
            disabled={currentStep === 0}
          >
            ← Previous
          </button>

          <div className="step-indicator">
            Step {currentStep + 1} of {steps.length}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              className="btn btn-primary"
              onClick={() => setCurrentStep(currentStep + 1)}
            >
              Next →
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={onClose}
            >
              Done ✓
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
