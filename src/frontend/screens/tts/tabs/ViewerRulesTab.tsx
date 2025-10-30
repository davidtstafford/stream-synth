import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface ViewerVoicePreference {
  id: number;
  viewer_id: string;
  voice_id: string;
  provider: string;
  pitch: number;
  speed: number;
  created_at: string;
  updated_at: string;
}

interface ViewerVoicePreferenceWithInfo extends ViewerVoicePreference {
  display_name: string | null;
  username: string;
  voice_name: string | null;
}

interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
  hasRule: boolean;
}

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

interface Message {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

interface ViewerTTSRules {
  id: number;
  viewer_id: string;
  is_muted: boolean;
  mute_period_mins?: number | null;
  muted_at?: string | null;
  mute_expires_at?: string | null;
  has_cooldown: boolean;
  cooldown_gap_seconds?: number | null;
  cooldown_period_mins?: number | null;
  cooldown_set_at?: string | null;
  cooldown_expires_at?: string | null;
  created_at: string;
  updated_at: string;
}

interface Props {
  voiceGroups: VoiceGroup[];
  accessMode: 'access_all' | 'limited_access' | 'premium_voice_access';
}

export const ViewerRulesTab: React.FC<Props> = ({ voiceGroups, accessMode }) => {
  const [rules, setRules] = useState<ViewerVoicePreferenceWithInfo[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Viewer[]>([]);
  const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
  const [editingRule, setEditingRule] = useState<Partial<ViewerVoicePreference> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  
  // TTS Rules (Mute & Cooldown) - Phase 4
  const [ttsRules, setTtsRules] = useState<ViewerTTSRules | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [mutePeriodMins, setMutePeriodMins] = useState(0);
  const [hasCooldown, setHasCooldown] = useState(false);
  const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
  const [cooldownPeriodMins, setCooldownPeriodMins] = useState(0);
  
  // Voice filters
  const [voiceSearchTerm, setVoiceSearchTerm] = useState('');
  const [providerFilter, setProviderFilter] = useState('all');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [genderFilter, setGenderFilter] = useState('all');

  useEffect(() => {
    loadRules();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchViewers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const loadRules = async () => {
    try {
      setLoading(true);
      const response = await ipcRenderer.invoke('viewer-rules:list');
      
      if (response.success && response.data) {
        setRules(response.data);
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to load rules' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setLoading(false);
    }
  };

  const searchViewers = async () => {
    try {
      const response = await ipcRenderer.invoke('viewer-rules:search-viewers', { query: searchTerm });
      
      if (response.success && response.data) {
        setSearchResults(response.data);
      }
    } catch (error: any) {
      console.error('Error searching viewers:', error);
    }
  };
  const selectViewer = async (viewer: Viewer) => {
    setSelectedViewer(viewer);
    setSearchTerm(viewer.display_name || viewer.username);
    setSearchResults([]);
    
    // Check if viewer has an existing voice rule
    const response = await ipcRenderer.invoke('viewer-rules:get', { viewerId: viewer.id });
    
    if (response.success && response.data) {
      setEditingRule(response.data);
    }

    // Load TTS rules (mute & cooldown) - Phase 4
    await loadTTSRules(viewer.id);
  };

  const loadTTSRules = async (viewerId: string) => {
    try {
      const response = await ipcRenderer.invoke('viewer-tts-rules:get', { viewerId });
      
      if (response.success && response.data) {
        const rules = response.data;
        setTtsRules(rules);
        setIsMuted(rules.is_muted);
        setMutePeriodMins(rules.mute_period_mins || 0);
        setHasCooldown(rules.has_cooldown);
        setCooldownGapSeconds(rules.cooldown_gap_seconds || 30);
        setCooldownPeriodMins(rules.cooldown_period_mins || 0);
      } else {
        // No rules exist yet - reset to defaults
        setTtsRules(null);
        setIsMuted(false);
        setMutePeriodMins(0);
        setHasCooldown(false);
        setCooldownGapSeconds(30);
        setCooldownPeriodMins(0);
      }
    } catch (error: any) {
      console.error('Error loading TTS rules:', error);
    }
  };

  const handleCreateRule = () => {
    if (!selectedViewer) return;
    
    setEditingRule({
      viewer_id: selectedViewer.id,
      voice_id: '',
      provider: 'webspeech',
      pitch: 1.0,
      speed: 1.0
    });
  };

  const handleEditRule = async () => {
    if (!selectedViewer) return;
    
    const response = await ipcRenderer.invoke('viewer-rules:get', { viewerId: selectedViewer.id });
    
    if (response.success && response.data) {
      setEditingRule(response.data);
    }
  };

  const updateRule = (field: keyof ViewerVoicePreference, value: any) => {
    if (!editingRule) return;
    
    setEditingRule({
      ...editingRule,
      [field]: value
    });
  };  const handleSaveRule = async () => {
    if (!editingRule || !editingRule.viewer_id || !editingRule.voice_id) {
      setMessage({ type: 'error', text: 'Please select a voice' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      // Save voice preference
      const voiceResponse = await ipcRenderer.invoke('viewer-rules:save', editingRule);
      
      if (!voiceResponse.success) {
        setMessage({ type: 'error', text: voiceResponse.error || 'Failed to save voice rule' });
        return;
      }

      // Save TTS rules (mute & cooldown)
      if (isMuted) {
        const muteResponse = await ipcRenderer.invoke('viewer-tts-rules:set-mute', {
          viewerId: editingRule.viewer_id,
          mutePeriodMins: mutePeriodMins === 0 ? null : mutePeriodMins
        });
        
        if (!muteResponse.success) {
          setMessage({ type: 'error', text: muteResponse.error || 'Failed to save mute rule' });
          return;
        }
      } else {
        // Remove mute if disabled
        await ipcRenderer.invoke('viewer-tts-rules:remove-mute', { 
          viewerId: editingRule.viewer_id 
        });
      }

      if (hasCooldown) {
        const cooldownResponse = await ipcRenderer.invoke('viewer-tts-rules:set-cooldown', {
          viewerId: editingRule.viewer_id,
          cooldownGapSeconds,
          cooldownPeriodMins: cooldownPeriodMins === 0 ? null : cooldownPeriodMins
        });
        
        if (!cooldownResponse.success) {
          setMessage({ type: 'error', text: cooldownResponse.error || 'Failed to save cooldown rule' });
          return;
        }
      } else {
        // Remove cooldown if disabled
        await ipcRenderer.invoke('viewer-tts-rules:remove-cooldown', { 
          viewerId: editingRule.viewer_id 
        });
      }

      setMessage({ type: 'success', text: 'All rules saved successfully!' });
      setTimeout(() => setMessage(null), 2000);
      await loadRules();
      setEditingRule(null);
      setSelectedViewer(null);
      setSearchTerm('');
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };
  const handleDeleteRule = async (viewerId: string, viewerName: string) => {
    if (!confirm(`Delete custom voice rule for ${viewerName}?`)) {
      return;
    }

    try {
      const response = await ipcRenderer.invoke('viewer-rules:delete', { viewerId });
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Rule deleted successfully' });
        setTimeout(() => setMessage(null), 2000);
        await loadRules();
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to delete rule' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };
  const handleCancelEdit = () => {
    setEditingRule(null);
    setSelectedViewer(null);
    setSearchTerm('');
    // Reset TTS rules state
    setTtsRules(null);
    setIsMuted(false);
    setMutePeriodMins(0);
    setHasCooldown(false);
    setCooldownGapSeconds(30);
    setCooldownPeriodMins(0);
  };
  // Phase 4: TTS Rules Handlers (simplified - save happens in handleSaveRule)
  const handleToggleMute = (enabled: boolean) => {
    setIsMuted(enabled);
  };

  const handleToggleCooldown = (enabled: boolean) => {
    setHasCooldown(enabled);
  };

  const handleClearAllRules = async () => {
    if (!selectedViewer) return;
    
    if (!confirm(`Clear all TTS rules (mute & cooldown) for ${selectedViewer.display_name || selectedViewer.username}?`)) {
      return;
    }

    try {
      const response = await ipcRenderer.invoke('viewer-tts-rules:clear-all', { 
        viewerId: selectedViewer.id 
      });
      
      if (response.success) {
        setMessage({ type: 'success', text: 'All TTS rules cleared' });
        setTimeout(() => setMessage(null), 2000);
        await loadTTSRules(selectedViewer.id);
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to clear rules' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const formatTimeRemaining = (expiresAt: string | null | undefined): string => {
    if (!expiresAt) return '';
    
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();
    
    if (diffMs <= 0) return 'Expired';
    
    const mins = Math.floor(diffMs / 60000);
    const hours = Math.floor(mins / 60);
    
    if (hours > 0) {
      return `${hours}h ${mins % 60}m remaining`;
    }
    return `${mins}m remaining`;
  };

  const getFilteredVoices = () => {
    let filtered = voiceGroups.flatMap(group => group.voices);
    
    if (providerFilter !== 'all') {
      filtered = filtered.filter(v => v.provider === providerFilter);
    }
    
    if (languageFilter !== 'all') {
      filtered = filtered.filter(v => v.language_name === languageFilter);
    }
    
    if (genderFilter !== 'all') {
      filtered = filtered.filter(v => v.gender === genderFilter);
    }
    
    if (voiceSearchTerm) {
      const search = voiceSearchTerm.toLowerCase();
      filtered = filtered.filter(v => 
        v.name.toLowerCase().includes(search) ||
        v.language_name.toLowerCase().includes(search)
      );
    }
    
    return filtered;
  };

  const getUniqueLanguages = () => {
    const languages = new Set(voiceGroups.flatMap(g => g.voices.map(v => v.language_name)));
    return Array.from(languages).sort();
  };

  const getAvailableGenders = () => {
    const genders = new Set(voiceGroups.flatMap(g => g.voices.map(v => v.gender)));
    return Array.from(genders).filter(g => g).sort();
  };

  const formatVoiceOption = (voice: any) => {
    return `${voice.name} (${voice.language_name}, ${voice.gender}, ${voice.provider})`;
  };

  const getVoiceValidationWarning = () => {
    if (!editingRule || !editingRule.voice_id) return null;
    
    const voice = voiceGroups.flatMap(g => g.voices).find(v => v.voice_id === editingRule.voice_id);
    if (!voice) return null;
    
    const isPremium = voice.provider === 'azure' || voice.provider === 'google';
    
    if (isPremium && accessMode === 'premium_voice_access') {
      return '⚠️ This voice requires Premium Voice Access. If this viewer doesn\'t have access (subscriber/VIP/active redeem), the global default voice will be used instead.';
    }
    
    return null;
  };

  const filteredVoices = getFilteredVoices();
  const validationWarning = getVoiceValidationWarning();

  if (loading) {
    return <div className="loading">Loading viewer rules...</div>;
  }

  return (
    <div className="viewer-rules-tab">
      <div className="tab-header">
        <h2>Viewer Custom Voice Rules</h2>
        <p className="tab-description">
          Set custom voices, pitch, and speed for individual viewers.
        </p>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Viewer Search */}
      {!editingRule && (
        <div className="viewer-search-section">
          <h3>Search for Viewer</h3>
          <div className="search-container">
            <input
              type="text"
              placeholder="Type viewer username or display name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="search-input"
            />
              {searchResults.length > 0 && (
              <ul className="autocomplete-results">
                {searchResults.map(viewer => {
                  const hasRule = rules.some(r => r.viewer_id === viewer.id);
                  return (
                    <li 
                      key={viewer.id}
                      onClick={() => selectViewer(viewer)}
                      className="autocomplete-item"
                    >
                      <span className="viewer-name">
                        {viewer.display_name || viewer.username}
                      </span>
                      {hasRule && (
                        <span className="has-rule-badge">Has Rule</span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
          
          {selectedViewer && !editingRule && (
            <div className="selected-viewer">
              <p>Selected: <strong>{selectedViewer.display_name || selectedViewer.username}</strong></p>
              <button onClick={handleCreateRule} className="button button-primary">
                Create Voice Rule
              </button>
              {selectedViewer.hasRule && (
                <button onClick={handleEditRule} className="button button-secondary">
                  Edit Existing Rule
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Voice Selection Panel */}
      {editingRule && (
        <div className="voice-selection-panel">
          <h3>Configure Voice for {selectedViewer?.display_name || selectedViewer?.username}</h3>
          
          {/* Voice Filters */}
          <div className="voice-filters">
            <input 
              type="text" 
              placeholder="Search voices..."
              value={voiceSearchTerm}
              onChange={(e) => setVoiceSearchTerm(e.target.value)}
              className="filter-input"
            />
            
            <select 
              value={providerFilter} 
              onChange={(e) => setProviderFilter(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Providers</option>
              <option value="webspeech">WebSpeech</option>
              <option value="azure">Azure</option>
              <option value="google">Google</option>
            </select>
            
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
              {getAvailableGenders().map(gender => (
                <option key={gender} value={gender}>{gender}</option>
              ))}
            </select>
          </div>
            {/* Voice Selection */}
          <div className="voice-selector">
            <label>Voice:</label>
            <select 
              value={editingRule.voice_id || ''}
              onChange={(e) => {
                const selectedVoice = filteredVoices.find(v => v.voice_id === e.target.value);
                if (selectedVoice) {
                  setEditingRule({
                    ...editingRule,
                    voice_id: e.target.value,
                    provider: selectedVoice.provider
                  });
                } else {
                  updateRule('voice_id', e.target.value);
                }
              }}
              className="voice-select"
            >
              <option value="">-- Select a voice --</option>
              {filteredVoices.map(voice => (
                <option key={voice.voice_id} value={voice.voice_id}>
                  {formatVoiceOption(voice)}
                </option>
              ))}
            </select>
            
            {validationWarning && (
              <div className="validation-warning">
                {validationWarning}
              </div>
            )}
          </div>
            {/* Pitch Control */}
          <div className="slider-control">
            <label>Pitch: {editingRule.pitch?.toFixed(1) || 1.0}</label>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1"
              value={editingRule.pitch || 1.0}
              onChange={(e) => updateRule('pitch', parseFloat(e.target.value))}
              className="slider"
            />
          </div>
          
          {/* Speed Control */}
          <div className="slider-control">
            <label>Speed: {editingRule.speed?.toFixed(1) || 1.0}</label>
            <input 
              type="range" 
              min="0.5" 
              max="2.0" 
              step="0.1"
              value={editingRule.speed || 1.0}
              onChange={(e) => updateRule('speed', parseFloat(e.target.value))}
              className="slider"
            />
          </div>

          {/* Phase 4: TTS Rules - Mute & Cooldown */}
          <div className="tts-rules-section">
            <h4 style={{ marginTop: '30px', borderTop: '2px solid #444', paddingTop: '20px' }}>
              TTS Restrictions
            </h4>
            
            {/* Mute Control */}
            <div className="tts-rule-control">
              <div className="rule-header">
                <label>
                  <input
                    type="checkbox"
                    checked={isMuted}
                    onChange={(e) => handleToggleMute(e.target.checked)}
                  />
                  🔇 Mute Viewer
                </label>
              </div>
                {isMuted && (
                <div className="rule-config">                  <div className="slider-control">
                    <label>
                      Mute Period (Minutes): {mutePeriodMins === 0 ? 'Permanent' : mutePeriodMins}
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1440" 
                      step="5"
                      value={mutePeriodMins}
                      onChange={(e) => setMutePeriodMins(parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>
                  
                  {ttsRules?.is_muted && ttsRules.mute_expires_at && (
                    <div className="status-display">
                      Status: 🔇 Muted - {formatTimeRemaining(ttsRules.mute_expires_at)}
                    </div>
                  )}
                  
                  {ttsRules?.is_muted && !ttsRules.mute_expires_at && (
                    <div className="status-display">
                      Status: 🔇 Permanently Muted
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Cooldown Control */}
            <div className="tts-rule-control" style={{ marginTop: '20px' }}>
              <div className="rule-header">
                <label>
                  <input
                    type="checkbox"
                    checked={hasCooldown}
                    onChange={(e) => handleToggleCooldown(e.target.checked)}
                  />
                  ⏰ Cooldown Viewer
                </label>
              </div>
                {hasCooldown && (
                <div className="rule-config">                  <div className="slider-control">
                    <label>
                      Cooldown Gap (Seconds): {cooldownGapSeconds}
                    </label>
                    <input 
                      type="range" 
                      min="1" 
                      max="120" 
                      step="1"
                      value={cooldownGapSeconds}
                      onChange={(e) => setCooldownGapSeconds(parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>
                  
                  <div className="slider-control">
                    <label>
                      Cooldown Period (Minutes): {cooldownPeriodMins === 0 ? 'Permanent' : cooldownPeriodMins}
                    </label>
                    <input 
                      type="range" 
                      min="0" 
                      max="1440" 
                      step="5"
                      value={cooldownPeriodMins}
                      onChange={(e) => setCooldownPeriodMins(parseInt(e.target.value))}
                      className="slider"
                    />
                  </div>
                  
                  {ttsRules?.has_cooldown && ttsRules.cooldown_expires_at && (
                    <div className="status-display">
                      Status: ⏰ Active - {formatTimeRemaining(ttsRules.cooldown_expires_at)}
                    </div>
                  )}
                  
                  {ttsRules?.has_cooldown && !ttsRules.cooldown_expires_at && (
                    <div className="status-display">
                      Status: ⏰ Permanent Cooldown ({ttsRules.cooldown_gap_seconds}s gap)
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Clear All Button */}
            {(ttsRules?.is_muted || ttsRules?.has_cooldown) && (
              <button 
                onClick={handleClearAllRules}
                className="button button-danger"
                style={{ marginTop: '20px' }}
              >
                🗑️ Clear All TTS Rules
              </button>
            )}
          </div>
            
            <div className="button-group">
            <button 
              onClick={handleSaveRule} 
              disabled={saving || !editingRule.voice_id}
              className="button button-primary"
            >
              {saving ? 'Saving...' : 'Add/Update Rule'}
            </button>
            <button 
              onClick={handleCancelEdit}
              disabled={saving}
              className="button button-secondary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Existing Rules Table */}
      <div className="existing-rules">
        <h3>Existing Viewer Rules ({rules.length})</h3>
        {rules.length === 0 ? (
          <p className="no-rules">No custom voice rules configured yet.</p>
        ) : (
          <table className="rules-table">
            <thead>
              <tr>
                <th>Viewer</th>
                <th>Voice</th>
                <th>Provider</th>
                <th>Pitch</th>
                <th>Speed</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map(rule => (
                <tr key={rule.viewer_id}>
                  <td>{rule.display_name || rule.username}</td>
                  <td>{rule.voice_name || rule.voice_id}</td>
                  <td className={`provider-${rule.provider}`}>{rule.provider}</td>
                  <td>{rule.pitch.toFixed(1)}</td>
                  <td>{rule.speed.toFixed(1)}</td>
                  <td>
                    <button 
                      onClick={() => {
                        setSelectedViewer({
                          id: rule.viewer_id,
                          username: rule.username,
                          display_name: rule.display_name,
                          hasRule: true
                        });
                        setEditingRule(rule);
                      }}
                      className="button-small button-edit"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleDeleteRule(rule.viewer_id, rule.display_name || rule.username)}
                      className="button-small button-delete"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
