export async function subscribeToEvent(
  eventType: string,
  accessToken: string,
  clientId: string,
  sessionId: string,
  broadcasterId: string,
  userId: string
): Promise<void> {
  if (!accessToken || !sessionId) {
    console.error('Cannot subscribe: missing token or session', { 
      hasToken: !!accessToken, 
      hasSession: !!sessionId 
    });
    return;
  }

  try {
    // Create subscription condition based on event type
    const condition: any = {};
    
    // Different events require different condition fields
    if (eventType.startsWith('channel.chat')) {
      // Chat events need both broadcaster and user
      condition.broadcaster_user_id = broadcasterId;
      condition.user_id = userId;
    } else if (eventType === 'channel.raid') {
      // Raid event - listen for raids TO this broadcaster
      condition.to_broadcaster_user_id = broadcasterId;
    } else if (eventType.includes('moderator') || eventType.includes('shield_mode')) {
      // Moderator events
      condition.broadcaster_user_id = broadcasterId;
      condition.moderator_user_id = userId;
    } else if (eventType.startsWith('channel.shoutout')) {
      // Shoutout events
      condition.broadcaster_user_id = broadcasterId;
      condition.moderator_user_id = userId;
    } else {
      // Most other events just need broadcaster_user_id
      condition.broadcaster_user_id = broadcasterId;
    }

    // Determine the correct version for each event type
    let version = '1';
    // Beta versions are deprecated for most events

    const subscriptionResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: eventType,
        version: version,
        condition: condition,
        transport: {
          method: 'websocket',
          session_id: sessionId
        }
      })
    });

    const result = await subscriptionResponse.json();
    
    if (subscriptionResponse.ok) {
      console.log(`✅ Subscribed to ${eventType}`, result);
    } else {
      console.error(`❌ Failed to subscribe to ${eventType}:`, result);
      console.error('Request details:', {
        type: eventType,
        version: version,
        condition,
        sessionId: sessionId,
        status: subscriptionResponse.status,
        statusText: subscriptionResponse.statusText
      });
    }
  } catch (error) {
    console.error(`Error subscribing to ${eventType}:`, error);
  }
}

export async function unsubscribeFromEvent(
  eventType: string,
  accessToken: string,
  clientId: string
): Promise<void> {
  if (!accessToken) return;

  try {
    // First, get all subscriptions to find the ID
    const response = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Client-Id': clientId
      }
    });

    const data = await response.json();
    const subscription = data.data?.find((sub: any) => sub.type === eventType);

    if (subscription) {
      await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${subscription.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Client-Id': clientId
        }
      });
      console.log(`🔌 Unsubscribed from ${eventType}`);
    }
  } catch (error) {
    console.error(`Error unsubscribing from ${eventType}:`, error);
  }
}
