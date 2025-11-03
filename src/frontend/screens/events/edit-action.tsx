/**
 * Edit Action Screen
 * 
 * Dedicated full-screen editor for creating and editing event actions.
 * Replaces the modal approach with a proper screen following the Viewer pattern.
 * 
 * Phase 8 Refactor: Modal → Dedicated Screen
 */

import React, { useState, useEffect } from 'react';
import { EventAction, EventActionPayload } from '../../services/event-actions';
import { browserSourceChannelsService, BrowserSourceChannel } from '../../services/browser-source-channels';
import { EVENT_DISPLAY_INFO, EventSubscriptions } from '../../config/event-types';
import { TemplateBuilder, AlertPreview } from './components';
import './edit-action.css';

interface EditActionProps {
  action?: EventAction;           // undefined = create mode
  channelId: string;
  defaultChannel?: string;        // Default channel for new actions
  onSave: (payload: EventActionPayload) => Promise<void>;
  onCancel: () => void;
}

type TabType = 'general' | 'text' | 'sound' | 'image' | 'video';

interface ValidationErrors {
  event_type?: string;
  text_template?: string;
  sound_file_path?: string;
  image_file_path?: string;
  video_file_path?: string;
}

const POSITIONS = [
  'top-left', 'top-center', 'top-right',
  'middle-left', 'middle-center', 'middle-right',
  'bottom-left', 'bottom-center', 'bottom-right'
];

const POSITION_LABELS: Record<string, string> = {
  'top-left': '↖',
  'top-center': '↑',
  'top-right': '↗',
  'middle-left': '←',
  'middle-center': '●',
  'middle-right': '→',
  'bottom-left': '↙',
  'bottom-center': '↓',
  'bottom-right': '↘'
};

