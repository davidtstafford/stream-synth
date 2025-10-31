# Phase 7: EventSub WebSocket Integration - Implementation Plan

**Date:** October 31, 2025  
**Status:** 🚀 **PLANNING**  
**Goal:** Add real-time EventSub WebSocket events with fallback polling (2-4 hours)

---

## Architecture Overview

```
User Action (Follow/Sub/Mod/VIP)
    ↓
Twitch EventSub WebSocket (REAL-TIME PRIMARY)
    ↓
Event Router → Handlers (apply business logic)
    ↓
Database Updates:
  - follower_history (for follows)
  - viewer_roles (for mod/vip changes)
  - viewer_subscriptions (for subs)
  - events table (record all events)
    ↓
Frontend: Events screen shows event + description
    ↓
Polling (FALLBACK - every 2-4 hours): catches any missed events
```

---

## EventSub Event Types (8 total)

| Event Type | WebSocket | What Happens | Database Updates |
|------------|-----------|--------------|------------------|
| `channel.follow` (v2) | ✅ YES | User follows channel | follower_history + events |
| `channel.subscribe` | ✅ YES | User subscribes | viewer_subscriptions + events |
| `channel.subscription.end` | ✅ YES | Sub expires | viewer_subscriptions (end_date) |
| `channel.subscription.gift` | ✅ YES | Gifted subscription | viewer_subscriptions (is_gift=1) |
| `channel.moderator.add` | ✅ YES | User becomes mod | viewer_roles + events |
| `channel.moderator.remove` | ✅ YES | User loses mod | viewer_roles (revoke) + events |
| `channel.vip.add` | ✅ YES | User becomes VIP | viewer_roles + events |
| `channel.vip.remove` | ✅ YES | User loses VIP | viewer_roles (revoke) + events |

---

## Implementation Steps

### Step 1: EventSub WebSocket Manager

**File:** `src/backend/services/eventsub-manager.ts`

**Responsibility:**
- Connect to Twitch EventSub WebSocket
- Handle WebSocket lifecycle (connect, reconnect, disconnect)
- Subscribe to 8 event types
- Validate incoming events
- Emit events to router

**Key Methods:**
- `initialize(userId, channelId, accessToken, clientId)` - Connect and subscribe
- `subscribe(eventType)` - Subscribe to specific event
- `unsubscribe(eventType)` - Unsubscribe from event
- `getStatus()` - Return connection status
- `destroy()` - Clean disconnect

**Events Emitted:**
- `ready` - Connected and subscribed
- `event` - EventSub event received
- `error` - Connection error
- `disconnected` - Connection lost

---

### Step 2: Event Router & Handlers

**File:** `src/backend/services/eventsub-event-router.ts`

**Responsibility:**
- Route events to appropriate handlers
- Apply business logic (same as polling was doing)
- Record events to database

**Event Handlers:**

1. **Follow Handler** - `channel.follow`
   - Create viewer if not exists
   - Record to `follower_history` (action: 'follow')
   - Record to `events` table

2. **Subscribe Handler** - `channel.subscribe`
   - Update `viewer_subscriptions` (tier, start_date)
   - Record to `events` table

3. **Subscription End Handler** - `channel.subscription.end`
   - Update `viewer_subscriptions` (end_date)
   - Record to `events` table

4. **Subscription Gift Handler** - `channel.subscription.gift`
   - Create subscription with is_gift=1
   - Record to `events` table

5. **Moderator Add Handler** - `channel.moderator.add`
   - Create/update `viewer_roles` (role_type='moderator')
   - Record to `events` table

6. **Moderator Remove Handler** - `channel.moderator.remove`
   - Revoke `viewer_roles` (set revoked_at)
   - Record to `events` table

7. **VIP Add Handler** - `channel.vip.add`
   - Create/update `viewer_roles` (role_type='vip')
   - Record to `events` table

8. **VIP Remove Handler** - `channel.vip.remove`
   - Revoke `viewer_roles` (set revoked_at)
   - Record to `events` table

---

### Step 3: IPC Handlers

**File:** `src/backend/core/ipc-handlers/eventsub.ts`

**Handlers:**
- `get-eventsub-status` - Return connection status, subscriptions, session info
- `initialize-eventsub` - Start EventSub connection
- `disconnect-eventsub` - Stop EventSub connection

