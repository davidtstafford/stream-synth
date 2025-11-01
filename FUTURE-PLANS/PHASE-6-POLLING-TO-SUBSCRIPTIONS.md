# Phase 6: Convert Polling to EventSub Subscriptions

**Status:** 📋 **PLANNING**  
**Priority:** 🔴 **CRITICAL** (API efficiency & real-time responsiveness)  
**Estimated Time:** 12-18 hours  
**Prerequisites:** Phase 5 complete  
**Created:** October 30, 2025

---

## 🎯 Objective

**Convert all polling-based features to real-time EventSub subscriptions** while maintaining polling only for:
1. **Initial data fetch** (on app startup/channel connection)
2. **Periodic reconciliation** (every 1-2 hours to catch missed events)

This will dramatically reduce API calls, improve real-time responsiveness, and eliminate polling intervals from consuming resources.

---

## 📊 Current Polling State

### Active Pollers (from `dynamic-polling-manager.ts`)

| API Type | Current Interval | Purpose | Can Convert? |
|----------|------------------|---------|--------------|
| `followers` | 2 min | New follower detection | ✅ **YES** - `channel.follow` (v2) |
| `moderators` | 5 min | Mod add/remove detection | ⚠️ **WEBHOOK ONLY** |
| `vips` | 5 min | VIP add/remove detection | ❌ **NO EVENTSUB** |
| `subscriptions` | 3 min | Subscriber status tracking | ✅ **PARTIAL** - Events exist, need state |
| `banned` | 1 min | Ban/timeout detection | ⚠️ **WEBHOOK ONLY** |
| `clips` | 10 min | New clip detection | ❌ **NO EVENTSUB** |

### EventSub Availability Matrix

| Feature | EventSub Type | Version | Transport | Available? | Notes |
|---------|---------------|---------|-----------|------------|-------|
| **Followers** | `channel.follow` | v2 | WebSocket ✅ | ✅ **PROVEN** | Tested & working! |
| **Subscriptions** | `channel.subscribe` | v1 | WebSocket ✅ | ✅ YES | New subs only |
| | `channel.subscription.end` | v1 | WebSocket ✅ | ✅ YES | Sub expiry |
| | `channel.subscription.gift` | v1 | WebSocket ✅ | ✅ YES | Gift subs |
| | `channel.subscription.message` | v1 | WebSocket ✅ | ✅ YES | Resub messages |
| **Moderators** | `channel.moderator.add` | v1 | Webhook ⚠️ | ❌ NO | Webhook only |
| | `channel.moderator.remove` | v1 | Webhook ⚠️ | ❌ NO | Webhook only |
| **VIPs** | *(none)* | - | - | ❌ NO | No EventSub available |
| **Bans/Timeouts** | `channel.ban` | v1 | Webhook ⚠️ | ❌ NO | Webhook only |
| | `channel.unban` | v1 | Webhook ⚠️ | ❌ NO | Webhook only |
| **Clips** | *(none)* | - | - | ❌ NO | No EventSub available |

---

## 🚀 Implementation Strategy

### Tier 1: Full Conversion (Stop Polling Entirely)

**✅ Followers** - `channel.follow` (v2)
- **Current:** Poll every 2 minutes
- **New:** Real-time EventSub subscription
- **Polling:** Initial fetch on startup + reconciliation every 2 hours
- **Benefit:** ~720 API calls/day → ~12 API calls/day (98% reduction)

**Status:** ✅ **ALREADY ENABLED** (tested & proven to work!)

---

### Tier 2: Hybrid Approach (EventSub + Reduced Polling)

**⚠️ Subscriptions** - Multiple EventSub types
- **Current:** Poll every 3 minutes
- **New:** Subscribe to 4 event types:
  - `channel.subscribe` (new subs)
  - `channel.subscription.end` (expirations)
  - `channel.subscription.gift` (gift subs)
  - `channel.subscription.message` (resub messages)
- **Polling:** Initial fetch on startup + reconciliation every 2 hours
- **Limitation:** EventSub provides events but NOT current state
- **Solution:** Maintain local cache, reconcile with API periodically
- **Benefit:** ~480 API calls/day → ~60 API calls/day (87% reduction)

---

### Tier 3: Polling Only (No EventSub Available)

**❌ VIPs** - No EventSub
- **Current:** Poll every 5 minutes
- **New:** Poll every 30 minutes (6x reduction)
- **Reconciliation:** On demand when viewing VIP list
- **Rationale:** VIP changes are rare, don't need minute-level updates

**❌ Clips** - No EventSub
- **Current:** Poll every 10 minutes (if enabled)
- **New:** Poll every 60 minutes (6x reduction)
- **Reconciliation:** On demand when viewing clips screen
- **Rationale:** Clips are not time-critical for most use cases

