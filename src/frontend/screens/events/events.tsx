import React, { useState, useEffect } from 'react';
import * as db from '../../services/database';
import { EVENT_DISPLAY_INFO } from '../../config/event-types';

const { ipcRenderer } = window.require('electron');

interface EventsScreenProps {
  channelId?: string;
}

export const EventsScreen: React.FC<EventsScreenProps> = ({ channelId }) => {
  const [events, setEvents] = useState<db.StoredEvent[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [eventTypeFilter, setEventTypeFilter] = useState<string>('');
  const [searchText, setSearchText] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  
  // Pagination
  const [limit] = useState<number>(50);
  const [offset, setOffset] = useState<number>(0);
  const [totalCount, setTotalCount] = useState<number>(0);

  // Selected event for detail view
  const [selectedEvent, setSelectedEvent] = useState<db.StoredEvent | null>(null);

  // Load events
  const loadEvents = async () => {
    setLoading(true);
    setError(null);

    try {
      const filters: db.EventFilters = {
        limit,
        offset
      };

      if (channelId) {
        filters.channelId = channelId;
      }

      if (eventTypeFilter) {
        filters.eventType = eventTypeFilter;
      }

      if (searchText) {
        filters.searchText = searchText;
      }

      if (startDate) {
        filters.startDate = new Date(startDate).toISOString();
      }

      if (endDate) {
        filters.endDate = new Date(endDate).toISOString();
      }

      const result = await db.getEvents(filters);
      
      if (result.success && result.events) {
        setEvents(result.events);
      } else {
        setError(result.error || 'Failed to load events');
      }

      // Get total count
      const countResult = await db.getEventCount(channelId, eventTypeFilter);
      if (countResult.success && countResult.count !== undefined) {
        setTotalCount(countResult.count);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  // Load events on mount and when filters change
  useEffect(() => {
    loadEvents();
  }, [channelId, eventTypeFilter, searchText, startDate, endDate, offset]);

  // Listen for real-time event updates
  useEffect(() => {
    const handleNewEvent = (_event: any, eventData: any) => {
      console.log('[Events Screen] New event received:', eventData);
      
      // Only add events from our current channel if channelId is set
      if (channelId && eventData.channel_id !== channelId) {
        return;
      }
      
      // If we have filters active, just refresh to re-query with filters
      // Otherwise, if on first page with no filters, prepend the new event
      if (eventTypeFilter || searchText || startDate || endDate || offset > 0) {
        // Refresh to respect filters
        loadEvents();
      } else {
        // Add to beginning of list if on first page
        const newEvent: db.StoredEvent = {
          id: eventData.id,
          event_type: eventData.event_type,
          event_data: typeof eventData.event_data === 'string' 
            ? eventData.event_data 
            : JSON.stringify(eventData.event_data),
          viewer_id: eventData.viewer_id || null,
          channel_id: eventData.channel_id,
          created_at: eventData.created_at || new Date().toISOString(),
          viewer_username: eventData.viewer_username,
          viewer_display_name: eventData.viewer_display_name
        };
        
        setEvents(prev => {
          // Check if event already exists (deduplicate by id)
          if (prev.some(evt => evt.id === newEvent.id)) {
            console.log('[Events Screen] Duplicate event detected, skipping:', newEvent.id);
            return prev;
          }
          
          const updated = [newEvent, ...prev];
          // Limit to our page size
          if (updated.length > limit) {
            return updated.slice(0, limit);
          }
          return updated;
        });
        
        // Update total count
        setTotalCount(prev => prev + 1);
      }
    };

    ipcRenderer.on('event:stored', handleNewEvent);

    return () => {
      ipcRenderer.removeListener('event:stored', handleNewEvent);
    };
  }, [channelId, eventTypeFilter, searchText, startDate, endDate, offset, limit]);

  const handleClearFilters = () => {
    setEventTypeFilter('');
    setSearchText('');
    setStartDate('');
    setEndDate('');
    setOffset(0);
  };

  const handlePreviousPage = () => {
    if (offset >= limit) {
      setOffset(offset - limit);
    }
  };

  const handleNextPage = () => {
    if (offset + limit < totalCount) {
      setOffset(offset + limit);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    // Show local time (24-hour format)
    const localTime = date.toLocaleString(undefined, {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
    return localTime;
  };

  const parseEventData = (eventDataString: string) => {
    try {
      return JSON.parse(eventDataString);
    } catch {
      return {};
    }
  };

  const getEventDisplayName = (eventType: string) => {
    const info = EVENT_DISPLAY_INFO[eventType as keyof typeof EVENT_DISPLAY_INFO];
    return info ? info.name : eventType;
  };

  const renderEventPreview = (event: db.StoredEvent) => {
    const data = parseEventData(event.event_data);
    
    // For IRC events, get username from event_data if not in viewer fields
    let displayName = event.viewer_display_name || event.viewer_username;
    if (!displayName && (event.event_type === 'irc.chat.join' || event.event_type === 'irc.chat.part')) {
      displayName = data.username;
    }
    if (!displayName) {
      displayName = 'Unknown';
    }

    switch (event.event_type) {
      case 'channel.chat.message':
        return (
          <span>
            <strong>{displayName}:</strong> {data.message?.text || ''}
          </span>
        );
      case 'irc.chat.join':
        return (
          <span>
            <strong style={{ color: '#4CAF50' }}>→ {displayName}</strong> joined the chat
          </span>
        );
      case 'irc.chat.part':
        return (
          <span>
            <strong style={{ color: '#f44336' }}>← {displayName}</strong> left the chat
          </span>
        );
      case 'stream.online':
        return (
          <span>
            <strong style={{ color: '#9146FF' }}>🔴 Stream went live</strong>
            {data.type && ` (${data.type})`}
            {data.started_at && ` at ${new Date(data.started_at).toLocaleTimeString()}`}
          </span>
        );
      case 'stream.offline':
        return (
          <span>
            <strong style={{ color: '#808080' }}>⚫ Stream ended</strong>
          </span>
        );
      case 'channel.raid':
        return (
          <span>
            <strong>{displayName}</strong> raided with {data.viewers || 0} viewers
          </span>
        );
      case 'channel.subscribe':
        return (
          <span>
            <strong>{displayName}</strong> subscribed (Tier {data.tier || 1})
          </span>
        );
      case 'channel.cheer':
        return (
          <span>
            <strong>{displayName}</strong> cheered {data.bits || 0} bits
          </span>
        );
      default:
        return (
          <span>
            {displayName && displayName !== 'Unknown' && <><strong>{displayName}</strong> - </>}
            {event.event_type}
          </span>
        );
    }
  };

  return (
    <div className="content">
      <h2>Events</h2>

      {/* Filters */}
      <div style={{ marginBottom: '20px', padding: '15px', backgroundColor: '#2a2a2a', borderRadius: '4px' }}>
        <h3 style={{ marginTop: 0 }}>Filters</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Event Type:</label>
            <select 
              value={eventTypeFilter} 
              onChange={(e) => setEventTypeFilter(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            >
              <option value="">All Types</option>
              {Object.keys(EVENT_DISPLAY_INFO).map(type => (
                <option key={type} value={type}>
                  {getEventDisplayName(type)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Search:</label>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search in event data..."
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>Start Date:</label>
            <input
              type="datetime-local"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '5px' }}>End Date:</label>
            <input
              type="datetime-local"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #555', backgroundColor: '#333', color: 'white' }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            onClick={handleClearFilters}
            style={{ padding: '8px 16px', backgroundColor: '#555', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Clear Filters
          </button>
          <button 
            onClick={loadEvents}
            style={{ padding: '8px 16px', backgroundColor: '#9147ff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Status */}
      <div style={{ marginBottom: '10px', color: '#888' }}>
        Showing {events.length} of {totalCount} events
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px', backgroundColor: '#ff4444', color: 'white', borderRadius: '4px', marginBottom: '10px' }}>
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '20px', color: '#888' }}>
          Loading events...
        </div>
      )}

      {/* Events List */}
      {!loading && events.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888' }}>
          No events found. Try adjusting your filters or connect to Twitch to start capturing events.
        </div>
      )}

      {!loading && events.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#2a2a2a' }}>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Time</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Type</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Details</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>User</th>
                <th style={{ padding: '10px', textAlign: 'left', borderBottom: '2px solid #555' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr 
                  key={event.id} 
                  style={{ 
                    backgroundColor: event.id === selectedEvent?.id ? '#333' : 'transparent',
                    borderBottom: '1px solid #333',
                    cursor: 'pointer'
                  }}
                  onClick={() => setSelectedEvent(event)}
                >
                  <td style={{ padding: '10px' }}>{formatDate(event.created_at)}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      backgroundColor: '#9147ff', 
                      borderRadius: '4px', 
                      fontSize: '0.85em' 
                    }}>
                      {getEventDisplayName(event.event_type)}
                    </span>
                  </td>
                  <td style={{ padding: '10px' }}>{renderEventPreview(event)}</td>
                  <td style={{ padding: '10px' }}>
                    {(() => {
                      // For IRC events, get username from event_data if not in viewer fields
                      const displayName = event.viewer_display_name || event.viewer_username;
                      if (displayName) return displayName;
                      
                      const data = parseEventData(event.event_data);
                      if ((event.event_type === 'irc.chat.join' || event.event_type === 'irc.chat.part') && data.username) {
                        return data.username;
                      }
                      return '-';
                    })()}
                  </td>
                  <td style={{ padding: '10px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvent(event);
                      }}
                      style={{ 
                        padding: '4px 8px', 
                        backgroundColor: '#555', 
                        color: 'white', 
                        border: 'none', 
                        borderRadius: '4px', 
                        cursor: 'pointer',
                        fontSize: '0.85em'
                      }}
                    >
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && events.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <button
            onClick={handlePreviousPage}
            disabled={offset === 0}
            style={{
              padding: '8px 16px',
              backgroundColor: offset === 0 ? '#333' : '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: offset === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Previous
          </button>
          
          <span style={{ color: '#888' }}>
            Page {Math.floor(offset / limit) + 1} of {Math.ceil(totalCount / limit)}
          </span>
          
          <button
            onClick={handleNextPage}
            disabled={offset + limit >= totalCount}
            style={{
              padding: '8px 16px',
              backgroundColor: offset + limit >= totalCount ? '#333' : '#9147ff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: offset + limit >= totalCount ? 'not-allowed' : 'pointer'
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Event Detail Modal */}
      {selectedEvent && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setSelectedEvent(null)}
        >
          <div 
            style={{
              backgroundColor: '#1e1e1e',
              padding: '20px',
              borderRadius: '8px',
              maxWidth: '800px',
              maxHeight: '80vh',
              overflow: 'auto',
              width: '90%'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h3 style={{ margin: 0 }}>{getEventDisplayName(selectedEvent.event_type)}</h3>
              <button
                onClick={() => setSelectedEvent(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#555',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Close
              </button>
            </div>

            <div style={{ marginBottom: '15px' }}>
              <strong>Time:</strong> {formatDate(selectedEvent.created_at)}
            </div>

            {(() => {
              // Get username from viewer fields or event_data for IRC events
              const displayName = selectedEvent.viewer_display_name || selectedEvent.viewer_username;
              const data = parseEventData(selectedEvent.event_data);
              const ircUsername = (selectedEvent.event_type === 'irc.chat.join' || selectedEvent.event_type === 'irc.chat.part') 
                ? data.username 
                : null;
              
              if (displayName || ircUsername) {
                return (
                  <div style={{ marginBottom: '15px' }}>
                    <strong>User:</strong> {displayName || ircUsername}
                    {selectedEvent.viewer_id && ` (ID: ${selectedEvent.viewer_id})`}
                  </div>
                );
              }
              return null;
            })()}

            <div style={{ marginBottom: '15px' }}>
              <strong>Channel ID:</strong> {selectedEvent.channel_id}
            </div>

            <div>
              <strong>Event Data:</strong>
              <pre style={{
                backgroundColor: '#2a2a2a',
                padding: '15px',
                borderRadius: '4px',
                overflow: 'auto',
                marginTop: '10px'
              }}>
                {JSON.stringify(parseEventData(selectedEvent.event_data), null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
