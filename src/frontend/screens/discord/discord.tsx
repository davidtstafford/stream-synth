import React, { useState, useEffect } from 'react';
import * as databaseService from '../../services/database';
import './discord.css';

const { ipcRenderer } = window.require('electron');

interface DiscordSettings {
  webhookUrl?: string;
  autoPostOnStartup: boolean;
  lastMessageId?: string;  // Store last posted message ID for deletion
  notificationsEnabled: boolean;
  goLiveWebhookUrl?: string;
  mentionRole?: string;
}

type TabType = 'catalogue' | 'notifications';

export const Discord: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('catalogue');
  const [settings, setSettings] = useState<DiscordSettings>({
    autoPostOnStartup: false,
    notificationsEnabled: false
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Catalogue tab state
  const [voiceCount, setVoiceCount] = useState(0);
  const [cataloguePreview, setCataloguePreview] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const savedSettings = await databaseService.getSetting('discord_settings');
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
      }
      await loadVoiceCount();
    } catch (err: any) {
      setError(err.message);
      console.error('[Discord Screen] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadVoiceCount = async () => {
    try {
      const result = await ipcRenderer.invoke('tts:get-voice-stats');
      if (result.success) {
        setVoiceCount(result.stats.available);
      }
    } catch (err: any) {
      console.error('[Discord Screen] Error loading voice count:', err);
    }
  };

  const saveSetting = async (key: keyof DiscordSettings, value: any) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    await databaseService.setSetting('discord_settings', JSON.stringify(newSettings));
  };
  const generateCataloguePreview = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      const response = await ipcRenderer.invoke('discord:generate-voice-catalogue');
      console.log('[Discord Preview] Response:', response);
      
      if (response.success) {
        setCataloguePreview(response.data.catalogue);
        setSuccess('Preview generated! Review before posting.');
      } else {
        setError(response.error || 'Failed to generate preview');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('[Discord Preview] Error:', err);
    } finally {
      setLoading(false);
    }
  };
  const postVoiceCatalogue = async () => {
    if (!settings.webhookUrl) {
      setError('Please configure webhook URL first');
      return;
    }

    try {
      setPosting(true);
      setError(null);
      setSuccess(null);

      console.log('[Discord Post] Sending to webhook:', settings.webhookUrl);
      const response = await ipcRenderer.invoke('discord:post-voice-catalogue', settings.webhookUrl);
      console.log('[Discord Post] Response:', response);
      
      if (response.success) {
        setSuccess('✅ Voice catalogue posted to Discord successfully!');
      } else {
        setError(response.error || 'Failed to post to Discord');
      }
    } catch (err: any) {
      setError(err.message);
      console.error('[Discord Post] Error:', err);
    } finally {
      setPosting(false);
    }
  };
  const testWebhook = async (webhookUrl: string) => {
    try {
      setError(null);
      setSuccess(null);
      const response = await ipcRenderer.invoke('discord:test-webhook', webhookUrl);
      
      if (response.success) {
        setSuccess('✅ Webhook test successful!');
      } else {
        setError(response.error || 'Webhook test failed');
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading && !settings) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Discord Integration</h2>
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="discord-container">
      <h2>Discord Integration</h2>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {success && (
        <div className="success-message">
          {success}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'catalogue' ? 'active' : ''}`}
          onClick={() => setActiveTab('catalogue')}
        >
          📋 Voice Catalogue
        </button>
        <button
          className={`tab-button ${activeTab === 'notifications' ? 'active' : ''}`}
          onClick={() => setActiveTab('notifications')}
        >
          🔔 Notifications
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'catalogue' && (
        <div className="tab-content">
          {renderVoiceCatalogueTab()}
        </div>
      )}

      {activeTab === 'notifications' && (
        <div className="tab-content">
          {renderNotificationsTab()}
        </div>
      )}
    </div>
  );

  // Voice Catalogue Tab
  function renderVoiceCatalogueTab() {
    return (
      <>
        <div className="info-box">
          <h3>📣 Share Your Voice Catalogue</h3>
          <p>
            Post your complete TTS voice catalogue to Discord with numeric IDs.
            Viewers can use these IDs with the <code>~setmyvoice [ID]</code> command.
          </p>
          <p className="voice-count">
            <strong>{voiceCount} voices</strong> available to share
          </p>
        </div>

        <div className="setting-group">
          <label className="setting-label">
            Discord Webhook URL
          </label>
          <input
            type="text"
            value={settings.webhookUrl || ''}
            onChange={(e) => saveSetting('webhookUrl', e.target.value)}
            placeholder="https://discord.com/api/webhooks/..."
            className="webhook-input"
          />
          <p className="setting-hint">
            Get a webhook URL from Discord: Server Settings → Integrations → Webhooks → New Webhook
          </p>
          {settings.webhookUrl && (
            <button
              onClick={() => testWebhook(settings.webhookUrl!)}
              className="btn btn-secondary"
              style={{ marginTop: '8px' }}
            >
              🔍 Test Webhook
            </button>
          )}
        </div>

        <div className="setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={settings.autoPostOnStartup}
              onChange={(e) => saveSetting('autoPostOnStartup', e.target.checked)}
            />
            <span>
              🔄 Auto-update on startup
            </span>
          </label>
          <p className="setting-hint">
            When enabled, the app will delete previous webhook messages and automatically post an updated voice catalogue on startup.
            This keeps your Discord channel current with the latest available voices.
          </p>
        </div>

        <div className="button-group">
          <button
            onClick={generateCataloguePreview}
            disabled={loading}
            className={`btn btn-secondary ${loading ? 'disabled' : ''}`}
          >
            👁️ Preview Catalogue
          </button>

          <button
            onClick={postVoiceCatalogue}
            disabled={!settings.webhookUrl || posting}
            className={`btn btn-primary ${(!settings.webhookUrl || posting) ? 'disabled' : ''}`}
          >
            {posting ? '📤 Posting...' : '📤 Post to Discord'}
          </button>
        </div>

        {cataloguePreview && (
          <div className="preview-section">
            <h4>Preview:</h4>
            <div className="preview-box">
              <pre>{cataloguePreview}</pre>
            </div>
            <p className="setting-hint">
              This is a simplified preview. The actual Discord post will be formatted with embeds.
            </p>
          </div>
        )}
      </>
    );
  }

  // Notifications Tab
  function renderNotificationsTab() {
    return (
      <div className="notifications-tab">
        <div className="coming-soon">
          <h3>🚧 Stream Notifications</h3>
          <p>Configure automatic Discord notifications for stream events.</p>
          
          <div className="feature-list">
            <h4>Coming Features:</h4>
            <ul>
              <li>✨ Go-live notifications with custom message</li>
              <li>✨ Role mentions (@Subscribers, @everyone, etc.)</li>
              <li>✨ Stream title and category display</li>
              <li>✨ Viewer count milestones</li>
              <li>✨ Raid notifications</li>
              <li>✨ Follower/Subscriber alerts</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }
};