export const EditActionScreen: React.FC<EditActionProps> = ({
  action,
  channelId,
  defaultChannel,
  onSave,
  onCancel
}) => {
  const isEditMode = !!action;
  
  // Tab state
  const [activeTab, setActiveTab] = useState<TabType>('general');
  // Form state
  const [formData, setFormData] = useState<EventActionPayload>({
    channel_id: channelId,
    event_type: action?.event_type || '',
    is_enabled: action ? !!action.is_enabled : true,
    browser_source_channel: action?.browser_source_channel || defaultChannel || 'default',
    
    // Text
    text_enabled: action ? !!action.text_enabled : false,
    text_template: action?.text_template || null,
    text_duration: action?.text_duration ?? 5000,
    text_position: action?.text_position || 'top-center',
    text_style: action?.text_style || null,
    
    // Sound
    sound_enabled: action ? !!action.sound_enabled : false,
    sound_file_path: action?.sound_file_path || null,
    sound_volume: action?.sound_volume ?? 0.5,
    
    // Image
    image_enabled: action ? !!action.image_enabled : false,
    image_file_path: action?.image_file_path || null,
    image_duration: action?.image_duration ?? 3000,
    image_position: action?.image_position || 'middle-center',
    image_width: action?.image_width || null,
    image_height: action?.image_height || null,
    
    // Video
    video_enabled: action ? !!action.video_enabled : false,
    video_file_path: action?.video_file_path || null,
    video_volume: action?.video_volume ?? 0.5,
    video_position: action?.video_position || 'middle-center',
    video_width: action?.video_width || null,
    video_height: action?.video_height || null  });
  
  // Browser Source Channels
  const [channels, setChannels] = useState<BrowserSourceChannel[]>([]);
  
  // UI state
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Load browser source channels
  useEffect(() => {
    const loadChannels = async () => {
      try {
        const data = await browserSourceChannelsService.getAll(channelId);
        setChannels(data);
      } catch (err) {
        console.error('[EditActionScreen] Failed to load channels:', err);
      }
    };
    loadChannels();
  }, [channelId]);
  
  // Track form changes
  useEffect(() => {
    if (isEditMode) {      setHasUnsavedChanges(JSON.stringify(formData) !== JSON.stringify({
        channel_id: action.channel_id,
        event_type: action.event_type,
        is_enabled: action.is_enabled,
        browser_source_channel: action.browser_source_channel,
        text_enabled: action.text_enabled,
        text_template: action.text_template,
        text_duration: action.text_duration,
        text_position: action.text_position,
        text_style: action.text_style,
        sound_enabled: action.sound_enabled,
        sound_file_path: action.sound_file_path,
        sound_volume: action.sound_volume,
        image_enabled: action.image_enabled,
        image_file_path: action.image_file_path,
        image_duration: action.image_duration,
        image_position: action.image_position,
        image_width: action.image_width,
        image_height: action.image_height,
        video_enabled: action.video_enabled,
        video_file_path: action.video_file_path,
        video_volume: action.video_volume,
        video_position: action.video_position,
        video_width: action.video_width,
        video_height: action.video_height
      }));
    } else {
      setHasUnsavedChanges(true); // Always consider create mode as having changes
    }
  }, [formData, isEditMode, action]);
  
  // Validate form
  const validate = (): boolean => {
    const newErrors: ValidationErrors = {};
    
    if (!formData.event_type) {
      newErrors.event_type = 'Event type is required';
    }
    
    if (formData.text_enabled && !formData.text_template?.trim()) {
      newErrors.text_template = 'Text template is required when text alerts are enabled';
    }
    
    if (formData.sound_enabled && !formData.sound_file_path?.trim()) {
      newErrors.sound_file_path = 'Sound file is required when sound alerts are enabled';
    }
    
    if (formData.image_enabled && !formData.image_file_path?.trim()) {
      newErrors.image_file_path = 'Image file is required when image alerts are enabled';
    }
    
    if (formData.video_enabled && !formData.video_file_path?.trim()) {
      newErrors.video_file_path = 'Video file is required when video alerts are enabled';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };
  
  // Handle save
  const handleSave = async () => {
    if (!validate()) {
      return;
    }
    
    setIsSaving(true);
    try {
      await onSave(formData);
    } catch (error) {
      console.error('Failed to save action:', error);
      alert('Failed to save action. Check console for details.');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Handle cancel with unsaved changes warning
  const handleCancel = () => {
    if (hasUnsavedChanges) {
      if (!confirm('You have unsaved changes. Are you sure you want to go back?')) {
        return;
      }
    }
    onCancel();
  };
  
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleCancel();
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        handleSave();
      }
    }; window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasUnsavedChanges, formData]);
  
  // Get event display name
  const getEventDisplayName = (eventType: string): string => {
    return EVENT_DISPLAY_INFO[eventType as keyof EventSubscriptions]?.name || eventType;
  };
  
  // Update form field
  const updateField = <K extends keyof EventActionPayload>(
    field: K,
    value: EventActionPayload[K]
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field as keyof ValidationErrors]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field as keyof ValidationErrors];
        return newErrors;
      });
    }
  };
  
  // File picker
  const handleFilePicker = async (
    field: 'sound_file_path' | 'image_file_path' | 'video_file_path',
    accept: string
  ) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        updateField(field, file.path);
      }
    };
    input.click();
  };
  
  return (
    <div className="edit-action-screen">
      {/* Header with back button */}
      <div className="edit-action-header">
        <button className="back-button" onClick={handleCancel}>
          ← Back to Event Actions
        </button>
        <h2>
          {isEditMode ? 'Edit Action' : 'Create Action'}
          {formData.event_type && `: ${getEventDisplayName(formData.event_type)}`}
        </h2>
        {hasUnsavedChanges && (
          <span className="unsaved-indicator">● Unsaved changes</span>
        )}
      </div>
      
      {/* Tab Navigation - FIXED HEIGHT */}
      <div className="edit-action-tabs">
        <button
          className={`tab-button ${activeTab === 'general' ? 'active' : ''}`}
          onClick={() => setActiveTab('general')}
        >
          General
        </button>
        <button
          className={`tab-button ${activeTab === 'text' ? 'active' : ''}`}
          onClick={() => setActiveTab('text')}
        >
          Text Alert
          {formData.text_enabled && <span className="tab-badge">●</span>}
        </button>
        <button
          className={`tab-button ${activeTab === 'sound' ? 'active' : ''}`}
          onClick={() => setActiveTab('sound')}
        >
          Sound Alert
          {formData.sound_enabled && <span className="tab-badge">●</span>}
        </button>
        <button
          className={`tab-button ${activeTab === 'image' ? 'active' : ''}`}
          onClick={() => setActiveTab('image')}
        >
          Image Alert
          {formData.image_enabled && <span className="tab-badge">●</span>}
        </button>
        <button
          className={`tab-button ${activeTab === 'video' ? 'active' : ''}`}
          onClick={() => setActiveTab('video')}
        >
          Video Alert
          {formData.video_enabled && <span className="tab-badge">●</span>}
        </button>
      </div>
      
      {/* Tab Content - SCROLLABLE */}
      <div className="edit-action-content">
        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="tab-content">
            <div className="form-section">
              <h3>General Settings</h3>
              
              <div className="form-group">
                <label htmlFor="event_type">
                  Event Type <span className="required">*</span>
                </label>
                <select
                  id="event_type"
                  value={formData.event_type}
                  onChange={(e) => updateField('event_type', e.target.value)}
                  disabled={isEditMode}
                  className={errors.event_type ? 'error' : ''}
                >
                  <option value="">Select an event type...</option>
                  {Object.keys(EVENT_DISPLAY_INFO).map(eventType => (
                    <option key={eventType} value={eventType}>
                      {getEventDisplayName(eventType)}
                    </option>
                  ))}
                </select>
                {errors.event_type && (
                  <span className="error-message">{errors.event_type}</span>
                )}
              </div>
              
              <div className="form-group">
                <label htmlFor="browser_source_channel">
                  Browser Source Channel
                </label>
                <select
                  id="browser_source_channel"
                  value={formData.browser_source_channel || 'default'}
                  onChange={(e) => updateField('browser_source_channel', e.target.value)}
                >
                  {channels.map(channel => (
                    <option key={channel.id} value={channel.name}>
                      {channel.icon} {channel.display_name}
                    </option>
                  ))}
                </select>
                <p className="help-text">
                  Choose which browser source channel will display this alert. Use different channels to position alerts in different locations on your stream.
                </p>
                {formData.browser_source_channel && formData.browser_source_channel !== 'default' && (
                  <div className="browser-source-url-preview">
                    <label>Browser Source URL for this channel:</label>
                    <code className="url-code">
                      {browserSourceChannelsService.getBrowserSourceUrl(formData.browser_source_channel)}
                    </code>
                  </div>
                )}
              </div>
              
              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.is_enabled ?? true}
                    onChange={(e) => updateField('is_enabled', e.target.checked)}
                  />
                  <span>Enable this action</span>
                </label>
                <p className="help-text">
                  When disabled, this action will not trigger alerts
                </p>
              </div>
            </div>
            
            <div className="form-section">
              <h3>Alert Configuration Summary</h3>
              <div className="summary-grid">
                <div className="summary-item">
                  <span className="summary-label">Text Alert:</span>
                  <span className={`summary-value ${formData.text_enabled ? 'enabled' : 'disabled'}`}>
                    {formData.text_enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Sound Alert:</span>
                  <span className={`summary-value ${formData.sound_enabled ? 'enabled' : 'disabled'}`}>
                    {formData.sound_enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Image Alert:</span>
                  <span className={`summary-value ${formData.image_enabled ? 'enabled' : 'disabled'}`}>
                    {formData.image_enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
                <div className="summary-item">
                  <span className="summary-label">Video Alert:</span>
                  <span className={`summary-value ${formData.video_enabled ? 'enabled' : 'disabled'}`}>
                    {formData.video_enabled ? '✓ Enabled' : '✗ Disabled'}
                  </span>
                </div>
              </div>
              <p className="help-text">
                Use the tabs above to configure each alert type
              </p>
            </div>
          </div>
        )}
        
        {/* Text Alert Tab */}
        {activeTab === 'text' && (
          <div className="tab-content">
            <div className="form-section">
              <div className="section-header">
                <h3>Text Alert Configuration</h3>
                <label className="checkbox-label inline">
                  <input
                    type="checkbox"
                    checked={formData.text_enabled ?? false}
                    onChange={(e) => updateField('text_enabled', e.target.checked)}
                  />
                  <span>Enable Text Alert</span>
                </label>
              </div>
                {formData.text_enabled && (
                <>                  <div className="form-group">
                    <label htmlFor="text_template">
                      Text Template <span className="required">*</span>
                    </label>
                    <TemplateBuilder
                      eventType={formData.event_type}
                      value={formData.text_template || ''}
                      onChange={(template: string) => updateField('text_template', template || null)}
                      placeholder="Enter text template or use a preset..."
                    />
                    {errors.text_template && (
                      <span className="error-message">{errors.text_template}</span>
                    )}
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="text_duration">Duration (ms)</label>
                      <input
                        id="text_duration"
                        type="number"
                        min="100"
                        max="60000"
                        step="100"
                        value={formData.text_duration ?? 5000}
                        onChange={(e) => updateField('text_duration', parseInt(e.target.value) || 5000)}
                      />
                      <p className="help-text">
                        {((formData.text_duration ?? 5000) / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Position</label>
                    <div className="position-selector">
                      {POSITIONS.map(position => (
                        <button
                          key={position}
                          type="button"
                          className={`position-button ${formData.text_position === position ? 'active' : ''}`}
                          onClick={() => updateField('text_position', position)}
                          title={position}
                        >
                          {POSITION_LABELS[position]}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="text_style">Custom Style (JSON)</label>
                    <textarea
                      id="text_style"
                      value={formData.text_style || ''}
                      onChange={(e) => updateField('text_style', e.target.value || null)}
                      placeholder='{"fontSize": "24px", "color": "#fff"}'
                      rows={3}
                    />
                    <p className="help-text">
                      Optional CSS style object in JSON format
                    </p>
                  </div>
                </>
              )}
              
              {!formData.text_enabled && (
                <p className="disabled-message">
                  Enable text alerts to configure settings
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Sound Alert Tab */}
        {activeTab === 'sound' && (
          <div className="tab-content">
            <div className="form-section">
              <div className="section-header">
                <h3>Sound Alert Configuration</h3>
                <label className="checkbox-label inline">
                  <input
                    type="checkbox"
                    checked={formData.sound_enabled ?? false}
                    onChange={(e) => updateField('sound_enabled', e.target.checked)}
                  />
                  <span>Enable Sound Alert</span>
                </label>
              </div>
              
              {formData.sound_enabled && (
                <>
                  <div className="form-group">
                    <label htmlFor="sound_file_path">
                      Sound File <span className="required">*</span>
                    </label>
                    <div className="file-picker">
                      <input
                        id="sound_file_path"
                        type="text"
                        value={formData.sound_file_path || ''}
                        onChange={(e) => updateField('sound_file_path', e.target.value || null)}
                        placeholder="Select a sound file..."
                        className={errors.sound_file_path ? 'error' : ''}
                        readOnly
                      />
                      <button
                        type="button"
                        className="file-picker-button"
                        onClick={() => handleFilePicker('sound_file_path', 'audio/*')}
                      >
                        Browse
                      </button>
                    </div>
                    {errors.sound_file_path && (
                      <span className="error-message">{errors.sound_file_path}</span>
                    )}
                    <p className="help-text">
                      Supported formats: MP3, WAV, OGG
                    </p>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="sound_volume">
                      Volume: {Math.round((formData.sound_volume ?? 0.5) * 100)}%
                    </label>
                    <input
                      id="sound_volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={formData.sound_volume ?? 0.5}
                      onChange={(e) => updateField('sound_volume', parseFloat(e.target.value))}
                    />
                  </div>
                </>
              )}
              
              {!formData.sound_enabled && (
                <p className="disabled-message">
                  Enable sound alerts to configure settings
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Image Alert Tab */}
        {activeTab === 'image' && (
          <div className="tab-content">
            <div className="form-section">
              <div className="section-header">
                <h3>Image Alert Configuration</h3>
                <label className="checkbox-label inline">
                  <input
                    type="checkbox"
                    checked={formData.image_enabled ?? false}
                    onChange={(e) => updateField('image_enabled', e.target.checked)}
                  />
                  <span>Enable Image Alert</span>
                </label>
              </div>
              
              {formData.image_enabled && (
                <>
                  <div className="form-group">
                    <label htmlFor="image_file_path">
                      Image File <span className="required">*</span>
                    </label>
                    <div className="file-picker">
                      <input
                        id="image_file_path"
                        type="text"
                        value={formData.image_file_path || ''}
                        onChange={(e) => updateField('image_file_path', e.target.value || null)}
                        placeholder="Select an image file..."
                        className={errors.image_file_path ? 'error' : ''}
                        readOnly
                      />
                      <button
                        type="button"
                        className="file-picker-button"
                        onClick={() => handleFilePicker('image_file_path', 'image/*')}
                      >
                        Browse
                      </button>
                    </div>
                    {errors.image_file_path && (
                      <span className="error-message">{errors.image_file_path}</span>
                    )}
                    <p className="help-text">
                      Supported formats: PNG, JPG, GIF, WebP
                    </p>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="image_duration">Duration (ms)</label>
                      <input
                        id="image_duration"
                        type="number"
                        min="100"
                        max="60000"
                        step="100"
                        value={formData.image_duration ?? 3000}
                        onChange={(e) => updateField('image_duration', parseInt(e.target.value) || 3000)}
                      />
                      <p className="help-text">
                        {((formData.image_duration ?? 3000) / 1000).toFixed(1)}s
                      </p>
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Position</label>
                    <div className="position-selector">
                      {POSITIONS.map(position => (
                        <button
                          key={position}
                          type="button"
                          className={`position-button ${formData.image_position === position ? 'active' : ''}`}
                          onClick={() => updateField('image_position', position)}
                          title={position}
                        >
                          {POSITION_LABELS[position]}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="image_width">Width (px)</label>
                      <input
                        id="image_width"
                        type="number"
                        min="0"
                        placeholder="Auto"
                        value={formData.image_width || ''}
                        onChange={(e) => updateField('image_width', e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="image_height">Height (px)</label>
                      <input
                        id="image_height"
                        type="number"
                        min="0"
                        placeholder="Auto"
                        value={formData.image_height || ''}
                        onChange={(e) => updateField('image_height', e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                  </div>
                  <p className="help-text">
                    Leave width/height blank for original size
                  </p>
                </>
              )}
              
              {!formData.image_enabled && (
                <p className="disabled-message">
                  Enable image alerts to configure settings
                </p>
              )}
            </div>
          </div>
        )}
        
        {/* Video Alert Tab */}
        {activeTab === 'video' && (
          <div className="tab-content">
            <div className="form-section">
              <div className="section-header">
                <h3>Video Alert Configuration</h3>
                <label className="checkbox-label inline">
                  <input
                    type="checkbox"
                    checked={formData.video_enabled ?? false}
                    onChange={(e) => updateField('video_enabled', e.target.checked)}
                  />
                  <span>Enable Video Alert</span>
                </label>
              </div>
              
              {formData.video_enabled && (
                <>
                  <div className="form-group">
                    <label htmlFor="video_file_path">
                      Video File <span className="required">*</span>
                    </label>
                    <div className="file-picker">
                      <input
                        id="video_file_path"
                        type="text"
                        value={formData.video_file_path || ''}
                        onChange={(e) => updateField('video_file_path', e.target.value || null)}
                        placeholder="Select a video file..."
                        className={errors.video_file_path ? 'error' : ''}
                        readOnly
                      />
                      <button
                        type="button"
                        className="file-picker-button"
                        onClick={() => handleFilePicker('video_file_path', 'video/*')}
                      >
                        Browse
                      </button>
                    </div>
                    {errors.video_file_path && (
                      <span className="error-message">{errors.video_file_path}</span>
                    )}
                    <p className="help-text">
                      Supported formats: MP4, WebM, OGG
                    </p>
                  </div>
                  
                  <div className="form-group">
                    <label htmlFor="video_volume">
                      Volume: {Math.round((formData.video_volume ?? 0.5) * 100)}%
                    </label>
                    <input
                      id="video_volume"
                      type="range"
                      min="0"
                      max="1"
                      step="0.01"
                      value={formData.video_volume ?? 0.5}
                      onChange={(e) => updateField('video_volume', parseFloat(e.target.value))}
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Position</label>
                    <div className="position-selector">
                      {POSITIONS.map(position => (
                        <button
                          key={position}
                          type="button"
                          className={`position-button ${formData.video_position === position ? 'active' : ''}`}
                          onClick={() => updateField('video_position', position)}
                          title={position}
                        >
                          {POSITION_LABELS[position]}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="video_width">Width (px)</label>
                      <input
                        id="video_width"
                        type="number"
                        min="0"
                        placeholder="Auto"
                        value={formData.video_width || ''}
                        onChange={(e) => updateField('video_width', e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                    
                    <div className="form-group">
                      <label htmlFor="video_height">Height (px)</label>
                      <input
                        id="video_height"
                        type="number"
                        min="0"
                        placeholder="Auto"
                        value={formData.video_height || ''}
                        onChange={(e) => updateField('video_height', e.target.value ? parseInt(e.target.value) : null)}
                      />
                    </div>
                  </div>
                  <p className="help-text">
                    Leave width/height blank for original size. Video plays until completion.
                  </p>
                </>
              )}
              
              {!formData.video_enabled && (
                <p className="disabled-message">
                  Enable video alerts to configure settings
                </p>
              )}
            </div>
          </div>
        )}
      </div>
        {/* Alert Preview Section */}
      <AlertPreview
        eventType={formData.event_type}
        textEnabled={formData.text_enabled ?? false}
        textTemplate={formData.text_template ?? null}
        textPosition={formData.text_position || 'top-center'}
        textDuration={formData.text_duration ?? 5000}
        imageEnabled={formData.image_enabled ?? false}
        imageFilePath={formData.image_file_path ?? null}
        imagePosition={formData.image_position || 'middle-center'}
        imageWidth={formData.image_width ?? null}
        imageHeight={formData.image_height ?? null}
        videoEnabled={formData.video_enabled ?? false}
        videoFilePath={formData.video_file_path ?? null}
        videoPosition={formData.video_position || 'middle-center'}
        videoWidth={formData.video_width ?? null}
        videoHeight={formData.video_height ?? null}
      />
      
      {/* Footer - FIXED */}
      <div className="edit-action-footer">
        <button
          className="cancel-button"
          onClick={handleCancel}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          className="save-button"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : (isEditMode ? 'Save Changes' : 'Create Action')}
        </button>
      </div>
    </div>
  );
};
