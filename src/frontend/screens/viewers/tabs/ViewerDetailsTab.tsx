import React, { useState, useEffect } from 'react';
import * as db from '../../../services/database';

interface ViewerDetailsTabProps {
  onViewerClick: (viewer: db.ViewerWithSubscription) => void;
}

export const ViewerDetailsTab: React.FC<ViewerDetailsTabProps> = ({ onViewerClick }) => {
  const [viewers, setViewers] = useState<db.ViewerWithSubscription[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number>(0);
  const [syncing, setSyncing] = useState<boolean>(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const loadViewers = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;
      if (searchQuery.trim()) {
        result = await db.searchViewersWithStatus(searchQuery, 100);
      } else {
        result = await db.getAllViewersWithStatus(100, 0);
      }

      if (result.success && result.viewers) {
        setViewers(result.viewers);
      } else {
        setError(result.error || 'Failed to load viewers');
      }

      const countResult = await db.getViewerCount();
      if (countResult.success && countResult.count !== undefined) {
        setTotalCount(countResult.count);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load viewers');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadViewers();
  }, [searchQuery]);

  // Listen for EventSub changes
  useEffect(() => {
    const { ipcRenderer } = window.require('electron');
    
    const handleRoleChanged = () => loadViewers();
    const handleModerationChanged = () => loadViewers();
    
    ipcRenderer.on('eventsub:role-changed', handleRoleChanged);
    ipcRenderer.on('eventsub:moderation-changed', handleModerationChanged);
    
    return () => {
      ipcRenderer.removeListener('eventsub:role-changed', handleRoleChanged);
      ipcRenderer.removeListener('eventsub:moderation-changed', handleModerationChanged);
    };
  }, []);
  const handleSyncFromTwitch = async () => {
    setSyncing(true);
    setSyncMessage(null);

    try {
      const session = await db.getCurrentSession();
      if (!session) {
        setSyncMessage('No active session found');
        return;
      }

      const token = await db.getToken(session.user_id);
      if (!token) {
        setSyncMessage('No OAuth token found');
        return;
      }

      // Use IPC directly like the original viewers screen
      const { ipcRenderer } = window.require('electron');
        // Sync roles (subscribers, VIPs, moderators)
      const roleResult = await ipcRenderer.invoke('twitch:sync-subscriptions-from-twitch');
      
      // Sync followers
      const followerResult = await ipcRenderer.invoke('twitch:sync-followers-from-twitch');
      
      // Sync blocked/banned viewers
      const blockedResult = await ipcRenderer.invoke('twitch:sync-moderation-status');      if (roleResult.success && followerResult.success && blockedResult.success) {
        setSyncMessage(`✓ Synced: ${roleResult.subCount || 0} subs, ${roleResult.vipCount || 0} VIPs, ${roleResult.modCount || 0} mods, ${followerResult.newFollowers || 0} new followers, blocked viewers updated`);
        await loadViewers();
        setTimeout(() => setSyncMessage(null), 5000);
      } else {
        setSyncMessage(`Error: ${roleResult.error || followerResult.error || blockedResult.error}`);
      }
    } catch (err: any) {
      setSyncMessage(`Error: ${err.message}`);    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString();
  };

  const renderModerationStatus = (viewer: db.ViewerWithSubscription) => {
    if (!viewer.moderation_status || viewer.moderation_status === 'none') {
      return <span style={{ color: '#888', fontSize: '12px' }}>—</span>;
    }

    let badge;
    if (viewer.moderation_status === 'banned') {
      badge = (
        <span style={{
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          backgroundColor: '#d32f2f',
          color: 'white'
        }}>
          BANNED
        </span>
      );
    } else if (viewer.moderation_status === 'timeout') {
      const expiresAt = viewer.moderation_expires_at 
        ? new Date(viewer.moderation_expires_at).toLocaleTimeString() 
        : '';
      badge = (
        <span style={{
          padding: '3px 8px',
          borderRadius: '4px',
          fontSize: '11px',
          fontWeight: 'bold',
          backgroundColor: '#f57c00',
          color: 'white'
        }} title={expiresAt ? `Expires: ${expiresAt}` : undefined}>
          TIMED OUT
        </span>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {badge}
        {viewer.moderation_reason && (
          <span style={{ fontSize: '11px', color: '#aaa', fontStyle: 'italic' }}>
            {viewer.moderation_reason}
          </span>
        )}
      </div>
    );
  };

  return (
    <div>
      {/* Search and Actions */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Search viewers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: 1,
            padding: '10px',
            borderRadius: '4px',
            border: '1px solid #555',
            backgroundColor: '#333',
            color: 'white'
          }}
        />
        <button
          onClick={handleSyncFromTwitch}
          disabled={syncing}
          style={{
            padding: '10px 20px',
            backgroundColor: syncing ? '#555' : '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: syncing ? 'not-allowed' : 'pointer',
            opacity: syncing ? 0.6 : 1,
            whiteSpace: 'nowrap'
          }}
          title="Sync subscribers, VIPs, and moderators from Twitch"
        >
          {syncing ? '⟳ Syncing...' : '⟳ Sync from Twitch'}
        </button>        <button
          onClick={loadViewers}
          style={{
            padding: '10px 20px',
            backgroundColor: '#9147ff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Refresh
        </button>
      </div>

      {/* Sync Success Message */}
      {syncMessage && (
        <div style={{
          padding: '12px',
          backgroundColor: syncMessage.startsWith('✓') ? '#1a3a1a' : '#3a1a1a',
          color: syncMessage.startsWith('✓') ? '#28a745' : '#ff4444',
          border: `1px solid ${syncMessage.startsWith('✓') ? '#28a745' : '#ff4444'}`,
          borderRadius: '4px',
          marginBottom: '10px',
          fontSize: '14px'
        }}>
          {syncMessage}
        </div>
      )}

      {/* Status */}
      <div style={{ marginBottom: '10px', color: '#888' }}>
        {searchQuery ? `Showing ${viewers.length} matching viewers` : `Total viewers: ${totalCount}`}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          padding: '10px',
          backgroundColor: '#ff4444',
          color: 'white',
          borderRadius: '4px',
          marginBottom: '10px'
        }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          Loading viewers...
        </div>
      )}

      {/* No Viewers */}
      {!loading && viewers.length === 0 && !searchQuery && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No viewers yet. Viewers are automatically added when they trigger events.
        </div>
      )}

      {!loading && viewers.length === 0 && searchQuery && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No viewers found matching "{searchQuery}"
        </div>
      )}

      {/* Viewers Table */}
      {!loading && viewers.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Display Name</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Roles</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Follower</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Moderation</th>                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Subscription Status</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>First Seen</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {viewers.map((viewer) => {
                const roles: string[] = [];
                if (viewer.is_broadcaster) roles.push('Broadcaster');
                if (viewer.is_moderator) roles.push('Moderator');
                if (viewer.is_vip) roles.push('VIP');
                
                return (
                  <tr
                    key={viewer.id}
                    onClick={() => onViewerClick(viewer)}
                    style={{
                      borderBottom: '1px solid #333',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#2a2a2a';
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }}
                  >
                    <td style={{ padding: '10px' }}>
                      <span style={{ color: '#9147ff', fontWeight: 'bold' }}>
                        {viewer.display_name || 'Unknown'}
                      </span>
                    </td>
                    <td style={{ padding: '10px' }}>
                      {roles.length > 0 ? (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                          {viewer.is_broadcaster && (
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 'bold',
                              backgroundColor: '#ff6b6b',
                              color: 'white'
                            }}>
                              BROADCASTER
                            </span>
                          )}
                          {viewer.is_moderator && (
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
                          {viewer.is_vip && (
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
                        </div>
                      ) : (
                        <span style={{ color: '#888', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {viewer.is_follower ? (
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 'bold',
                          backgroundColor: '#9147ff',
                          color: 'white'
                        }} title={viewer.followed_at ? `Followed: ${formatDate(viewer.followed_at)}` : 'Following'}>
                          FOLLOWING
                        </span>
                      ) : (
                        <span style={{ color: '#888', fontSize: '12px' }}>—</span>
                      )}
                    </td>
                    <td style={{ padding: '10px' }}>
                      {renderModerationStatus(viewer)}
                    </td>
                    <td style={{ padding: '10px' }}>
                      <span style={{
                        color: viewer.tier ? '#ffd700' : '#888',
                        fontWeight: viewer.tier ? 'bold' : 'normal'
                      }}>
                        {viewer.subscription_status}
                      </span>
                    </td>
                    <td style={{ padding: '10px', fontSize: '0.9em' }}>
                      {formatDate(viewer.created_at)}
                    </td>                    <td style={{ padding: '10px', fontSize: '0.9em' }}>
                      {formatDate(viewer.updated_at)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
