import React, { useState, useEffect } from 'react';
import * as ttsService from '../../services/tts';
import { VoiceSettingsTab } from './tabs/VoiceSettingsTab';
import { TTSRulesTab } from './tabs/TTSRulesTab';
import { TTSAccessTab } from './tabs/TTSAccessTab';
import { ViewerRulesTab } from './tabs/ViewerRulesTab';
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

type TabType = 'settings' | 'rules' | 'access' | 'viewer-rules';

export const TTS: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('settings');
  const [settings, setSettings] = useState<ttsService.TTSSettings | null>(null);
  const [voiceGroups, setVoiceGroups] = useState<VoiceGroup[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState('Hello! This is a test of the text to speech system.');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [rescanningProvider, setRescanningProvider] = useState<string | null>(null);
  const [rescanMessages, setRescanMessages] = useState<{ [key: string]: string }>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');
  const [providerFilter, setProviderFilter] = useState('all');
  const [voiceStats, setVoiceStats] = useState({ total: 0, available: 0, unavailable: 0 });

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

      const grouped = await ttsService.getGroupedVoices();
      console.log('[TTS Screen] Got grouped voices:', grouped);

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

  const handleProviderToggle = async (provider: 'webspeech' | 'azure' | 'google', enabled: boolean) => {
    try {
      console.log(`[TTS] Toggling ${provider} provider:`, enabled);

      await ttsService.saveSettings({ [`${provider}Enabled`]: enabled } as any);
      setSettings(prev => prev ? { ...prev, [`${provider}Enabled`]: enabled } : null);

      const { ipcRenderer } = window.require('electron');
      await ipcRenderer.invoke('provider:toggle', { provider, enabled });
      console.log(`[TTS] Provider ${provider} ${enabled ? 'enabled' : 'disabled'}`);

      await syncAndLoadVoices();
      await loadVoiceStats();
    } catch (err: any) {
      setError(err.message);
      console.error(`[TTS] Error toggling ${provider} provider:`, err);
    }
  };

  const handleProviderRescan = async (provider: 'webspeech' | 'azure' | 'google') => {
    try {
      setRescanningProvider(provider);
      setRescanMessages(prev => ({ ...prev, [provider]: 'Rescanning...' }));

      console.log(`[TTS] Rescanning ${provider} voices immediately...`);

      const { ipcRenderer } = window.require('electron');
      
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
          const data = result.data;
          console.log(`[TTS] Azure rescan complete: ${data.voiceCount} voices found`);
          
          await syncAndLoadVoices();
          await loadVoiceStats();

          setRescanMessages(prev => ({ ...prev, [provider]: `✓ Azure rescanned: ${data.voiceCount} voices found` }));
        } else {
          throw new Error(result.error || 'Azure rescan failed');
        }
      } else if (provider === 'google') {
        const currentSettings = await ttsService.getSettings();
        if (!currentSettings?.googleApiKey) {
          throw new Error('Google not configured. Please set up Google Cloud first.');
        }
          console.log(`[TTS] Rescanning Google with stored credentials`);
        const result = await ipcRenderer.invoke('google:sync-voices', {
          apiKey: currentSettings.googleApiKey
        });

        if (result.success) {
          const data = result.data;
          console.log(`[TTS] Google rescan complete: ${data.voiceCount} voices found`);
          
          await syncAndLoadVoices();
          await loadVoiceStats();

          setRescanMessages(prev => ({ ...prev, [provider]: `✓ Google rescanned: ${data.voiceCount} voices found` }));
        } else {
          throw new Error(result.error || 'Google rescan failed');
        }
      } else {
        let currentVoices: any[] = [];
        if (provider === 'webspeech') {
          if (!window.speechSynthesis) {
            throw new Error('Web Speech API not available');
          }
          const rawVoices = window.speechSynthesis.getVoices();
          console.log(`[TTS] Found ${rawVoices.length} Web Speech voices for rescan`);

          currentVoices = rawVoices.map(v => ({
            name: v.name,
            lang: v.lang,
            voiceURI: v.voiceURI,
            localService: v.localService,
            default: v.default
          }));

          console.log(`[TTS] Serialized voices for IPC:`, currentVoices[0]);
        }        if (currentVoices.length === 0) {
          throw new Error(`No ${provider} voices available to rescan`);
        }

        const response = await ipcRenderer.invoke('provider:rescan-immediate', { provider, voices: currentVoices });

        if (response.success) {
          const data = response.data;
          console.log(`[TTS] Rescan complete: ${data.count} voices found`);

          await syncAndLoadVoices();
          await loadVoiceStats();

          setRescanMessages(prev => ({ ...prev, [provider]: `✓ ${provider} rescanned: ${data.count} voices found` }));
        } else {
          throw new Error(response.error || 'Rescan failed');
        }
      }
    } catch (err: any) {
      console.error(`[TTS] Error rescanning ${provider}:`, err);
      setRescanMessages(prev => ({ ...prev, [provider]: `❌ Error: ${err.message}` }));
    } finally {
      setRescanningProvider(null);
      setTimeout(() => {
        setRescanMessages(prev => {
          const newMessages = { ...prev };
          delete newMessages[provider];
          return newMessages;
        });
      }, 5000);
    }
  };  const handleSettingChange = async (key: keyof ttsService.TTSSettings, value: any) => {
    try {
      // Special validation for voiceId changes
      if (key === 'voiceId') {
        const voiceIdStr = String(value);
        const isPremiumVoice = voiceIdStr.startsWith('azure_') || voiceIdStr.startsWith('google_');
        
        if (isPremiumVoice) {
          // Check if Premium Voice Access mode is enabled
          const { ipcRenderer } = window.require('electron');
          const response = await ipcRenderer.invoke('tts-access:get-config');
          
          if (response.success && response.data) {
            const accessMode = response.data.access_mode;
            
            if (accessMode === 'premium_voice_access') {
              setError('Premium Voice Access mode is currently enabled. Remove the Premium Voice Access setting in the TTS Access tab first.');
              // Clear error after 8 seconds (longer for user to read)
              setTimeout(() => setError(null), 8000);
              return;
            }
          }
        }
      }

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

  const getUniqueLanguages = (): string[] => {
    if (!settings) return [];

    const languages = new Set<string>();
    voiceGroups.forEach(group => {
      group.voices.forEach(voice => {
        const voiceIdStr = voice.voice_id || '';
        const isWebSpeech = !voiceIdStr.startsWith('azure_') && !voiceIdStr.startsWith('google_');
        const isAzure = voiceIdStr.startsWith('azure_');
        const isGoogle = voiceIdStr.startsWith('google_');

        if (isWebSpeech && !(settings.webspeechEnabled ?? true)) return;
        if (isAzure && !(settings.azureEnabled ?? false)) return;
        if (isGoogle && !(settings.googleEnabled ?? false)) return;

        if (providerFilter !== 'all' && voice.provider !== providerFilter) return;

        languages.add(voice.language_name);
      });
    });
    return Array.from(languages).sort();
  };

  const getAvailableGenders = (): string[] => {
    if (!settings) return [];

    const genders = new Set<string>();
    voiceGroups.forEach(group => {
      group.voices.forEach(voice => {
        const voiceIdStr = voice.voice_id || '';
        const isWebSpeech = !voiceIdStr.startsWith('azure_') && !voiceIdStr.startsWith('google_');
        const isAzure = voiceIdStr.startsWith('azure_');
        const isGoogle = voiceIdStr.startsWith('google_');

        if (isWebSpeech && !(settings.webspeechEnabled ?? true)) return;
        if (isAzure && !(settings.azureEnabled ?? false)) return;
        if (isGoogle && !(settings.googleEnabled ?? false)) return;

        if (providerFilter !== 'all' && voice.provider !== providerFilter) return;

        if (languageFilter !== 'all' && voice.language_name !== languageFilter) return;

        if (voice.gender) {
          genders.add(voice.gender);
        }
      });
    });
    return Array.from(genders).sort();
  };

  const getAvailableProviders = (): Array<{ value: string; label: string }> => {
    if (!settings) return [];

    const providers: Array<{ value: string; label: string }> = [];
    
    if (settings.webspeechEnabled ?? true) {
      providers.push({ value: 'webspeech', label: '🌐 WebSpeech' });
    }
    if (settings.azureEnabled ?? false) {
      providers.push({ value: 'azure', label: '☁️ Azure' });
    }
    if (settings.googleEnabled ?? false) {
      providers.push({ value: 'google', label: '🔵 Google' });
    }
    
    return providers;
  };

  const getFilteredGroups = (): VoiceGroup[] => {
    if (!settings) return [];

    return voiceGroups.map(group => ({
      ...group,
      voices: group.voices.filter(voice => {
        const voiceIdStr = voice.voice_id || '';
        const isWebSpeech = !voiceIdStr.startsWith('azure_') && !voiceIdStr.startsWith('google_');
        const isAzure = voiceIdStr.startsWith('azure_');
        const isGoogle = voiceIdStr.startsWith('google_');

        if (isWebSpeech && !(settings.webspeechEnabled ?? true)) return false;
        if (isAzure && !(settings.azureEnabled ?? false)) return false;
        if (isGoogle && !(settings.googleEnabled ?? false)) return false;

        const searchLower = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm ||
          voice.name.toLowerCase().includes(searchLower) ||
          voice.language_name.toLowerCase().includes(searchLower) ||
          voice.region.toLowerCase().includes(searchLower) ||
          voice.id.toString().includes(searchTerm);

        const matchesProvider = providerFilter === 'all' || voice.provider === providerFilter;

        const matchesLanguage = languageFilter === 'all' || voice.language_name === languageFilter;

        const matchesGender = genderFilter === 'all' || voice.gender === genderFilter;

        return matchesSearch && matchesProvider && matchesLanguage && matchesGender;
      })
    })).filter(group => group.voices.length > 0);
  };

  const formatVoiceOption = (voice: VoiceGroup['voices'][0]): string => {
    const genderIcon = voice.gender === 'male' ? '♂️' : voice.gender === 'female' ? '♀️' : '⚧';
    const id = voice.id.toString().padStart(3, '0');
    const location = voice.region ? ` (${voice.region})` : '';

    return `${id} │ ${voice.provider} │ ${voice.name}${location} ${genderIcon}`;
  };

  const getVisibleVoiceCount = (): number => {
    return getFilteredGroups().reduce((sum, group) => sum + group.voices.length, 0);
  };

  const getProviderVoiceCounts = () => {
    const counts = { webspeech: 0 };

    voiceGroups.forEach(group => {
      group.voices.forEach(voice => {
        counts.webspeech++;
      });
    });

    return counts;
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

  return (
    <div className="tts-container">
      <h2>Text-to-Speech</h2>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="tab-navigation">
        <button
          className={`tab-button ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => setActiveTab('settings')}      >
          🎙️ Voice Settings
        </button>
        <button
          className={`tab-button ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          📋 TTS Rules
        </button>
        <button
          className={`tab-button ${activeTab === 'access' ? 'active' : ''}`}
          onClick={() => setActiveTab('access')}
        >
          🔐 TTS Access
        </button>
        <button
          className={`tab-button ${activeTab === 'viewer-rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('viewer-rules')}
        >
          👤 Viewer Rules
        </button>
      </div>      {activeTab === 'settings' && (
        <div className="tab-content">
          <VoiceSettingsTab
            settings={settings}
            voiceGroups={voiceGroups}
            voiceStats={voiceStats}
            testMessage={testMessage}
            isSpeaking={isSpeaking}
            rescanningProvider={rescanningProvider}
            rescanMessages={rescanMessages}
            searchTerm={searchTerm}
            languageFilter={languageFilter}
            genderFilter={genderFilter}
            providerFilter={providerFilter}
            error={error}
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
            onErrorClear={() => setError(null)}
            getUniqueLanguages={getUniqueLanguages}
            getAvailableGenders={getAvailableGenders}
            getAvailableProviders={getAvailableProviders}
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
      )}      {activeTab === 'access' && (
        <div className="tab-content">
          <TTSAccessTab
            globalVoiceProvider={
              settings?.voiceId?.startsWith('azure_') ? 'azure' :
              settings?.voiceId?.startsWith('google_') ? 'google' :
              'webspeech'
            }
          />
        </div>
      )}

      {activeTab === 'viewer-rules' && (
        <div className="tab-content">
          <ViewerRulesTab
            voiceGroups={voiceGroups}
            accessMode={'access_all'}
          />
        </div>
      )}
    </div>
  );
};

