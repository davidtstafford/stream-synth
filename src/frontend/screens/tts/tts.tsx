import React, { useState, useEffect } from 'react';
import * as ttsService from '../../services/tts';
import { VoiceSettingsTab } from './tabs/VoiceSettingsTab';
import { TTSRulesTab } from './tabs/TTSRulesTab';
import { ViewersTab } from './tabs/ViewersTab';
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
    provider: string;
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

  // Rescan state
  const [rescanningProvider, setRescanningProvider] = useState<string | null>(null);
  // Voice filtering state
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [voiceStats, setVoiceStats] = useState({ total: 0, available: 0, unavailable: 0 });

  // Viewer tab state
  const [viewerSearchTerm, setViewerSearchTerm] = useState('');
  const [viewerSearchResults, setViewerSearchResults] = useState<Array<{ id: string; username: string; display_name?: string }>>([]);
  const [selectedViewer, setSelectedViewer] = useState<string | null>(null);
  const [viewerRule, setViewerRule] = useState<ttsService.ViewerTTSRule | null>(null);
  // Viewer voice filters
  const [viewerVoiceSearch, setViewerVoiceSearch] = useState('');
  const [viewerLanguageFilter, setViewerLanguageFilter] = useState('all');
  const [viewerGenderFilter, setViewerGenderFilter] = useState('all');
  const [viewerProviderFilter, setViewerProviderFilter] = useState('all');

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
      console.log('[TTS Screen] Loading voices from database...');

      // Load grouped voices from database (voices are synced on app startup, not here)
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
      console.error('[TTS Screen] Error loading voices:', err);
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
  // Handle provider toggle (enable/disable provider voices in database)
  const handleProviderToggle = async (provider: 'webspeech' | 'azure' | 'google', enabled: boolean) => {
    try {
      console.log(`[TTS] Toggling ${provider} provider:`, enabled);

      // Save the enable setting
      await ttsService.saveSettings({ [`${provider}Enabled`]: enabled } as any);
      setSettings(prev => prev ? { ...prev, [`${provider}Enabled`]: enabled } : null);

      // For other providers, just toggle availability
      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('provider:toggle', { provider, enabled });
      console.log(`[TTS] Provider ${provider} ${enabled ? 'enabled' : 'disabled'}`);

      // Reload voices
      await syncAndLoadVoices();
      await loadVoiceStats();
    } catch (err: any) {
      setError(err.message);
      console.error(`[TTS] Error toggling ${provider} provider:`, err);
    }
  };  // Handle provider rescan - immediate, with loading spinner
  const handleProviderRescan = async (provider: 'webspeech' | 'azure' | 'google') => {
    try {
      setRescanningProvider(provider);
      setError(null);

      console.log(`[TTS] Rescanning ${provider} voices immediately...`);

      const { ipcRenderer } = window.require('electron');
      
      // For Azure: use sync-voices handler with stored credentials
      if (provider === 'azure') {
        const currentSettings = await ttsService.getSettings();
        if (!currentSettings?.azureApiKey || !currentSettings?.azureRegion) {
          throw new Error('Azure not configured. Please set up Azure first.');
        }
        
        console.log(`[TTS] Rescanning Azure with stored credentials for region: ${currentSettings.azureRegion}`);
        const result = await ipcRenderer.invoke('azure:sync-voices', {
          apiKey: currentSettings.azureApiKey,
          region: currentSettings.azureRegion
        });

        if (result.success) {
          console.log(`[TTS] Azure rescan complete: ${result.voiceCount} voices found`);
          
          // Reload voice list from database
          await syncAndLoadVoices();
          await loadVoiceStats();

          setError(`✓ Azure rescanned: ${result.voiceCount} voices found`);
        } else {
          throw new Error(result.error || 'Azure rescan failed');
        }
      } else {
        // For WebSpeech and other providers: get voices and rescan
        let currentVoices: any[] = [];
        if (provider === 'webspeech') {
          if (!window.speechSynthesis) {
            throw new Error('Web Speech API not available');
          }
          const rawVoices = window.speechSynthesis.getVoices();
          console.log(`[TTS] Found ${rawVoices.length} Web Speech voices for rescan`);

          // Convert SpeechSynthesisVoice objects to plain objects for IPC serialization
          currentVoices = rawVoices.map(v => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            localService: v.localService,
            default: v.default
          }));

          console.log(`[TTS] Serialized voices for IPC:`, currentVoices[0]); // Log first voice to verify
        }

        if (currentVoices.length === 0) {
          throw new Error(`No ${provider} voices available to rescan`);
        }

        // Call backend to rescan immediately
        const result = await ipcRenderer.invoke('provider:rescan-immediate', provider, currentVoices);

        if (result.success) {
          console.log(`[TTS] Rescan complete: ${result.count} voices found`);

          // Reload voice list from database
          await syncAndLoadVoices();
          await loadVoiceStats();

          setError(`✓ ${provider} rescanned: ${result.count} voices found`);
        } else {
          throw new Error(result.error || 'Rescan failed');
        }
      }
    } catch (err: any) {
      setError(`Error rescanning ${provider}: ${err.message}`);
      console.error(`[TTS] Error rescanning ${provider}:`, err);
    } finally {
      setRescanningProvider(null);
    }
  };

  const handleSettingChange = async (key: keyof ttsService.TTSSettings, value: any) => {
    try {
      console.log(`[TTS] Saving ${key}:`, value);
      await ttsService.saveSettings({ [key]: value });
      setSettings(prev => prev ? { ...prev, [key]: value } : null);
      console.log('[TTS] Settings updated:', { ...settings, [key]: value });
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

      console.log('[TTS Test] Testing voice with voiceId:', settings.voiceId, 'options:', {
        volume: settings.volume,
        rate: settings.rate,
        pitch: settings.pitch
      });

      await ttsService.testVoice(settings.voiceId, {
        volume: settings.volume,
        rate: settings.rate,
        pitch: settings.pitch
      }, testMessage);
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
  };  // Filter voices based on search and filters
  const getFilteredGroups = (): VoiceGroup[] => {
    if (!settings) return [];

    return voiceGroups.map(group => ({
      ...group,
      voices: group.voices.filter(voice => {
        // Check if provider is enabled
        const voiceIdStr = voice.voice_id || '';
        const isWebSpeech = !voiceIdStr.startsWith('azure_') && !voiceIdStr.startsWith('google_');
        const isAzure = voiceIdStr.startsWith('azure_');
        const isGoogle = voiceIdStr.startsWith('google_');

        // Only show voices from enabled providers
        if (isWebSpeech && !(settings.webspeechEnabled ?? true)) return false;
        if (isAzure && !(settings.azureEnabled ?? false)) return false;
        if (isGoogle && !(settings.googleEnabled ?? false)) return false;

        // Search filter
        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
          voice.name.toLowerCase().includes(searchLower) ||
          voice.language_name.toLowerCase().includes(searchLower) ||
          voice.region.toLowerCase().includes(searchLower) ||
          voice.id.toString().includes(searchTerm);

        // Provider filter
        const matchesProvider = providerFilter === 'all' || voice.provider === providerFilter;

        // Language filter
        const matchesLanguage = languageFilter === 'all' || voice.language_name === languageFilter;

        // Gender filter
        const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;

        return matchesSearch && matchesProvider && matchesLanguage && matchesGender;
      })
    })).filter(group => group.voices.length > 0);
  };
  const formatVoiceOption = (voice: VoiceGroup['voices'][0]): string => {
    const genderIcon = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
    const id = voice.id.toString().padStart(3, '0');

    // Include region if available to differentiate voices with same name
    const location = voice.region ? ` (${voice.region})` : '';

    return `${id} │ ${voice.provider} │ ${voice.name}${location} ${genderIcon}`;
  };

  const getVisibleVoiceCount = (): number => {
    return getFilteredGroups().reduce((sum, group) => sum + group.voices.length, 0);
  };

  // Get voice counts by provider (only WebSpeech)
  const getProviderVoiceCounts = () => {
    const counts = { webspeech: 0 };

    voiceGroups.forEach(group => {
      group.voices.forEach(voice => {
        // All available voices are Web Speech (Azure and Google are disabled)
        counts.webspeech++;
      });
    });

    return counts;
  };

  // Viewer tab handlers
  const handleViewerSearch = async (query: string) => {
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

    try {
      const rule = await ttsService.getViewerRule(username);
      setViewerRule(rule);
    } catch (err: any) {
      console.error('[Viewers] Error loading viewer rule:', err);
      setError(err.message);
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
    if (!voiceGroups.length || !settings) return [];

    return voiceGroups
      .map(group => ({
        ...group,
        voices: group.voices.filter(voice => {
          // Only show available voices from ENABLED providers
          const voiceId = voice.voice_id || '';

          // Check if voice provider is enabled
          const isWebSpeech = !voiceId.startsWith('azure_') && !voiceId.startsWith('google_');
          const isAzure = voiceId.startsWith('azure_');
          const isGoogle = voiceId.startsWith('google_');

          // Skip based on provider enable state
          if (isGoogle) return false; // Google always disabled
          if (isAzure && !(settings.azureEnabled ?? false)) return false;
          if (isWebSpeech && !(settings.webspeechEnabled ?? false)) return false;

          // Provider filter dropdown
          const matchesProvider = 
            viewerProviderFilter === 'all' ||
            (viewerProviderFilter === 'webspeech' && isWebSpeech) ||
            (viewerProviderFilter === 'azure' && isAzure) ||
            (viewerProviderFilter === 'google' && isGoogle);

          if (!matchesProvider) return false;

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
  const providerCounts = getProviderVoiceCounts();
  const viewerFilteredGroups = getViewerFilteredGroups();

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
      {activeTab === 'settings' && (        <div className="tab-content">
          <VoiceSettingsTab
            settings={settings}
            voiceGroups={voiceGroups}
            voiceStats={voiceStats}
            testMessage={testMessage}
            isSpeaking={isSpeaking}
            rescanningProvider={rescanningProvider}
            searchTerm={searchTerm}
            languageFilter={languageFilter}
            genderFilter={genderFilter}
            providerFilter={providerFilter}
            onSettingChange={handleSettingChange}
            onTestVoice={handleTestVoice}
            onStop={handleStop}
            onTestMessageChange={setTestMessage}
            onProviderToggle={handleProviderToggle}
            onProviderRescan={handleProviderRescan}
            onSearchChange={setSearchTerm}
            onLanguageFilterChange={setLanguageFilter}
            onGenderFilterChange={setGenderFilter}
            onProviderFilterChange={setProviderFilter}
            getUniqueLanguages={getUniqueLanguages}
            getFilteredGroups={getFilteredGroups}
            getVisibleVoiceCount={getVisibleVoiceCount}
            formatVoiceOption={formatVoiceOption}
            getProviderVoiceCounts={() => providerCounts}
          />
        </div>
      )}

      {activeTab === 'rules' && (
        <div className="tab-content">
          <TTSRulesTab
            settings={settings}
            onSettingChange={handleSettingChange}
          />
        </div>
      )}      {activeTab === 'viewers' && (
        <div className="tab-content">
          <ViewersTab
            settings={settings}
            voiceGroups={viewerFilteredGroups}
            voiceStats={voiceStats}
            viewerSearchTerm={viewerSearchTerm}
            viewerSearchResults={viewerSearchResults}
            selectedViewer={selectedViewer}
            viewerRule={viewerRule}
            viewerVoiceSearch={viewerVoiceSearch}
            viewerLanguageFilter={viewerLanguageFilter}
            viewerGenderFilter={viewerGenderFilter}
            viewerProviderFilter={viewerProviderFilter}
            onViewerSearch={handleViewerSearch}
            onSelectViewer={handleSelectViewer}
            onCreateRule={handleCreateRule}
            onDeleteRule={handleDeleteRule}
            onUpdateRule={handleUpdateRule}
            onMuteChange={handleMuteChange}
            onMuteDurationChange={handleMuteDurationChange}
            getMuteDurationMinutes={getMuteDurationMinutes}
            onCooldownChange={handleCooldownChange}
            onCooldownDurationChange={handleCooldownDurationChange}
            getCooldownDurationMinutes={getCooldownDurationMinutes}
            onViewerVoiceSearchChange={setViewerVoiceSearch}
            onViewerLanguageFilterChange={setViewerLanguageFilter}            onViewerGenderFilterChange={setViewerGenderFilter}
            onViewerProviderFilterChange={setViewerProviderFilter}
            onResetVoice={handleResetVoice}
            getUniqueLanguages={getUniqueLanguages}
            getViewerFilteredGroups={getViewerFilteredGroups}
            getViewerVisibleVoiceCount={getViewerVisibleVoiceCount}
            formatVoiceOption={formatVoiceOption}
          />
        </div>
      )}
    </div>
  );
};

