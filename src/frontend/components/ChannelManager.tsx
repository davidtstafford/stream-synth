/**
 * ChannelManager Component
 * 
 * Modal dialog for managing browser source channels.
 * Allows users to create, edit, and delete custom channels for organizing alerts.
 * 
 * Phase 8C: Channel Manager UI
 */

import React, { useState, useEffect } from 'react';
import { 
  browserSourceChannelsService, 
  BrowserSourceChannel 
} from '../services/browser-source-channels';
import { ChannelEditor } from './ChannelEditor';
import './ChannelManager.css';

const { ipcRenderer } = window.require('electron');
const os = window.require('os');

function getLocalIpAddress() {
  try {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      const addresses = networkInterfaces[interfaceName];
      for (const addr of addresses) {
        if (addr.family === 'IPv4' && !addr.internal) {
          return addr.address;
        }
      }
    }
  } catch (err) {
    console.error('[ChannelManager] Error getting IP address:', err);
  }
  return 'localhost';
}

interface ChannelManagerProps {
  channelId: string;
  onClose: () => void;
}

export const ChannelManager: React.FC<ChannelManagerProps> = ({ channelId, onClose }) => {
  const [channels, setChannels] = useState<BrowserSourceChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Editor state
  const [showEditor, setShowEditor] = useState(false);
  const [editingChannel, setEditingChannel] = useState<BrowserSourceChannel | undefined>(undefined);
  
  // Delete confirmation
  const [deletingChannelId, setDeletingChannelId] = useState<number | null>(null);
  
  // Copy notification
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  /**
   * Load channels
   */
  const loadChannels = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await browserSourceChannelsService.getAll(channelId);
      setChannels(data);
    } catch (err: any) {
      console.error('[ChannelManager] Error loading channels:', err);
      setError(err.message || 'Failed to load channels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadChannels();
  }, [channelId]);

  /**
   * Handle create new channel
   */
  const handleCreate = () => {
    setEditingChannel(undefined);
    setShowEditor(true);
  };

  /**
   * Handle edit channel
   */
  const handleEdit = (channel: BrowserSourceChannel) => {
    setEditingChannel(channel);
    setShowEditor(true);
  };

  /**
   * Handle delete channel
   */
  const handleDelete = async (id: number) => {
    try {
      await browserSourceChannelsService.delete(id);
      await loadChannels(); // Reload channels
      setDeletingChannelId(null);
    } catch (err: any) {
      console.error('[ChannelManager] Error deleting channel:', err);
      alert(`Failed to delete channel: ${err.message}`);
      setDeletingChannelId(null);
    }
  };

  /**
   * Handle copy URL to clipboard
   */
  const handleCopyUrl = async (channel: BrowserSourceChannel) => {
    const url = browserSourceChannelsService.getBrowserSourceUrl(channel.name);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedUrl(channel.name);
      setTimeout(() => setCopiedUrl(null), 2000); // Clear after 2 seconds
    } catch (err) {
      console.error('[ChannelManager] Error copying URL:', err);
      alert('Failed to copy URL to clipboard');
    }
  };

  /**
   * Handle editor save
   */
  const handleEditorSave = async () => {
    setShowEditor(false);
    setEditingChannel(undefined);
    await loadChannels(); // Reload channels
  };

  /**
   * Handle editor cancel
   */
  const handleEditorCancel = () => {
    setShowEditor(false);
    setEditingChannel(undefined);
  };

  /**
   * Render loading state
   */
  if (loading) {
    return (
      <div className="channel-manager-backdrop" onClick={onClose}>
        <div className="channel-manager-modal" onClick={(e) => e.stopPropagation()}>
          <div className="channel-manager-header">
            <h2>Browser Source Channels</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="channel-manager-content">
            <div className="loading-state">Loading channels...</div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render error state
   */
  if (error) {
    return (
      <div className="channel-manager-backdrop" onClick={onClose}>
        <div className="channel-manager-modal" onClick={(e) => e.stopPropagation()}>
          <div className="channel-manager-header">
            <h2>Browser Source Channels</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>
          <div className="channel-manager-content">
            <div className="error-state">
              <p>❌ {error}</p>
              <button onClick={loadChannels} className="retry-button">Retry</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /**
   * Render main UI
   */
  return (
    <>
      <div className="channel-manager-backdrop" onClick={onClose}>
        <div className="channel-manager-modal" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="channel-manager-header">
            <h2>📺 Browser Source Channels</h2>
            <button className="close-button" onClick={onClose}>×</button>
          </div>

          {/* Toolbar */}
          <div className="channel-manager-toolbar">
            <button className="create-button" onClick={handleCreate}>
              ➕ Create Channel
            </button>
            <div className="channel-count">
              {channels.length} {channels.length === 1 ? 'channel' : 'channels'}
            </div>
          </div>

          {/* Content */}
          <div className="channel-manager-content">
            {channels.length === 0 ? (
              <div className="empty-state">
                <p>No channels found.</p>
                <p>Create your first channel to organize browser source alerts.</p>
                <button className="create-button-large" onClick={handleCreate}>
                  ➕ Create Channel
                </button>
              </div>
            ) : (
              <div className="channel-list">
                {channels.map((channel) => (
                  <div key={channel.id} className="channel-card">
                    {/* Channel Icon & Info */}
                    <div className="channel-info">
                      <div className="channel-icon" style={{ color: channel.color }}>
                        {channel.icon}
                      </div>
                      <div className="channel-details">
                        <div className="channel-name">
                          {channel.display_name}
                          {channel.is_default && (
                            <span className="default-badge">Default</span>
                          )}
                        </div>
                        <div className="channel-description">
                          {channel.description || 'No description'}
                        </div>
                        <div className="channel-meta">
                          <span className="channel-slug">{channel.name}</span>
                          <span className="channel-actions-count">
                            {channel.action_count || 0} {channel.action_count === 1 ? 'action' : 'actions'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Channel URLs */}
                    <div className="channel-urls">
                      <div className="url-section">
                        <div className="url-label">Localhost (same machine):</div>
                        <div className="url-preview">
                          <code className="url-display">{`http://localhost:3737/browser-source?channel=${channel.name}`}</code>
                          <button
                            className="copy-url-button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(`http://localhost:3737/browser-source?channel=${channel.name}`);
                              setCopiedUrl(channel.name + '-localhost');
                              setTimeout(() => setCopiedUrl(null), 2000);
                            }}
                            type="button"
                          >
                            {copiedUrl === channel.name + '-localhost' ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                      <div className="url-section">
                        <div className="url-label">Network IP (for OBS on another machine):</div>
                        <div className="url-preview">
                          <code className="url-display">{`http://${getLocalIpAddress()}:3737/browser-source?channel=${channel.name}`}</code>
                          <button
                            className="copy-url-button"
                            onClick={async () => {
                              await navigator.clipboard.writeText(`http://${getLocalIpAddress()}:3737/browser-source?channel=${channel.name}`);
                              setCopiedUrl(channel.name + '-ip');
                              setTimeout(() => setCopiedUrl(null), 2000);
                            }}
                            type="button"
                          >
                            {copiedUrl === channel.name + '-ip' ? '✓ Copied!' : '📋 Copy'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="channel-actions">
                      <button
                        className="edit-button"
                        onClick={() => handleEdit(channel)}
                      >
                        ✏️ Edit
                      </button>
                      {!channel.is_default && (
                        <>
                          {deletingChannelId === channel.id ? (
                            <div className="delete-confirm">
                              <span>Delete?</span>
                              <button
                                className="confirm-button"
                                onClick={() => handleDelete(channel.id)}
                              >
                                Yes
                              </button>
                              <button
                                className="cancel-button"
                                onClick={() => setDeletingChannelId(null)}
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              className="delete-button"
                              onClick={() => setDeletingChannelId(channel.id)}
                              disabled={channel.action_count! > 0}
                              title={
                                channel.action_count! > 0
                                  ? `Cannot delete channel with ${channel.action_count} assigned action(s)`
                                  : 'Delete channel'
                              }
                            >
                              🗑️ Delete
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="channel-manager-footer">
            <button className="close-footer-button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>

      {/* Channel Editor Modal */}
      {showEditor && (
        <ChannelEditor
          channel={editingChannel}
          channelId={channelId}
          onSave={handleEditorSave}
          onCancel={handleEditorCancel}
        />
      )}
    </>
  );
};
