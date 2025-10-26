import React, { useState } from 'react';
import * as ttsService from '../../../services/tts';

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

interface Props {
  settings: ttsService.TTSSettings;
  voiceGroups: VoiceGroup[];
  voiceStats: { total: number; available: number; unavailable: number };
  onViewerSearch: (query: string) => Promise<void>;
  onSelectViewer: (username: string) => Promise<void>;
  onCreateRule: () => Promise<void>;
  onDeleteRule: () => Promise<void>;
  onUpdateRule: (updates: Partial<ttsService.ViewerTTSRuleInput>) => Promise<void>;
  selectedViewer: string | null;
  viewerSearchResults: Array<{ id: string; username: string; display_name?: string }>;
  viewerRule: ttsService.ViewerTTSRule | null;
  viewerSearchTerm: string;
  viewerVoiceSearch: string;
  viewerLanguageFilter: string;
  viewerGenderFilter: string;
  onViewerVoiceSearchChange: (term: string) => void;
  onViewerLanguageFilterChange: (filter: string) => void;
  onViewerGenderFilterChange: (filter: string) => void;
  getUniqueLanguages: () => string[];
  getViewerFilteredGroups: () => VoiceGroup[];
  getViewerVisibleVoiceCount: () => number;
  formatVoiceOption: (voice: VoiceGroup['voices'][0]) => string;
  getMuteDurationMinutes: () => number;
  getCooldownDurationMinutes: () => number;
  onMuteChange: (muted: boolean) => Promise<void>;
  onMuteDurationChange: (minutes: number) => Promise<void>;
  onCooldownChange: (enabled: boolean) => Promise<void>;
  onCooldownDurationChange: (minutes: number) => Promise<void>;
  onResetVoice: () => Promise<void>;
}

