import React, { useState, useEffect } from 'react';
import { EVENT_GROUPS, DEFAULT_SUBSCRIPTIONS, MANDATORY_SUBSCRIPTIONS, BROADCASTER_ONLY_EVENTS, EVENT_DISPLAY_INFO, EventSubscriptions as EventSubscriptionsType } from '../config/event-types';
import { subscribeToEvent, unsubscribeFromEvent } from '../services/twitch-api';

interface EventSubscriptionsProps {
  clientId: string;
  accessToken: string;
  sessionId: string;
  broadcasterId: string;
  userId: string;
  isBroadcaster: boolean;
}

export const EventSubscriptions: React.FC<EventSubscriptionsProps> = ({
  clientId,
  accessToken,
  sessionId,
  broadcasterId,
  userId,
  isBroadcaster
}) => {
  const [showSubscriptions, setShowSubscriptions] = useState<boolean>(false);
  const [subscriptions, setSubscriptions] = useState<EventSubscriptionsType>(() => {
    const initial = {} as EventSubscriptionsType;
    Object.values(EVENT_GROUPS).flat().forEach(event => {
      initial[event as keyof EventSubscriptionsType] = MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptionsType);
    });
    return initial;
  });

  // Auto-subscribe to mandatory events when session is established
  useEffect(() => {
    if (sessionId && accessToken && clientId) {
      MANDATORY_SUBSCRIPTIONS.forEach(eventType => {
        subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
      });
    }
  }, [sessionId, accessToken, clientId, broadcasterId, userId]);

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

  const handleEventToggle = async (eventType: keyof EventSubscriptionsType) => {
    if (MANDATORY_SUBSCRIPTIONS.includes(eventType)) {
      return;
    }
    
    // Don't allow toggling broadcaster-only events when not a broadcaster
    if (BROADCASTER_ONLY_EVENTS.includes(eventType) && !isBroadcaster) {
      return;
    }
    
    const newValue = !subscriptions[eventType];
    setSubscriptions((prev: EventSubscriptionsType) => ({
      ...prev,
      [eventType]: newValue
    }));

    if (newValue) {
      await subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
    } else {
      await unsubscribeFromEvent(eventType, accessToken, clientId);
    }
  };

  const handleSelectDefault = () => {
    const newSubscriptions = { ...subscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      newSubscriptions[key as keyof EventSubscriptionsType] = DEFAULT_SUBSCRIPTIONS.includes(key as keyof EventSubscriptionsType);
    });
    setSubscriptions(newSubscriptions);

    if (sessionId && accessToken) {
      DEFAULT_SUBSCRIPTIONS.forEach((event: keyof EventSubscriptionsType) => {
        if (!MANDATORY_SUBSCRIPTIONS.includes(event)) {
          subscribeToEvent(event, accessToken, clientId, sessionId, broadcasterId, userId);
        }
      });
    }
  };

  const handleSelectAll = () => {
    const newSubscriptions = { ...subscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      const eventType = key as keyof EventSubscriptionsType;
      // Only enable if not broadcaster-only OR user is a broadcaster
      if (!BROADCASTER_ONLY_EVENTS.includes(eventType) || isBroadcaster) {
        newSubscriptions[eventType] = true;
      }
    });
    setSubscriptions(newSubscriptions);

    if (sessionId && accessToken) {
      Object.keys(newSubscriptions).forEach(event => {
        const eventType = event as keyof EventSubscriptionsType;
        if (!MANDATORY_SUBSCRIPTIONS.includes(eventType) && 
            (!BROADCASTER_ONLY_EVENTS.includes(eventType) || isBroadcaster)) {
          subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
        }
      });
    }
  };

  const handleDeselectAll = () => {
    const newSubscriptions = { ...subscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      newSubscriptions[key as keyof EventSubscriptionsType] = MANDATORY_SUBSCRIPTIONS.includes(key as keyof EventSubscriptionsType);
    });
    setSubscriptions(newSubscriptions);

    if (sessionId && accessToken) {
      Object.keys(newSubscriptions).forEach(event => {
        if (!MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptionsType)) {
          unsubscribeFromEvent(event, accessToken, clientId);
        }
      });
    }
  };

  if (!sessionId) {
    return null;
  }

  return (
    <div style={{ marginTop: '40px' }}>
      <div 
        onClick={() => setShowSubscriptions(!showSubscriptions)}
        style={{ 
          cursor: 'pointer', 
          display: 'flex', 
          alignItems: 'center',
          marginBottom: '20px'
        }}
      >
        <h2 style={{ fontSize: '24px', fontWeight: '500' }}>
          Event Subscriptions {showSubscriptions ? '▼' : '▶'}
        </h2>
      </div>

      {showSubscriptions && (
        <div style={{ 
          background: '#252525', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
            <button className="btn" onClick={handleSelectDefault}>
              Select Default
            </button>
            <button className="btn" onClick={handleSelectAll}>
              Select All
            </button>
            <button 
              className="btn" 
              onClick={handleDeselectAll}
              style={{ background: '#555' }}
            >
              Deselect All
            </button>
          </div>

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
                        border: isMandatory ? '1px solid #4d7a45' : 'none',
                        opacity: (isBroadcasterOnly && !isBroadcaster) ? 0.5 : 1
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled) e.currentTarget.style.background = '#353535';
                      }}
                      onMouseLeave={(e) => {
                        if (!isDisabled) e.currentTarget.style.background = '#2d2d2d';
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
                            (REQUIRED)
                          </span>
                        )}
                        {isBroadcasterOnly && (
                          <span style={{ 
                            fontSize: '10px', 
                            color: isBroadcaster ? '#6dff8e' : '#ff6d6d',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            (BROADCASTER)
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
      )}
    </div>
  );
};
