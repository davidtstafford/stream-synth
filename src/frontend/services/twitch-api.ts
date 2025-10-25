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

    // First, fetch existing subscriptions and avoid creating duplicates
    try {
      const listResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
        headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId }
      });

      let listData: any = { data: [] };
      if (listResponse.ok) {
        listData = await listResponse.json();
        console.log('[EventSub] fetched subscriptions count=', (listData.data || []).length);
      } else {
        console.warn('[EventSub] failed to list subscriptions, status=', listResponse.status);
      }

      const existing = (listData.data || []).find((s: any) => {
        try { return s.type === eventType && JSON.stringify(s.condition) === JSON.stringify(condition); } catch (_) { return false; }
      });

      if (existing) {
        if (existing.transport && existing.transport.session_id === sessionId) {
          console.log(`⏭️ Subscription for ${eventType} already exists for this session, skipping creation`, existing);
          return;
        }

        console.log('[EventSub] Found stale subscription(s); attempting cleanup', existing.id);
        const toRemove = (listData.data || []).filter((s: any) => s.type === eventType && JSON.stringify(s.condition) === JSON.stringify(condition));

        for (const s of toRemove) {
          try {
            console.log('[EventSub] Deleting subscription', s.id, 'session', s.transport?.session_id);
            const delRes = await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${s.id}`, {
              method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId }
            });
            if (delRes.ok) console.log('[EventSub] Deleted', s.id); else console.warn('[EventSub] Failed to delete', s.id, 'status=', delRes.status);
          } catch (err) {
            console.warn('[EventSub] Error deleting subscription', s.id, err);
          }
        }
      }

      const maxAttempts = 3;
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
          console.log(`[EventSub] Creating subscription attempt ${attempt}/${maxAttempts} for ${eventType}`);
          const subscriptionResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
            method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: eventType, version, condition, transport: { method: 'websocket', session_id: sessionId } })
          });

          const result = await subscriptionResponse.json().catch(() => ({}));
          if (subscriptionResponse.ok) { console.log('[EventSub] Subscription created:', result); return; }
          console.warn('[EventSub] Create failed status=', subscriptionResponse.status, 'body=', result);
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        } catch (err) {
          console.warn('[EventSub] Create attempt error', err);
          if (attempt < maxAttempts) await new Promise(r => setTimeout(r, 1000 * attempt));
        }
      }

      console.error('[EventSub] All attempts to create subscription failed for', eventType);
    } catch (err) {
      console.error('Error while checking/creating subscription:', err);
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
