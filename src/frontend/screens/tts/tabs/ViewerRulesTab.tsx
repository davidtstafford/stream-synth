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
    
    // Check if viewer has an existing rule
    const response = await ipcRenderer.invoke('viewer-rules:get', { viewerId: viewer.id });
    
    if (response.success && response.data) {
      setEditingRule(response.data);
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
  };

  const handleSaveRule = async () => {
    if (!editingRule || !editingRule.viewer_id || !editingRule.voice_id) {
      setMessage({ type: 'error', text: 'Please select a voice' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      const response = await ipcRenderer.invoke('viewer-rules:save', editingRule);
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Viewer rule saved successfully!' });
        await loadRules();
        setEditingRule(null);
        setSelectedViewer(null);
        setSearchTerm('');
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to save rule' });
      }
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
                {searchResults.map(viewer => (
                  <li 
                    key={viewer.id}
                    onClick={() => selectViewer(viewer)}
                    className="autocomplete-item"
                  >
                    <span className="viewer-name">
                      {viewer.display_name || viewer.username}
                    </span>
                    {viewer.hasRule && (
                      <span className="has-rule-badge">Has Rule</span>
                    )}
                  </li>
                ))}
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
                updateRule('voice_id', e.target.value);
                if (selectedVoice) {
                  updateRule('provider', selectedVoice.provider);
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
            <div className="slider-labels">
              <span>Lower</span>
              <span>Normal</span>
              <span>Higher</span>
            </div>
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
            <div className="slider-labels">
              <span>Slower</span>
              <span>Normal</span>
              <span>Faster</span>
            </div>
          </div>
          
          <div className="button-group">
            <button 
              onClick={handleSaveRule} 
              disabled={saving || !editingRule.voice_id}
              className="button button-primary"
            >
              {saving ? 'Saving...' : 'Save Rule'}
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
