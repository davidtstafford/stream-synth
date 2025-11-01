import React, { useState, useEffect, useRef } from 'react';
import * as db from '../../../services/database';

interface ViewerHistoryTabProps {
  preselectedViewerId?: string;
}

export const ViewerHistoryTab: React.FC<ViewerHistoryTabProps> = ({ preselectedViewerId }) => {
  const [selectedViewer, setSelectedViewer] = useState<db.ViewerWithSubscription | null>(null);
  const [history, setHistory] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<db.ViewerWithSubscription[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Load preselected viewer if provided
  useEffect(() => {
    if (preselectedViewerId) {
      loadViewerById(preselectedViewerId);
    }
  }, [preselectedViewerId]);

  // Search for viewers as user types
  useEffect(() => {
    const searchViewers = async () => {
      if (searchQuery.trim().length < 2) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      try {
        const result = await db.searchViewersWithStatus(searchQuery, 10);
        if (result.success && result.viewers) {
          setSearchResults(result.viewers);
          setShowDropdown(result.viewers.length > 0);
        }
      } catch (err) {
        console.error('[ViewerHistory] Search failed:', err);
      }
    };

    const debounce = setTimeout(searchViewers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadViewerById = async (viewerId: string) => {
    setLoading(true);
    try {
      // Get viewer details
      const viewersResult = await db.getAllViewersWithStatus(1000, 0);
      if (viewersResult.success && viewersResult.viewers) {
        const viewer = viewersResult.viewers.find(v => v.id === viewerId);
        if (viewer) {
          setSelectedViewer(viewer);
          await loadHistory(viewerId);
        }
      }
    } catch (err) {
      console.error('[ViewerHistory] Failed to load viewer:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async (viewerId: string) => {
    setLoading(true);
    try {
      const historyResponse = await db.getViewerDetailedHistory(viewerId);
      const historyData = historyResponse?.data || historyResponse;
      setHistory(historyData);
    } catch (err) {
      console.error('[ViewerHistory] Failed to load history:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewerSelect = async (viewer: db.ViewerWithSubscription) => {
    setSelectedViewer(viewer);
    setSearchQuery(viewer.display_name || '');
    setShowDropdown(false);
    await loadHistory(viewer.id);
  };

  const formatDate = (date: string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleString();
  };
  const renderCurrentStatus = () => {
    if (!selectedViewer) return null;
    
    return (
      <div style={{
        backgroundColor: '#2a2a2a',
        padding: '20px',
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <h3 style={{ margin: '0 0 15px 0', color: '#9147ff' }}>Current Status</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          {/* Moderation Status */}
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Moderation Status</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {selectedViewer.moderation_status === 'banned' && (
                <span style={{ color: '#d32f2f' }}>BANNED</span>
              )}
              {selectedViewer.moderation_status === 'timeout' && (
                <span style={{ color: '#f57c00' }}>TIMED OUT</span>
              )}
              {(!selectedViewer.moderation_status || selectedViewer.moderation_status === 'none') && (
                <span style={{ color: '#51cf66' }}>Active</span>
              )}
            </div>
            {selectedViewer.moderation_reason && (
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>
                Reason: {selectedViewer.moderation_reason}
              </div>
            )}
          </div>

          {/* Follower Status */}
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Follower Status</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {selectedViewer.is_follower ? (
                <span style={{ color: '#9147ff' }}>Following</span>
              ) : (
                <span style={{ color: '#888' }}>Not Following</span>
              )}
            </div>
            {selectedViewer.followed_at && (
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '3px' }}>
                Since: {formatDate(selectedViewer.followed_at)}
              </div>
            )}
          </div>

          {/* Roles */}
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Roles</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
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

          {/* Subscription */}
          <div>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '5px' }}>Subscription</div>
            <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
              {selectedViewer.tier ? (
                <span style={{ color: '#ffd700' }}>Tier {selectedViewer.tier}</span>
              ) : (
                <span style={{ color: '#888' }}>Not Subscribed</span>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTimeline = () => {
    if (!history?.timeline || history.timeline.length === 0) {
      return (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No action history yet
        </div>
      );
    }

    return (
      <div style={{ position: 'relative' }}>
        {/* Timeline line */}
        <div style={{
          position: 'absolute',
          left: '20px',
          top: '0',
          bottom: '0',
          width: '2px',
          backgroundColor: '#444'
        }} />

        {history.timeline.map((event: any, index: number) => (
          <div
            key={index}
            style={{
              position: 'relative',
              paddingLeft: '50px',
              paddingBottom: '20px'
            }}
          >
            {/* Timeline dot */}
            <div style={{
              position: 'absolute',
              left: '11px',
              top: '5px',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: event.category === 'moderation' ? '#d32f2f' :
                               event.category === 'roles' ? '#51cf66' :
                               event.category === 'follows' ? '#9147ff' :
                               '#666',
              border: '3px solid #1a1a1a'
            }} />

            {/* Event card */}
            <div style={{
              backgroundColor: '#2a2a2a',
              padding: '15px',
              borderRadius: '8px',
              border: '1px solid #444'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 'bold', color: '#9147ff' }}>
                  {event.action}
                </span>
                <span style={{ fontSize: '12px', color: '#888' }}>
                  {formatDate(event.timestamp)}
                </span>
              </div>

              {event.details && (
                <div style={{ fontSize: '13px', color: '#aaa' }}>
                  {typeof event.details === 'string' ? event.details : JSON.stringify(event.details, null, 2)}
                </div>
              )}

              {event.moderator && (
                <div style={{ fontSize: '11px', color: '#666', marginTop: '8px' }}>
                  By: {event.moderator}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      {/* Search Box */}
      <div ref={searchRef} style={{ position: 'relative', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Search for a viewer..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
          style={{
            width: '100%',
            padding: '12px',
            borderRadius: '4px',
            border: '1px solid #555',
            backgroundColor: '#333',
            color: 'white',
            fontSize: '14px'
          }}
        />

        {/* Autocomplete Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: '#2a2a2a',
            border: '1px solid #555',
            borderRadius: '0 0 4px 4px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            marginTop: '2px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.3)'
          }}>
            {searchResults.map((viewer) => (
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
          Loading viewer history...
        </div>
      )}

      {/* No Viewer Selected */}
      {!loading && !selectedViewer && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔍</div>
          <div style={{ fontSize: '16px' }}>Search for a viewer to view their history</div>
          <div style={{ fontSize: '12px', marginTop: '8px', color: '#666' }}>
            Start typing a display name or user ID
          </div>
        </div>
      )}

      {/* Viewer History */}
      {!loading && selectedViewer && (
        <div>
          {/* Viewer Header */}
          <div style={{
            backgroundColor: '#2a2a2a',
            padding: '20px',
            borderRadius: '8px',
            marginBottom: '20px'
          }}>
            <h2 style={{ margin: '0 0 8px 0', color: '#9147ff' }}>
              {selectedViewer.display_name || 'Unknown'}
            </h2>
            <div style={{ fontSize: '12px', color: '#888' }}>
              User ID: {selectedViewer.id}
            </div>
          </div>

          {/* Current Status */}
          {renderCurrentStatus()}

          {/* Timeline */}
          <div style={{
            backgroundColor: '#2a2a2a',
            padding: '20px',
            borderRadius: '8px'
          }}>
            <h3 style={{ margin: '0 0 20px 0', color: '#9147ff' }}>Activity Timeline</h3>
            {renderTimeline()}
          </div>
        </div>
      )}
    </div>
  );
};
