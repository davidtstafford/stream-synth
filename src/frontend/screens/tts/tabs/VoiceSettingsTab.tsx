import React, { useState } from 'react';
import * as ttsService from '../../../services/tts';
import { AzureSetupGuide, WebSpeechSetupGuide, GoogleSetupGuide } from './VoiceSettingGuides';

// VoiceGroup interface is defined in parent component, but we need to mirror it here
// This is defined in tts.tsx as well - kept in sync for type safety
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

interface Props {
  settings: ttsService.TTSSettings;
  voiceGroups: VoiceGroup[];
  voiceStats: { total: number; available: number; unavailable: number };
  testMessage: string;
  isSpeaking: boolean;
  rescanningProvider: string | null;
  rescanMessages: { [key: string]: string };
  searchTerm: string;
  languageFilter: string;
  genderFilter: string;
  providerFilter: string;
  onSettingChange: (key: keyof ttsService.TTSSettings, value: any) => Promise<void>;
  onTestVoice: () => Promise<void>;
  onStop: () => Promise<void>;
  onTestMessageChange: (message: string) => void;
  onProviderToggle: (provider: 'webspeech' | 'azure' | 'google', enabled: boolean) => Promise<void>;
  onProviderRescan: (provider: 'webspeech' | 'azure' | 'google') => Promise<void>;
  onSearchChange: (term: string) => void;
  onLanguageFilterChange: (filter: string) => void;
  onGenderFilterChange: (filter: string) => void;
  onProviderFilterChange: (filter: string) => void;  getUniqueLanguages: () => string[];
  getAvailableGenders: () => string[];
  getAvailableProviders: () => Array<{ value: string; label: string }>;
  getFilteredGroups: () => VoiceGroup[];
  getVisibleVoiceCount: () => number;
  formatVoiceOption: (voice: VoiceGroup['voices'][0]) => string;
  getProviderVoiceCounts: () => { webspeech: number };
}

