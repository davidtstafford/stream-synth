import React, { useState, useEffect } from 'react';
import { eventActionsService, EventAction, EventActionPayload, ActionStats, BrowserSourceStats } from '../../services/event-actions';
import { browserSourceChannelsService, BrowserSourceChannel } from '../../services/browser-source-channels';
import { EVENT_DISPLAY_INFO } from '../../config/event-types';
import { EditActionScreen } from './edit-action';
import { ChannelManager } from '../../components/ChannelManager';
import './event-actions.css';

const { ipcRenderer } = window.require('electron');

interface EventActionsScreenProps {
  channelId?: string;
}

type ViewState = 'list' | 'edit' | 'create';

export const EventActionsScreen: React.FC<EventActionsScreenProps> = ({ channelId }) => {
  const [actions, setActions] = useState<EventAction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ActionStats | null>(null);
  const [browserSourceStats, setBrowserSourceStats] = useState<BrowserSourceStats | null>(null);
  
  // Browser Source Channels
  const [channels, setChannels] = useState<BrowserSourceChannel[]>([]);
  const [selectedChannelFilter, setSelectedChannelFilter] = useState<string>('all');
  const [showChannelManager, setShowChannelManager] = useState<boolean>(false);
  
  // Filter states
  const [showOnlyEnabled, setShowOnlyEnabled] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  
  // View state management (replaces modal approach)
  const [activeView, setActiveView] = useState<ViewState>('list');
  const [editingActionId, setEditingActionId] = useState<number | null>(null);
  
  // Load actions
  const loadActions = async () => {
    if (!channelId) {
      setActions([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = showOnlyEnabled
        ? await eventActionsService.getEnabledActions(channelId)
        : await eventActionsService.getAllActions(channelId);
      
      setActions(data);
      
      // Load stats
      const statsData = await eventActionsService.getStats(channelId);
      setStats(statsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load event actions');
      console.error('[Event Actions] Load error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Load browser source stats
  const loadBrowserSourceStats = async () => {
    try {
      const data = await eventActionsService.getBrowserSourceStats();
      setBrowserSourceStats(data);
    } catch (err) {
      console.error('[Event Actions] Failed to load browser source stats:', err);
    }
  };

  // Load on mount and when filters change
  useEffect(() => {
    loadActions();
  }, [channelId, showOnlyEnabled]);  // Load browser source stats periodically
  useEffect(() => {
    loadBrowserSourceStats();
    const interval = setInterval(loadBrowserSourceStats, 5000); // Every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Load browser source channels
  const loadChannels = async () => {
    if (!channelId) return;
    try {
      const data = await browserSourceChannelsService.getAll(channelId);
      setChannels(data);
    } catch (err) {
      console.error('[Event Actions] Failed to load browser source channels:', err);
    }
  };

  // Load channels on mount and when channelId changes
  useEffect(() => {
    loadChannels();
  }, [channelId]);

  // Toggle action enabled state
  const handleToggleAction = async (action: EventAction) => {
    try {
      await eventActionsService.toggleAction(action.id, !action.is_enabled);
      await loadActions(); // Refresh list
    } catch (err: any) {
      alert(`Failed to toggle action: ${err.message}`);
    }
  };

  // Delete action
  const handleDeleteAction = async (action: EventAction) => {
    if (!confirm(`Delete alert for "${getEventDisplayName(action.event_type)}"?`)) {
      return;
    }

    try {
      await eventActionsService.deleteAction(action.id);
      await loadActions(); // Refresh list
    } catch (err: any) {
      alert(`Failed to delete action: ${err.message}`);
    }
  };
  // Send test alert
  const handleTestAlert = async (action: EventAction) => {
    try {
      // Create a test alert payload
      const testPayload = {
        event_type: action.event_type,
        channel_id: action.channel_id,
        formatted: {
          html: `<strong>Test Alert</strong> for ${getEventDisplayName(action.event_type)}`,
          plainText: `Test Alert for ${getEventDisplayName(action.event_type)}`,
          emoji: '🧪',
          variables: { test: 'true' }
        },
        text: action.text_enabled ? {
          content: action.text_template || `Test ${getEventDisplayName(action.event_type)}`,
          duration: action.text_duration,
          position: action.text_position,
          style: action.text_style ? JSON.parse(action.text_style) : undefined
        } : undefined,
        timestamp: new Date().toISOString()
      };

      await eventActionsService.testAlert(testPayload);
      
      // Show feedback
      const btn = document.activeElement as HTMLButtonElement;
      if (btn && btn.classList.contains('test-button')) {
        btn.textContent = '✅ Sent!';
        setTimeout(() => {
          btn.textContent = '🧪 Test';
        }, 2000);
      }
    } catch (err: any) {
      alert(`Failed to send test alert: ${err.message}`);
    }
  };
  // Save action (create or update)
  const handleSaveAction = async (payload: EventActionPayload) => {
    try {
      if (activeView === 'edit' && editingActionId !== null) {
        // Update existing action
        await eventActionsService.updateAction(editingActionId, payload);
      } else {
        // Create new action
        await eventActionsService.createAction(payload);
      }
      
      // Return to list view and refresh
      setActiveView('list');
      setEditingActionId(null);
      await loadActions();
    } catch (err: any) {
      console.error('[Event Actions] Save error:', err);
      throw err; // Re-throw to let EditActionScreen handle it
    }
  };

  // Cancel editing/creating
  const handleCancelEdit = () => {
    setActiveView('list');
    setEditingActionId(null);
  };

  // Open edit view
  const handleEditAction = (action: EventAction) => {
    setEditingActionId(action.id);
    setActiveView('edit');
  };

  // Open create view
  const handleCreateAction = () => {
    setEditingActionId(null);
    setActiveView('create');
  };
  // Get event display name
  const getEventDisplayName = (eventType: string): string => {
    const info = EVENT_DISPLAY_INFO[eventType as keyof typeof EVENT_DISPLAY_INFO];
    return info ? info.name : eventType;
  };
  // Filter actions by search text
  const filteredActions = actions.filter(action => {
    // Search text filter
    if (searchText) {
      const searchLower = searchText.toLowerCase();
      const matchesSearch = (
        action.event_type.toLowerCase().includes(searchLower) ||
        getEventDisplayName(action.event_type).toLowerCase().includes(searchLower) ||
        (action.text_template && action.text_template.toLowerCase().includes(searchLower))
      );
      if (!matchesSearch) return false;
    }
    
    // Channel filter
    if (selectedChannelFilter !== 'all') {
      if (action.browser_source_channel !== selectedChannelFilter) return false;
    }
    
    return true;
  });

  // Render no connection state
  if (!channelId) {
    return (
      <div className="event-actions-container">
        <h2>🎬 Event Actions</h2>
        <div className="no-connection-message">
          <p>⚠️ Please connect to Twitch first to manage event actions.</p>
          <p>Go to the Connection tab to log in.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="event-actions-container">
      <h2>🎬 Event Actions</h2>
      
      {/* Browser Source Status Bar */}
      {browserSourceStats && (
        <div className={`browser-source-status ${browserSourceStats.isRunning ? 'running' : 'stopped'}`}>
          <div className="status-indicator">
            <span className={`status-dot ${browserSourceStats.isRunning ? 'active' : ''}`}></span>
            <span className="status-text">
              {browserSourceStats.isRunning ? 'Browser Source Running' : 'Browser Source Stopped'}
            </span>
          </div>
          {browserSourceStats.isRunning && (
            <div className="status-details">
              <span className="detail-item">
                <strong>Port:</strong> {browserSourceStats.port}
              </span>
              <span className="detail-item">
                <strong>Clients:</strong> {browserSourceStats.connectedClients}
              </span>
              <span className="detail-item">
                <strong>Alerts Sent:</strong> {browserSourceStats.alertsSent}
              </span>
              <a 
                href={browserSourceStats.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="browser-source-link"
              >
                📺 Open Browser Source
              </a>
            </div>
          )}
        </div>
      )}

      {/* Stats Bar */}
      {stats && (
        <div className="stats-bar">
          <div className="stat">
            <span className="stat-label">Total Actions</span>
            <span className="stat-value">{stats.total}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Enabled</span>
            <span className="stat-value enabled">{stats.enabled}</span>
          </div>
          <div className="stat">
            <span className="stat-label">Disabled</span>
            <span className="stat-value disabled">{stats.total - stats.enabled}</span>
          </div>
        </div>
      )}      {/* Toolbar */}
      <div className="toolbar">
        <div className="search-box">
          <input
            type="text"
            placeholder="Search by event type or template..."
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            className="search-input"
          />
          {searchText && (
            <button 
              className="clear-search-button"
              onClick={() => setSearchText('')}
              title="Clear search"
            >
              ✕
            </button>
          )}
        </div>
        
        <div className="filter-controls">
          <label className="filter-label">
            <span>Channel:</span>
            <select
              value={selectedChannelFilter}
              onChange={(e) => setSelectedChannelFilter(e.target.value)}
              className="channel-filter-select"
              title="Filter by browser source channel"
            >
              <option value="all">All Channels</option>
              {channels.map(channel => (
                <option key={channel.id} value={channel.name}>
                  {channel.icon} {channel.display_name}
                </option>
              ))}
            </select>
          </label>
          
          <label className="filter-checkbox">
            <input
              type="checkbox"
              checked={showOnlyEnabled}
              onChange={(e) => setShowOnlyEnabled(e.target.checked)}
            />
            <span>Show only enabled</span>
          </label>
        </div>
        
        <button 
          className="secondary-button"
          onClick={() => setShowChannelManager(true)}
          title="Manage browser source channels"
          disabled={!channelId}
        >
          📺 Manage Channels
        </button>
        
        <button 
          className="create-button primary-button"
          onClick={handleCreateAction}
          title="Create new event action"
          disabled={!channelId}
        >
          ➕ Create Action
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button className="retry-button" onClick={loadActions}>
            🔄 Retry
          </button>
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="loading-message">
          <div className="spinner"></div>
          <p>Loading event actions...</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && filteredActions.length === 0 && (
        <div className="empty-state">
          {searchText ? (
            <>
              <p className="empty-icon">🔍</p>
              <p className="empty-title">No actions match your search</p>
              <p className="empty-subtitle">Try a different search term</p>
              <button className="clear-search-button" onClick={() => setSearchText('')}>
                Clear Search
              </button>
            </>
          ) : showOnlyEnabled ? (
            <>
              <p className="empty-icon">😴</p>
              <p className="empty-title">No enabled actions</p>
              <p className="empty-subtitle">Enable some actions or create new ones!</p>
              <button className="secondary-button" onClick={() => setShowOnlyEnabled(false)}>
                Show All Actions
              </button>
            </>
          ) : (
            <>
              <p className="empty-icon">🎬</p>              <p className="empty-title">No event actions configured</p>
              <p className="empty-subtitle">Create your first alert to get started!</p>
              <button className="primary-button" onClick={handleCreateAction}>
                ➕ Create Your First Action
              </button>
            </>
          )}
        </div>
      )}

      {/* Actions List */}
      {!loading && !error && filteredActions.length > 0 && (        <div className="actions-list">
          <div className="list-header">
            <span className="header-cell event-type">Event Type</span>
            <span className="header-cell media-types">Media</span>
            <span className="header-cell status">Status</span>
            <span className="header-cell actions-header">Actions</span>
          </div>
          
          {filteredActions.map(action => (            <div 
              key={action.id} 
              className={`action-item ${!action.is_enabled ? 'disabled' : ''}`}
            >              <div className="cell event-type">
                <span className="event-icon">📢</span>
                <div className="event-info">
                  <span className="event-name">{getEventDisplayName(action.event_type)}</span>
                  {action.browser_source_channel && action.browser_source_channel !== 'default' && (
                    <span className="channel-badge" title={`Browser Source Channel: ${action.browser_source_channel}`}>
                      {channels.find(c => c.name === action.browser_source_channel)?.icon || '📺'} {action.browser_source_channel}
                    </span>
                  )}
                </div>
              </div><div className="cell media-types">
                <div className="media-badges">
                  {!!action.text_enabled && <span className="media-badge text">📝 Text</span>}
                  {!!action.sound_enabled && <span className="media-badge sound">🔊 Sound</span>}
                  {!!action.image_enabled && <span className="media-badge image">🖼️ Image</span>}
                  {!!action.video_enabled && <span className="media-badge video">🎬 Video</span>}
                  {!action.text_enabled && !action.sound_enabled && !action.image_enabled && !action.video_enabled && (
                    <span className="media-badge none">None</span>
                  )}
                </div>
              </div>

              <div className="cell status">
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={action.is_enabled}
                    onChange={() => handleToggleAction(action)}
                  />
                  <span className="toggle-slider"></span>
                </label>
                <span className={`status-label ${action.is_enabled ? 'enabled' : 'disabled'}`}>
                  {action.is_enabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>

              <div className="cell actions-cell">
                <button
                  className="action-button test-button"
                  onClick={() => handleTestAlert(action)}
                  title="Send test alert"
                  disabled={!action.is_enabled}
                >
                  🧪 Test
                </button>                <button
                  className="action-button edit-button"
                  onClick={() => handleEditAction(action)}
                  title="Edit action"
                >
                  ✏️ Edit
                </button>
                <button
                  className="action-button delete-button"
                  onClick={() => handleDeleteAction(action)}
                  title="Delete action"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>          ))}
        </div>
      )}      {/* Edit/Create Action Screen (replaces modal) */}
      {activeView !== 'list' && channelId && (
        <EditActionScreen
          action={editingActionId !== null ? actions.find(a => a.id === editingActionId) : undefined}
          channelId={channelId}
          defaultChannel={selectedChannelFilter !== 'all' ? selectedChannelFilter : undefined}
          onSave={handleSaveAction}
          onCancel={handleCancelEdit}
        />
      )}

      {/* Channel Manager Modal */}
      {showChannelManager && channelId && (
        <ChannelManager
          channelId={channelId}
          onClose={() => {
            setShowChannelManager(false);
            loadChannels(); // Reload channels after closing
          }}
        />
      )}
    </div>
  );
};