export const ViewersTab: React.FC<Props> = ({
  settings,
  voiceGroups,
  voiceStats,
  onViewerSearch,
  onSelectViewer,
  onCreateRule,
  onDeleteRule,
  onUpdateRule,
  selectedViewer,
  viewerSearchResults,
  viewerRule,
  viewerSearchTerm,
  viewerVoiceSearch,
  viewerLanguageFilter,
  viewerGenderFilter,
  onViewerVoiceSearchChange,
  onViewerLanguageFilterChange,
  onViewerGenderFilterChange,
  getUniqueLanguages,
  getViewerFilteredGroups,
  getViewerVisibleVoiceCount,
  formatVoiceOption,
  getMuteDurationMinutes,
  getCooldownDurationMinutes,
  onMuteChange,
  onMuteDurationChange,
  onCooldownChange,
  onCooldownDurationChange,
  onResetVoice,
}) => {
  const viewerFilteredGroups = getViewerFilteredGroups();
  const viewerVisibleCount = getViewerVisibleVoiceCount();

  // Get voice info helpers
  const getVoiceInfoById = (voiceId: number | null) => {
    if (voiceId === null) return { name: null, voice: null, available: true };
    for (const group of voiceGroups) {
      const voice = group.voices.find(v => v.id === voiceId);
      if (voice) {
        const voiceIdStr = voice.voice_id || '';
        if (voiceIdStr.startsWith('google_')) {
          return { name: voice.name, voice, available: false };
        }
        const webspeechEnabled = settings.webspeechEnabled ?? false;
        return { name: voice.name, voice, available: webspeechEnabled };
      }
    }
    return { name: `Voice #${voiceId}`, voice: null, available: false };
  };

  const getVoiceInfoByVoiceId = (voiceIdStr: string) => {
    if (!voiceIdStr) return { name: null, voice: null, available: true };
    for (const group of voiceGroups) {
      const voice = group.voices.find(v => v.voice_id === voiceIdStr);
      if (voice) {
        if (voiceIdStr.startsWith('google_')) {
          return { name: voice.name, voice, available: false };
        }
        const webspeechEnabled = settings.webspeechEnabled ?? false;
        return { name: voice.name, voice, available: webspeechEnabled };
      }
    }
    return { name: voiceIdStr, voice: null, available: false };
  };

  const customVoiceInfo = viewerRule ? getVoiceInfoById(viewerRule.customVoiceId) : null;
  const globalVoiceInfo = getVoiceInfoByVoiceId(settings.voiceId);

  const enabledProviders: string[] = [];
  if (settings.webspeechEnabled) enabledProviders.push('Web Speech');
  const providersText = enabledProviders.length > 0 ? enabledProviders.join(', ') : 'None';

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
            onChange={(e) => onViewerSearch(e.target.value)}
          />
          {viewerSearchResults.length > 0 && (
            <div className="viewer-search-results">
              {viewerSearchResults.map((viewer) => (
                <div
                  key={viewer.id}
                  className="viewer-search-result"
                  onClick={() => onSelectViewer(viewer.username)}
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
              onClick={onDeleteRule}
            >
              {viewerRule ? 'Delete Rules' : 'Cancel'}
            </button>
          </div>

          {!viewerRule && (
            <div className="no-rules-message">
              <p>No custom rules for this viewer</p>
              <button className="create-rule-button" onClick={onCreateRule}>
                Create Rules
              </button>
            </div>
          )}

          {viewerRule && (
            <ViewerRuleEditor
              viewerRule={viewerRule}
              settings={settings}
              voiceGroups={voiceGroups}
              voiceStats={voiceStats}
              viewerFilteredGroups={viewerFilteredGroups}
              viewerVisibleCount={viewerVisibleCount}
              customVoiceInfo={customVoiceInfo}
              globalVoiceInfo={globalVoiceInfo}
              providersText={providersText}
              viewerVoiceSearch={viewerVoiceSearch}
              viewerLanguageFilter={viewerLanguageFilter}
              viewerGenderFilter={viewerGenderFilter}
              onViewerVoiceSearchChange={onViewerVoiceSearchChange}
              onViewerLanguageFilterChange={onViewerLanguageFilterChange}
              onViewerGenderFilterChange={onViewerGenderFilterChange}
              getUniqueLanguages={getUniqueLanguages}
              formatVoiceOption={formatVoiceOption}
              getMuteDurationMinutes={getMuteDurationMinutes}
              getCooldownDurationMinutes={getCooldownDurationMinutes}
              onUpdateRule={onUpdateRule}
              onMuteChange={onMuteChange}
              onMuteDurationChange={onMuteDurationChange}
              onCooldownChange={onCooldownChange}
              onCooldownDurationChange={onCooldownDurationChange}
              onResetVoice={onResetVoice}
            />
          )}
        </div>
      )}
    </div>
  );
};

// Sub-component for rule editor
const ViewerRuleEditor: React.FC<any> = ({
  viewerRule,
  settings,
  voiceGroups,
  voiceStats,
  viewerFilteredGroups,
  viewerVisibleCount,
  customVoiceInfo,
  globalVoiceInfo,
  providersText,
  viewerVoiceSearch,
  viewerLanguageFilter,
  viewerGenderFilter,
  onViewerVoiceSearchChange,
  onViewerLanguageFilterChange,
  onViewerGenderFilterChange,
  getUniqueLanguages,
  formatVoiceOption,
  getMuteDurationMinutes,
  getCooldownDurationMinutes,
  onUpdateRule,
  onMuteChange,
  onMuteDurationChange,
  onCooldownChange,
  onCooldownDurationChange,
  onResetVoice,
}) => {
  return (
    <div className="viewer-rule-editor">
      {/* TTS Provider */}
      <div className="rule-setting-group">
        <label className="rule-label">Enabled TTS Providers</label>
        <div className="provider-display">
          {providersText}
        </div>
        <p className="setting-hint" style={{ fontSize: '12px', marginTop: '5px', color: '#888' }}>
          Only voices from enabled providers are shown. Toggle providers in the Settings tab.
        </p>
      </div>

      {/* Voice Search and Filters */}
      <div className="voice-filters">
        <input
          type="text"
          placeholder="🔍 Search voices by name, language, or ID..."
          value={viewerVoiceSearch}
          onChange={(e) => onViewerVoiceSearchChange(e.target.value)}
          className="search-input"
        />        <select
          value={viewerLanguageFilter}
          onChange={(e) => onViewerLanguageFilterChange(e.target.value)}
          className="filter-select"
        >
          <option value="all">All Languages</option>
          {getUniqueLanguages().map((lang: string) => (
            <option key={lang} value={lang}>{lang}</option>
          ))}
        </select>

        <select
          value={viewerGenderFilter}
          onChange={(e) => onViewerGenderFilterChange(e.target.value)}
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

        {/* Warning if custom voice is unavailable */}
        {viewerRule.customVoiceId !== null && !customVoiceInfo?.available && (
          <div style={{
            padding: '10px',
            marginBottom: '10px',
            backgroundColor: '#ff6b6b',
            color: 'white',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            ⚠️ Voice "{customVoiceInfo?.name}" is unavailable (provider disabled).
            <button
              onClick={() => onUpdateRule({ customVoiceId: null })}
              style={{
                marginLeft: '10px',
                padding: '5px 10px',
                backgroundColor: 'white',
                color: '#ff6b6b',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              Use Global Voice
            </button>
          </div>
        )}

        {/* Warning if global voice is unavailable */}
        {viewerRule.customVoiceId === null && !globalVoiceInfo?.available && (
          <div style={{
            padding: '10px',
            marginBottom: '10px',
            backgroundColor: '#ffa500',
            color: 'white',
            borderRadius: '4px',
            fontSize: '14px'
          }}>
            ⚠️ Global voice "{globalVoiceInfo?.name}" is unavailable (provider disabled). Please select a custom voice or enable the provider in Settings tab.
          </div>
        )}

        <select
          value={viewerRule.customVoiceId?.toString() || ''}
          onChange={(e) => onUpdateRule({ customVoiceId: e.target.value ? parseInt(e.target.value) : null })}
          className="voice-select"
        >          <option value="">Use Global Voice ({globalVoiceInfo?.name || 'None'})</option>
          {viewerFilteredGroups.map((group: VoiceGroup) => (
            <optgroup key={group.category} label={group.category}>
              {group.voices.map((voice: VoiceGroup['voices'][0]) => (
                <option key={voice.voice_id} value={voice.id}>
                  {formatVoiceOption(voice)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {viewerRule.customVoiceId !== null && (
          <button className="reset-voice-button" onClick={() => onResetVoice()}>
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
          onChange={(e) => onUpdateRule({ pitchOverride: parseFloat(e.target.value) })}
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
          onChange={(e) => onUpdateRule({ rateOverride: parseFloat(e.target.value) })}
          className="slider"
        />
      </div>

      {/* Mute */}
      <div className="rule-setting-group">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={viewerRule.isMuted}
            onChange={(e) => onMuteChange(e.target.checked)}
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
              onChange={(e) => onMuteDurationChange(parseInt(e.target.value))}
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
            onChange={(e) => onCooldownChange(e.target.checked)}
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
                onChange={(e) => onUpdateRule({ cooldownSeconds: parseInt(e.target.value) })}
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
                onChange={(e) => onCooldownDurationChange(parseInt(e.target.value))}
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
};
