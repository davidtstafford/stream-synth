import React, { useState, useEffect } from 'react';

const { ipcRenderer } = window.require('electron');

interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
}

interface ViewerTTSRules {
  id: number;
  viewer_id: string;
  viewer_username: string;
  viewer_display_name: string | null;
  
  // Mute
  is_muted: boolean;
  mute_period_mins?: number | null;
  muted_at?: string | null;
  mute_expires_at?: string | null;
  
  // Cooldown
  has_cooldown: boolean;
  cooldown_gap_seconds?: number | null;
  cooldown_period_mins?: number | null;
  cooldown_set_at?: string | null;
  cooldown_expires_at?: string | null;
  
  created_at: string;
  updated_at: string;
}

interface Message {
  type: 'success' | 'error' | 'warning' | 'info';
  text: string;
}

export const ViewerTTSRestrictionsTab: React.FC = () => {
  const [mutedUsers, setMutedUsers] = useState<ViewerTTSRules[]>([]);
  const [cooldownUsers, setCooldownUsers] = useState<ViewerTTSRules[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Viewer[]>([]);
  const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);
  
  // Form states
  const [restrictionType, setRestrictionType] = useState<'mute' | 'cooldown'>('mute');
  const [mutePeriodMins, setMutePeriodMins] = useState(30);
  const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
  const [cooldownPeriodMins, setCooldownPeriodMins] = useState(60);
  
  // Countdown timer
  const [countdownTick, setCountdownTick] = useState(0);

  useEffect(() => {
    loadRestrictions();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchViewers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  // Set up countdown timer
  useEffect(() => {
    const interval = setInterval(() => {
      setCountdownTick(prev => prev + 1);
    }, 10000); // Update every 10 seconds

    return () => clearInterval(interval);
  }, []);

  // Listen for TTS rules updates from chat commands
  useEffect(() => {
    const handleTTSRulesUpdated = () => {
      console.log('[ViewerTTSRestrictionsTab] TTS rules updated via chat');
      loadRestrictions();
    };

    ipcRenderer.on('viewer-tts-rules-updated', handleTTSRulesUpdated);

    return () => {
      ipcRenderer.removeListener('viewer-tts-rules-updated', handleTTSRulesUpdated);
    };
  }, []);

  const loadRestrictions = async () => {
    try {
      setLoading(true);
      
      const [mutedResponse, cooldownResponse] = await Promise.all([
        ipcRenderer.invoke('viewer-tts-rules:get-all-muted'),
        ipcRenderer.invoke('viewer-tts-rules:get-all-cooldown')
      ]);
      
      if (mutedResponse.success && mutedResponse.data) {
        setMutedUsers(mutedResponse.data);
      }
      
      if (cooldownResponse.success && cooldownResponse.data) {
        setCooldownUsers(cooldownResponse.data);
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
      console.error('Error loading restrictions:', error);
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

  const selectViewer = (viewer: Viewer) => {
    setSelectedViewer(viewer);
    setSearchTerm(viewer.display_name || viewer.username);
    setSearchResults([]);
  };

  const handleAddRestriction = async () => {
    if (!selectedViewer) {
      setMessage({ type: 'error', text: 'Please select a viewer' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      if (restrictionType === 'mute') {
        const response = await ipcRenderer.invoke('viewer-tts-rules:set-mute', {
          viewerId: selectedViewer.id,
          mutePeriodMins: mutePeriodMins === 0 ? null : mutePeriodMins
        });
        
        if (!response.success) {
          setMessage({ type: 'error', text: response.error || 'Failed to save mute' });
          return;
        }
      } else {
        const response = await ipcRenderer.invoke('viewer-tts-rules:set-cooldown', {
          viewerId: selectedViewer.id,
          cooldownGapSeconds,
          cooldownPeriodMins: cooldownPeriodMins === 0 ? null : cooldownPeriodMins
        });
        
        if (!response.success) {
          setMessage({ type: 'error', text: response.error || 'Failed to save cooldown' });
          return;
        }
      }

      setMessage({ type: 'success', text: 'Restriction added successfully!' });
      setTimeout(() => setMessage(null), 2000);
      
      // Reset form
      setSelectedViewer(null);
      setSearchTerm('');
      setMutePeriodMins(30);
      setCooldownGapSeconds(30);
      setCooldownPeriodMins(60);
      
      // Reload restrictions
      await loadRestrictions();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveMute = async (viewerId: string) => {
    try {
      const response = await ipcRenderer.invoke('viewer-tts-rules:remove-mute', { viewerId });
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Mute removed' });
        setTimeout(() => setMessage(null), 2000);
        await loadRestrictions();
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to remove mute' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    }
  };

  const handleRemoveCooldown = async (viewerId: string) => {
    try {
      const response = await ipcRenderer.invoke('viewer-tts-rules:remove-cooldown', { viewerId });
      
      if (response.success) {
        setMessage({ type: 'success', text: 'Cooldown removed' });
        setTimeout(() => setMessage(null), 2000);
        await loadRestrictions();
      } else {
        setMessage({ type: 'error', text: response.error || 'Failed to remove cooldown' });
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
    const days = Math.floor(hours / 24);
    
    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    }
    if (hours > 0) {
      return `${hours}h ${mins % 60}m`;
    }
    return `${mins}m`;
  };

  const formatDateTime = (dateTime: string | null | undefined): string => {
    if (!dateTime) return '';
    const date = new Date(dateTime);
    return date.toLocaleString();
  };

  if (loading) {
    return <div className="loading">Loading TTS restrictions...</div>;
  }

  return (
    <div className="viewer-tts-restrictions-tab">
      <div className="tab-header">
        <h2>Viewer TTS Restrictions</h2>
        <p className="tab-description">
          Manage mutes and cooldowns for viewer TTS messages. Changes via chat commands appear automatically.
        </p>
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {/* Add Restriction Section */}
      <div className="add-restriction-section">
        <h3>Add Restriction</h3>
        
        <div className="search-container">
          <input
            type="text"
            placeholder="Search viewer..."
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
                </li>
              ))}
            </ul>
          )}
        </div>

        {selectedViewer && (
          <div className="restriction-form">
            <p className="selected-viewer-info">
              Selected: <strong>@{selectedViewer.username}</strong>
            </p>

            {/* Restriction Type Toggle */}
            <div className="restriction-type-toggle">
              <button
                className={`toggle-button ${restrictionType === 'mute' ? 'active' : ''}`}
                onClick={() => setRestrictionType('mute')}
              >
                🔇 Mute
              </button>
              <button
                className={`toggle-button ${restrictionType === 'cooldown' ? 'active' : ''}`}
                onClick={() => setRestrictionType('cooldown')}
              >
                ⏰ Cooldown
              </button>
            </div>

            {/* Mute Configuration */}
            {restrictionType === 'mute' && (
              <div className="restriction-config">
                <div className="slider-control">
                  <label>
                    Mute Duration (Minutes): {mutePeriodMins === 0 ? 'Permanent' : mutePeriodMins}
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
                  <small>0 = Permanent mute</small>
                </div>
              </div>
            )}

            {/* Cooldown Configuration */}
            {restrictionType === 'cooldown' && (
              <div className="restriction-config">
                <div className="slider-control">
                  <label>
                    Cooldown Gap (Seconds): {cooldownGapSeconds}
                  </label>
                  <input 
                    type="range" 
                    min="1" 
                    max="300" 
                    step="1"
                    value={cooldownGapSeconds}
                    onChange={(e) => setCooldownGapSeconds(parseInt(e.target.value))}
                    className="slider"
                  />
                </div>

                <div className="slider-control">
                  <label>
                    Cooldown Duration (Minutes): {cooldownPeriodMins === 0 ? 'Permanent' : cooldownPeriodMins}
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
                  <small>0 = Permanent cooldown</small>
                </div>
              </div>
            )}

            <div className="button-group">
              <button 
                onClick={handleAddRestriction} 
                disabled={saving}
                className="button button-primary"
              >
                {saving ? 'Adding...' : 'Add Restriction'}
              </button>
              <button 
                onClick={() => {
                  setSelectedViewer(null);
                  setSearchTerm('');
                }}
                disabled={saving}
                className="button button-secondary"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Muted Users Table */}
      <div className="muted-users-section">
        <h3>🔇 Muted Users ({mutedUsers.length})</h3>
        {mutedUsers.length === 0 ? (
          <p className="no-data">No muted users.</p>
        ) : (
          <table className="restrictions-table">
            <thead>
              <tr>
                <th>Viewer</th>
                <th>Muted At</th>
                <th>Duration</th>
                <th>Expires In</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {mutedUsers.map(rule => (
                <tr key={`muted-${rule.viewer_id}`}>
                  <td className="viewer-column">@{rule.viewer_username}</td>
                  <td>{formatDateTime(rule.muted_at)}</td>
                  <td>
                    {rule.mute_period_mins === null ? (
                      <span className="permanent">Permanent 🔒</span>
                    ) : (
                      `${rule.mute_period_mins} min`
                    )}
                  </td>
                  <td>
                    {rule.mute_expires_at ? (
                      <span className="countdown">⏱️ {formatTimeRemaining(rule.mute_expires_at)}</span>
                    ) : (
                      <span className="permanent">Never</span>
                    )}
                  </td>
                  <td>
                    <button 
                      onClick={() => handleRemoveMute(rule.viewer_id)}
                      className="button-small button-delete"
                    >
                      Unmute
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Cooldown Users Table */}
      <div className="cooldown-users-section">
        <h3>⏰ Users with Cooldowns ({cooldownUsers.length})</h3>
        {cooldownUsers.length === 0 ? (
          <p className="no-data">No users with cooldowns.</p>
        ) : (
          <table className="restrictions-table">
            <thead>
              <tr>
                <th>Viewer</th>
                <th>Gap</th>
                <th>Set At</th>
                <th>Duration</th>
                <th>Expires In</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {cooldownUsers.map(rule => (
                <tr key={`cooldown-${rule.viewer_id}`}>
                  <td className="viewer-column">@{rule.viewer_username}</td>
                  <td>
                    <span className="cooldown-gap">{rule.cooldown_gap_seconds}s</span>
                  </td>
                  <td>{formatDateTime(rule.cooldown_set_at)}</td>
                  <td>
                    {rule.cooldown_period_mins === null ? (
                      <span className="permanent">Permanent 🔒</span>
                    ) : (
                      `${rule.cooldown_period_mins} min`
                    )}
                  </td>
                  <td>
                    {rule.cooldown_expires_at ? (
                      <span className="countdown">⏱️ {formatTimeRemaining(rule.cooldown_expires_at)}</span>
                    ) : (
                      <span className="permanent">Never</span>
                    )}
                  </td>
                  <td>
                    <button 
                      onClick={() => handleRemoveCooldown(rule.viewer_id)}
                      className="button-small button-delete"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Chat Commands Help */}
      <div className="chat-commands-help">
        <h3>💬 Chat Commands</h3>
        <p className="help-note">
          ℹ️ Use these commands in chat to quickly manage restrictions. Changes appear automatically in the tables above.
        </p>
        <ul className="command-list">
          <li><code>~mutevoice @user [minutes]</code> - Mute user (0 or omit = permanent)</li>
          <li><code>~unmutevoice @user</code> - Remove mute</li>
          <li><code>~cooldownvoice @user &lt;gap_sec&gt; [period_min]</code> - Set cooldown (0 or omit = permanent)</li>
        </ul>
      </div>
    </div>
  );
};
