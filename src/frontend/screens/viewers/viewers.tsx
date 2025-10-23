import React, { useState, useEffect } from 'react';
import * as db from '../../services/database';

export const ViewersScreen: React.FC = () => {
  const [viewers, setViewers] = useState<db.Viewer[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [totalCount, setTotalCount] = useState<number>(0);

  const loadViewers = async () => {
    setLoading(true);
    setError(null);

    try {
      let result;
      if (searchQuery.trim()) {
        result = await db.searchViewers(searchQuery, 100);
      } else {
        result = await db.getAllViewers(100, 0);
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
  }, [searchQuery]);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="content">
      <h2>Viewers</h2>

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
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Username</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Display Name</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>ID</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>First Seen</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Last Updated</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {viewers.map((viewer) => (
                <tr
                  key={viewer.id}
                  style={{
                    borderBottom: '1px solid #333'
                  }}
                >
                  <td style={{ padding: '10px' }}>
                    <span style={{ color: '#9147ff', fontWeight: 'bold' }}>
                      {viewer.username}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>
                    {viewer.display_name || '-'}
                  </td>
                  <td style={{ padding: '10px', fontSize: '0.85em', color: '#888' }}>
                    {viewer.id}
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
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
