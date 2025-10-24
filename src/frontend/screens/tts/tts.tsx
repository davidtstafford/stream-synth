import React, { useState, useEffect } from 'react';
import * as ttsService from '../../services/tts';
import './tts.css';

interface VoiceGroup {
  category: string;
  voices: Array<{
    id: number;
    voice_id: string;
    name: string;
    language_name: string;
    region: string;
    gender: string;
  }>;
}

type TabType = 'settings' | 'rules' | 'viewers';

export const TTS: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [settings, setSettings] = useState<ttsService.TTSSettings | null>(null);
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('Hello! This is a test of the text to speech system.');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Voice filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [voiceStats, setVoiceStats] = useState({ total: 0, available: 0, unavailable: 0 });

  // Viewer tab state
  const [viewerSearchTerm, setViewerSearchTerm] = useState('');
  const [viewerSearchResults, setViewerSearchResults] = useState<Array<{ id: string; username: string; display_name?: string }>>([]);
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null);
  const [viewerRule, setViewerRule] = useState<ttsService.ViewerTTSRule | null>(null);
  const [loadingViewerRule, setLoadingViewerRule] = useState(false);
  
  // Viewer voice filters
  const [viewerVoiceSearch, setViewerVoiceSearch] = useState('');
  const [viewerLanguageFilter, setViewerLanguageFilter] = useState('all');
  const [viewerGenderFilter, setViewerGenderFilter] = useState('all');

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [loadedSettings, loadedProviders] = await Promise.all([
        ttsService.getSettings(),
        ttsService.getProviders()
      ]);
      
      setSettings(loadedSettings);
      setProviders(loadedProviders);
      
      // Load voices for current provider
      if (loadedSettings) {
        await syncAndLoadVoices(loadedSettings);
        await loadVoiceStats();
      }
    } catch (err: any) {
      setError(err.message);
      console.error('[TTS Screen] Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const syncAndLoadVoices = async (currentSettings?: ttsService.TTSSettings) => {
    try {
      const settingsToUse = currentSettings || settings;
      if (!settingsToUse) {
        console.log('[TTS Screen] No settings available, skipping voice sync');
        return;
      }
      
      console.log('[TTS Screen] Starting voice sync...');
      
      // Get raw voices from browser
      const rawVoices = await ttsService.getVoices();
      console.log(`[TTS Screen] Got ${rawVoices.length} raw voices from browser`);
      console.log('[TTS Screen] Sample raw voice:', rawVoices[0]);
      
      // Convert to plain objects for IPC
      // Note: rawVoices are TTSVoice objects with 'language' property, not 'lang'
      const plainVoices = rawVoices.map((v: any) => ({
        voiceURI: v.id, // TTSVoice uses 'id' not 'voiceURI'
        name: v.name,
        lang: v.language, // TTSVoice uses 'language' property
        localService: true,
        default: false,
      }));
      
      console.log('[TTS Screen] Sample plain voice:', plainVoices[0]);
      
      console.log('[TTS Screen] Syncing voices to database...');
      // Sync to database
      const syncResult = await ttsService.syncVoices(settingsToUse.provider, plainVoices);
      console.log('[TTS Screen] Sync result:', syncResult);
      
      // Load grouped voices from database
      console.log('[TTS Screen] Loading grouped voices from database...');
      const grouped = await ttsService.getGroupedVoices();
      console.log('[TTS Screen] Got grouped voices:', grouped);
      
      // Convert Record to array of VoiceGroup objects
      const groupArray: VoiceGroup[] = Object.entries(grouped).map(([category, voices]) => ({
        category,
        voices: voices as any[]
      }));
      
      console.log(`[TTS Screen] Created ${groupArray.length} voice groups`);
      console.log('[TTS Screen] Sample voices:', groupArray[0]?.voices.slice(0, 3));
      setVoiceGroups(groupArray);
    } catch (err: any) {
      setError(err.message);
      console.error('[TTS Screen] Error syncing/loading voices:', err);
    }
  };

  const loadVoiceStats = async () => {
    try {
      const stats = await ttsService.getVoiceStats();
      setVoiceStats(stats);
    } catch (err: any) {
      console.error('[TTS Screen] Error loading voice stats:', err);
    }
  };

  const handleProviderChange = async (provider: string) => {
    try {
      setLoading(true);
      await ttsService.saveSettings({ provider: provider as any });
      await loadData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSettingChange = async (key: keyof ttsService.TTSSettings, value: any) => {
    try {
      await ttsService.saveSettings({ [key]: value });
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleTestVoice = async () => {
    if (!settings?.voiceId) {
      setError('Please select a voice first');
      return;
    }

    try {
      setIsSpeaking(true);
      setError(null);
      
      await ttsService.speak(testMessage, {
        volume: settings.volume,
        rate: settings.rate,
        pitch: settings.pitch
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      // Reset after a delay (speech might still be playing)
      setTimeout(() => setIsSpeaking(false), 1000);
    }
  };

  const handleStop = async () => {
    try {
      await ttsService.stop();
      setIsSpeaking(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Get unique languages from voice groups
  const getUniqueLanguages = (): string[] => {
    const languages = new Set<string>();
    voiceGroups.forEach(group => {
      group.voices.forEach(voice => {
        languages.add(voice.language_name);
      });
    });
    return Array.from(languages).sort();
  };

  // Filter voices based on search and filters
  const getFilteredGroups = (): VoiceGroup[] => {
    return voiceGroups.map(group => ({
      ...group,
      voices: group.voices.filter(voice => {
        // Search filter
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          voice.name.toLowerCase().includes(searchLower) ||
          voice.language_name.toLowerCase().includes(searchLower) ||
          voice.region.toLowerCase().includes(searchLower) ||
          voice.id.toString().includes(searchTerm);

        // Language filter
        const matchesLanguage = languageFilter === 'all' || voice.language_name === languageFilter;

        // Gender filter
        const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;

        return matchesSearch && matchesLanguage && matchesGender;
      })
    })).filter(group => group.voices.length > 0);
  };

  const formatVoiceOption = (voice: VoiceGroup['voices'][0]): string => {
    const genderIcon = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
    const id = voice.id.toString().padStart(3, '0');
    
    // Include region if available to differentiate voices with same name
    const location = voice.region ? ` (${voice.region})` : '';
    
    return `${id} │ ${voice.name}${location} ${genderIcon}`;
  };

  const getVisibleVoiceCount = (): number => {
    return getFilteredGroups().reduce((sum, group) => sum + group.voices.length, 0);
  };

  // Viewer tab handlers
  const handleViewerSearch = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setViewerSearchTerm(query);

    if (query.length < 2) {
      setViewerSearchResults([]);
      return;
    }

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('db:search-viewers', query, 10);
      if (result.success) {
        setViewerSearchResults(result.viewers);
      }
    } catch (err: any) {
      console.error('[Viewers] Error searching viewers:', err);
    }
  };

  const handleSelectViewer = async (username: string) => {
    setSelectedViewer(username);
    setViewerSearchTerm('');
    setViewerSearchResults([]);
    setLoadingViewerRule(true);

    try {
      const rule = await ttsService.getViewerRule(username);
      setViewerRule(rule);
    } catch (err: any) {
      console.error('[Viewers] Error loading viewer rule:', err);
      setError(err.message);
    } finally {
      setLoadingViewerRule(false);
    }
  };

  const handleCreateRule = async () => {
    if (!selectedViewer) return;

    try {
      const rule = await ttsService.createViewerRule({
        username: selectedViewer,
        customVoiceId: null,
        pitchOverride: null,
        rateOverride: null,
        isMuted: false,
        mutedUntil: null,
        cooldownEnabled: false,
        cooldownSeconds: null,
        cooldownUntil: null
      });
      setViewerRule(rule);
    } catch (err: any) {
      console.error('[Viewers] Error creating rule:', err);
      setError(err.message);
    }
  };

  const handleDeleteRule = async () => {
    if (!selectedViewer) return;

    if (!viewerRule) {
      // Just close the viewer section
      setSelectedViewer(null);
      return;
    }

    if (!confirm(`Delete all custom rules for ${selectedViewer}?`)) {
      return;
    }

    try {
      await ttsService.deleteViewerRule(selectedViewer);
      setViewerRule(null);
      setSelectedViewer(null);
    } catch (err: any) {
      console.error('[Viewers] Error deleting rule:', err);
      setError(err.message);
    }
  };

  const handleUpdateRule = async (updates: Partial<ttsService.ViewerTTSRuleInput>) => {
    if (!selectedViewer || !viewerRule) return;

    try {
      const updated = await ttsService.updateViewerRule(selectedViewer, updates);
      if (updated) {
        setViewerRule(updated);
      }
    } catch (err: any) {
      console.error('[Viewers] Error updating rule:', err);
      setError(err.message);
    }
  };

  const handleMuteChange = async (muted: boolean) => {
    if (!selectedViewer || !viewerRule) return;

    try {
      const updates: Partial<ttsService.ViewerTTSRuleInput> = {
        isMuted: muted,
        mutedUntil: muted ? null : null // null means permanent when muted
      };
      const updated = await ttsService.updateViewerRule(selectedViewer, updates);
      if (updated) {
        setViewerRule(updated);
      }
    } catch (err: any) {
      console.error('[Viewers] Error updating mute:', err);
      setError(err.message);
    }
  };

  const handleMuteDurationChange = async (minutes: number) => {
    if (!selectedViewer || !viewerRule) return;

    try {
      let mutedUntil: string | null = null;
      if (minutes > 0) {
        const until = new Date();
        until.setMinutes(until.getMinutes() + minutes);
        mutedUntil = until.toISOString();
      }

      const updated = await ttsService.updateViewerRule(selectedViewer, { mutedUntil });
      if (updated) {
        setViewerRule(updated);
      }
    } catch (err: any) {
      console.error('[Viewers] Error updating mute duration:', err);
      setError(err.message);
    }
  };

  const getMuteDurationMinutes = (): number => {
    if (!viewerRule || !viewerRule.mutedUntil) return 0;

    const until = new Date(viewerRule.mutedUntil).getTime();
    const now = Date.now();
    const diffMs = until - now;
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    return Math.max(0, diffMinutes);
  };

  const handleCooldownChange = async (enabled: boolean) => {
    if (!selectedViewer || !viewerRule) return;

    try {
      const updates: Partial<ttsService.ViewerTTSRuleInput> = {
        cooldownEnabled: enabled,
        cooldownUntil: enabled ? null : null // null means permanent when enabled
      };
      const updated = await ttsService.updateViewerRule(selectedViewer, updates);
      if (updated) {
        setViewerRule(updated);
      }
    } catch (err: any) {
      console.error('[Viewers] Error updating cooldown:', err);
      setError(err.message);
    }
  };

  const handleCooldownDurationChange = async (minutes: number) => {
    if (!selectedViewer || !viewerRule) return;

    try {
      let cooldownUntil: string | null = null;
      if (minutes > 0) {
        const until = new Date();
        until.setMinutes(until.getMinutes() + minutes);
        cooldownUntil = until.toISOString();
      }

      const updated = await ttsService.updateViewerRule(selectedViewer, { cooldownUntil });
      if (updated) {
        setViewerRule(updated);
      }
    } catch (err: any) {
      console.error('[Viewers] Error updating cooldown duration:', err);
      setError(err.message);
    }
  };

  const getCooldownDurationMinutes = (): number => {
    if (!viewerRule || !viewerRule.cooldownUntil) return 0;

    const until = new Date(viewerRule.cooldownUntil).getTime();
    const now = Date.now();
    const diffMs = until - now;
    const diffMinutes = Math.ceil(diffMs / (1000 * 60));

    return Math.max(0, diffMinutes);
  };

  const handleResetVoice = async () => {
    if (!selectedViewer) return;
    await handleUpdateRule({ customVoiceId: null });
  };

  // Get filtered voice groups for viewer voice picker
  const getViewerFilteredGroups = () => {
    if (!voiceGroups.length) return [];

    return voiceGroups
      .map(group => ({
        ...group,
        voices: group.voices.filter(voice => {
          const matchesSearch = !viewerVoiceSearch ||
            voice.name.toLowerCase().includes(viewerVoiceSearch.toLowerCase()) ||
            voice.voice_id.toString().includes(viewerVoiceSearch);

          const matchesLanguage = viewerLanguageFilter === 'all' || voice.language_name === viewerLanguageFilter;
          const matchesGender = viewerGenderFilter === 'all' || voice.gender === viewerGenderFilter;

          return matchesSearch && matchesLanguage && matchesGender;
        })
      }))
      .filter(group => group.voices.length > 0);
  };

  const getViewerVisibleVoiceCount = () => {
    return getViewerFilteredGroups().reduce((sum, group) => sum + group.voices.length, 0);
  };

  if (loading && !settings) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Text-to-Speech</h2>
        <p>Loading...</p>
      </div>
    );
  }

  if (!settings) {
    return (
      <div style={{ padding: '20px' }}>
        <h2>Text-to-Speech</h2>
        <p style={{ color: 'red' }}>{error || 'Failed to load TTS settings'}</p>
      </div>
    );
  }

  const filteredGroups = getFilteredGroups();
  const visibleCount = getVisibleVoiceCount();

  return (
    <div className="tts-container">
      <h2>Text-to-Speech</h2>
      
      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}
        >
          🎙️ Voice Settings
        </button>
        <button
          className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          📋 TTS Rules
        </button>
        <button
          className={`tab-button ${activeTab === 'viewers' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewers')}
        >
          👤 Viewers
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'settings' && (
        <div className="tab-content">
          {renderVoiceSettingsTab()}
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="tab-content">
          {renderTTSRulesTab()}
        </div>
      )}

      {activeTab === 'viewers' && (
        <div className="tab-content">
          {renderViewersTab()}
        </div>
      )}
    </div>
  );

  // Voice Settings Tab Content
  function renderVoiceSettingsTab() {
    if (!settings) {
      return <div>Loading settings...</div>;
    }

    return (
      <>
        {/* Voice Statistics Bar */}
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Total Voices:</span>
            <span className="stat-value">{voiceStats.total}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Available:</span>
            <span className="stat-value available">{voiceStats.available}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Showing:</span>
            <span className="stat-value">{visibleCount}</span>
          </div>
        </div>

      {/* Enable/Disable Toggle */}
      <div className="setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => handleSettingChange('enabled', e.target.checked)}
          />
          <span className="checkbox-text">Enable TTS</span>
        </label>
      </div>

      {/* Provider Selection */}
      <div className="setting-group">
        <label className="setting-label">
          TTS Provider
        </label>
        <select
          value={settings.provider}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="setting-select"
        >
          {providers.map(provider => (
            <option key={provider} value={provider}>
              {provider === 'webspeech' && 'Web Speech API (Free)'}
              {provider === 'azure' && 'Azure TTS (5M/month)'}
              {provider === 'google' && 'Google Cloud TTS (1M/month)'}
            </option>
          ))}
        </select>
        <p className="setting-hint">
          {settings.provider === 'webspeech' && '✅ Uses your system\'s built-in voices. No API key needed.'}
          {settings.provider === 'azure' && '🔑 Requires Azure API key. 5 million characters per month free forever.'}
          {settings.provider === 'google' && '🔑 Requires Google Cloud API key. 1 million characters per month free forever.'}
        </p>
      </div>

      {/* Voice Search and Filters */}
      <div className="voice-filters">
        <input
          type="text"
          placeholder="🔍 Search voices by name, language, or ID..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
        
        <select
          value={languageFilter}
          onChange={(e) => setLanguageFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Languages</option>
          {getUniqueLanguages().map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>

        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Genders</option>
          <option value="male">♂️ Male</option>
          <option value="female">♀️ Female</option>
          <option value="neutral">⚧ Neutral</option>
        </select>
      </div>

      {/* Voice Selection with Grouped Dropdown */}
      <div className="setting-group">
        <label className="setting-label">
          Voice ({visibleCount} of {voiceStats.available} available)
        </label>
        <select
          value={settings.voiceId || ''}
          onChange={(e) => handleSettingChange('voiceId', e.target.value)}
          className="voice-select"
        >
          <option value="">Select a voice...</option>
          {filteredGroups.map(group => (
            <optgroup key={group.category} label={group.category}>
              {group.voices.map(voice => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {formatVoiceOption(voice)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Volume Control */}
      <div className="setting-group">
        <label className="setting-label">
          Volume: {settings.volume}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={settings.volume}
          onChange={(e) => handleSettingChange('volume', parseInt(e.target.value))}
          className="slider"
        />
      </div>

      {/* Rate Control */}
      <div className="setting-group">
        <label className="setting-label">
          Speed: {settings.rate}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.rate}
          onChange={(e) => handleSettingChange('rate', parseFloat(e.target.value))}
          className="slider"
        />
      </div>

      {/* Pitch Control */}
      <div className="setting-group">
        <label className="setting-label">
          Pitch: {settings.pitch}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2.0"
          step="0.1"
          value={settings.pitch}
          onChange={(e) => handleSettingChange('pitch', parseFloat(e.target.value))}
          className="slider"
        />
      </div>

      {/* Test Message */}
      <div className="setting-group">
        <label className="setting-label">
          Test Message
        </label>
        <textarea
          value={testMessage}
          onChange={(e) => setTestMessage(e.target.value)}
          rows={3}
          className="test-textarea"
        />
      </div>

      {/* Test Buttons */}
      <div className="button-group">
        <button
          onClick={handleTestVoice}
          disabled={!settings.voiceId || isSpeaking}
          className={`btn btn-primary ${(!settings.voiceId || isSpeaking) ? 'disabled' : ''}`}
        >
          {isSpeaking ? '🔊 Speaking...' : '▶️ Test Voice'}
        </button>
        
        <button
          onClick={handleStop}
          disabled={!isSpeaking}
          className={`btn btn-danger ${!isSpeaking ? 'disabled' : ''}`}
        >
          ⏹️ Stop
        </button>

        <button
          onClick={() => syncAndLoadVoices().then(loadVoiceStats)}
          disabled={loading}
          className={`btn btn-secondary ${loading ? 'disabled' : ''}`}
        >
          🔄 Refresh Voices
        </button>
      </div>
      </>
    );
  }

  // TTS Rules Tab Content
  function renderTTSRulesTab() {
    if (!settings) {
      return <div>Loading settings...</div>;
    }

    return (
      <div className="rules-tab">
        <h3>📋 TTS Filtering & Rules</h3>
        <p className="section-description">
          Control which messages are read aloud and how they are processed.
        </p>

        {/* Message Filtering */}
        <div className="rules-section">
          <h4>� Message Filtering</h4>
          
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.filterCommands ?? true}
                onChange={(e) => handleSettingChange('filterCommands', e.target.checked)}
              />
              <span className="checkbox-text">
                Filter Commands
                <span className="setting-hint">Skip messages starting with ! or ~ (e.g., !followage, ~setmyvoice)</span>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.filterBots ?? true}
                onChange={(e) => handleSettingChange('filterBots', e.target.checked)}
              />
              <span className="checkbox-text">
                Filter Bot Messages
                <span className="setting-hint">Skip messages from Nightbot, StreamElements, Streamlabs, Moobot, Fossabot, Wizebot</span>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.filterUrls ?? true}
                onChange={(e) => handleSettingChange('filterUrls', e.target.checked)}
              />
              <span className="checkbox-text">
                Remove URLs
                <span className="setting-hint">Strip http:// and https:// links from messages before speaking</span>
              </span>
            </label>
          </div>
        </div>

        {/* Username Announcement */}
        <div className="rules-section">
          <h4>👤 Username Announcement</h4>
          
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.announceUsername ?? true}
                onChange={(e) => handleSettingChange('announceUsername', e.target.checked)}
              />
              <span className="checkbox-text">
                Announce Username
                <span className="setting-hint">Say "Username says:" before each message. Disable to only read the message.</span>
              </span>
            </label>
          </div>

          <div className="example-box">
            <strong>Example:</strong>
            <div className="example-text">
              {settings.announceUsername ?? true
                ? '🔊 "ViewerName says: Hello everyone!"'
                : '🔊 "Hello everyone!"'}
            </div>
          </div>
        </div>

        {/* Message Length Limits */}
        <div className="rules-section">
          <h4>📏 Message Length Limits</h4>
          
          <div className="setting-group">
            <label className="setting-label">
              Minimum Length: {settings.minMessageLength ?? 0} characters
            </label>
            <input
              type="range"
              min="0"
              max="50"
              value={settings.minMessageLength ?? 0}
              onChange={(e) => handleSettingChange('minMessageLength', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              Skip messages shorter than this. Set to 0 to disable. Useful for filtering single-emoji spam.
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Maximum Length: {settings.maxMessageLength ?? 500} characters
            </label>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={settings.maxMessageLength ?? 500}
              onChange={(e) => handleSettingChange('maxMessageLength', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              Truncate messages longer than this. Prevents excessive reading of copypastas.
            </p>
          </div>
        </div>

        {/* Duplicate Detection */}
        <div className="rules-section">
          <h4>🔁 Duplicate Message Detection</h4>
          
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.skipDuplicateMessages ?? true}
                onChange={(e) => handleSettingChange('skipDuplicateMessages', e.target.checked)}
              />
              <span className="checkbox-text">
                Skip Duplicate Messages
                <span className="setting-hint">Don't read the same message twice within the time window</span>
              </span>
            </label>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Duplicate Window: {settings.duplicateMessageWindow ?? 300} seconds ({Math.floor((settings.duplicateMessageWindow ?? 300) / 60)} minutes)
            </label>
            <input
              type="range"
              min="60"
              max="600"
              step="30"
              value={settings.duplicateMessageWindow ?? 300}
              onChange={(e) => handleSettingChange('duplicateMessageWindow', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              How long to remember messages. Same message can only be read once per window.
            </p>
          </div>
        </div>

        {/* Rate Limiting & Cooldowns */}
        <div className="rules-section">
          <h4>⏱️ Rate Limiting & Cooldowns</h4>
          
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.userCooldownEnabled ?? true}
                onChange={(e) => handleSettingChange('userCooldownEnabled', e.target.checked)}
              />
              <span className="checkbox-text">
                Per-User Cooldown
                <span className="setting-hint">Limit how often each user can trigger TTS</span>
              </span>
            </label>
          </div>

          {settings.userCooldownEnabled && (
            <div className="setting-group" style={{ marginLeft: '28px' }}>
              <label className="setting-label">
                User Cooldown: {settings.userCooldownSeconds ?? 30} seconds
              </label>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                value={settings.userCooldownSeconds ?? 30}
                onChange={(e) => handleSettingChange('userCooldownSeconds', parseInt(e.target.value))}
                className="slider"
              />
            </div>
          )}

          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.globalCooldownEnabled ?? false}
                onChange={(e) => handleSettingChange('globalCooldownEnabled', e.target.checked)}
              />
              <span className="checkbox-text">
                Global Cooldown
                <span className="setting-hint">Limit TTS frequency across all users (prevents spam during raids)</span>
              </span>
            </label>
          </div>

          {settings.globalCooldownEnabled && (
            <div className="setting-group" style={{ marginLeft: '28px' }}>
              <label className="setting-label">
                Global Cooldown: {settings.globalCooldownSeconds ?? 5} seconds
              </label>
              <input
                type="range"
                min="1"
                max="30"
                value={settings.globalCooldownSeconds ?? 5}
                onChange={(e) => handleSettingChange('globalCooldownSeconds', parseInt(e.target.value))}
                className="slider"
              />
            </div>
          )}

          <div className="setting-group">
            <label className="setting-label">
              Max Queue Size: {settings.maxQueueSize ?? 20} messages
            </label>
            <input
              type="range"
              min="5"
              max="50"
              step="5"
              value={settings.maxQueueSize ?? 20}
              onChange={(e) => handleSettingChange('maxQueueSize', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              Maximum messages in queue. New messages dropped if queue is full.
            </p>
          </div>
        </div>

        {/* Emote & Emoji Limits */}
        <div className="rules-section">
          <h4>😀 Emote & Emoji Limits</h4>
          
          <div className="setting-group">
            <label className="setting-label">
              Max Emotes per Message: {settings.maxEmotesPerMessage ?? 5}
            </label>
            <input
              type="range"
              min="0"
              max="20"
              value={settings.maxEmotesPerMessage ?? 5}
              onChange={(e) => handleSettingChange('maxEmotesPerMessage', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              Limit Twitch emotes per message. Set to 0 for no limit.
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Max Emojis per Message: {settings.maxEmojisPerMessage ?? 3}
            </label>
            <input
              type="range"
              min="0"
              max="10"
              value={settings.maxEmojisPerMessage ?? 3}
              onChange={(e) => handleSettingChange('maxEmojisPerMessage', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              Limit Unicode emojis per message. Set to 0 for no limit.
            </p>
          </div>

          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.stripExcessiveEmotes ?? true}
                onChange={(e) => handleSettingChange('stripExcessiveEmotes', e.target.checked)}
              />
              <span className="checkbox-text">
                Strip Excessive Emotes
                <span className="setting-hint">Remove excess emotes instead of skipping the entire message</span>
              </span>
            </label>
          </div>
        </div>

        {/* Character Repetition */}
        <div className="rules-section">
          <h4>🔤 Character & Word Repetition</h4>
          
          <div className="setting-group">
            <label className="setting-label">
              Max Repeated Characters: {settings.maxRepeatedChars ?? 3}
            </label>
            <input
              type="range"
              min="2"
              max="10"
              value={settings.maxRepeatedChars ?? 3}
              onChange={(e) => handleSettingChange('maxRepeatedChars', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              "woooooow" → "wooow", "lolllll" → "lolll" (limits consecutive chars to {settings.maxRepeatedChars ?? 3})
            </p>
          </div>

          <div className="setting-group">
            <label className="setting-label">
              Max Repeated Words: {settings.maxRepeatedWords ?? 2}
            </label>
            <input
              type="range"
              min="1"
              max="5"
              value={settings.maxRepeatedWords ?? 2}
              onChange={(e) => handleSettingChange('maxRepeatedWords', parseInt(e.target.value))}
              className="slider"
            />
            <p className="setting-hint">
              "really really really really" → "really really"
            </p>
          </div>
        </div>

        {/* Content Filters */}
        <div className="rules-section">
          <h4>🛡️ Content Filters</h4>
          
          <div className="setting-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={settings.copypastaFilterEnabled ?? false}
                onChange={(e) => handleSettingChange('copypastaFilterEnabled', e.target.checked)}
              />
              <span className="checkbox-text">
                Block Known Copypastas
                <span className="setting-hint">Skip common copypasta spam (basic list included)</span>
              </span>
            </label>
          </div>
        </div>

        {/* Future Features */}
        <div className="rules-section">
          <h4>✨ Coming Soon</h4>
          <ul className="feature-list">
            <li>Per-viewer voice assignments</li>
            <li>Chat command: <code>~setmyvoice [voice_id]</code></li>
            <li>Muted viewers list</li>
            <li>Account age requirements</li>
            <li>Watch time requirements</li>
            <li>Role-based voice rules (subscribers, mods, VIPs)</li>
            <li>Priority queue for specific users</li>
            <li>Custom copypasta blocklist</li>
          </ul>
        </div>
      </div>
    );
  }

  // Viewers Tab Content
  function renderViewersTab() {
    return (
      <div className="viewers-tab">
        <div className="viewer-search-section">
          <h3>Find Viewer</h3>
          <div className="viewer-search-container">
            <input
              type="text"
              className="viewer-search-input"
              placeholder="Search for a viewer..."
              value={viewerSearchTerm}
              onChange={handleViewerSearch}
            />
            {viewerSearchResults.length > 0 && (
              <div className="viewer-search-results">
                {viewerSearchResults.map((viewer) => (
                  <div
                    key={viewer.id}
                    className="viewer-search-result"
                    onClick={() => handleSelectViewer(viewer.username)}
                  >
                    {viewer.display_name || viewer.username}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedViewer && (
          <div className="viewer-rule-section">
            <div className="viewer-header">
              <h3>{selectedViewer}</h3>
              <button
                className="delete-rule-button"
                onClick={handleDeleteRule}
              >
                {viewerRule ? 'Delete Rules' : 'Cancel'}
              </button>
            </div>

            {!viewerRule && (
              <div className="no-rules-message">
                <p>No custom rules for this viewer</p>
                <button className="create-rule-button" onClick={handleCreateRule}>
                  Create Rules
                </button>
              </div>
            )}

            {viewerRule && renderViewerRuleEditor()}
          </div>
        )}
      </div>
    );
  }

  function renderViewerRuleEditor() {
    if (!viewerRule || !settings) return null;

    // Get the voice name for display
    const getVoiceName = (voiceId: number | null) => {
      if (voiceId === null) return null;
      // Find the voice in voice groups
      for (const group of voiceGroups) {
        const voice = group.voices.find(v => v.id === voiceId);
        if (voice) return voice.name;
      }
      return `Voice #${voiceId}`;
    };

    const customVoiceName = getVoiceName(viewerRule.customVoiceId);
    const globalVoiceName = getVoiceName(parseInt(settings.voiceId));
    
    const viewerFilteredGroups = getViewerFilteredGroups();
    const viewerVisibleCount = getViewerVisibleVoiceCount();

    return (
      <div className="viewer-rule-editor">
        {/* TTS Provider (read-only display) */}
        <div className="rule-setting-group">
          <label className="rule-label">TTS Provider</label>
          <div className="provider-display">
            {settings.provider === 'webspeech' && 'Web Speech API (Free)'}
            {settings.provider === 'azure' && 'Azure TTS (5M/month)'}
            {settings.provider === 'google' && 'Google Cloud TTS (1M/month)'}
          </div>
        </div>

        {/* Voice Search and Filters */}
        <div className="voice-filters">
          <input
            type="text"
            placeholder="🔍 Search voices by name, language, or ID..."
            value={viewerVoiceSearch}
            onChange={(e) => setViewerVoiceSearch(e.target.value)}
            className="search-input"
          />
          
          <select
            value={viewerLanguageFilter}
            onChange={(e) => setViewerLanguageFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Languages</option>
            {getUniqueLanguages().map(lang => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>

          <select
            value={viewerGenderFilter}
            onChange={(e) => setViewerGenderFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Genders</option>
            <option value="male">♂️ Male</option>
            <option value="female">♀️ Female</option>
            <option value="neutral">⚧ Neutral</option>
          </select>
        </div>

        {/* Voice Selection */}
        <div className="rule-setting-group">
          <label className="rule-label">
            Voice ({viewerVisibleCount} of {voiceStats.available} available)
          </label>
          <select
            value={viewerRule.customVoiceId?.toString() || ''}
            onChange={(e) => handleUpdateRule({ customVoiceId: e.target.value ? parseInt(e.target.value) : null })}
            className="voice-select"
          >
            <option value="">Use Global Voice ({globalVoiceName})</option>
            {viewerFilteredGroups.map(group => (
              <optgroup key={group.category} label={group.category}>
                {group.voices.map(voice => (
                  <option key={voice.voice_id} value={voice.id}>
                    {formatVoiceOption(voice)}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          {viewerRule.customVoiceId !== null && (
            <button className="reset-voice-button" onClick={() => handleResetVoice()}>
              Reset to Global Voice
            </button>
          )}
        </div>

        {/* Pitch Override */}
        <div className="rule-setting-group">
          <label className="rule-label">
            Pitch: {viewerRule.pitchOverride ?? settings.pitch}
            {viewerRule.pitchOverride === null && <span className="global-indicator"> (global)</span>}
          </label>
          <input
            type="range"
            min="0.5"
            max="2.0"
            step="0.1"
            value={viewerRule.pitchOverride ?? settings.pitch}
            onChange={(e) => handleUpdateRule({ pitchOverride: parseFloat(e.target.value) })}
            className="slider"
          />
        </div>

        {/* Rate Override */}
        <div className="rule-setting-group">
          <label className="rule-label">
            Speed: {viewerRule.rateOverride ?? settings.rate}
            {viewerRule.rateOverride === null && <span className="global-indicator"> (global)</span>}
          </label>
          <input
            type="range"
            min="0.5"
            max="3.0"
            step="0.1"
            value={viewerRule.rateOverride ?? settings.rate}
            onChange={(e) => handleUpdateRule({ rateOverride: parseFloat(e.target.value) })}
            className="slider"
          />
        </div>

        {/* Mute */}
        <div className="rule-setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={viewerRule.isMuted}
              onChange={(e) => handleMuteChange(e.target.checked)}
            />
            <span className="checkbox-text">Mute this viewer</span>
          </label>
          {viewerRule.isMuted && (
            <div className="mute-duration">
              <label className="rule-label">
                Mute Duration: {getMuteDurationMinutes() === 0 ? 'Permanent' : `${getMuteDurationMinutes()} minutes`}
              </label>
              <input
                type="range"
                min="0"
                max="1440"
                step="5"
                value={getMuteDurationMinutes()}
                onChange={(e) => handleMuteDurationChange(parseInt(e.target.value))}
                className="slider"
              />
              <p className="setting-hint">
                0 = permanent, or set minutes (max 1440 = 24 hours)
              </p>
            </div>
          )}
        </div>

        {/* Cooldown */}
        <div className="rule-setting-group">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={viewerRule.cooldownEnabled}
              onChange={(e) => handleCooldownChange(e.target.checked)}
            />
            <span className="checkbox-text">Custom cooldown for this viewer</span>
          </label>
          {viewerRule.cooldownEnabled && (
            <div className="cooldown-settings">
              <div className="cooldown-duration-section">
                <label className="rule-label">
                  Cooldown Window: {viewerRule.cooldownSeconds ?? (settings.userCooldownSeconds || 30)}s
                </label>
                <input
                  type="range"
                  min="0"
                  max="300"
                  step="5"
                  value={viewerRule.cooldownSeconds ?? (settings.userCooldownSeconds || 30)}
                  onChange={(e) => handleUpdateRule({ cooldownSeconds: parseInt(e.target.value) })}
                  className="slider"
                />
                <p className="setting-hint">
                  Time between messages. Effective: {Math.max(settings.userCooldownSeconds || 30, viewerRule.cooldownSeconds ?? 0)}s (never less than global {settings.userCooldownSeconds || 30}s)
                </p>
              </div>

              <div className="cooldown-duration-section">
                <label className="rule-label">
                  Cooldown Duration: {getCooldownDurationMinutes() === 0 ? 'Permanent' : `${getCooldownDurationMinutes()} minutes`}
                </label>
                <input
                  type="range"
                  min="0"
                  max="1440"
                  step="5"
                  value={getCooldownDurationMinutes()}
                  onChange={(e) => handleCooldownDurationChange(parseInt(e.target.value))}
                  className="slider"
                />
                <p className="setting-hint">
                  0 = permanent custom cooldown, or set minutes (max 1440 = 24 hours)
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
};

