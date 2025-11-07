import React, { useState, useEffect } from 'react';
import * as db from '../../../services/database';
import * as entranceSounds from '../../../services/viewer-entrance-sounds';

export const EntranceSoundsTab: React.FC = () => {
  const [viewers, setViewers] = useState<db.ViewerWithSubscription[]>([]);
  const [sounds, setSounds] = useState<entranceSounds.ViewerEntranceSound[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [editingViewerId, setEditingViewerId] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [selectedVolume, setSelectedVolume] = useState<number>(50);
  const [selectedEnabled, setSelectedEnabled] = useState<boolean>(true);
  const [saving, setSaving] = useState<boolean>(false);
  const [stats, setStats] = useState<{ total: number; enabled: number }>({ total: 0, enabled: 0 });

  const loadData = async () => {
    setLoading(true);
    setError(null);

    try {
      // Load viewers
      let viewerResult;
      if (searchQuery.trim()) {
        viewerResult = await db.searchViewersWithStatus(searchQuery, 100);
      } else {
        viewerResult = await db.getAllViewersWithStatus(100, 0);
      }

      if (viewerResult.success && viewerResult.viewers) {
        setViewers(viewerResult.viewers);
      } else {
        setError(viewerResult.error || 'Failed to load viewers');
      }

      // Load entrance sounds
      const soundsList = await entranceSounds.getAllEntranceSounds();
      setSounds(Array.isArray(soundsList) ? soundsList : []);

      // Load stats
      const statsData = await entranceSounds.getEntranceSoundCount();
      setStats(statsData || { total: 0, enabled: 0 });
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [searchQuery]);

  const handleAddSound = (viewer: db.ViewerWithSubscription) => {
    // Check if viewer already has a sound
    const existingSound = sounds.find(s => s.viewer_id === viewer.id);
    
    setEditingViewerId(viewer.id);
    if (existingSound) {
      setSelectedFile(existingSound.sound_file_path);
      setSelectedVolume(existingSound.volume);
      setSelectedEnabled(existingSound.enabled);
    } else {
      setSelectedFile('');
      setSelectedVolume(50);
      setSelectedEnabled(true);
    }
  };

  const handleBrowseFile = async () => {
    try {
      const filePath = await entranceSounds.pickAudioFile();
      if (filePath) {
        setSelectedFile(filePath);
      }
    } catch (err: any) {
      alert(`Error picking file: ${err.message}`);
    }
  };

  const handleSave = async () => {
    if (!editingViewerId || !selectedFile) {
      alert('Please select a sound file');
      return;
    }

    const viewer = viewers.find(v => v.id === editingViewerId);
    if (!viewer) {
      alert('Viewer not found');
      return;
    }

    setSaving(true);
    try {
      await entranceSounds.upsertEntranceSound({
        viewer_id: viewer.id,
        viewer_username: viewer.display_name || viewer.id,
        sound_file_path: selectedFile,
        volume: selectedVolume,
        enabled: selectedEnabled
      });

      alert(`Entrance sound saved for ${viewer.display_name || viewer.id}!`);
      setEditingViewerId(null);
      setSelectedFile('');
      await loadData();
    } catch (err: any) {
      alert(`Error saving: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setEditingViewerId(null);
    setSelectedFile('');
    setSelectedVolume(50);
    setSelectedEnabled(true);
  };

  const handleDelete = async (viewerId: string, username: string) => {
    if (!confirm(`Delete entrance sound for ${username}?`)) {
      return;
    }

    try {
      await entranceSounds.deleteEntranceSound(viewerId);
      alert(`Entrance sound deleted for ${username}`);
      await loadData();
    } catch (err: any) {
      alert(`Error deleting: ${err.message}`);
    }
  };

  const handleToggleEnabled = async (viewerId: string, enabled: boolean) => {
    try {
      await entranceSounds.setEntranceSoundEnabled(viewerId, enabled);
      await loadData();
    } catch (err: any) {
      alert(`Error updating: ${err.message}`);
    }
  };

  const getFileName = (filePath: string): string => {
    return filePath.split('/').pop() || filePath.split('\\').pop() || filePath;
  };

  if (loading) {
    return (
      <div style={{ padding: '20px', textAlign: 'center' }}>
        <p>Loading entrance sounds...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '20px' }}>
        <div style={{ 
          backgroundColor: '#f44336', 
          color: 'white', 
          padding: '15px', 
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
        <button onClick={loadData} style={{ padding: '10px 20px' }}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header with stats */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: '#2a2a2a',
        borderRadius: '8px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <div>
          <h3 style={{ margin: '0 0 10px 0', color: '#9147ff' }}>Viewer Entrance Sounds</h3>
          <p style={{ margin: 0, color: '#aaa', fontSize: '14px' }}>
            Assign custom sounds that play when viewers send their first message of the session
          </p>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#9147ff' }}>
            {stats.enabled}/{stats.total}
          </div>
          <div style={{ fontSize: '12px', color: '#aaa' }}>
            Enabled Sounds
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div style={{ marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search viewers by username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            backgroundColor: '#2a2a2a',
            color: 'white',
            border: '1px solid #444',
            borderRadius: '4px'
          }}
        />
      </div>

      {/* Editing form */}
      {editingViewerId && (
        <div style={{
          marginBottom: '20px',
          padding: '20px',
          backgroundColor: '#2a2a2a',
          borderRadius: '8px',
          border: '2px solid #9147ff'
        }}>
          <h4 style={{ marginTop: 0, color: '#9147ff' }}>
            Configure Entrance Sound for {viewers.find(v => v.id === editingViewerId)?.display_name || 'Viewer'}
          </h4>

          {/* File selection */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
              Sound File:
            </label>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                type="text"
                value={selectedFile}
                readOnly
                placeholder="No file selected"
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: '#1a1a1a',
                  color: 'white',
                  border: '1px solid #444',
                  borderRadius: '4px',
                  fontSize: '13px'
                }}
              />
              <button
                onClick={handleBrowseFile}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#444',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Browse...
              </button>
            </div>
            {selectedFile && (
              <div style={{ marginTop: '5px', fontSize: '12px', color: '#888' }}>
                📁 {getFileName(selectedFile)}
              </div>
            )}
          </div>

          {/* Volume slider */}
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px', color: '#aaa' }}>
              Volume: {selectedVolume}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedVolume}
              onChange={(e) => setSelectedVolume(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          {/* Enabled toggle */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={selectedEnabled}
                onChange={(e) => setSelectedEnabled(e.target.checked)}
                style={{ marginRight: '10px', width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '14px' }}>Enabled (sound will play on first message)</span>
            </label>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              onClick={handleSave}
              disabled={saving || !selectedFile}
              style={{
                padding: '12px 24px',
                backgroundColor: selectedFile ? '#9147ff' : '#555',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: selectedFile ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: 'bold'
              }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              style={{
                padding: '12px 24px',
                backgroundColor: '#444',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Viewers list */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
        gap: '15px'
      }}>
        {viewers.map((viewer) => {
          const sound = sounds.find(s => s.viewer_id === viewer.id);
          
          return (
            <div
              key={viewer.id}
              style={{
                padding: '15px',
                backgroundColor: sound ? '#1a3a1a' : '#2a2a2a',
                borderRadius: '8px',
                border: sound ? '1px solid #4caf50' : '1px solid #444'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ 
                    fontSize: '16px', 
                    fontWeight: 'bold', 
                    marginBottom: '8px',
                    color: sound ? '#4caf50' : 'white'
                  }}>
                    {viewer.display_name || viewer.id}
                    {sound && (
                      <span style={{ 
                        marginLeft: '10px', 
                        fontSize: '12px', 
                        color: sound.enabled ? '#4caf50' : '#888',
                        backgroundColor: sound.enabled ? '#1a3a1a' : '#333',
                        padding: '2px 8px',
                        borderRadius: '4px'
                      }}>
                        {sound.enabled ? '✓ Enabled' : '✗ Disabled'}
                      </span>
                    )}
                  </div>

                  {sound ? (
                    <>
                      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '5px' }}>
                        🔊 {getFileName(sound.sound_file_path)}
                      </div>
                      <div style={{ fontSize: '13px', color: '#aaa', marginBottom: '10px' }}>
                        📊 Volume: {sound.volume}%
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleAddSound(viewer)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#444',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleToggleEnabled(viewer.id, !sound.enabled)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: sound.enabled ? '#666' : '#4caf50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          {sound.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button
                          onClick={() => handleDelete(viewer.id, viewer.display_name || viewer.id)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontSize: '12px'
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '13px', color: '#888', marginBottom: '10px' }}>
                        No entrance sound configured
                      </div>
                      <button
                        onClick={() => handleAddSound(viewer)}
                        style={{
                          padding: '8px 16px',
                          backgroundColor: '#9147ff',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer',
                          fontSize: '13px',
                          fontWeight: 'bold'
                        }}
                      >
                        + Add Sound
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {viewers.length === 0 && (
        <div style={{ 
          padding: '40px', 
          textAlign: 'center', 
          color: '#888',
          backgroundColor: '#2a2a2a',
          borderRadius: '8px'
        }}>
          <p style={{ fontSize: '16px', marginBottom: '10px' }}>No viewers found</p>
          <p style={{ fontSize: '14px' }}>
            {searchQuery ? 'Try a different search query' : 'Viewers will appear here once they start chatting'}
          </p>
        </div>
      )}
    </div>
  );
};
