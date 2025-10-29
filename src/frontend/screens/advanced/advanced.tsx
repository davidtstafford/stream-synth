import React, { useState, useEffect } from 'react';
import { ExportImport } from '../../components/ExportImport';
import { EVENT_GROUPS, DEFAULT_SUBSCRIPTIONS, MANDATORY_SUBSCRIPTIONS, BROADCASTER_ONLY_EVENTS, EVENT_DISPLAY_INFO, EventSubscriptions as EventSubscriptionsType } from '../../config/event-types';
import { subscribeToEvent, unsubscribeFromEvent } from '../../services/twitch-api';
import { connectIRC, disconnectIRC } from '../../services/irc-api';
import * as db from '../../services/database';
import { 
  getAllPollingConfigs, 
  updatePollingInterval, 
  setPollingEnabled,
  PollingConfig 
} from '../../services/twitch-polling';

interface AdvancedScreenProps {
  userId?: string;
  clientId?: string;
  accessToken?: string;
  sessionId?: string;
  broadcasterId?: string;
  broadcasterLogin?: string;
  isBroadcaster?: boolean;
}

export const AdvancedScreen: React.FC<AdvancedScreenProps> = ({ 
  userId,
  clientId = '',
  accessToken = '',
  sessionId = '',
  broadcasterId = '',
  broadcasterLogin = '',
  isBroadcaster = false
}) => {
  const [pollingConfigs, setPollingConfigs] = useState<PollingConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [updateMessage, setUpdateMessage] = useState<string | null>(null);
  const [showEventSubscriptions, setShowEventSubscriptions] = useState<boolean>(false);
  const [subscriptions, setSubscriptions] = useState<EventSubscriptionsType>(() => {
    // Initialize ALL events as enabled by default
    const initial = {} as EventSubscriptionsType;
    Object.values(EVENT_GROUPS).flat().forEach(event => {
      initial[event as keyof EventSubscriptionsType] = true;
    });
    return initial;
  });
  const [ircConnected, setIrcConnected] = useState<boolean>(false);
  // Load polling configs on mount
  useEffect(() => {
    loadPollingConfigs();
  }, []);

  // Auto-subscribe to mandatory events when session is established
  useEffect(() => {
    if (sessionId && accessToken && clientId && broadcasterId && userId) {
      MANDATORY_SUBSCRIPTIONS.forEach(eventType => {
        subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
      });
    }
  }, [sessionId, accessToken, clientId, broadcasterId, userId]);

  // Restore saved event subscriptions from database
  useEffect(() => {
    async function restoreSubscriptions() {
      if (!sessionId || !userId || !broadcasterId) return;

      try {
        const savedEvents = await db.getEnabledEvents(userId, broadcasterId);
        console.log('Restoring saved events:', savedEvents);

        if (savedEvents.length > 0) {
          // User has saved preferences, use those
          const newSubscriptions = {} as EventSubscriptionsType;
          Object.values(EVENT_GROUPS).flat().forEach(event => {
            newSubscriptions[event as keyof EventSubscriptionsType] = savedEvents.includes(event);
          });
          setSubscriptions(newSubscriptions);

          // Re-subscribe to saved events
          savedEvents.forEach(eventType => {
            if (!MANDATORY_SUBSCRIPTIONS.includes(eventType as keyof EventSubscriptionsType)) {
              subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
            }
          });
        } else {
          // No saved preferences, enable all events by default
          const allEnabled = {} as EventSubscriptionsType;
          Object.values(EVENT_GROUPS).flat().forEach(event => {
            allEnabled[event as keyof EventSubscriptionsType] = true;
          });
          setSubscriptions(allEnabled);

          // Subscribe to all non-mandatory events
          Object.keys(allEnabled).forEach(eventType => {
            if (!MANDATORY_SUBSCRIPTIONS.includes(eventType as keyof EventSubscriptionsType) && 
                !eventType.startsWith('irc.')) {
              subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
            }
          });

          // Enable IRC if IRC events are enabled
          const hasIRCEvents = Object.keys(allEnabled).some(key => key.startsWith('irc.'));
          if (hasIRCEvents && !ircConnected && broadcasterLogin) {
            try {
              await connectIRC(broadcasterLogin, accessToken, broadcasterLogin);
              setIrcConnected(true);
            } catch (error) {
              console.error('Failed to connect to IRC:', error);
            }
          }
        }
      } catch (error) {
        console.error('Failed to restore subscriptions:', error);
      }
    }

    restoreSubscriptions();
  }, [sessionId, userId, broadcasterId]);

  // When switching between broadcaster/moderator mode, update subscriptions
  useEffect(() => {
    if (!sessionId || !accessToken) return;

    const newSubscriptions = { ...subscriptions };
    
    // If not a broadcaster, disable all broadcaster-only events
    if (!isBroadcaster) {
      BROADCASTER_ONLY_EVENTS.forEach(event => {
        if (subscriptions[event]) {
          newSubscriptions[event] = false;
          unsubscribeFromEvent(event, accessToken, clientId);
        }
      });
      setSubscriptions(newSubscriptions);
    }
  }, [isBroadcaster, sessionId]);

  const loadPollingConfigs = async () => {
    try {
      setLoading(true);
      const configs = await getAllPollingConfigs();
      setPollingConfigs(configs);
    } catch (error) {
      console.error('Failed to load polling configs:', error);
    } finally {
      setLoading(false);
    }
  };  const handleIntervalChange = async (apiType: string, newIntervalValue: number) => {
    try {
      await updatePollingInterval(apiType as any, newIntervalValue);
      
      // Update local state
      setPollingConfigs(prev => 
        prev.map(config => 
          config.api_type === apiType 
            ? { ...config, interval_value: newIntervalValue }
            : config
        )
      );

      // Show success message
      const config = pollingConfigs.find(c => c.api_type === apiType);
      const formattedInterval = config ? formatInterval(newIntervalValue, config.interval_units) : `${newIntervalValue}`;
      setUpdateMessage(`✓ Updated ${apiType} interval to ${formattedInterval}`);
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (error) {
      console.error('Failed to update interval:', error);
      setUpdateMessage(`✗ Failed to update ${apiType} interval`);
      setTimeout(() => setUpdateMessage(null), 3000);
    }
  };

  const handleEnabledToggle = async (apiType: string, enabled: boolean) => {
    try {
      await setPollingEnabled(apiType as any, enabled);
      
      // Update local state
      setPollingConfigs(prev => 
        prev.map(config => 
          config.api_type === apiType 
            ? { ...config, enabled, isRunning: enabled }
            : config
        )
      );

      setUpdateMessage(`✓ ${enabled ? 'Enabled' : 'Disabled'} ${apiType}`);
      setTimeout(() => setUpdateMessage(null), 3000);
    } catch (error) {
      console.error('Failed to toggle enabled:', error);
      setUpdateMessage(`✗ Failed to update ${apiType}`);
      setTimeout(() => setUpdateMessage(null), 3000);
    }
  };
  const handleImportComplete = () => {
    console.log('Import completed');
    loadPollingConfigs(); // Reload polling configs after import
  };

  const handleEventToggle = async (eventType: keyof EventSubscriptionsType) => {
    if (MANDATORY_SUBSCRIPTIONS.includes(eventType)) return;

    const newValue = !subscriptions[eventType];
    
    setSubscriptions(prev => ({
      ...prev,
      [eventType]: newValue
    }));

    // Save to database
    if (userId && broadcasterId) {
      await db.saveSubscription(userId, broadcasterId, eventType, newValue);
    }

    // Check if this is an IRC event
    const isIRCEvent = eventType.startsWith('irc.');
    
    if (isIRCEvent) {
      // Handle IRC events differently
      if (newValue) {
        // Enable IRC event - connect to IRC if not already connected
        if (!ircConnected && broadcasterLogin && accessToken) {
          try {
            await connectIRC(broadcasterLogin, accessToken, broadcasterLogin);
            setIrcConnected(true);
          } catch (error) {
            console.error('Failed to connect to IRC:', error);
          }
        }
      } else {
        // Disable IRC event - check if any IRC events are still enabled
        const anyIRCEventEnabled = Object.entries(subscriptions).some(
          ([key, value]) => key.startsWith('irc.') && key !== eventType && value
        );
        
        if (!anyIRCEventEnabled && ircConnected) {
          // No IRC events enabled, disconnect
          try {
            await disconnectIRC();
            setIrcConnected(false);
          } catch (error) {
            console.error('Failed to disconnect from IRC:', error);
          }
        }
      }
    } else {
      // Handle EventSub events
      if (newValue && sessionId && accessToken && clientId && broadcasterId && userId) {
        await subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
      } else if (!newValue && accessToken && clientId) {
        await unsubscribeFromEvent(eventType, accessToken, clientId);
      }
    }
  };// Helper to format API type names for display
  const formatApiTypeName = (apiType: string): string => {
    const names: Record<string, string> = {
      role_sync: 'Role Sync (Subs, VIPs, Mods)',
      followers: 'New Followers Detection',
    };
    return names[apiType] || apiType;
  };

  // Helper to format interval with units
  const formatInterval = (value: number, units: string): string => {
    const unitLabels: Record<string, string> = {
      seconds: 's',
      minutes: 'm',
      hours: 'h',
    };
    
    const label = unitLabels[units] || units;
    
    // Special formatting for common patterns
    if (units === 'minutes') {
      if (value >= 60) {
        const hours = Math.floor(value / 60);
        const mins = value % 60;
        return mins === 0 ? `${hours}h` : `${hours}h ${mins}m`;
      }
      return `${value}m`;
    }
    
    if (units === 'seconds') {
      if (value >= 60) {
        const minutes = Math.floor(value / 60);
        const secs = value % 60;
        return secs === 0 ? `${minutes}m` : `${minutes}m ${secs}s`;
      }
      return `${value}s`;
    }
    
    return `${value}${label}`;
  };
  return (
    <div className="content">
      <h1 className="screen-title">Advanced Settings</h1>
      
      <div style={{ color: '#aaa', marginBottom: '30px', fontSize: '14px' }}>
        <p>Advanced options for managing your application data and settings.</p>
      </div>

      {/* Export/Import Section - MOVED TO TOP */}
      <ExportImport 
        userId={userId}
        onImportComplete={handleImportComplete}
      />

      {/* Twitch API Polling Configuration */}
      <div style={{ 
        background: '#2a2a2a', 
        border: '1px solid #555', 
        borderRadius: '8px', 
        padding: '20px',
        marginBottom: '30px'
      }}>
        <h2 style={{ 
          fontSize: '18px', 
          fontWeight: 'bold', 
          marginBottom: '10px',
          color: '#fff'
        }}>
          🔄 Twitch API Polling Settings
        </h2>
        
        <p style={{ color: '#aaa', fontSize: '14px', marginBottom: '20px' }}>
          Configure how often the app syncs data from Twitch Helix APIs. Lower values = more frequent updates but more API calls.
        </p>

        {updateMessage && (
          <div style={{
            padding: '10px 15px',
            marginBottom: '15px',
            background: updateMessage.startsWith('✓') ? '#2d5a2d' : '#5a2d2d',
            border: `1px solid ${updateMessage.startsWith('✓') ? '#4a8a4a' : '#8a4a4a'}`,
            borderRadius: '5px',
            color: '#fff',
            fontSize: '14px'
          }}>
            {updateMessage}
          </div>
        )}

        {loading ? (
          <div style={{ color: '#aaa', textAlign: 'center', padding: '20px' }}>
            Loading configurations...
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {pollingConfigs.map(config => (
              <div 
                key={config.api_type}
                style={{
                  background: '#1e1e1e',
                  border: '1px solid #444',
                  borderRadius: '5px',
                  padding: '15px'
                }}
              >
                <div style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  marginBottom: '10px'
                }}>
                  <div>
                    <div style={{ 
                      fontSize: '16px', 
                      fontWeight: 'bold', 
                      color: '#fff',
                      marginBottom: '5px'
                    }}>
                      {formatApiTypeName(config.api_type)}
                    </div>
                    {config.description && (
                      <div style={{ fontSize: '13px', color: '#888' }}>
                        {config.description}
                      </div>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      cursor: 'pointer',
                      fontSize: '14px',
                      color: config.enabled ? '#4CAF50' : '#888'
                    }}>
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => handleEnabledToggle(config.api_type, e.target.checked)}
                        style={{ cursor: 'pointer' }}
                      />
                      Enabled
                    </label>
                    
                    {config.isRunning && (
                      <span style={{ 
                        fontSize: '12px', 
                        color: '#4CAF50',
                        padding: '2px 6px',
                        background: '#1a3a1a',
                        borderRadius: '3px'
                      }}>
                        ● Running
                      </span>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    color: '#ccc',
                    marginBottom: '8px'
                  }}>
                    Sync Frequency: <strong style={{ color: '#fff' }}>{formatInterval(config.interval_value, config.interval_units)}</strong>
                  </label>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                    <input
                      type="range"
                      min={config.min_interval}
                      max={config.max_interval}
                      step={config.step}
                      value={config.interval_value}
                      onChange={(e) => handleIntervalChange(config.api_type, parseInt(e.target.value))}
                      disabled={!config.enabled}
                      style={{
                        flex: 1,
                        cursor: config.enabled ? 'pointer' : 'not-allowed',
                        opacity: config.enabled ? 1 : 0.5
                      }}
                    />
                    
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#888',
                      minWidth: '120px',
                      textAlign: 'right'
                    }}>
                      {formatInterval(config.min_interval, config.interval_units)} ↔ {formatInterval(config.max_interval, config.interval_units)}
                    </div>
                  </div>

                  {config.last_poll_at && (
                    <div style={{ 
                      fontSize: '12px', 
                      color: '#666',
                      marginTop: '8px'
                    }}>
                      Last synced: {new Date(config.last_poll_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{
          marginTop: '15px',
          padding: '12px',
          background: '#1a1a1a',
          border: '1px solid #444',
          borderRadius: '5px',
          fontSize: '13px',
          color: '#aaa'
        }}>
          <strong style={{ color: '#fff' }}>ℹ️ Note:</strong> Changes take effect immediately. 
          Manual sync is always available regardless of these settings.
        </div>
      </div>      {/* Event Subscriptions Section - MOVED FROM CONNECTION SCREEN */}
      <div style={{ 
        background: '#2a2a2a', 
        border: '1px solid #555', 
        borderRadius: '8px', 
        padding: '20px',
        marginBottom: '30px'
      }}>
        <div 
          onClick={() => setShowEventSubscriptions(!showEventSubscriptions)}
          style={{ 
            cursor: 'pointer', 
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: showEventSubscriptions ? '20px' : '0'
          }}
        >
          <div>
            <h2 style={{ 
              fontSize: '18px', 
              fontWeight: 'bold',
              color: '#fff',
              marginBottom: '5px'
            }}>
              📡 Event Subscriptions {showEventSubscriptions ? '▼' : '▶'}
            </h2>
            <p style={{ color: '#aaa', fontSize: '14px', margin: 0 }}>
              Configure which Twitch events the app listens to
            </p>
          </div>
        </div>

        {showEventSubscriptions && (
          <>
            {!sessionId ? (
              <div style={{
                padding: '20px',
                background: '#1a1a1a',
                border: '1px solid #555',
                borderRadius: '5px',
                textAlign: 'center',
                color: '#aaa'
              }}>
                <p style={{ margin: 0, fontSize: '14px' }}>
                  Connect to Twitch on the <strong style={{ color: '#9147ff' }}>Connection</strong> screen to manage event subscriptions.
                </p>
              </div>
            ) : (
              <>
                <div style={{
                  padding: '15px',
                  background: '#3d2d1a',
                  border: '2px solid #ff9800',
                  borderRadius: '5px',
                  marginBottom: '20px',
                  fontSize: '14px',
                  color: '#ffb74d'
                }}>
                  <strong style={{ display: 'block', marginBottom: '8px', fontSize: '15px' }}>
                    ⚠️ Warning: Disabling Events May Break Features
                  </strong>
                  <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
                    All events are enabled by default for optimal functionality. 
                    Disabling certain events may prevent features from working correctly.
                  </p>
                  <ul style={{ margin: '8px 0 0 20px', paddingLeft: 0, lineHeight: '1.6' }}>
                    <li><strong>Chat Message</strong> and <strong>Channel Points</strong> events are locked (required for core features)</li>
                    <li>Disabling other events may cause incomplete data or missing alerts</li>
                    <li>Only disable events if you understand the impact</li>
                  </ul>
                </div>

                <div style={{ 
                  background: '#252525', 
                  padding: '20px', 
                  borderRadius: '8px',
                  border: '1px solid #333'
                }}>
                  {Object.entries(EVENT_GROUPS).map(([groupName, events]) => (
                    <div key={groupName} style={{ marginBottom: '30px' }}>
                      <h3 style={{ 
                        fontSize: '18px', 
                        marginBottom: '15px',
                        color: '#9147ff',
                        fontWeight: '500'
                      }}>
                        {groupName}
                      </h3>
                      <div style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                        gap: '10px'
                      }}>
                        {events.map((event) => {
                          const isMandatory = MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptionsType);
                          const isBroadcasterOnly = BROADCASTER_ONLY_EVENTS.includes(event as keyof EventSubscriptionsType);
                          const isDisabled = isMandatory || (isBroadcasterOnly && !isBroadcaster);
                          const displayInfo = EVENT_DISPLAY_INFO[event as keyof EventSubscriptionsType];
                          
                          return (
                            <label 
                              key={event}
                              title={`${event}\n${displayInfo.description}`}
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center',
                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                padding: '8px 12px',
                                background: isMandatory ? '#2d3d2d' : '#2d2d2d',
                                borderRadius: '4px',
                                transition: 'background 0.2s',
                                border: isMandatory ? '1px solid #4d7a45' : 'none'
                              }}
                              onMouseEnter={(e) => {
                                if (!isDisabled) e.currentTarget.style.background = '#353535';
                              }}
                              onMouseLeave={(e) => {
                                if (!isDisabled) e.currentTarget.style.background = isMandatory ? '#2d3d2d' : '#2d2d2d';
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={subscriptions[event as keyof EventSubscriptionsType]}
                                onChange={() => handleEventToggle(event as keyof EventSubscriptionsType)}
                                disabled={isDisabled}
                                style={{ 
                                  marginRight: '10px',
                                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                                  width: '16px',
                                  height: '16px',
                                  flexShrink: 0
                                }}
                              />
                              <span style={{ 
                                fontSize: '13px', 
                                userSelect: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px',
                                flexWrap: 'wrap'
                              }}>
                                <span>{displayInfo.name}</span>
                                {isMandatory && (
                                  <span style={{ 
                                    fontSize: '10px', 
                                    color: '#6dff8e',
                                    fontWeight: 'bold',
                                    whiteSpace: 'nowrap'
                                  }}>
                                    🔒 LOCKED
                                  </span>
                                )}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};
