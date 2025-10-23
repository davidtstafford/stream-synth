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

export const TTS: React.FC = () => {
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
    </div>
  );
};