---

### Tier 4: Keep Webhook-Only Features on Polling

**⚠️ Moderators** - Webhook-only EventSub
- **Current:** Poll every 5 minutes
- **New:** Poll every 30 minutes (6x reduction)
- **Rationale:** Can't use webhooks in Electron app
- **Future:** Consider webhook server for advanced deployments

**⚠️ Bans/Timeouts** - Webhook-only EventSub
- **Current:** Poll every 1 minute
- **New:** Poll every 5 minutes (5x reduction)
- **Rationale:** Moderation is important but not every-minute critical
- **Note:** Already have `channel.chat.clear_user_messages` via WebSocket for deleted messages

---

## 📋 Implementation Checklist

### Step 1: Audit & Document (1-2 hours)

- [x] **Identify all active pollers** (see table above)
- [ ] **Map to EventSub availability** (see matrix above)
- [ ] **Document current API call volumes**
- [ ] **Design hybrid state management strategy**

### Step 2: Subscription Event Integration (4-6 hours)

**2A: Enable Subscription Events**

- [ ] Re-enable in `event-types.ts`:
  - `channel.subscribe`
  - `channel.subscription.end`
  - `channel.subscription.gift`
  - `channel.subscription.message`
- [ ] Add to `DEFAULT_SUBSCRIPTIONS` array
- [ ] Add to `EVENT_DISPLAY_INFO`
- [ ] Configure in `twitch-api.ts` (check for special conditions)

**2B: Create Subscription Event Handlers**

- [ ] Create `src/backend/services/subscription-events.ts`
  - Handle new subscriptions
  - Handle expirations
  - Handle gift subs
  - Handle resub messages
  - Update `viewer_roles` table
  - Emit change events to frontend

**2C: Integrate with Existing System**

- [ ] Update `TwitchRoleSyncService` to listen for subscription events
- [ ] Modify `syncSubscribers()` to be reconciliation-only
- [ ] Add `reconcileSubscribers()` method (called hourly)

### Step 3: Reduce Polling Intervals (2-3 hours)

**3A: Update Default Intervals**

Modify `src/backend/database/migrations.ts`:

```typescript
// Current intervals → New intervals
INSERT INTO twitch_polling_config (api_type, interval_seconds, enabled) VALUES
  ('followers', 7200, 1),      -- 120 → 7200 (2 hours, reconciliation only)
  ('moderators', 1800, 1),     -- 300 → 1800 (30 min, no EventSub)
  ('vips', 1800, 1),           -- 300 → 1800 (30 min, no EventSub)
  ('subscriptions', 7200, 1),  -- 180 → 7200 (2 hours, reconciliation only)
  ('banned', 300, 1),          -- 60 → 300 (5 min, webhook-only EventSub)
  ('clips', 3600, 0);          -- 600 → 3600 (1 hour, optional)
```

**3B: Add Initial Fetch Logic**

- [ ] Create `src/backend/services/initial-data-fetcher.ts`
  - `fetchAllFollowers()` - on channel connection
  - `fetchAllModerators()` - on channel connection
  - `fetchAllVIPs()` - on channel connection
  - `fetchAllSubscribers()` - on channel connection
  - `fetchBannedUsers()` - on channel connection
  - Run once on startup, then rely on subscriptions/polling

**3C: Update Polling Manager**

- [ ] Add `isReconciliationMode` flag to pollers
- [ ] Add `runOnce()` method for initial fetches
- [ ] Log "Reconciliation poll" vs "Initial fetch" for clarity

### Step 4: State Management & Reconciliation (3-4 hours)

**4A: Design Reconciliation Strategy**

For each feature:
1. **EventSub provides real-time events** (new follower, new sub, etc.)
2. **Local cache tracks current state** (in database)
3. **Periodic reconciliation** (every 1-2 hours):
   - Fetch full list from API
   - Compare with local cache
   - Identify missed events (if any)
   - Update cache with truth from API
   - Log discrepancies for monitoring

**4B: Implement Reconciliation Services**

