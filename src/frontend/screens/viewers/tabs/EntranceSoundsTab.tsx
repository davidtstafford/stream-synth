import React, { useState, useEffect } from 'react';
import * as entranceSounds from '../../../services/viewer-entrance-sounds';
import { BrowserSourceURLDisplay } from '../../../components/BrowserSourceURLDisplay';

const { ipcRenderer } = window.require('electron');

interface Viewer {
  id: string;
  username: string;
  display_name: string | null;
  hasSound: boolean;
}

interface Message {
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export const EntranceSoundsTab: React.FC = () => {
  const [sounds, setSounds] = useState<entranceSounds.ViewerEntranceSound[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Viewer[]>([]);
  const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
  const [editingSound, setEditingSound] = useState<Partial<entranceSounds.ViewerEntranceSound> | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    loadSounds();
  }, []);

  useEffect(() => {
    if (searchTerm.length >= 2) {
      searchViewers();
    } else {
      setSearchResults([]);
    }
  }, [searchTerm]);

  const loadSounds = async () => {
    try {
      setLoading(true);
      const soundsList = await entranceSounds.getAllEntranceSounds();
      console.log('[EntranceSoundsTab] Loaded sounds:', soundsList);
      setSounds(Array.isArray(soundsList) ? soundsList : []);
    } catch (error: any) {
      console.error('[EntranceSoundsTab] Error loading sounds:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to load entrance sounds' });
    } finally {
      setLoading(false);
    }
  };

  const searchViewers = async () => {
    try {
      const response = await ipcRenderer.invoke('viewer-rules:search-viewers', { query: searchTerm });
      
      if (response.success && response.data) {
        const viewersWithSoundInfo = response.data.map((viewer: any) => ({
          ...viewer,
          hasSound: sounds.some(s => s.viewer_id === viewer.id)
        }));
        setSearchResults(viewersWithSoundInfo);
      }
    } catch (error: any) {
      console.error('Error searching viewers:', error);
    }
  };

  const selectViewer = async (viewer: Viewer) => {
    setSelectedViewer(viewer);
    setSearchTerm(viewer.display_name || viewer.username);
    setSearchResults([]);
    
    const existingSound = sounds.find(s => s.viewer_id === viewer.id);
    if (existingSound) {
      setEditingSound(existingSound);
    }
  };

  const handleCreateSound = () => {
    if (!selectedViewer) return;
    
    setEditingSound({
      viewer_id: selectedViewer.id,
      viewer_username: selectedViewer.username,
      sound_file_path: '',
      volume: 50,
      enabled: true
    });
  };

  const handleEditSound = () => {
    if (!selectedViewer) return;
    
    const existingSound = sounds.find(s => s.viewer_id === selectedViewer.id);
    if (existingSound) {
      setEditingSound(existingSound);
    }
  };

  const handleBrowseFile = async () => {
    try {
      const filePath = await entranceSounds.pickAudioFile();
      if (filePath && editingSound) {
        setEditingSound({
          ...editingSound,
          sound_file_path: filePath
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: `Error picking file: ${err.message}` });
    }
  };

  const updateSound = (field: keyof entranceSounds.ViewerEntranceSound, value: any) => {
    if (!editingSound) return;
    
    setEditingSound({
      ...editingSound,
      [field]: value
    });
  };

  const handleSaveSound = async () => {
    if (!editingSound || !editingSound.viewer_id || !editingSound.sound_file_path) {
      setMessage({ type: 'error', text: 'Please select an audio file' });
      return;
    }

    try {
      setSaving(true);
      setMessage(null);

      await entranceSounds.upsertEntranceSound({
        viewer_id: editingSound.viewer_id,
        viewer_username: editingSound.viewer_username || '',
        sound_file_path: editingSound.sound_file_path,
        volume: editingSound.volume || 50,
        enabled: editingSound.enabled !== false
      });

      // Clear edit state first
      setEditingSound(null);
      setSelectedViewer(null);
      setSearchTerm('');
      setSearchResults([]);

      // Then reload sounds to refresh the table
      const soundsList = await entranceSounds.getAllEntranceSounds();
      setSounds(Array.isArray(soundsList) ? soundsList : []);

      setMessage({ type: 'success', text: 'Entrance sound saved successfully!' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to save entrance sound' });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteSound = async (viewerId: string, viewerName: string) => {
    if (!confirm(`Delete entrance sound for ${viewerName}?`)) {
      return;
    }

    try {
      await entranceSounds.deleteEntranceSound(viewerId);
      
      // Refresh sounds table
      const soundsList = await entranceSounds.getAllEntranceSounds();
      setSounds(Array.isArray(soundsList) ? soundsList : []);
      
      setMessage({ type: 'success', text: 'Entrance sound deleted successfully' });
      setTimeout(() => setMessage(null), 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to delete entrance sound' });
    }
  };

  const handleToggleEnabled = async (viewerId: string, currentEnabled: boolean) => {
    try {
      await entranceSounds.setEntranceSoundEnabled(viewerId, !currentEnabled);
      
      // Refresh sounds table
      const soundsList = await entranceSounds.getAllEntranceSounds();
      setSounds(Array.isArray(soundsList) ? soundsList : []);
      
      setMessage({ 
        type: 'success', 
        text: `Entrance sound ${!currentEnabled ? 'enabled' : 'disabled'}` 
      });
      setTimeout(() => setMessage(null), 2000);
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message || 'Failed to toggle entrance sound' });
    }
  };

  const handleCancelEdit = () => {
    setEditingSound(null);
    setSelectedViewer(null);
    setSearchTerm('');
  };

  const getFileName = (path: string) => {
    return path.split(/[\\/]/).pop() || path;
  };

  const stats = sounds.reduce(
    (acc, sound) => ({
      total: acc.total + 1,
      enabled: acc.enabled + (sound.enabled ? 1 : 0)
    }),
    { total: 0, enabled: 0 }
  );

  if (loading) {
    return <div className="loading">Loading entrance sounds...</div>;
  }

  return (
    <div className="viewer-voice-settings-tab entrance-sounds-tab">
      <div className="tab-header">
        <h2>Viewer Entrance Sounds</h2>
        <p className="tab-description">
          Assign custom sounds that play when viewers send their first message of the stream.
        </p>
      </div>

      <div className="browser-source-section">
        <BrowserSourceURLDisplay 
          path="/browser-source/entrance-sounds"
          port={3737}
          title="Entrance Sounds Browser Source"
          description="Add this URL to OBS as a Browser Source. Make sure 'Control audio via OBS' is UNCHECKED."
        />
      </div>

      {message && (
        <div className={`message message-${message.type}`}>
          {message.text}
        </div>
      )}

      {!editingSound && (
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
                    {viewer.hasSound && (
                      <span className="has-rule-badge">Has Sound</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          {selectedViewer && !editingSound && (
            <div className="selected-viewer">
              <p>Selected: <strong>{selectedViewer.display_name || selectedViewer.username}</strong></p>
              <button onClick={handleCreateSound} className="button button-primary">
                Create Entrance Sound
              </button>
              {selectedViewer.hasSound && (
                <button onClick={handleEditSound} className="button button-secondary">
                  Edit Existing Sound
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {editingSound && (
        <div className="voice-selection-panel sound-config-panel">
          <h3>Configure Entrance Sound for {selectedViewer?.display_name || selectedViewer?.username}</h3>
          
          <div className="file-selector">
            <label>Audio File:</label>
            <div className="file-input-group">
              <input 
                type="text" 
                value={editingSound.sound_file_path || ''}
                placeholder="No file selected"
                readOnly
                className="file-path-input"
              />
              <button 
                onClick={handleBrowseFile}
                className="button button-secondary"
              >
                Browse...
              </button>
            </div>
            {editingSound.sound_file_path && (
              <div className="file-name">
                📁 {getFileName(editingSound.sound_file_path)}
              </div>
            )}
            <p className="helper-text">
              Supported formats: MP3, WAV, OGG, M4A, AAC, FLAC
            </p>
          </div>

          <div className="slider-control">
            <label>Volume: {editingSound.volume || 50}%</label>
            <input 
              type="range" 
              min="0" 
              max="100" 
              step="5"
              value={editingSound.volume || 50}
              onChange={(e) => updateSound('volume', parseInt(e.target.value))}
              className="slider"
            />
          </div>
          
          <div className="toggle-control">
            <label>
              <input 
                type="checkbox"
                checked={editingSound.enabled !== false}
                onChange={(e) => updateSound('enabled', e.target.checked)}
              />
              <span>Enabled</span>
            </label>
          </div>
            
          <div className="button-group">
            <button 
              onClick={handleSaveSound} 
              disabled={saving || !editingSound.sound_file_path}
              className="button button-primary"
            >
              {saving ? 'Saving...' : 'Save Entrance Sound'}
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

      <div className="existing-rules">
        <h3>Existing Entrance Sounds ({stats.enabled} enabled / {stats.total} total)</h3>
        {sounds.length === 0 ? (
          <p className="no-rules">No entrance sounds configured yet.</p>
        ) : (
          <table className="rules-table">
            <thead>
              <tr>
                <th>Viewer</th>
                <th>Audio File</th>
                <th>Volume</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sounds.map(sound => (
                <tr key={sound.viewer_id} className={!sound.enabled ? 'disabled-row' : ''}>
                  <td>{sound.viewer_username}</td>
                  <td className="file-cell" title={sound.sound_file_path}>
                    {getFileName(sound.sound_file_path)}
                  </td>
                  <td>{sound.volume}%</td>
                  <td>
                    <span className={`status-badge ${sound.enabled ? 'status-enabled' : 'status-disabled'}`}>
                      {sound.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </td>
                  <td>
                    <button 
                      onClick={() => {
                        setSelectedViewer({
                          id: sound.viewer_id,
                          username: sound.viewer_username,
                          display_name: null,
                          hasSound: true
                        });
                        setEditingSound(sound);
                      }}
                      className="button-small button-edit"
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => handleToggleEnabled(sound.viewer_id, sound.enabled)}
                      className={`button-small ${sound.enabled ? 'button-warning' : 'button-success'}`}
                    >
                      {sound.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button 
                      onClick={() => handleDeleteSound(sound.viewer_id, sound.viewer_username)}
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
