import React, { useState, useEffect } from 'react';
import * as eventsubService from '../../../services/eventsub';

interface EventSubDashboardProps {
  userId?: string;
  accessToken?: string;
  clientId?: string;
  broadcasterId?: string;
}

interface EventSubStatus {
  connected: boolean;
  sessionId: string | null;
  subscriptionCount: number;
  subscriptions: Array<{
    type: string;
    condition: Record<string, string>;
  }>;
  reconnectAttempts: number;
}

export const EventSubDashboard: React.FC<EventSubDashboardProps> = ({
  userId = '',
  accessToken = '',
  clientId = '',
  broadcasterId = ''
}) => {  const [status, setStatus] = useState<EventSubStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [recentEvents, setRecentEvents] = useState<Array<{ type: string; data: any; timestamp: number }>>([]);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await eventsubService.getEventSubStatus();
      if (response.success && response.result) {
        setStatus(response.result);
        setErrorMessage(null);
      } else {
        setErrorMessage(response.error || 'Failed to get status');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Error fetching status');
    } finally {
      setLoading(false);
    }
  };
  const handleInitialize = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      if (!userId || !broadcasterId) {
        setErrorMessage('Missing required credentials (userId and channelId)');
        return;
      }

      const response = await eventsubService.initializeEventSub(
        userId,
        broadcasterId
      );
      
      if (response.success) {
        setMessage(response.message || 'EventSub initialized successfully');
        setTimeout(fetchStatus, 1000);
      } else {
        setErrorMessage(response.error || 'Failed to initialize EventSub');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Error initializing EventSub');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      setLoading(true);
      setErrorMessage(null);
      
      const response = await eventsubService.disconnectEventSub();
      
      if (response.success) {
        setMessage(response.message || 'EventSub disconnected successfully');
        setStatus(null);
        setTimeout(fetchStatus, 500);
      } else {
        setErrorMessage(response.error || 'Failed to disconnect EventSub');
      }
    } catch (error: any) {
      setErrorMessage(error.message || 'Error disconnecting EventSub');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchStatus, 5000);
    fetchStatus();
    return () => clearInterval(interval);
  }, [autoRefresh]);

  useEffect(() => {
    const unsubConnected = eventsubService.onEventSubConnected(() => {
      setMessage('EventSub connected');
      fetchStatus();
    });

    const unsubDisconnected = eventsubService.onEventSubDisconnected(() => {
      setMessage('EventSub disconnected');
      setStatus(null);
    });

    const unsubError = eventsubService.onEventSubError((error: any) => {
      setErrorMessage(`EventSub error: ${error.message || error}`);
    });    const unsubEvent = eventsubService.onEventSubEvent((eventType: any, data: any) => {
      console.log(`[Dashboard] EventSub event received: ${eventType}`, data);
      
      // Add to recent events list (keep last 10)
      setRecentEvents(prev => {
        const newEvents = [
          { type: eventType, data, timestamp: Date.now() },
          ...prev
        ].slice(0, 10);
        return newEvents;
      });
      
      // Show success message
      setMessage(`Event received: ${eventType}`);
      setTimeout(() => setMessage(null), 3000);
      
      fetchStatus();
    });

    return () => {
      unsubConnected();
      unsubDisconnected();
      unsubError();
      unsubEvent();
    };
  }, []);

  const statusColor = status?.connected ? '#4caf50' : '#f44336';
  const statusText = status?.connected ? 'Connected' : 'Disconnected';

  const eventTypes = [
    { type: 'channel.follow', name: 'Followers', icon: '👥' },
    { type: 'channel.subscribe', name: 'Subscriptions', icon: '🎁' },
    { type: 'channel.subscription.end', name: 'Sub Ended', icon: '❌' },
    { type: 'channel.subscription.gift', name: 'Gift Sub', icon: '🎉' },
    { type: 'channel.moderator.add', name: 'Moderator Added', icon: '🛡️' },
    { type: 'channel.moderator.remove', name: 'Moderator Removed', icon: '👤' },
    { type: 'channel.vip.add', name: 'VIP Added', icon: '⭐' },
    { type: 'channel.vip.remove', name: 'VIP Removed', icon: '✨' }
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', flex: 1, overflowY: 'auto', backgroundColor: '#1a1a1a' }}>
      <div style={{ marginBottom: '12px' }}>
        <h2 style={{ margin: 0, fontSize: '20px', color: '#fff', fontWeight: 'bold' }}>EventSub WebSocket Status</h2>
        <p style={{ margin: '8px 0 0 0', color: '#888', fontSize: '13px' }}>Real-time Twitch event subscriptions and activity</p>
      </div>

      {/* Connection Status Card */}
      <div style={{ 
        backgroundColor: '#2a2a2a', 
        border: '1px solid #444',
        borderRadius: '8px', 
        padding: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>Connection Status</h3>
          <div style={{ 
            padding: '6px 12px', 
            borderRadius: '4px', 
            color: 'white', 
            fontWeight: 'bold', 
            fontSize: '12px',
            backgroundColor: statusColor 
          }}>
            {statusText}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '12px'
        }}>
          <div style={{ 
            padding: '12px', 
            backgroundColor: '#1e1e1e', 
            borderRadius: '4px', 
            border: '1px solid #333'
          }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Session ID</div>
            <div style={{ 
              color: '#9147ff', 
              fontFamily: "'Courier New', monospace", 
              fontSize: '12px',
              wordBreak: 'break-all'
            }}>
              {status?.sessionId ? status.sessionId.substring(0, 20) + '...' : 'None'}
            </div>
          </div>

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#1e1e1e', 
            borderRadius: '4px', 
            border: '1px solid #333'
          }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Active Subscriptions</div>
            <div style={{ color: '#9147ff', fontFamily: "'Courier New', monospace", fontSize: '14px', fontWeight: 'bold' }}>
              {status?.subscriptionCount || 0}
            </div>
          </div>

          <div style={{ 
            padding: '12px', 
            backgroundColor: '#1e1e1e', 
            borderRadius: '4px', 
            border: '1px solid #333'
          }}>
            <div style={{ fontSize: '12px', color: '#888', marginBottom: '4px' }}>Reconnect Attempts</div>
            <div style={{ color: '#9147ff', fontFamily: "'Courier New', monospace", fontSize: '14px', fontWeight: 'bold' }}>
              {status?.reconnectAttempts || 0}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      {message && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#1a3a1a',
          border: '1px solid #4caf50',
          borderRadius: '4px',
          color: '#4caf50',
          fontSize: '14px'
        }}>
          ✓ {message}
        </div>
      )}

      {errorMessage && (
        <div style={{
          padding: '12px 16px',
          backgroundColor: '#3a1a1a',
          border: '1px solid #dc3545',
          borderRadius: '4px',
          color: '#dc3545',
          fontSize: '14px'
        }}>
          ✕ {errorMessage}
        </div>
      )}

      {/* Controls */}
      <div style={{ 
        backgroundColor: '#2a2a2a', 
        border: '1px solid #444',
        borderRadius: '8px', 
        padding: '16px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>Controls</h3>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleInitialize}
            disabled={loading || status?.connected}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: loading || status?.connected ? '#555' : '#9147ff',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: loading || status?.connected ? 'not-allowed' : 'pointer',
              opacity: loading || status?.connected ? 0.5 : 1
            }}
          >
            {loading ? '⏳ Initializing...' : '▶️ Initialize EventSub'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading || !status?.connected}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: loading || !status?.connected ? '#555' : '#dc3545',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: loading || !status?.connected ? 'not-allowed' : 'pointer',
              opacity: loading || !status?.connected ? 0.5 : 1
            }}
          >
            {loading ? '⏳ Disconnecting...' : '⏹️ Disconnect'}
          </button>
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              padding: '8px 16px',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: loading ? '#555' : '#9147ff',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? '⏳ Refreshing...' : '🔄 Refresh Status'}
          </button>
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            fontSize: '13px', 
            color: '#ccc', 
            cursor: 'pointer',
            userSelect: 'none'
          }}>
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              style={{ cursor: 'pointer', width: '16px', height: '16px' }}
            />
            Auto-refresh (5s)
          </label>
        </div>
      </div>

      {/* Event Types Grid */}
      <div style={{ 
        backgroundColor: '#2a2a2a', 
        border: '1px solid #444',
        borderRadius: '8px', 
        padding: '16px'
      }}>
        <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>Event Type Status</h3>
        <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#888' }}>
          Common events ({status?.subscriptionCount || 0} total subscribed)
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
          {eventTypes.map((event) => {
            const isSubscribed = status?.subscriptions.some((sub) => sub.type === event.type);
            return (
              <div
                key={event.type}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  padding: '12px',
                  borderRadius: '4px',
                  backgroundColor: isSubscribed ? '#1a3a1a' : '#1e1e1e',
                  border: `1px solid ${isSubscribed ? '#4caf50' : '#333'}`,
                  transition: 'all 0.2s ease'
                }}
              >
                <div style={{ fontSize: '20px' }}>{event.icon}</div>
                <div>
                  <div style={{ fontWeight: 'bold', color: '#fff', fontSize: '13px' }}>{event.name}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontFamily: "'Courier New', monospace" }}>
                    {event.type}
                  </div>
                  <div style={{ fontSize: '11px', color: isSubscribed ? '#4caf50' : '#888', marginTop: '6px', fontWeight: '600' }}>
                    {isSubscribed ? '✓ Subscribed' : '○ Not subscribed'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Subscriptions */}
      {status && status.subscriptions.length > 0 && (
        <div style={{ 
          backgroundColor: '#2a2a2a', 
          border: '1px solid #444',
          borderRadius: '8px', 
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>
            All Active Subscriptions ({status.subscriptions.length})
          </h3>
          <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#888' }}>
            Complete list of subscribed EventSub event types
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '300px', overflowY: 'auto' }}>
            {status.subscriptions.map((sub, index) => (
              <div 
                key={index} 
                style={{ 
                  display: 'flex', 
                  gap: '12px', 
                  padding: '10px', 
                  backgroundColor: '#1e1e1e', 
                  borderRadius: '4px', 
                  border: '1px solid #333'
                }}
              >
                <span style={{ 
                  fontWeight: 'bold', 
                  color: '#9147ff', 
                  minWidth: '180px', 
                  fontFamily: "'Courier New', monospace", 
                  fontSize: '11px'
                }}>
                  {sub.type}
                </span>
                <span style={{ 
                  flex: 1, 
                  color: '#999', 
                  fontSize: '11px', 
                  fontFamily: "'Courier New', monospace", 
                  wordBreak: 'break-all',
                  whiteSpace: 'pre-wrap'
                }}>
                  {JSON.stringify(sub.condition, null, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Events */}
      {recentEvents.length > 0 && (
        <div style={{ 
          backgroundColor: '#2a2a2a', 
          border: '1px solid #444',
          borderRadius: '8px', 
          padding: '16px'
        }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>Recent Events</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '300px', overflowY: 'auto' }}>
            {recentEvents.map((event, index) => (
              <div 
                key={index} 
                style={{ 
                  display: 'flex', 
                  gap: '10px', 
                  padding: '10px', 
                  backgroundColor: '#1a3a1a', 
                  borderRadius: '4px', 
                  border: '1px solid #4caf50',
                  alignItems: 'flex-start'
                }}
              >
                <div style={{ fontSize: '16px', minWidth: '20px' }}>🔔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 'bold', color: '#4caf50', fontSize: '12px' }}>{event.type}</div>
                  <div style={{ fontSize: '10px', color: '#666', marginTop: '2px', fontFamily: "'Courier New', monospace" }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  {event.data && Object.keys(event.data).length > 0 && (
                    <div style={{ 
                      fontSize: '10px', 
                      color: '#999', 
                      marginTop: '4px', 
                      fontFamily: "'Courier New', monospace", 
                      maxHeight: '50px', 
                      overflowY: 'auto', 
                      backgroundColor: '#1e1e1e', 
                      padding: '6px', 
                      borderRadius: '3px',
                      border: '1px solid #333'
                    }}>
                      {JSON.stringify(event.data, null, 1)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info Box */}
      <div style={{ 
        backgroundColor: '#2a2a2a', 
        border: '1px solid #444',
        borderRadius: '8px', 
        padding: '16px'
      }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#fff', fontWeight: 'bold' }}>About EventSub WebSocket</h3>
        <ul style={{ 
          margin: 0, 
          paddingLeft: '20px', 
          listStyleType: 'disc',
          color: '#ccc',
          fontSize: '12px',
          lineHeight: 1.6
        }}>
          <li style={{ marginBottom: '6px' }}>Real-time Twitch events delivered via WebSocket connection</li>
          <li style={{ marginBottom: '6px' }}>Reduces API polling by 90%+ with &lt;1 second event latency</li>
          <li style={{ marginBottom: '6px' }}>Supports multiple event types: follows, subscriptions, roles, bans, raids, and more</li>
          <li style={{ marginBottom: '6px' }}>Automatic reconnection with exponential backoff</li>
          <li style={{ marginBottom: '6px' }}>Hourly reconciliation safety net for missed events</li>
          <li style={{ marginBottom: '6px' }}>Current status: {status?.connected ? '✓ Connected' : '✗ Disconnected'}</li>
        </ul>
      </div>
    </div>
  );
};