- [ ] `FollowerReconciliationService`
  - Compare API followers vs database followers
  - Detect missed follows (shouldn't happen with EventSub)
  - Detect unfollows (no EventSub for this)
- [ ] `SubscriptionReconciliationService`
  - Compare API subs vs database subs
  - Detect missed sub events
  - Detect expirations not caught by EventSub
- [ ] `ModerationReconciliationService`
  - Compare API bans/timeouts vs database
  - Primary source of truth (no EventSub available)

**4C: Add Reconciliation Scheduling**

- [ ] Modify `DynamicPollingManager` to support reconciliation mode
- [ ] Add `last_reconciliation` timestamp to config
- [ ] Run reconciliation every 2 hours (configurable)
- [ ] Log reconciliation results (found X new items, removed Y stale items)

### Step 5: Frontend Updates (2-3 hours)

**5A: Update Polling Config UI**

- [ ] Add "Reconciliation Mode" indicator
- [ ] Show "Last Reconciliation" timestamp
- [ ] Add manual "Reconcile Now" button
- [ ] Update interval labels:
  - "Polling Interval" → "Reconciliation Interval"
  - Show EventSub status for each feature

**5B: Add Status Indicators**

- [ ] Show EventSub connection status
- [ ] Show last event received timestamp
- [ ] Show reconciliation status (success/failure)
- [ ] Add troubleshooting info if EventSub disconnected

### Step 6: Testing & Validation (2-3 hours)

**6A: Test EventSub Coverage**

- [ ] **Followers:** Test real-time follow events
- [ ] **Subscriptions:** Test new sub, gift sub, resub, expiration
- [ ] Verify events stored correctly
- [ ] Verify UI updates in real-time

**6B: Test Reconciliation**

- [ ] Manually create discrepancy (add follower via Twitch UI)
- [ ] Wait for reconciliation poll
- [ ] Verify discrepancy detected and corrected
- [ ] Check logs for "missed event" warnings

**6C: Load Testing**

- [ ] Monitor API call reduction
- [ ] Verify no duplicate events
- [ ] Check memory usage (event handlers vs polling)
- [ ] Validate database performance (event inserts)

**6D: Edge Cases**

- [ ] EventSub disconnection during stream
- [ ] App offline for extended period (catch up on startup)
- [ ] Rate limit handling during reconciliation
- [ ] Simultaneous event + poll collision

---

## 📐 Architecture Changes

### New Services

```
src/backend/services/
  ├── subscription-events.ts          # NEW - Handle sub EventSub events
  ├── initial-data-fetcher.ts         # NEW - Startup data population
  ├── follower-reconciliation.ts      # NEW - Reconcile followers
  ├── subscription-reconciliation.ts  # NEW - Reconcile subs
  └── moderation-reconciliation.ts    # NEW - Reconcile bans/timeouts
```

### Modified Services

```
src/backend/services/
  ├── dynamic-polling-manager.ts      # ADD reconciliation mode
  ├── twitch-role-sync.ts             # MODIFY to use EventSub
  └── twitch-subscriptions.ts         # MODIFY for reconciliation
```

### Database Changes

```sql
-- Add reconciliation tracking
ALTER TABLE twitch_polling_config ADD COLUMN last_reconciliation TEXT;
ALTER TABLE twitch_polling_config ADD COLUMN reconciliation_mode INTEGER DEFAULT 1;

-- Add EventSub metadata to events table
ALTER TABLE events ADD COLUMN is_reconciliation INTEGER DEFAULT 0;
```

---

## 📊 Expected Benefits

### API Call Reduction

| Feature | Before | After | Reduction |
|---------|--------|-------|-----------|
| **Followers** | ~720/day | ~12/day | **98%** ✅ |
| **Subscriptions** | ~480/day | ~60/day | **87%** ✅ |
| **Moderators** | ~288/day | ~48/day | **83%** ✅ |
| **VIPs** | ~288/day | ~48/day | **83%** ✅ |
| **Bans** | ~1440/day | ~288/day | **80%** ✅ |
| **Clips** | ~144/day | ~24/day | **83%** ✅ |
| **TOTAL** | **~3360/day** | **~480/day** | **86%** ✅ |

### Performance Improvements

- ✅ **Real-time updates** for followers & subscriptions (no 2-3 min delay)
- ✅ **Reduced CPU usage** (fewer timers running)
- ✅ **Reduced network traffic** (86% fewer API calls)
- ✅ **Better rate limit headroom** (more API quota for other features)
- ✅ **Lower latency** (EventSub pushes events, no polling delay)

---

## ⚠️ Risks & Mitigations

### Risk 1: EventSub Disconnection

**Risk:** WebSocket connection drops, miss events  
**Mitigation:**
- Reconciliation polling every 2 hours catches missed events
- Automatic reconnection on WebSocket disconnect
- Alert user if EventSub down for >5 minutes

### Risk 2: Reconciliation Performance

**Risk:** Full list API calls could hit rate limits  
**Mitigation:**
- Stagger reconciliation (don't run all at once)
- Use cursor-based pagination
- Implement exponential backoff on 429 errors

### Risk 3: State Consistency

**Risk:** Race condition between EventSub event and reconciliation  
**Mitigation:**
- Use database transactions
- Timestamp comparison (use most recent data)
- Idempotent event handlers

### Risk 4: Webhook-Only Features

**Risk:** Can't get real-time mods/bans without webhooks  
**Mitigation:**
- Document limitation in UI
- Suggest reduced polling intervals (acceptable)
- Consider future webhook server (Phase N)

---

## 🧪 Testing Plan

### Unit Tests

- [ ] EventSub event handlers
- [ ] Reconciliation logic
- [ ] State consistency checks
- [ ] Edge case handling

### Integration Tests

- [ ] EventSub + polling coexistence
- [ ] Reconciliation discovers missed events
- [ ] WebSocket disconnect recovery
- [ ] Database transaction safety

### Manual Tests

- [ ] Real Twitch follow event received
- [ ] Real Twitch subscription event received
- [ ] Reconciliation detects manual API changes
- [ ] UI reflects real-time updates
- [ ] Logs show reduced API calls

---

## 📝 Documentation Updates

### Update These Files

- [ ] `README.md` - Add EventSub architecture section
- [ ] `MASTER-IMPLEMENTATION-ROADMAP.md` - Mark Phase 6 as next priority
- [ ] `POLLING-EVENTS-INTEGRATION.md` - Update with EventSub strategy
- [ ] `FOLLOWER-POLLING-FEATURE.md` - Mark as "converted to EventSub"
- [ ] `MODERATION-STATUS-POLLING-FEATURE.md` - Document hybrid approach
- [ ] `PHASE-6-IMPLEMENTATION-SUMMARY.md` - Create after completion

### Create New Docs

- [ ] `EVENTSUB-ARCHITECTURE.md` - Comprehensive EventSub guide
- [ ] `RECONCILIATION-STRATEGY.md` - How reconciliation works
- [ ] `API-OPTIMIZATION-RESULTS.md` - Before/after metrics

---

## 🎓 Lessons Learned (from channel.follow test)

1. ✅ **Documentation can be wrong** - `channel.follow` marked as webhook-only but works via WebSocket
2. ✅ **Always test first** - Don't assume EventSub won't work without trying
3. ✅ **Version matters** - `channel.follow` v2 requires `moderator_user_id` + `broadcaster_user_id`
4. ✅ **WebSocket transport is preferred** - Simpler than webhooks for Electron apps

### Test Other "Webhook-Only" Events?

Consider testing these marked as webhook-only:
- `channel.moderator.add` / `channel.moderator.remove`
- `channel.ban` / `channel.unban`

**IF they work via WebSocket:** Even bigger API savings! 🎉

---

## 🚢 Rollout Plan

### Phase 6.1: Followers (DONE)

- [x] Enable `channel.follow` EventSub ✅
- [x] Test real-time events ✅
- [x] Verify database storage ✅

### Phase 6.2: Subscriptions (2-3 hours)

- [ ] Enable 4 subscription EventSub types
- [ ] Create subscription event handlers
- [ ] Test with real/test subscriptions

### Phase 6.3: Reduce Polling (2-3 hours)

- [ ] Update default intervals
- [ ] Add reconciliation mode
- [ ] Test initial fetch + reconciliation

### Phase 6.4: State Management (3-4 hours)

- [ ] Implement reconciliation services
- [ ] Add discrepancy detection
- [ ] Test missed event recovery

### Phase 6.5: Frontend & Testing (3-4 hours)

- [ ] Update polling config UI
- [ ] Add status indicators
- [ ] Full integration testing
- [ ] Document results

---

## ✅ Success Criteria

- [ ] **Followers:** 100% real-time via EventSub, reconciliation every 2h
- [ ] **Subscriptions:** 100% real-time via EventSub, reconciliation every 2h
- [ ] **API calls reduced by ≥80%** (measured over 24 hours)
- [ ] **No missed events** (verified through reconciliation logs)
- [ ] **UI updates in <1 second** for EventSub events
- [ ] **All tests passing** (unit + integration + manual)
- [ ] **Documentation complete** (architecture + reconciliation strategy)

---

## 📚 Reference Documentation

- [Twitch EventSub Reference](https://dev.twitch.tv/docs/eventsub/eventsub-subscription-types/)
- [WebSocket vs Webhook Transport](https://dev.twitch.tv/docs/eventsub/#transport)
- [EventSub Versioning](https://dev.twitch.tv/docs/eventsub/manage-subscriptions/#subscription-versioning)
- [Rate Limits](https://dev.twitch.tv/docs/api/guide/#rate-limits)

---

**Next Steps:**
1. Complete Phase 5 (Chat Commands frontend UI)
2. Start Phase 6.2 (Subscription EventSub integration)
3. Monitor API call reduction metrics
4. Document any new EventSub discoveries (like `channel.follow`!)
