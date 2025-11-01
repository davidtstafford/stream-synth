import React, { useState, useEffect } from 'react';
import { EVENT_GROUPS, DEFAULT_SUBSCRIPTIONS, MANDATORY_SUBSCRIPTIONS, BROADCASTER_ONLY_EVENTS, EVENT_DISPLAY_INFO, EventSubscriptions as EventSubscriptionsType } from '../config/event-types';
import { subscribeToEvent, unsubscribeFromEvent } from '../services/twitch-api';
import { connectIRC, disconnectIRC } from '../services/irc-api';
import * as db from '../services/database';

interface EventSubscriptionsProps {
  clientId: string;
  accessToken: string;
  sessionId: string;
  broadcasterId: string;
  broadcasterLogin: string;
  userId: string;
  isBroadcaster: boolean;
}

export const EventSubscriptions: React.FC<EventSubscriptionsProps> = ({
  clientId,
  accessToken,
  sessionId,
  broadcasterId,
  broadcasterLogin,
  userId,
  isBroadcaster
}) => {  const [showSubscriptions, setShowSubscriptions] = useState<boolean>(false);
  const [subscriptions, setSubscriptions] = useState<EventSubscriptionsType>(() => {
    // Initialize ALL events as enabled by default
    const initial = {} as EventSubscriptionsType;
    Object.values(EVENT_GROUPS).flat().forEach(event => {
      initial[event as keyof EventSubscriptionsType] = true;
    });
    return initial;
  });
  const [ircConnected, setIrcConnected] = useState<boolean>(false);

  // Auto-subscribe to mandatory events when session is established
  useEffect(() => {
    if (sessionId && accessToken && clientId) {
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
          });          setSubscriptions(newSubscriptions);

          // Re-subscribe to saved events (filter out IRC events)
          savedEvents.forEach(eventType => {
            if (!MANDATORY_SUBSCRIPTIONS.includes(eventType as keyof EventSubscriptionsType) &&
                !eventType.startsWith('irc.')) {
              subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
            }
          });} else {
          // No saved preferences, enable all events by default (already in initial state)
          const allEvents = Object.values(EVENT_GROUPS).flat();
          
          // Save ALL events as enabled to database (first-time setup)
          console.log('First-time setup: Saving all events as enabled to database');
          for (const eventType of allEvents) {
            await db.saveSubscription(userId, broadcasterId, eventType, true);
          }
          
          // Subscribe to all non-mandatory EventSub events
          allEvents.forEach(eventType => {
            if (!MANDATORY_SUBSCRIPTIONS.includes(eventType as keyof EventSubscriptionsType) && 
                !eventType.startsWith('irc.')) {
              subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
            }
          });
          
          // Connect to IRC for IRC events
          const hasIRCEvents = allEvents.some(key => key.startsWith('irc.'));
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

    const handleEventToggle = async (eventType: keyof EventSubscriptionsType) => {
    if (MANDATORY_SUBSCRIPTIONS.includes(eventType)) return;

    const newValue = !subscriptions[eventType];
    
    setSubscriptions(prev => ({
      ...prev,
      [eventType]: newValue
    }));

    // Save to database
    await db.saveSubscription(userId, broadcasterId, eventType, newValue);

    // Check if this is an IRC event
    const isIRCEvent = eventType.startsWith('irc.');
    
    if (isIRCEvent) {
      // Handle IRC events differently
      if (newValue) {
        // Enable IRC event - connect to IRC if not already connected
        if (!ircConnected) {
          try {
            // Connect to IRC with broadcaster's channel
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
      // Handle EventSub events (original logic)
      if (newValue) {
        await subscribeToEvent(eventType, accessToken, clientId, sessionId, broadcasterId, userId);
      } else {
        await unsubscribeFromEvent(eventType, accessToken, clientId);
      }
    }
  };

  const handleSelectDefault = async () => {
    const newSubscriptions = { ...subscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      newSubscriptions[key as keyof EventSubscriptionsType] = DEFAULT_SUBSCRIPTIONS.includes(key as keyof EventSubscriptionsType);
    });
    setSubscriptions(newSubscriptions);

    if (sessionId && accessToken) {
      const eventSubEvents: (keyof EventSubscriptionsType)[] = [];
      const ircEvents: (keyof EventSubscriptionsType)[] = [];
      
      DEFAULT_SUBSCRIPTIONS.forEach((event: keyof EventSubscriptionsType) => {
        if (!MANDATORY_SUBSCRIPTIONS.includes(event)) {
          if (event.startsWith('irc.')) {
            ircEvents.push(event);
          } else {
            eventSubEvents.push(event);
          }
        }
      });
      
      // Subscribe to EventSub events
      for (const event of eventSubEvents) {
        await subscribeToEvent(event, accessToken, clientId, sessionId, broadcasterId, userId);
      }
      
      // Connect to IRC if any IRC events are enabled
      if (ircEvents.length > 0 && !ircConnected) {
        try {
          await connectIRC(broadcasterLogin, accessToken, broadcasterLogin);
          setIrcConnected(true);
        } catch (error) {
          console.error('Failed to connect to IRC:', error);
        }
      }
    }
  };

  const handleSelectAll = async () => {
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
      const eventSubEvents: (keyof EventSubscriptionsType)[] = [];
      const ircEvents: (keyof EventSubscriptionsType)[] = [];
      
      Object.keys(newSubscriptions).forEach(event => {
        const eventType = event as keyof EventSubscriptionsType;
        if (!MANDATORY_SUBSCRIPTIONS.includes(eventType) && 
            (!BROADCASTER_ONLY_EVENTS.includes(eventType) || isBroadcaster)) {
          if (eventType.startsWith('irc.')) {
            ircEvents.push(eventType);
          } else {
            eventSubEvents.push(eventType);
          }
        }
      });
      
      // Subscribe to EventSub events
      for (const event of eventSubEvents) {
        await subscribeToEvent(event, accessToken, clientId, sessionId, broadcasterId, userId);
      }
      
      // Connect to IRC if any IRC events are enabled
      if (ircEvents.length > 0 && !ircConnected) {
        try {
          await connectIRC(broadcasterLogin, accessToken, broadcasterLogin);
          setIrcConnected(true);
        } catch (error) {
          console.error('Failed to connect to IRC:', error);
        }
      }
    }
  };

  const handleDeselectAll = async () => {
    const newSubscriptions = { ...subscriptions };
    Object.keys(newSubscriptions).forEach(key => {
      newSubscriptions[key as keyof EventSubscriptionsType] = MANDATORY_SUBSCRIPTIONS.includes(key as keyof EventSubscriptionsType);
    });
    setSubscriptions(newSubscriptions);

    if (sessionId && accessToken) {
      const eventSubEvents: (keyof EventSubscriptionsType)[] = [];
      
      Object.keys(newSubscriptions).forEach(event => {
        if (!MANDATORY_SUBSCRIPTIONS.includes(event as keyof EventSubscriptionsType)) {
          if (!event.startsWith('irc.')) {
            eventSubEvents.push(event as keyof EventSubscriptionsType);
          }
        }
      });
      
      // Unsubscribe from EventSub events
      for (const event of eventSubEvents) {
        await unsubscribeFromEvent(event, accessToken, clientId);
      }
      
      // Disconnect from IRC
      if (ircConnected) {
        try {
          await disconnectIRC();
          setIrcConnected(false);
        } catch (error) {
          console.error('Failed to disconnect from IRC:', error);
        }
      }
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
      </div>      {showSubscriptions && (
        <div style={{ 
          background: '#252525', 
          padding: '20px', 
          borderRadius: '8px',
          border: '1px solid #333'
        }}>
          {/* Warning Message */}
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
              ⚠️ Warning: Disabling Events May Cause Issues
            </strong>
            <p style={{ margin: '0 0 8px 0', lineHeight: '1.5' }}>
              All events are enabled by default for optimal functionality. Disabling events may cause features to malfunction or data to be incomplete.
            </p>
            <p style={{ margin: '0', lineHeight: '1.5' }}>
              Only disable events if you understand the potential impact on the application.
            </p>
          </div>

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
                      title={`${event}\n${displayInfo.description}`}                      style={{ 
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
                        <span>{displayInfo.name}</span>                        {isMandatory && (
                          <span style={{ 
                            fontSize: '10px', 
                            color: '#6dff8e',
                            fontWeight: 'bold',
                            whiteSpace: 'nowrap'
                          }}>
                            (REQUIRED)
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