---

### Step 4: Frontend UI

**File:** `src/frontend/services/eventsub.ts`
- Wrapper functions for IPC calls

**File:** `src/frontend/screens/system/eventsub-dashboard.tsx`
- Show EventSub connection status
- List subscribed events
- Connect/Disconnect buttons
- Manual refresh

---

### Step 5: Event Type Descriptions

**File:** `src/frontend/config/event-types.ts` (UPDATE)

Add EventSub event descriptions:
```typescript
'channel.follow': 'New Follower',
'channel.subscribe': 'New Subscription',
'channel.subscription.end': 'Subscription Expired',
'channel.subscription.gift': 'Gifted Subscription',
'channel.moderator.add': 'Moderator Added',
'channel.moderator.remove': 'Moderator Removed',
'channel.vip.add': 'VIP Added',
'channel.vip.remove': 'VIP Removed',
```

---

## Database: What Already Exists

✅ **Tables exist and ready:**
- `events` - Records all events (event_type, event_data, viewer_id, channel_id)
- `follower_history` - Records follows (action: 'follow'/'unfollow')
- `viewer_subscriptions` - Records subscriptions (tier, is_gift, start_date, end_date)
- `viewer_roles` - Records roles (role_type: 'moderator'/'vip', granted_at, revoked_at)
- `viewers` - User records

✅ **Views exist:**
- `current_followers` - Latest follower state
- Subscription status view

---

## Polling: Fallback Strategy

**Current polling intervals (existing):**
- `followers` - 60 seconds (REDUCE TO: 2-4 hours when EventSub active)
- `role_sync` - 30 minutes (REDUCE TO: 2-4 hours when EventSub active)

**Why keep polling?**
- Safety net if EventSub disconnects
- Catch any missed real-time events
- Periodic reconciliation

---

## Implementation Order

1. ✅ Create `eventsub-manager.ts` (WebSocket connection)
2. ✅ Create `eventsub-event-router.ts` (Event handlers)
3. ✅ Create `src/backend/core/ipc-handlers/eventsub.ts` (IPC handlers)
4. ✅ Register handlers in `src/backend/core/ipc-handlers/index.ts`
5. ✅ Create `src/frontend/services/eventsub.ts` (IPC wrapper)
6. ✅ Create EventSub dashboard UI component
7. ✅ Add event descriptions to `event-types.ts`
8. ✅ Test EventSub integration
9. ✅ Verify polling fallback works
10. ✅ Documentation

---

## Success Criteria

- [ ] EventSub connects on app startup
- [ ] All 8 event types subscribed
- [ ] Events appear in Events screen with descriptions
- [ ] Follow events recorded to follower_history
- [ ] Mod/VIP events recorded to viewer_roles
- [ ] Sub events recorded to viewer_subscriptions
- [ ] EventSub dashboard shows status
- [ ] Polling fallback works if EventSub disconnects
- [ ] Build passes (0 errors)
- [ ] No console errors

---

## Files to Create

```
src/backend/
  services/
    ├─ eventsub-manager.ts (NEW)
    ├─ eventsub-event-router.ts (NEW)
  core/ipc-handlers/
    └─ eventsub.ts (NEW)

src/frontend/
  services/
    └─ eventsub.ts (NEW)
  screens/system/
    ├─ eventsub-dashboard.tsx (NEW)
    └─ eventsub-dashboard.css (NEW)
```

## Files to Modify

```
src/backend/core/ipc-handlers/
  └─ index.ts (MODIFY - register handlers)

src/frontend/config/
  └─ event-types.ts (MODIFY - add descriptions)

src/backend/services/
  └─ dynamic-polling-manager.ts (MODIFY - reduce intervals when EventSub active)
```

---

## Testing Checklist

- [ ] Manually follow channel → Event recorded
- [ ] Subscribe to channel → Event recorded
- [ ] Grant/revoke mod → Event recorded
- [ ] Grant/revoke VIP → Event recorded
- [ ] Events screen shows all with descriptions
- [ ] EventSub dashboard shows connected status
- [ ] Disconnect EventSub → Polling takes over
- [ ] Reconnect EventSub → Back to real-time

---

**Ready to start Step 1: EventSub Manager?**
