import React, { useState, useEffect } from 'react';
import * as db from '../../services/database';

export const ViewersScreen: React.FC = () => {
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

      // Get total count
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
  }, [searchQuery]);  // Listen for EventSub role changes and refresh viewers
  useEffect(() => {
    const { ipcRenderer } = window.require('electron');
    
    const handleRoleChanged = (event: any, data: any) => {
      console.log('[Viewers] Role changed event received:', data);
      // Reload viewers immediately to show updated roles
      loadViewers();
    };
    
    // Listen for explicit role change notifications
    ipcRenderer.on('eventsub:role-changed', handleRoleChanged);
    
    return () => {
      ipcRenderer.removeListener('eventsub:role-changed', handleRoleChanged);
    };
  }, []);

  const handleDeleteViewer = async (id: string) => {
    if (!confirm('Are you sure you want to delete this viewer? This will also remove them from associated events.')) {
      return;
    }

    try {
      const result = await db.deleteViewer(id);
      if (result.success) {
        setViewers(prev => prev.filter(v => v.id !== id));
        setTotalCount(prev => prev - 1);
      } else {
        alert(result.error || 'Failed to delete viewer');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete viewer');
    }
  };

  const handleDeleteAllViewers = async () => {
    if (!confirm('Are you sure you want to delete ALL viewers? This cannot be undone!')) {
      return;
    }

    if (!confirm('This will delete all viewer data. Are you ABSOLUTELY sure?')) {
      return;
    }

    try {
      const result = await db.deleteAllViewers();
      if (result.success) {
        setViewers([]);
        setTotalCount(0);
      } else {
        alert(result.error || 'Failed to delete all viewers');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to delete all viewers');
    }
  };

  const handleSyncFromTwitch = async () => {
    setSyncing(true);
    setSyncMessage(null);
    setError(null);

    try {
      const { ipcRenderer } = window.require('electron');
      const result = await ipcRenderer.invoke('twitch:sync-subscriptions-from-twitch');

      if (result.success) {
        const message = `✓ Synced successfully: ${result.subCount || 0} subscribers, ${result.vipCount || 0} VIPs, ${result.modCount || 0} moderators`;
        setSyncMessage(message);
        
        // Reload viewers to show updated data
        await loadViewers();
        
        // Clear message after 5 seconds
        setTimeout(() => setSyncMessage(null), 5000);
      } else {
        setError(result.error || 'Failed to sync from Twitch');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sync from Twitch');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="content">
      <h2>Viewers</h2>      {/* Search and Actions */}
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
        </button>
        <button
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
        <button
          onClick={handleDeleteAllViewers}
          style={{
            padding: '10px 20px',
            backgroundColor: '#ff4444',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Delete All
        </button>
      </div>

      {/* Sync Success Message */}
      {syncMessage && (
        <div style={{
          padding: '12px',
          backgroundColor: '#1a3a1a',
          color: '#28a745',
          border: '1px solid #28a745',
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
      )}      {/* Viewers Table */}
      {!loading && viewers.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Display Name</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Roles</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Subscription Status</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>First Seen</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Last Updated</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Actions</th>
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
                  style={{
                    borderBottom: '1px solid #333'
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
                    <span style={{
                      color: viewer.tier ? '#ffd700' : '#888',
                      fontWeight: viewer.tier ? 'bold' : 'normal'
                    }}>
                      {viewer.subscription_status}
                    </span>
                  </td>
                  <td style={{ padding: '10px', fontSize: '0.9em' }}>
                    {formatDate(viewer.created_at)}
                  </td>
                  <td style={{ padding: '10px', fontSize: '0.9em' }}>
                    {formatDate(viewer.updated_at)}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={() => handleDeleteViewer(viewer.id)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: '#ff4444',
                        color: 'white',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '0.85em'
                      }}
                    >
                      Delete                    </button>
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
