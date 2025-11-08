/**
 * ChannelEditor Component
 * 
 * Modal dialog for creating and editing browser source channels.
 * Provides form for channel name, display name, description, icon, and color.
 * 
 * Phase 8C: Channel Editor UI
 */

import React, { useState, useEffect } from 'react';
import { 
  browserSourceChannelsService, 
  BrowserSourceChannel,
  BrowserSourceChannelPayload 
} from '../services/browser-source-channels';
import './ChannelEditor.css';

const { ipcRenderer } = window.require('electron');
const os = window.require('os');

interface ChannelEditorProps {
  channel?: BrowserSourceChannel;  // undefined = create mode
  channelId: string;
  onSave: () => void;
  onCancel: () => void;
}

const ICON_OPTIONS = ['📺', '🎉', '💬', '💎', '🔔', '⭐', '🎬', '🎮', '🎵', '🎨', '🚀', '⚡'];
const COLOR_OPTIONS = [
  '#9147ff', // Twitch purple
  '#ff4444', // Red
  '#44ff44', // Green
  '#4444ff', // Blue
  '#ffaa00', // Orange
  '#ff44ff', // Pink
  '#00ffff', // Cyan
  '#ffff44', // Yellow
];

export const ChannelEditor: React.FC<ChannelEditorProps> = ({
  channel,
  channelId,
  onSave,
  onCancel
}) => {
  const isEditMode = !!channel;

  // Form state
  const [name, setName] = useState(channel?.name || '');
  const [displayName, setDisplayName] = useState(channel?.display_name || '');
  const [description, setDescription] = useState(channel?.description || '');
  const [icon, setIcon] = useState(channel?.icon || '📺');
  const [color, setColor] = useState(channel?.color || '#9147ff');
  // UI state
  const [nameError, setNameError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [localIpAddress, setLocalIpAddress] = useState<string>('');

  /**
   * Get local IP address on mount
   */
  useEffect(() => {
    try {
      const networkInterfaces = os.networkInterfaces();
      let ipAddress = 'localhost';
      
      // Find the first non-internal IPv4 address
      for (const interfaceName in networkInterfaces) {
        const addresses = networkInterfaces[interfaceName];
        for (const addr of addresses) {
          if (addr.family === 'IPv4' && !addr.internal) {
            ipAddress = addr.address;
            break;
          }
        }
        if (ipAddress !== 'localhost') break;
      }
      
      setLocalIpAddress(ipAddress);
    } catch (err) {
      console.error('[ChannelEditor] Error getting IP address:', err);
      setLocalIpAddress('localhost');
    }
  }, []);
  /**
   * Track unsaved changes
   */
  useEffect(() => {
    if (isEditMode) {
      const changed = 
        name !== channel.name ||
        displayName !== channel.display_name ||
        description !== (channel.description || '') ||
        icon !== channel.icon ||
        color !== channel.color;
      setHasUnsavedChanges(changed);
    } else {
      const hasData = name.length > 0 || displayName.length > 0 || description.length > 0;
      setHasUnsavedChanges(hasData);
    }
  }, [name, displayName, description, icon, color, isEditMode, channel]);

  /**
   * Handle display name blur - generate channel name
   */
  const handleDisplayNameBlur = () => {
    if (!isEditMode && displayName) {
      const sanitized = browserSourceChannelsService.sanitizeName(displayName);
      setName(sanitized);
    }
  };

  /**
   * Validate name
   */
  useEffect(() => {
    if (!name) {
      setNameError(null);
      return;
    }

    const validation = browserSourceChannelsService.validateName(name);
    if (!validation.valid) {
      setNameError(validation.error || 'Invalid name');
      return;
    }

    // Check availability (async)
    const checkAvailability = async () => {
      try {
        const available = await browserSourceChannelsService.checkNameAvailability(
          channelId,
          name,
          channel?.id
        );
        if (!available) {
          setNameError('Channel name already exists');
        } else {
          setNameError(null);
        }
      } catch (err) {
        console.error('[ChannelEditor] Error checking name availability:', err);
      }
    };

    checkAvailability();
  }, [name, channelId, channel?.id]);
  /**
   * Handle save
   */
  const handleSave = async () => {
    // Auto-generate name from display name if not already done (in create mode)
    let finalName = name;
    if (!isEditMode && displayName && !name) {
      finalName = browserSourceChannelsService.sanitizeName(displayName);
      setName(finalName);
    }

    // Validate
    if (!finalName || !displayName) {
      alert('Please fill in all required fields');
      return;
    }

    if (nameError) {
      alert(`Invalid channel name: ${nameError}`);
      return;
    }

    try {
      setIsSaving(true);

      const payload: BrowserSourceChannelPayload = {
        channel_id: channelId,
        name: finalName,
        display_name: displayName,
        description: description || null,
        icon,
        color
      };

      if (isEditMode) {
        await browserSourceChannelsService.update(channel.id, payload);
      } else {
        await browserSourceChannelsService.create(payload);
      }

      onSave();
    } catch (err: any) {
      console.error('[ChannelEditor] Error saving channel:', err);
      alert(`Failed to save channel: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      const confirmed = confirm('You have unsaved changes. Are you sure you want to cancel?');
      if (!confirmed) return;
    }
    onCancel();
  };
  /**
   * Get browser source URL preview
   */
  const getLocalhostUrl = () => {
    if (!name) return 'http://localhost:3737/browser-source?channel=...';
    return `http://localhost:3737/browser-source?channel=${name}`;
  };

  const getIpUrl = () => {
    if (!name || !localIpAddress) return 'http://...:3737/browser-source?channel=...';
    return `http://${localIpAddress}:3737/browser-source?channel=${name}`;
  };
  const copyUrl = async (url: string, label: string) => {
    // Ensure name is generated before copying
    if (!isEditMode && displayName && !name) {
      const sanitized = browserSourceChannelsService.sanitizeName(displayName);
      setName(sanitized);
    }
    
    try {
      await navigator.clipboard.writeText(url);
      alert(`${label} URL copied to clipboard!`);
    } catch (err) {
      console.error('Failed to copy URL:', err);
      alert('Failed to copy URL');
    }
  };

  return (
    <div className="channel-editor-backdrop" onClick={handleCancel}>
      <div className="channel-editor-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="channel-editor-header">
          <h2>{isEditMode ? 'Edit Channel' : 'Create Channel'}</h2>
          <button className="close-button" onClick={handleCancel}>×</button>
        </div>

        {/* Content */}
        <div className="channel-editor-content">          {/* Display Name */}
          <div className="form-group">
            <label className="form-label required">
              Display Name
            </label>
            <input
              type="text"
              className="form-input"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              onBlur={handleDisplayNameBlur}
              placeholder="e.g., Main Alerts, TTS Corner, Hype Events"
              maxLength={50}
              autoFocus
            />
            <div className="form-hint">
              This is the name shown in the UI
            </div>
          </div>

          {/* Channel URLs (auto-generated from display name) */}
          <div className="form-group">
            <label className="form-label">
              Channel URLs
            </label>
            <div className="channel-urls">
              <div className="url-section">
                <div className="url-label">Localhost (same machine):</div>
                <div className="url-preview">
                  <code className="url-display">{getLocalhostUrl()}</code>
                  <button
                    className="copy-url-button"
                    onClick={() => copyUrl(getLocalhostUrl(), 'Localhost')}
                    disabled={!name}
                    type="button"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
              <div className="url-section">
                <div className="url-label">Network IP (for OBS on another machine):</div>
                <div className="url-preview">
                  <code className="url-display">{getIpUrl()}</code>
                  <button
                    className="copy-url-button"
                    onClick={() => copyUrl(getIpUrl(), 'Network IP')}
                    disabled={!name}
                    type="button"
                  >
                    📋 Copy
                  </button>
                </div>
              </div>
            </div>
            <div className="form-hint">
              URLs are auto-generated from the display name. Channel name: <strong>{name || '(type a name above)'}</strong>
            </div>
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="form-label">
              Description <span className="optional">(optional)</span>
            </label>
            <textarea
              className="form-textarea"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Center screen - followers, subs, raids"
              rows={3}
              maxLength={200}
            />
            <div className="form-hint">
              Helps you remember what this channel is for
            </div>
          </div>

          {/* Icon Picker */}
          <div className="form-group">
            <label className="form-label">
              Icon
            </label>
            <div className="icon-picker">
              {ICON_OPTIONS.map((iconOption) => (
                <button
                  key={iconOption}
                  className={`icon-option ${icon === iconOption ? 'selected' : ''}`}
                  onClick={() => setIcon(iconOption)}
                  type="button"
                >
                  {iconOption}
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div className="form-group">
            <label className="form-label">
              Color
            </label>
            <div className="color-picker">
              {COLOR_OPTIONS.map((colorOption) => (
                <button
                  key={colorOption}
                  className={`color-option ${color === colorOption ? 'selected' : ''}`}
                  style={{ backgroundColor: colorOption }}
                  onClick={() => setColor(colorOption)}
                  type="button"
                  title={colorOption}
                />              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="channel-preview">
            <div className="preview-label">Preview:</div>
            <div className="preview-card">
              <div className="preview-icon" style={{ color }}>
                {icon}
              </div>
              <div className="preview-info">
                <div className="preview-name">{displayName || 'Channel Name'}</div>
                <div className="preview-description">{description || 'No description'}</div>
                <div className="preview-slug">{name || 'channel-name'}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="channel-editor-footer">
          <button 
            className="cancel-button" 
            onClick={handleCancel}
            disabled={isSaving}
          >
            Cancel
          </button>          <button 
            className="save-button"
            onClick={handleSave}
            disabled={isSaving || !displayName || (isEditMode && (!name || !!nameError))}
          >
            {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Channel')}
          </button>
        </div>
      </div>
    </div>
  );
};
