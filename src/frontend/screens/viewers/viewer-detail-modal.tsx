/**
 * Viewer Detail Modal
 * Displays comprehensive viewer history, statistics, and action controls
 */

import React, { useState, useEffect } from 'react';
import * as db from '../../services/database';

interface ViewerDetailModalProps {
  viewer: db.ViewerWithSubscription;
  isOpen: boolean;
  onClose: () => void;
  onActionComplete: () => void;
  broadcasterId?: string;
  accessToken?: string;
  clientId?: string;
}

interface TimelineEvent {
  id: number;
  timestamp: string;
  category: 'role' | 'moderation' | 'subscription' | 'event' | 'follow';
  action: string;
  description: string;
  details: Record<string, any>;
}

interface ViewerHistory {
  viewerId: string;
  displayName: string | null;
  currentStatus: {
    moderation: string | null;
    followed: boolean;
    roles: string[];
    subscriptionStatus: string | null;
  };
  timeline: TimelineEvent[];
}

const getCategoryColor = (category: string): string => {
  switch (category) {
    case 'role':
      return '#51cf66';
    case 'moderation':
      return '#ff6b6b';
    case 'subscription':
      return '#ffd700';
    case 'follow':
      return '#9147ff';
    case 'event':
      return '#2196f3';
    default:
      return '#666';
  }
};

const getCategoryIcon = (category: string): string => {
  switch (category) {
    case 'role':
      return '👤';
    case 'moderation':
      return '⚠️';
    case 'subscription':
      return '🎁';
    case 'follow':
      return '👥';
    case 'event':
      return '🔔';
    default:
      return '📝';
  }
};

