import { getSetting, setSetting } from './database';

// Module-level in-flight map to serialize subscribe operations per broadcaster+eventType
const inFlightSubscriptions = new Map<string, Promise<void>>();

export async function subscribeToEvent(
  eventType: string,
  accessToken: string,
  clientId: string,
  sessionId: string,
  broadcasterId: string,
  userId: string
): Promise<void> {
  // Filter out IRC events - they are handled by IRC connection, not EventSub
  if (eventType.startsWith('irc.')) {
    console.log(`[EventSub] Skipping IRC event ${eventType} - handled by IRC connection`);
    return;
  }

  if (!accessToken || !sessionId) {
    console.error('Cannot subscribe: missing token or session', { 
      hasToken: !!accessToken, 
      hasSession: !!sessionId 
    });
    return;
  }

  const key = `${broadcasterId}:${eventType}`;
  if (inFlightSubscriptions.has(key)) {
    console.log('[EventSub] Subscribe already in-flight for', key, '- awaiting existing operation');
    await inFlightSubscriptions.get(key);
    return;
  }

  const opPromise = (async () => {
    try {      // Create subscription condition based on event type
      const condition: any = {};
      if (eventType.startsWith('channel.chat')) {
        condition.broadcaster_user_id = broadcasterId;
        condition.user_id = userId;
      } else if (eventType === 'channel.follow') {
        // channel.follow v2 requires moderator_user_id
        condition.broadcaster_user_id = broadcasterId;
        condition.moderator_user_id = userId;
      } else if (eventType === 'channel.raid') {
        condition.to_broadcaster_user_id = broadcasterId;
      } else if (eventType.includes('moderator') || eventType.includes('shield_mode')) {
        condition.broadcaster_user_id = broadcasterId;
        condition.moderator_user_id = userId;      } else if (eventType.startsWith('channel.shoutout')) {
        condition.broadcaster_user_id = broadcasterId;
        condition.moderator_user_id = userId;
      } else if (eventType === 'channel.ban' || eventType === 'channel.unban') {
        // Ban/unban events ONLY need broadcaster_user_id (per Twitch docs)
        condition.broadcaster_user_id = broadcasterId;
      } else {
        condition.broadcaster_user_id = broadcasterId;
      }

      // Set version based on event type
      let version = '1';
      if (eventType === 'channel.follow') {
        version = '2'; // v2 is current version for channel.follow
      } else if (eventType === 'channel.chat.message') {
        version = '1';
      } else if (eventType === 'channel.chat.clear' || 
                 eventType === 'channel.chat.clear_user_messages' ||
                 eventType === 'channel.chat.message_delete' ||
                 eventType === 'channel.chat_settings.update') {
        version = '1';
      } else if (eventType === 'channel.shield_mode.begin' ||
                 eventType === 'channel.shield_mode.end') {
        version = '1';
      } else if (eventType === 'channel.shoutout.create' ||
                 eventType === 'channel.shoutout.receive') {
        version = '1';
      }

      const persistedKey = `eventsub:${broadcasterId}:${eventType}:subscription_id`;
      const persistedCreatedAtKey = `eventsub:${broadcasterId}:${eventType}:created_at`;

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

        const persistedId = await getSetting(persistedKey);
        const persistedCreatedAt = await getSetting(persistedCreatedAtKey);
        console.log('[EventSub] persisted keys', { persistedKey, hasPersistedId: !!persistedId, persistedCreatedAt });

        const existing = (listData.data || []).find((s: any) => {
          try { return s.type === eventType && JSON.stringify(s.condition) === JSON.stringify(condition); } catch (_) { return false; }
        });

        if (persistedId) {
          const foundById = (listData.data || []).find((s: any) => s.id === persistedId);
          if (foundById) {
            if (foundById.transport && foundById.transport.session_id === sessionId) {
              console.log(`[EventSub] Reusing persisted subscription id for ${eventType}`);
              return;
            }

            const ageMs = persistedCreatedAt ? (Date.now() - Number(persistedCreatedAt)) : null;
            const recentThresholdMs = 10 * 60 * 1000; // 10 minutes
            if (ageMs !== null && ageMs < recentThresholdMs) {
              console.log(`[EventSub] Persisted subscription is recent (${Math.round(ageMs/1000)}s); delaying delete to avoid churn`);
              await new Promise(r => setTimeout(r, 3000));
              const refreshResp = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', { headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId } });
              const refreshData = await refreshResp.json().catch(() => ({ data: [] }));
              const refreshed = (refreshData.data || []).find((s: any) => s.id === persistedId);
              if (refreshed && refreshed.transport && refreshed.transport.session_id === sessionId) {
                console.log(`[EventSub] Persisted subscription now matches current session, reusing`);
                return;
              }
              console.log(`[EventSub] Persisted subscription still mismatched, will replace it`);
            }
          }
        }

        if (existing) {
          console.log('[EventSub] Existing matching subscriptions detected; will perform post-create dedupe if needed');
        }

        const maxAttempts = 3;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            console.log(`[EventSub] Creating subscription attempt ${attempt}/${maxAttempts} for ${eventType}`);
            const subscriptionResponse = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', {
              method: 'POST', headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId, 'Content-Type': 'application/json' },
              body: JSON.stringify({ type: eventType, version, condition, transport: { method: 'websocket', session_id: sessionId } })
            });            const result = await subscriptionResponse.json().catch(() => ({}));
            if (subscriptionResponse.ok) {
              console.log('[EventSub] Subscription created:', result);
              if (result && result.data && result.data[0] && result.data[0].id) {
                try {
                  const newId = result.data[0].id as string;
                  await setSetting(persistedKey, newId);
                  await setSetting(persistedCreatedAtKey, String(Date.now()));
                  console.log('[EventSub] Persisted subscription id (redacted)');
                } catch (err) {
                  console.warn('[EventSub] Failed to persist subscription id', err);
                }
              }

              // Post-create: re-list subscriptions and remove duplicates safely
              try {
                const postListResp = await fetch('https://api.twitch.tv/helix/eventsub/subscriptions', { headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId } });
                const postList = await postListResp.json().catch(() => ({ data: [] }));
                const matches = (postList.data || []).filter((s: any) => s.type === eventType && JSON.stringify(s.condition) === JSON.stringify(condition));
                if (matches.length > 1) {
                  let keeper = matches.find((s: any) => s.transport?.session_id === sessionId) || null;
                  if (!keeper && persistedId) keeper = matches.find((s: any) => s.id === persistedId) || null;
                  if (!keeper) {
                    keeper = matches.slice().sort((a: any, b: any) => (new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))[0];
                  }
                  for (const s of matches) {
                    if (s.id === keeper.id) continue;
                    try {
                      console.log('[EventSub] Post-create deleting duplicate', s.id, 'session', s.transport?.session_id);
                      await fetch(`https://api.twitch.tv/helix/eventsub/subscriptions?id=${s.id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${accessToken}`, 'Client-Id': clientId } });
                    } catch (err) {
                      console.warn('[EventSub] Failed to delete duplicate subscription', s.id, err);
                    }
                  }
                  try {
                    await setSetting(persistedKey, keeper.id);
                    await setSetting(persistedCreatedAtKey, String(new Date(keeper.created_at).getTime()));
                  } catch (err) {
                    console.warn('[EventSub] Failed to persist keeper id', err);
                  }
                }
              } catch (err) {
                console.warn('[EventSub] Post-create dedupe failed', err);
              }

              return;
            }
            
            // Enhanced error logging for debugging
            console.error(`[EventSub] ❌ Create FAILED for ${eventType}`);
            console.error(`[EventSub] Status: ${subscriptionResponse.status}`);
            console.error(`[EventSub] Error body:`, JSON.stringify(result, null, 2));
            console.error(`[EventSub] Condition sent:`, JSON.stringify(condition, null, 2));
            console.error(`[EventSub] Version sent: ${version}`);
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
  })();

  inFlightSubscriptions.set(key, opPromise);
  try {
    await opPromise;
  } finally {
    inFlightSubscriptions.delete(key);
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

    // Clear any persisted subscription id/settings for this eventType across broadcasters.
    try {
      // persisted key format used by subscribeToEvent
      const keysToClear = data.data?.map((s: any) => `eventsub:${s.condition?.broadcaster_user_id}:${s.type}:subscription_id`) || [];
      const createdKeysToClear = data.data?.map((s: any) => `eventsub:${s.condition?.broadcaster_user_id}:${s.type}:created_at`) || [];
      for (const k of keysToClear) {
        try { await setSetting(k, ''); } catch (_) { /* ignore */ }
      }
      for (const k of createdKeysToClear) {
        try { await setSetting(k, ''); } catch (_) { /* ignore */ }
      }
      console.log('[EventSub] Cleared persisted subscription keys for unsubscribe (best-effort)');
    } catch (err) {
      console.warn('[EventSub] Error clearing persisted subscription keys', err);
    }

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