export const VoiceSettingsTab: React.FC<Props> = ({
  settings,
  voiceGroups,
  voiceStats,
  testMessage,
  isSpeaking,
  rescanningProvider,
  rescanMessages,
  searchTerm,
  languageFilter,
  genderFilter,
  providerFilter,
  onSettingChange,
  onTestVoice,
  onStop,
  onTestMessageChange,
  onProviderToggle,
  onProviderRescan,
  onSearchChange,
  onLanguageFilterChange,
  onGenderFilterChange,
  onProviderFilterChange,
  getUniqueLanguages,
  getAvailableGenders,
  getAvailableProviders,
  getFilteredGroups,
  getVisibleVoiceCount,
  formatVoiceOption,
  getProviderVoiceCounts,
}) => {
  const [showAzureGuide, setShowAzureGuide] = useState(false);
  const [showWebSpeechGuide, setShowWebSpeechGuide] = useState(false);
  const [showGoogleGuide, setShowGoogleGuide] = useState(false);
  
  const filteredGroups = getFilteredGroups();
  const visibleCount = getVisibleVoiceCount();
  const providerCounts = getProviderVoiceCounts();

  const handleAzureGuideClose = () => {
    setShowAzureGuide(false);
  };  const handleAzureGuideComplete = async (apiKey: string, region: string) => {
    // Save the Azure credentials and sync voices
    try {
      console.log('[VoiceSettingsTab] Azure setup complete, saving credentials and syncing voices...');
      await onSettingChange('azureApiKey', apiKey);
      await onSettingChange('azureRegion', region);
      
      // Sync Azure voices to database before enabling
      console.log('[VoiceSettingsTab] Syncing Azure voices...');
      const { ipcRenderer } = window.require('electron');
      const syncResult = await ipcRenderer.invoke('azure:sync-voices', { apiKey, region });
      console.log('[VoiceSettingsTab] Sync result:', syncResult);
      
      // Enable Azure provider
      await onProviderToggle('azure', true);
      setShowAzureGuide(false);
    } catch (error) {
      console.error('[VoiceSettingsTab] Error saving Azure credentials:', error);
    }
  };

  const handleGoogleGuideComplete = async (apiKey: string) => {
    // Save the Google credentials and sync voices
    try {
      console.log('[VoiceSettingsTab] Google setup complete, saving credentials and syncing voices...');
      await onSettingChange('googleApiKey', apiKey);
      
      // Sync Google voices to database before enabling
      console.log('[VoiceSettingsTab] Syncing Google voices...');
      const { ipcRenderer } = window.require('electron');
      const syncResult = await ipcRenderer.invoke('google:sync-voices', { apiKey });
      console.log('[VoiceSettingsTab] Sync result:', syncResult);
      
      // Enable Google provider
      await onProviderToggle('google', true);
      setShowGoogleGuide(false);
    } catch (error) {
      console.error('[VoiceSettingsTab] Error saving Google credentials:', error);
    }
  };

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
            onChange={(e) => onSettingChange('enabled', e.target.checked)}
          />
          <span className="checkbox-text">Enable TTS</span>
        </label>
      </div>      {/* Provider Enable Toggles */}
      <div className="setting-group">
        <label className="setting-label">
          TTS Providers
          <span className="setting-hint" style={{ display: 'block', fontWeight: 'normal', fontSize: '0.9em', marginTop: '5px' }}>
            Enable multiple providers to use different voices for different viewers
          </span>
        </label>        {/* Web Speech Provider */}
        <div className="provider-toggle-section" style={{ marginBottom: '15px', padding: '15px', border: '1px solid #444', borderRadius: '8px', backgroundColor: '#1a1a1a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={settings.webspeechEnabled ?? true}
                onChange={(e) => onProviderToggle('webspeech', e.target.checked)}
              />
              <span className="checkbox-text" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                🌐 Web Speech API (Free)
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowWebSpeechGuide(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.95em',
                  backgroundColor: '#0078d4',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
                title="View Web Speech voice installation guide"
              >
                ⚙️ Setup
              </button>
              <button
                onClick={() => onProviderRescan('webspeech')}
                disabled={rescanningProvider === 'webspeech'}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.95em',
                  backgroundColor: rescanningProvider === 'webspeech' ? '#555' : '#28a745',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: rescanningProvider === 'webspeech' ? 'not-allowed' : 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  opacity: rescanningProvider === 'webspeech' ? 0.6 : 1
                }}
                title={rescanningProvider === 'webspeech' ? 'Rescanning...' : 'Click to rescan voices immediately'}
              >
                {rescanningProvider === 'webspeech' ? '⟳ Rescanning...' : '⟳ Rescan'}
              </button>
            </div>          </div>
          <div style={{ marginLeft: '28px', color: '#888' }}>
            <div>✓ {providerCounts.webspeech} system voices available</div>
            <div>✓ No API key required</div>
            <div>✓ Works offline</div>
          </div>
          {rescanMessages['webspeech'] && (
            <div style={{
              marginTop: '12px',
              marginLeft: '28px',
              padding: '8px 12px',
              backgroundColor: rescanMessages['webspeech'].startsWith('✓') ? '#1a3a1a' : '#3a1a1a',
              border: `1px solid ${rescanMessages['webspeech'].startsWith('✓') ? '#28a745' : '#dc3545'}`,
              borderRadius: '4px',
              fontSize: '0.9em',
              color: rescanMessages['webspeech'].startsWith('✓') ? '#28a745' : '#dc3545'
            }}>
              {rescanMessages['webspeech']}
            </div>
          )}
        </div>        {/* Azure Provider Setup Button */}
        <div className="provider-toggle-section" style={{ padding: '15px', border: '1px solid #444', borderRadius: '8px', backgroundColor: '#1a1a1a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={settings.azureEnabled ?? false}
                onChange={(e) => onProviderToggle('azure', e.target.checked)}
              />
              <span className="checkbox-text" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                🔷 Azure Neural Voices (Premium)
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowAzureGuide(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.95em',
                  backgroundColor: '#0078d4',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
                title={settings?.azureApiKey ? 'Click to edit Azure setup' : 'Click to set up Azure Neural Voices'}
              >
                {settings?.azureApiKey ? '✏️ Edit Setup' : '⚙️ Setup'}
              </button>
              {settings?.azureApiKey && (
                <button
                  onClick={() => onProviderRescan('azure')}
                  disabled={rescanningProvider === 'azure'}
                  style={{
                    padding: '10px 16px',
                    fontSize: '0.95em',
                    backgroundColor: rescanningProvider === 'azure' ? '#555' : '#28a745',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: rescanningProvider === 'azure' ? 'not-allowed' : 'pointer',
                    color: '#fff',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    opacity: rescanningProvider === 'azure' ? 0.6 : 1
                  }}
                  title="Rescan Azure voices for changes"
                >
                  {rescanningProvider === 'azure' ? '⟳ Rescanning...' : '⟳ Rescan'}
                </button>
              )}
            </div>
          </div>          <div style={{ marginLeft: '28px', color: '#888', marginBottom: '12px' }}>
            <div>✓ 300+ high-quality neural voices</div>
            <div>✓ Multiple languages and regions</div>
            <div>✓ Free tier: 500K characters/month</div>
          </div>
          {rescanMessages['azure'] && (
            <div style={{
              marginBottom: '12px',
              marginLeft: '28px',
              padding: '8px 12px',
              backgroundColor: rescanMessages['azure'].startsWith('✓') ? '#1a3a1a' : '#3a1a1a',
              border: `1px solid ${rescanMessages['azure'].startsWith('✓') ? '#28a745' : '#dc3545'}`,
              borderRadius: '4px',
              fontSize: '0.9em',
              color: rescanMessages['azure'].startsWith('✓') ? '#28a745' : '#dc3545'
            }}>
              {rescanMessages['azure']}
            </div>
          )}
            {/* Best Practices Callout */}
          <div style={{
            marginTop: '12px',
            padding: '10px',
            backgroundColor: '#1f3a5f',
            borderLeft: '4px solid #0078d4',
            borderRadius: '4px',
            fontSize: '0.85em',
            lineHeight: '1.5',
            color: '#e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>💡 Best Practices:</div>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li>Use premium Azure voices for regular viewers who appreciate quality</li>
              <li>Keep the global voice as Web Speech API for cost efficiency</li>
              <li>Override per-viewer in the Viewers tab to customize per user</li>
              <li>Test voices before using them to ensure quality</li>
            </ul>
          </div>
        </div>        {/* Google Provider */}
        <div className="provider-toggle-section" style={{ padding: '15px', border: '1px solid #444', borderRadius: '8px', backgroundColor: '#1a1a1a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
            <label className="checkbox-label" style={{ display: 'flex', alignItems: 'center' }}>
              <input
                type="checkbox"
                checked={settings.googleEnabled ?? false}
                onChange={(e) => onProviderToggle('google', e.target.checked)}
              />
              <span className="checkbox-text" style={{ fontSize: '1.1em', fontWeight: 'bold' }}>
                🔵 Google Cloud Text-to-Speech (Premium)
              </span>
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setShowGoogleGuide(true)}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.95em',
                  backgroundColor: '#0078d4',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  color: '#fff',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap'
                }}
                title={settings?.googleApiKey ? 'Click to edit Google setup' : 'Click to set up Google Cloud Text-to-Speech'}
              >
                {settings?.googleApiKey ? '✏️ Edit Setup' : '⚙️ Setup'}
              </button>
              {settings?.googleApiKey && (
                <button
                  onClick={() => onProviderRescan('google')}
                  disabled={rescanningProvider === 'google'}
                  style={{
                    padding: '10px 16px',
                    fontSize: '0.95em',
                    backgroundColor: rescanningProvider === 'google' ? '#555' : '#28a745',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: rescanningProvider === 'google' ? 'not-allowed' : 'pointer',
                    color: '#fff',
                    fontWeight: 'bold',
                    whiteSpace: 'nowrap',
                    opacity: rescanningProvider === 'google' ? 0.6 : 1
                  }}
                  title="Rescan Google voices for changes"
                >
                  {rescanningProvider === 'google' ? '⟳ Rescanning...' : '⟳ Rescan'}
                </button>
              )}
            </div>
          </div>          <div style={{ marginLeft: '28px', color: '#888', marginBottom: '12px' }}>
            <div>✓ 400+ high-quality neural voices (Chirp 3: HD)</div>
            <div>✓ 100+ languages and variants</div>
            <div>✓ Free tier: 1M characters/month</div>
          </div>
          {rescanMessages['google'] && (
            <div style={{
              marginBottom: '12px',
              marginLeft: '28px',
              padding: '8px 12px',
              backgroundColor: rescanMessages['google'].startsWith('✓') ? '#1a3a1a' : '#3a1a1a',
              border: `1px solid ${rescanMessages['google'].startsWith('✓') ? '#28a745' : '#dc3545'}`,
              borderRadius: '4px',
              fontSize: '0.9em',
              color: rescanMessages['google'].startsWith('✓') ? '#28a745' : '#dc3545'
            }}>
              {rescanMessages['google']}
            </div>
          )}
          {/* Best Practices Callout */}
          <div style={{
            marginTop: '12px',
            padding: '10px',
            backgroundColor: '#1f3a5f',
            borderLeft: '4px solid #4285f4',
            borderRadius: '4px',
            fontSize: '0.85em',
            lineHeight: '1.5',
            color: '#e0e0e0'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '6px' }}>💡 Best Practices:</div>
            <ul style={{ margin: '0', paddingLeft: '20px' }}>
              <li>Use Google voices for a global audience with diverse language needs</li>
              <li>Combine with Azure voices for maximum quality and cost flexibility</li>
              <li>Monitor your usage to stay within free tier (500K chars/month)</li>
              <li>Test voices before using them to ensure quality</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Voice Search and Filters */}
      <div className="voice-filters">        <input
          type="text"
          placeholder="🔍 Search voices by name, language, or ID..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="search-input"
        />        <select
          value={providerFilter}
          onChange={(e) => onProviderFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Providers</option>
          {getAvailableProviders().map(provider => (
            <option key={provider.value} value={provider.value}>{provider.label}</option>
          ))}
        </select>

        <select
          value={languageFilter}
          onChange={(e) => onLanguageFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Languages</option>
          {getUniqueLanguages().map(lang => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>        <select
          value={genderFilter}
          onChange={(e) => onGenderFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Genders</option>
          {getAvailableGenders().map(gender => (
            <option key={gender} value={gender}>
              {gender === 'male' ? '♂️ Male' : gender === 'female' ? '♀️ Female' : '⚧ Neutral'}
            </option>
          ))}
        </select>
      </div>      {/* Voice Selection with Grouped Dropdown */}
      <div className="setting-group">
        <label className="setting-label">
          Voice ({visibleCount} of {voiceStats.available} available)
        </label>

        {/* Warning if current voice provider is disabled */}
        {settings.voiceId && (() => {
          const voiceIdStr = settings.voiceId;
          const isAzure = voiceIdStr.startsWith('azure_');
          const isGoogle = voiceIdStr.startsWith('google_');
          
          if (isAzure && !(settings.azureEnabled ?? false)) {
            return (
              <div style={{
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: '#ffa500',
                color: 'white',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                ⚠️ Current voice is from Azure, which is disabled. Enable Azure or select a different voice.
              </div>
            );
          }
          if (isGoogle && !(settings.googleEnabled ?? false)) {
            return (
              <div style={{
                padding: '10px',
                marginBottom: '10px',
                backgroundColor: '#ffa500',
                color: 'white',
                borderRadius: '4px',
                fontSize: '14px'
              }}>
                ⚠️ Current voice is from Google, which is disabled. Enable Google or select a different voice.
              </div>
            );
          }
          return null;
        })()}

        <select
          value={settings.voiceId || ''}
          onChange={(e) => onSettingChange('voiceId', e.target.value)}
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
          onChange={(e) => onSettingChange('volume', parseInt(e.target.value))}
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
          onChange={(e) => onSettingChange('rate', parseFloat(e.target.value))}
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
          onChange={(e) => onSettingChange('pitch', parseFloat(e.target.value))}
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
          onChange={(e) => onTestMessageChange(e.target.value)}
          rows={3}
          className="test-textarea"
        />
      </div>      {/* Test Buttons */}
      <div className="button-group">
        <button
          onClick={onTestVoice}
          disabled={!settings.voiceId || isSpeaking}
          className={`btn btn-primary ${(!settings.voiceId || isSpeaking) ? 'disabled' : ''}`}
        >
          {isSpeaking ? '🔊 Speaking...' : '▶️ Test Voice'}
        </button>
        <button
          onClick={onStop}
          disabled={!isSpeaking}
          className={`btn btn-danger ${!isSpeaking ? 'disabled' : ''}`}
        >
          ⏹️ Stop
        </button>
      </div>      {/* Azure Setup Guide Modal */}
      {showAzureGuide && (
        <AzureSetupGuide
          onClose={handleAzureGuideClose}
          onComplete={handleAzureGuideComplete}
        />
      )}      {/* WebSpeech Setup Guide Modal */}
      {showWebSpeechGuide && (
        <WebSpeechSetupGuide
          onClose={() => setShowWebSpeechGuide(false)}
        />
      )}

      {/* Google Setup Guide Modal */}
      {showGoogleGuide && (
        <GoogleSetupGuide
          onClose={() => setShowGoogleGuide(false)}
          onComplete={handleGoogleGuideComplete}
        />
      )}
    </>
  );
};
