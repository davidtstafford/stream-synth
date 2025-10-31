import React, { useState, useEffect } from 'react';
import * as eventsubService from '../../services/eventsub';

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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '20px', flex: 1, overflowY: 'auto', backgroundColor: '#fafafa' }}>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: 0, fontSize: '28px', color: '#333', fontWeight: 600 }}>EventSub WebSocket Dashboard</h1>
        <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>Real-time Twitch event subscriptions</p>
      </div>

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', border: '1px solid #e0e0e0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#333', fontWeight: 600 }}>Connection Status</h2>
          <div style={{ padding: '6px 16px', borderRadius: '20px', color: 'white', fontWeight: 600, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', backgroundColor: statusColor }}>
            {statusText}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
            <span style={{ fontWeight: 600, color: '#555', minWidth: '140px' }}>Session ID:</span>
            <span style={{ color: '#2196f3', fontFamily: "'Courier New', monospace", fontSize: '12px', padding: '4px 8px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              {status?.sessionId ? status.sessionId.substring(0, 16) + '...' : 'None'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
            <span style={{ fontWeight: 600, color: '#555', minWidth: '140px' }}>Active Subscriptions:</span>
            <span style={{ color: '#2196f3', fontFamily: "'Courier New', monospace", fontSize: '12px', padding: '4px 8px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              {status?.subscriptionCount || 0} / 8
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
            <span style={{ fontWeight: 600, color: '#555', minWidth: '140px' }}>Reconnect Attempts:</span>
            <span style={{ color: '#2196f3', fontFamily: "'Courier New', monospace", fontSize: '12px', padding: '4px 8px', backgroundColor: '#e3f2fd', borderRadius: '4px' }}>
              {status?.reconnectAttempts || 0}
            </span>
          </div>
        </div>
      </div>

      {message && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, backgroundColor: '#e8f5e9', borderLeft: '4px solid #4caf50' }}>
          ✓ {message}
        </div>
      )}

      {errorMessage && (
        <div style={{ padding: '12px 16px', borderRadius: '6px', fontSize: '14px', fontWeight: 500, backgroundColor: '#ffebee', borderLeft: '4px solid #f44336' }}>
          ✕ {errorMessage}
        </div>
      )}

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', border: '1px solid #e0e0e0' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#333', fontWeight: 600 }}>Controls</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            onClick={handleInitialize}
            disabled={loading || status?.connected}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: loading || status?.connected ? '#ccc' : '#2196f3',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: loading || status?.connected ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              opacity: loading || status?.connected ? 0.5 : 1
            }}
          >
            {loading ? 'Initializing...' : 'Initialize EventSub'}
          </button>
          <button
            onClick={handleDisconnect}
            disabled={loading || !status?.connected}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: loading || !status?.connected ? '#ccc' : '#2196f3',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: loading || !status?.connected ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              opacity: loading || !status?.connected ? 0.5 : 1
            }}
          >
            {loading ? 'Disconnecting...' : 'Disconnect'}
          </button>
          <button
            onClick={fetchStatus}
            disabled={loading}
            style={{
              padding: '10px 20px',
              border: 'none',
              borderRadius: '6px',
              backgroundColor: loading ? '#ccc' : '#2196f3',
              color: 'white',
              fontWeight: 600,
              fontSize: '13px',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              whiteSpace: 'nowrap',
              opacity: loading ? 0.5 : 1
            }}
          >
            {loading ? 'Refreshing...' : 'Refresh Status'}
          </button>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#555', cursor: 'pointer', userSelect: 'none' }}>
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

      <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', border: '1px solid #e0e0e0' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#333', fontWeight: 600 }}>Available Event Types</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
          {eventTypes.map((event) => {
            const isSubscribed = status?.subscriptions.some((sub) => sub.type === event.type);
            return (
              <div
                key={event.type}
                style={{
                  display: 'flex',
                  gap: '12px',
                  padding: '12px',
                  borderRadius: '6px',
                  transition: 'all 0.2s ease',
                  backgroundColor: isSubscribed ? '#e8f5e9' : '#f5f5f5',
                  borderLeft: isSubscribed ? '4px solid #4caf50' : '4px solid #ccc'
                }}
              >
                <div style={{ fontSize: '24px', minWidth: '32px', textAlign: 'center' }}>{event.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#333', fontSize: '14px' }}>{event.name}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px', fontFamily: "'Courier New', monospace" }}>{event.type}</div>
                  <div style={{ fontSize: '12px', color: '#4caf50', marginTop: '4px', fontWeight: 500 }}>
                    {isSubscribed ? '✓ Subscribed' : '○ Not subscribed'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {status && status.subscriptions.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', border: '1px solid #e0e0e0' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#333', fontWeight: 600 }}>Active Subscriptions</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {status.subscriptions.map((sub, index) => (
              <div key={index} style={{ display: 'flex', gap: '16px', padding: '12px', backgroundColor: '#f9f9f9', borderRadius: '6px', border: '1px solid #e8e8e8' }}>
                <span style={{ fontWeight: 600, color: '#2196f3', minWidth: '200px', fontFamily: "'Courier New', monospace", fontSize: '12px' }}>{sub.type}</span>
                <span style={{ flex: 1, color: '#666', fontSize: '12px', fontFamily: "'Courier New', monospace", wordBreak: 'break-all', whiteSpace: 'pre-wrap' }}>
                  {JSON.stringify(sub.condition, null, 2)}
                </span>
              </div>
            ))}
          </div>
        </div>      )}

      {recentEvents.length > 0 && (
        <div style={{ backgroundColor: 'white', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', border: '1px solid #e0e0e0' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '18px', color: '#333', fontWeight: 600 }}>Recent Events</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '300px', overflowY: 'auto' }}>
            {recentEvents.map((event, index) => (
              <div key={index} style={{ display: 'flex', gap: '12px', padding: '12px', backgroundColor: '#e8f5e9', borderRadius: '6px', border: '1px solid #4caf50', alignItems: 'flex-start' }}>
                <div style={{ fontSize: '16px', minWidth: '24px' }}>🔔</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, color: '#2e7d32', fontSize: '13px' }}>{event.type}</div>
                  <div style={{ fontSize: '11px', color: '#999', marginTop: '2px', fontFamily: "'Courier New', monospace" }}>
                    {new Date(event.timestamp).toLocaleTimeString()}
                  </div>
                  {event.data && Object.keys(event.data).length > 0 && (
                    <div style={{ fontSize: '11px', color: '#666', marginTop: '4px', fontFamily: "'Courier New', monospace", maxHeight: '60px', overflowY: 'auto', backgroundColor: '#f5f5f5', padding: '6px', borderRadius: '3px' }}>
                      {JSON.stringify(event.data, null, 1)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '20px', boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)', border: '1px solid #e0e0e0' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '16px', color: '#333', fontWeight: 600 }}>About EventSub WebSocket</h3>
        <ul style={{ margin: 0, paddingLeft: '20px', listStyleType: 'disc' }}>
          <li style={{ margin: '8px 0', color: '#555', fontSize: '13px', lineHeight: 1.6 }}>Real-time Twitch events delivered via WebSocket connection</li>
          <li style={{ margin: '8px 0', color: '#555', fontSize: '13px', lineHeight: 1.6 }}>Reduces API polling by 90%+ with &lt;1 second event latency</li>
          <li style={{ margin: '8px 0', color: '#555', fontSize: '13px', lineHeight: 1.6 }}>Supports 8 event types: follows, subscriptions, roles, and more</li>
          <li style={{ margin: '8px 0', color: '#555', fontSize: '13px', lineHeight: 1.6 }}>Automatic reconnection with exponential backoff</li>
          <li style={{ margin: '8px 0', color: '#555', fontSize: '13px', lineHeight: 1.6 }}>Hourly reconciliation safety net for missed events</li>
          <li style={{ margin: '8px 0', color: '#555', fontSize: '13px', lineHeight: 1.6 }}>Connection status: {statusText}</li>
        </ul>
      </div>
    </div>
  );
};
