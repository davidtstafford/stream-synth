import React, { useState, useEffect, useRef } from 'react';
import * as db from '../../../services/database';

interface ModerationActionsTabProps {
  preselectedViewerId?: string;
  broadcasterId: string;
  accessToken: string;
  clientId: string;
}

interface ActionHistoryItem {
  timestamp: Date;
  action: string;
  viewerName: string;
  details?: string;
}

export const ModerationActionsTab: React.FC<ModerationActionsTabProps> = ({
  preselectedViewerId,
  broadcasterId,
  accessToken,
  clientId
}) => {
  const [selectedViewer, setSelectedViewer] = useState<db.ViewerWithSubscription | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<db.ViewerWithSubscription[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [actionReason, setActionReason] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState(600); // 10 minutes default
  const [liveBanStatus, setLiveBanStatus] = useState<{
    isBanned: boolean;
    isTimedOut: boolean;
    expiresAt: string | null;
    reason: string | null;
  } | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load preselected viewer if provided
  useEffect(() => {
    if (preselectedViewerId) {
      loadViewerById(preselectedViewerId);
    }
  }, [preselectedViewerId]);

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);  const loadViewerById = async (viewerId: string) => {
    setLoading(true);
    try {
      // Search by ID to get ViewerWithSubscription
      const result = await db.searchViewersWithStatus(viewerId, 10);
      if (result.success && result.viewers) {
        const viewer = result.viewers.find(v => v.id === viewerId);
        if (viewer) {
          setSelectedViewer(viewer);
          setSearchQuery(viewer.display_name || viewer.id);
          await checkLiveBanStatus(viewerId);
        }
      }
    } catch (err) {
      console.error('Failed to load viewer:', err);
    } finally {
      setLoading(false);
    }
  };

  const checkLiveBanStatus = async (viewerId: string) => {
    try {
      const status = await db.checkViewerBanStatus(viewerId);
      setLiveBanStatus(status);
    } catch (err) {
      console.error('Failed to check ban status:', err);
      setLiveBanStatus(null);
    }
  };

  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    try {
      const result = await db.searchViewersWithStatus(query, 10);
      if (result.success && result.viewers) {
        setSearchResults(result.viewers);
        setShowDropdown(result.viewers.length > 0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  };

  const handleViewerSelect = async (viewer: db.ViewerWithSubscription) => {
    setSelectedViewer(viewer);
    setSearchQuery(viewer.display_name || viewer.id);
    setShowDropdown(false);
    setActionMessage(null);
    setActionError(null);
    await checkLiveBanStatus(viewer.id);
  };

  const addToHistory = (action: string, viewerName: string, details?: string) => {
    const item: ActionHistoryItem = {
      timestamp: new Date(),
      action,
      viewerName,
      details
    };
    setActionHistory(prev => [item, ...prev].slice(0, 10)); // Keep last 10 actions
  };

  const handleAction = async (
    actionType: 'ban' | 'unban' | 'timeout' | 'add-vip' | 'remove-vip' | 'add-mod' | 'remove-mod'
  ) => {
    if (!selectedViewer) return;

    setActionLoading(true);
    setActionMessage(null);
    setActionError(null);

    try {
      let result;

      switch (actionType) {
        case 'ban':
          result = await db.banViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            actionReason,
            accessToken,
            clientId
          );
          addToHistory('Ban', selectedViewer.display_name || 'Unknown', actionReason);
          break;

        case 'unban':
          result = await db.unbanViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          addToHistory('Unban', selectedViewer.display_name || 'Unknown');
          break;

        case 'timeout':
          result = await db.timeoutViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            timeoutDuration,
            actionReason,
            accessToken,
            clientId
          );
          addToHistory(
            'Timeout',
            selectedViewer.display_name || 'Unknown',
            `${timeoutDuration}s - ${actionReason}`
          );
          break;

        case 'add-vip':
          result = await db.addVipViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          addToHistory('Add VIP', selectedViewer.display_name || 'Unknown');
          break;

        case 'remove-vip':
          result = await db.removeVipViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          addToHistory('Remove VIP', selectedViewer.display_name || 'Unknown');
          break;

        case 'add-mod':
          result = await db.addModViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          addToHistory('Add Moderator', selectedViewer.display_name || 'Unknown');
          break;

        case 'remove-mod':
          result = await db.removeModViewer(
            broadcasterId,
            selectedViewer.id,
            selectedViewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          addToHistory('Remove Moderator', selectedViewer.display_name || 'Unknown');
          break;
      }      console.log(`[ModerationActions] ${actionType} result:`, result);

      // IPC framework wraps response: { success: true, data: { success, error, ... } }
      // So we need to check result.data.success, not result.success
      const actionResult = result?.data || result;
      
      if (actionResult?.success) {
        const successMsg = actionResult.message || `✓ ${actionType.replace('-', ' ')} successful`;
        setActionMessage(successMsg);
        setActionReason('');
        // Refresh live ban status
        await checkLiveBanStatus(selectedViewer.id);
        // Reload viewer data
        await loadViewerById(selectedViewer.id);
        setTimeout(() => setActionMessage(null), 5000);
      } else {
        const errorMsg = actionResult?.error || actionResult?.message || result?.error || 'Action failed';
        console.error(`[ModerationActions] ${actionType} failed:`, errorMsg);
        setActionError(errorMsg);
        setTimeout(() => setActionError(null), 10000); // Show errors longer
      }
    } catch (err: any) {
      setActionError(err.message || 'Action failed');
      setTimeout(() => setActionError(null), 5000);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: 0, marginBottom: '8px', color: '#fff' }}>Moderation Actions</h2>
        <p style={{ margin: 0, color: '#888', fontSize: '14px' }}>
          Perform moderation actions on viewers. Actions are state-aware and check live Twitch ban status.
        </p>
      </div>

      {/* Search Bar with Autocomplete */}
      <div ref={dropdownRef} style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search for a viewer by display name or ID..."
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          style={{
            width: '100%',
            padding: '12px',
            fontSize: '14px',
            border: '1px solid #333',
            borderRadius: '4px',
            backgroundColor: '#2a2a2a',
            color: '#fff',
            boxSizing: 'border-box'
          }}
        />

        {/* Autocomplete Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#1e1e1e',
            border: '1px solid #333',
            borderTop: 'none',
            borderRadius: '0 0 4px 4px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000
          }}>
            {searchResults.map(viewer => (
              <div
                key={viewer.id}
                onClick={() => handleViewerSelect(viewer)}
                style={{
                  padding: '10px 12px',
                  cursor: 'pointer',
                  borderBottom: '1px solid #333',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = '#333';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                }}
              >
                <div style={{ fontWeight: 'bold', color: '#9147ff' }}>
                  {viewer.display_name || 'Unknown'}
                </div>
                <div style={{ fontSize: '11px', color: '#888' }}>
                  ID: {viewer.id}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          Loading viewer...
        </div>
      )}

      {/* No Viewer Selected */}
      {!loading && !selectedViewer && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <div style={{ fontSize: '16px' }}>Search for a viewer to perform moderation actions</div>
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
            Start typing a display name or user ID
          </div>
        </div>
      )}

      {/* Viewer Selected */}
      {!loading && selectedViewer && (
        <div>
          {/* Viewer Header */}
          <div style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
              <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#fff' }}>
                {selectedViewer.display_name || 'Unknown'}
              </div>
              <div style={{ fontSize: '12px', color: '#888' }}>
                ID: {selectedViewer.id}
              </div>
            </div>

            {/* Current Status Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '16px'
            }}>
              {/* Live Twitch Ban Status */}
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>
                  Live Twitch Status
                </div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {liveBanStatus === null ? (
                    <span style={{ color: '#888' }}>Checking...</span>
                  ) : liveBanStatus.isBanned ? (
                    <span style={{ color: '#dc3545' }}>⛔ BANNED</span>
                  ) : liveBanStatus.isTimedOut ? (
                    <span style={{ color: '#ffc107' }}>⏱️ TIMED OUT</span>
                  ) : (
                    <span style={{ color: '#28a745' }}>✓ Not Banned</span>
                  )}
                  {liveBanStatus?.expiresAt && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      Expires: {new Date(liveBanStatus.expiresAt).toLocaleString()}
                    </div>
                  )}
                  {liveBanStatus?.reason && (
                    <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                      Reason: {liveBanStatus.reason}
                    </div>
                  )}
                </div>
              </div>

              {/* DB Moderation Status */}
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>DB Moderation Status</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {selectedViewer.moderation_status === 'banned' && (
                    <span style={{ color: '#dc3545' }}>Banned</span>
                  )}
                  {selectedViewer.moderation_status === 'timeout' && (
                    <span style={{ color: '#ffc107' }}>Timeout</span>
                  )}
                  {!selectedViewer.moderation_status || selectedViewer.moderation_status === 'none' ? (
                    <span style={{ color: '#888' }}>None</span>
                  ) : null}
                </div>
              </div>

              {/* Roles */}
              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Roles</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {selectedViewer.is_moderator && (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: '#51cf66',
                      color: 'white'
                    }}>
                      MOD
                    </span>
                  )}
                  {selectedViewer.is_vip && (
                    <span style={{
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 'bold',
                      backgroundColor: '#ff69b4',
                      color: 'white'
                    }}>
                      VIP
                    </span>
                  )}
                  {!selectedViewer.is_moderator && !selectedViewer.is_vip && (
                    <span style={{ fontSize: '14px', color: '#888' }}>None</span>
                  )}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Follower Status</div>
                <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                  {selectedViewer.is_follower ? (
                    <span style={{ color: '#9147ff' }}>Following</span>
                  ) : (
                    <span style={{ color: '#888' }}>Not Following</span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Action Messages */}
          {actionMessage && (
            <div style={{
              padding: '12px',
              backgroundColor: '#1a3a1a',
              color: '#28a745',
              border: '1px solid #28a745',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              {actionMessage}
            </div>
          )}

          {actionError && (
            <div style={{
              padding: '12px',
              backgroundColor: '#3a1a1a',
              color: '#dc3545',
              border: '1px solid #dc3545',
              borderRadius: '4px',
              marginBottom: '10px'
            }}>
              {actionError}
            </div>
          )}

          {/* Moderation Actions Section */}
          <div style={{
            backgroundColor: '#2a2a2a',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px'
          }}>
            <h3 style={{ margin: '0 0 16px 0', color: '#fff', fontSize: '16px' }}>
              🛡️ Moderation Actions
            </h3>

            {/* Ban/Timeout Section */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{
                display: 'flex',
                gap: '10px',
                marginBottom: '12px',
                flexWrap: 'wrap'
              }}>
                <button
                  onClick={() => handleAction('ban')}
                  disabled={actionLoading || liveBanStatus?.isBanned || !broadcasterId}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: liveBanStatus?.isBanned ? '#555' : '#dc3545',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: liveBanStatus?.isBanned || actionLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    opacity: liveBanStatus?.isBanned || actionLoading ? 0.5 : 1
                  }}
                >
                  {actionLoading ? '⏳ Processing...' : '⛔ Ban User'}
                </button>

                <button
                  onClick={() => handleAction('unban')}
                  disabled={actionLoading || (!liveBanStatus?.isBanned && !liveBanStatus?.isTimedOut) || !broadcasterId}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: (!liveBanStatus?.isBanned && !liveBanStatus?.isTimedOut) ? '#555' : '#28a745',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (!liveBanStatus?.isBanned && !liveBanStatus?.isTimedOut) || actionLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    opacity: (!liveBanStatus?.isBanned && !liveBanStatus?.isTimedOut) || actionLoading ? 0.5 : 1
                  }}
                >
                  {actionLoading ? '⏳ Processing...' : '✓ Unban User'}
                </button>

                <button
                  onClick={() => handleAction('timeout')}
                  disabled={actionLoading || liveBanStatus?.isBanned || liveBanStatus?.isTimedOut || !broadcasterId}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) ? '#555' : '#ffc107',
                    color: '#000',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) || actionLoading ? 'not-allowed' : 'pointer',
                    fontSize: '14px',
                    fontWeight: 'bold',
                    opacity: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) || actionLoading ? 0.5 : 1
                  }}
                >
                  {actionLoading ? '⏳ Processing...' : '⏱️ Timeout User'}
                </button>
              </div>

              {/* Timeout Duration Selector */}
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                  Timeout Duration
                </label>
                <select
                  value={timeoutDuration}
                  onChange={(e) => setTimeoutDuration(Number(e.target.value))}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    backgroundColor: '#1e1e1e',
                    color: '#fff'
                  }}
                >
                  <option value={60}>1 minute</option>
                  <option value={300}>5 minutes</option>
                  <option value={600}>10 minutes</option>
                  <option value={1800}>30 minutes</option>
                  <option value={3600}>1 hour</option>
                  <option value={86400}>24 hours</option>
                  <option value={604800}>7 days</option>
                </select>
              </div>

              {/* Reason Input */}
              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#888', marginBottom: '6px' }}>
                  Reason (optional)
                </label>
                <input
                  type="text"
                  placeholder="Enter reason for ban/timeout..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px',
                    fontSize: '14px',
                    border: '1px solid #333',
                    borderRadius: '4px',
                    backgroundColor: '#1e1e1e',
                    color: '#fff',
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Role Management Section */}
            <div style={{ borderTop: '1px solid #444', paddingTop: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '14px' }}>
                👥 Role Management
              </h4>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {/* VIP Toggle */}
                {selectedViewer.is_vip ? (
                  <button
                    onClick={() => handleAction('remove-vip')}
                    disabled={actionLoading || !broadcasterId}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      opacity: actionLoading ? 0.5 : 1
                    }}
                  >
                    ➖ Remove VIP
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('add-vip')}
                    disabled={actionLoading || !broadcasterId}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#ff69b4',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      opacity: actionLoading ? 0.5 : 1
                    }}
                  >
                    ➕ Add VIP
                  </button>
                )}

                {/* Moderator Toggle */}
                {selectedViewer.is_moderator ? (
                  <button
                    onClick={() => handleAction('remove-mod')}
                    disabled={actionLoading || !broadcasterId}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#dc3545',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      opacity: actionLoading ? 0.5 : 1
                    }}
                  >
                    ➖ Remove Moderator
                  </button>
                ) : (
                  <button
                    onClick={() => handleAction('add-mod')}
                    disabled={actionLoading || !broadcasterId}
                    style={{
                      padding: '8px 16px',
                      backgroundColor: '#51cf66',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: actionLoading ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      opacity: actionLoading ? 0.5 : 1
                    }}
                  >
                    ➕ Add Moderator
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Action History */}
          {actionHistory.length > 0 && (
            <div style={{
              backgroundColor: '#2a2a2a',
              borderRadius: '8px',
              padding: '16px'
            }}>
              <h3 style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px' }}>
                📜 Session Action History
              </h3>
              <div style={{ fontSize: '12px', color: '#666', marginBottom: '12px' }}>
                Last {Math.min(actionHistory.length, 10)} actions this session
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {actionHistory.map((item, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '10px',
                      backgroundColor: '#1e1e1e',
                      borderRadius: '4px',
                      marginBottom: '8px',
                      borderLeft: '3px solid #9147ff'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: '#fff' }}>
                        {item.action}
                      </span>
                      <span style={{ fontSize: '11px', color: '#888' }}>
                        {item.timestamp.toLocaleTimeString()}
                      </span>
                    </div>
                    <div style={{ fontSize: '13px', color: '#9147ff' }}>
                      {item.viewerName}
                    </div>
                    {item.details && (
                      <div style={{ fontSize: '12px', color: '#888', marginTop: '4px' }}>
                        {item.details}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