export const ViewerDetailModal: React.FC<ViewerDetailModalProps> = ({
  viewer,
  isOpen,
  onClose,
  onActionComplete,
  broadcasterId = '',
  accessToken = '',
  clientId = ''
}) => {  const [history, setHistory] = useState<ViewerHistory | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showActionPanel, setShowActionPanel] = useState(false);
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [actionReason, setActionReason] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState(300); // 5 minutes default
  const [liveBanStatus, setLiveBanStatus] = useState<{
    isBanned: boolean;
    isTimedOut: boolean;
    expiresAt: string | null;
    reason: string | null;
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadViewerDetails();
      checkLiveBanStatus();
    }
  }, [isOpen, viewer.id]);

  const checkLiveBanStatus = async () => {
    try {
      const status = await db.checkViewerBanStatus(viewer.id);
      setLiveBanStatus(status);
    } catch (err) {
      console.error('Failed to check ban status:', err);
      setLiveBanStatus(null);
    }
  };const debugDatabase = async () => {
    console.log('=== DEBUG DATABASE FOR VIEWER:', viewer.id, '(' + viewer.display_name + ') ===');
    console.log('Expected test viewer with data: 1362524977');
    console.log('Current viewer:', viewer.id === '1362524977' ? '✓ This is the test viewer!' : '✗ This is NOT the test viewer (no history expected)');
    
    try {
      const debugData = await db.debugViewerData(viewer.id);
      console.log('Raw Database Data:', JSON.stringify(debugData, null, 2));
      
      // Access data from wrapped response
      const data = debugData.data || debugData;
      console.log('Viewer:', data.viewer);
      console.log('Moderation History:', data.moderation);
      console.log('Roles:', data.roles);
      console.log('Follower History:', data.follower);
      console.log('Subscriptions:', data.subscriptions);
      console.log('Status:', data.status);
      console.log('Recent Events:', data.events);
      
      const totalEvents = (data.moderation?.length || 0) + (data.roles?.length || 0) + (data.follower?.length || 0);
      alert(`Debug data logged to console (F12)\n\nViewer: ${viewer.display_name} (${viewer.id})\nTotal events in DB: ${totalEvents}`);
    } catch (err: any) {
      console.error('Debug failed:', err);
      alert('Debug failed: ' + err.message);
    }
  };
  const loadViewerDetails = async () => {
    setLoading(true);
    setActionMessage(null);
    setActionError(null);

    try {
      const historyResponse = await db.getViewerDetailedHistory(viewer.id);
      const statsResponse = await db.getViewerStats(viewer.id);
      
      console.log('[ViewerModal] History response received:', historyResponse);
      console.log('[ViewerModal] Stats response received:', statsResponse);
      
      // Unwrap the response if it's wrapped in { success, data }
      const historyData = historyResponse?.data || historyResponse;
      const statsData = statsResponse?.data || statsResponse;
      
      if (historyData && !historyData.error) {
        console.log('[ViewerModal] Setting history with timeline length:', historyData.timeline?.length);
        setHistory(historyData);
      } else {
        console.warn('[ViewerModal] History data invalid or has error:', historyData);
      }
      setStats(statsData);
    } catch (err: any) {
      console.error('[ViewerModal] Error loading details:', err);
      setActionError(err.message || 'Failed to load viewer details');
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (actionType: string) => {
    if (!broadcasterId || !accessToken || !clientId) {
      setActionError('Missing credentials for moderation action');
      return;
    }

    setActionLoading(true);
    setActionMessage(null);
    setActionError(null);

    try {
      let result: any = null;

      switch (actionType) {
        case 'ban':
          result = await db.banViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            actionReason,
            accessToken,
            clientId
          );
          break;
        case 'unban':
          result = await db.unbanViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          break;
        case 'timeout':
          result = await db.timeoutViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            timeoutDuration,
            actionReason,
            accessToken,
            clientId
          );
          break;
        case 'mod':
          result = await db.addModViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          break;
        case 'unmod':
          result = await db.removeModViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          break;
        case 'vip':
          result = await db.addVipViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          break;
        case 'unvip':
          result = await db.removeVipViewer(
            broadcasterId,
            viewer.id,
            viewer.display_name || 'Unknown',
            accessToken,
            clientId
          );
          break;      }

      // IPC framework wraps response: { success: true, data: { success, error, ... } }
      // So we need to check result.data.success, not result.success
      const actionResult = result?.data || result;      if (actionResult?.success) {
        setActionMessage(actionResult.message || `Action completed successfully`);
        setSelectedAction(null);
        setActionReason('');
        setTimeoutDuration(300);
        
        // Refresh ban status immediately
        await checkLiveBanStatus();
        
        // Reload history after action
        setTimeout(() => {
          loadViewerDetails();
          onActionComplete();
        }, 1500);
      } else {
        setActionError(actionResult?.error || result?.error || 'Action failed');
      }
    } catch (err: any) {
      setActionError(err.message || 'Failed to execute action');
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
      <div style={{
        backgroundColor: '#1a1a1a',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        maxHeight: '90vh',
        width: '90%',
        maxWidth: '1000px',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #333'
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid #333',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', color: '#fff' }}>
              {viewer.display_name || 'Unknown'}
            </h2>
            <div style={{ fontSize: '12px', color: '#888' }}>
              User ID: {viewer.id}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={debugDatabase}
              style={{
                padding: '8px 12px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#ff9800',
                color: '#fff',
                fontSize: '12px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              🐛 Debug DB
            </button>
            <button
              onClick={onClose}
              style={{
                width: '32px',
                height: '32px',
                border: 'none',
                borderRadius: '4px',
                backgroundColor: '#333',
                color: '#fff',
                fontSize: '18px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          gap: '20px',
          padding: '20px'
        }}>
          {/* Left Panel - Actions & Status */}
          <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Current Status */}
            <div style={{
              backgroundColor: '#222',
              borderRadius: '6px',
              padding: '16px',
              border: '1px solid #333'
            }}>
              <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                Current Status
              </h3>              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {history?.currentStatus?.moderation && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#ff6b6b',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    textTransform: 'uppercase'
                  }}>
                    ⚠️ {history.currentStatus.moderation.toUpperCase()}
                  </div>
                )}
                {history?.currentStatus?.followed && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#9147ff',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white'
                  }}>
                    👥 FOLLOWING
                  </div>
                )}
                {history?.currentStatus?.roles?.map((role) => (
                  <div key={role} style={{
                    padding: '8px',
                    backgroundColor: role === 'Moderator' ? '#51cf66' : role === 'VIP' ? '#ff69b4' : '#ff6b6b',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: 'white',
                    textTransform: 'uppercase'
                  }}>
                    {role}
                  </div>
                ))}
                {history?.currentStatus?.subscriptionStatus && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#ffd700',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    color: '#000',
                    textTransform: 'uppercase'
                  }}>
                    🎁 {history.currentStatus.subscriptionStatus}
                  </div>                )}
                {!history?.currentStatus?.moderation && 
                 !history?.currentStatus?.roles?.length && 
                 !history?.currentStatus?.subscriptionStatus && (
                  <div style={{ color: '#888', fontSize: '12px' }}>— No active status</div>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            {stats && (
              <div style={{
                backgroundColor: '#222',
                borderRadius: '6px',
                padding: '16px',
                border: '1px solid #333',
                fontSize: '12px'
              }}>
                <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
                  Statistics
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: '#aaa' }}>
                  <div>First Seen: <span style={{ color: '#fff' }}>{stats.firstSeen ? formatDate(stats.firstSeen) : '—'}</span></div>
                  <div>Total Events: <span style={{ color: '#fff' }}>{stats.totalEvents}</span></div>
                  <div>Mod Actions: <span style={{ color: '#fff' }}>{stats.moderationActions}</span></div>
                  <div>Role Changes: <span style={{ color: '#fff' }}>{stats.roleChanges}</span></div>
                </div>
              </div>
            )}

            {/* Action Panel Toggle */}
            <button
              onClick={() => setShowActionPanel(!showActionPanel)}
              style={{
                padding: '12px',
                backgroundColor: showActionPanel ? '#ff6b6b' : '#2196f3',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px'
              }}
            >
              {showActionPanel ? '✕ Close Actions' : '⚡ Moderation Actions'}
            </button>

            {/* Action Panel */}
            {showActionPanel && (
              <div style={{
                backgroundColor: '#222',
                borderRadius: '6px',
                padding: '12px',
                border: '1px solid #ff6b6b',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                {actionMessage && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#2d5a2d',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#51cf66',
                    border: '1px solid #51cf66'
                  }}>
                    ✓ {actionMessage}
                  </div>
                )}
                {actionError && (
                  <div style={{
                    padding: '8px',
                    backgroundColor: '#5a2d2d',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#ff6b6b',
                    border: '1px solid #ff6b6b'
                  }}>
                    ✕ {actionError}
                  </div>
                )}                {selectedAction === null && (
                  <>
                    <button
                      onClick={() => setSelectedAction('ban')}
                      disabled={actionLoading || liveBanStatus?.isBanned || liveBanStatus?.isTimedOut}
                      style={{
                        padding: '8px',
                        backgroundColor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) ? '#555' : '#ff6b6b',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) || actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) || actionLoading ? 0.6 : 1
                      }}
                    >
                      Ban User
                    </button>
                    <button
                      onClick={() => setSelectedAction('unban')}
                      disabled={actionLoading || (!liveBanStatus?.isBanned && !liveBanStatus?.isTimedOut)}
                      style={{
                        padding: '8px',
                        backgroundColor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) ? '#51cf66' : '#555',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) && !actionLoading ? 'pointer' : 'not-allowed',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) && !actionLoading ? 1 : 0.6
                      }}
                    >
                      Unban User
                    </button>
                    <button
                      onClick={() => setSelectedAction('timeout')}
                      disabled={actionLoading || liveBanStatus?.isBanned || liveBanStatus?.isTimedOut}
                      style={{
                        padding: '8px',
                        backgroundColor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) ? '#555' : '#f57c00',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) || actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: (liveBanStatus?.isBanned || liveBanStatus?.isTimedOut) || actionLoading ? 0.6 : 1
                      }}
                    >
                      Timeout User
                    </button>
                    <hr style={{ margin: '8px 0', borderColor: '#333' }} />
                    <button
                      onClick={() => setSelectedAction('mod')}
                      disabled={actionLoading}
                      style={{
                        padding: '8px',
                        backgroundColor: '#51cf66',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      Add Mod
                    </button>
                    <button
                      onClick={() => setSelectedAction('unmod')}
                      disabled={actionLoading}
                      style={{
                        padding: '8px',
                        backgroundColor: '#888',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      Remove Mod
                    </button>
                    <hr style={{ margin: '8px 0', borderColor: '#333' }} />
                    <button
                      onClick={() => setSelectedAction('vip')}
                      disabled={actionLoading}
                      style={{
                        padding: '8px',
                        backgroundColor: '#ff69b4',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      Add VIP
                    </button>
                    <button
                      onClick={() => setSelectedAction('unvip')}
                      disabled={actionLoading}
                      style={{
                        padding: '8px',
                        backgroundColor: '#888',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      Remove VIP
                    </button>
                  </>
                )}

                {selectedAction && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button
                      onClick={() => setSelectedAction(null)}
                      style={{
                        padding: '6px',
                        backgroundColor: '#333',
                        color: '#aaa',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '11px'
                      }}
                    >
                      ← Back
                    </button>

                    {(selectedAction === 'ban' || selectedAction === 'timeout') && (
                      <input
                        type="text"
                        placeholder="Reason (optional)"
                        value={actionReason}
                        onChange={(e) => setActionReason(e.target.value)}
                        style={{
                          padding: '6px',
                          backgroundColor: '#333',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '11px'
                        }}
                      />
                    )}

                    {selectedAction === 'timeout' && (
                      <select
                        value={timeoutDuration}
                        onChange={(e) => setTimeoutDuration(parseInt(e.target.value))}
                        style={{
                          padding: '6px',
                          backgroundColor: '#333',
                          border: '1px solid #555',
                          borderRadius: '4px',
                          color: '#fff',
                          fontSize: '11px'
                        }}
                      >
                        <option value={60}>1 minute</option>
                        <option value={300}>5 minutes</option>
                        <option value={600}>10 minutes</option>
                        <option value={1800}>30 minutes</option>
                        <option value={3600}>1 hour</option>
                        <option value={86400}>1 day</option>
                        <option value={604800}>7 days</option>
                      </select>
                    )}

                    <button
                      onClick={() => handleAction(selectedAction)}
                      disabled={actionLoading}
                      style={{
                        padding: '8px',
                        backgroundColor: '#2196f3',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: actionLoading ? 'not-allowed' : 'pointer',
                        fontSize: '11px',
                        fontWeight: 'bold',
                        opacity: actionLoading ? 0.6 : 1
                      }}
                    >
                      {actionLoading ? 'Processing...' : 'Confirm Action'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>          {/* Right Panel - Timeline */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#fff' }}>
              Action Timeline ({history?.timeline?.length || 0})
            </h3>

            {loading ? (
              <div style={{ color: '#888', textAlign: 'center', padding: '40px 20px' }}>
                Loading history...
              </div>
            ) : history?.timeline && history.timeline.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                maxHeight: '100%',
                overflowY: 'auto'
              }}>
                {history.timeline.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      padding: '12px',
                      backgroundColor: '#222',
                      borderRadius: '6px',
                      border: `1px solid ${getCategoryColor(event.category)}`,
                      borderLeft: `4px solid ${getCategoryColor(event.category)}`
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                      <div style={{ fontSize: '16px', minWidth: '24px' }}>
                        {getCategoryIcon(event.category)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: getCategoryColor(event.category) }}>
                          {event.description}
                        </div>
                        <div style={{ fontSize: '11px', color: '#888', marginTop: '2px' }}>
                          {formatDate(event.timestamp)}
                        </div>
                        {event.details && Object.keys(event.details).length > 0 && (
                          <div style={{
                            fontSize: '10px',
                            color: '#aaa',
                            marginTop: '6px',
                            backgroundColor: '#1a1a1a',
                            padding: '6px',
                            borderRadius: '3px',
                            fontFamily: "'Courier New', monospace",
                            maxHeight: '60px',
                            overflowY: 'auto'
                          }}>
                            {Object.entries(event.details)
                              .filter(([, v]) => v !== null && v !== undefined)
                              .map(([key, value]) => (
                                <div key={key}>
                                  <strong>{key}:</strong> {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: '#888', textAlign: 'center', padding: '40px 20px' }}>
                No action history yet
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
