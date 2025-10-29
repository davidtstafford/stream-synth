# Twitch Role Sync Strategy

## Overview
This document explains when and how viewer roles (Subscribers, VIPs, Moderators) are synchronized from Twitch in the TTS Access & Enablement System.

---

## 🔄 Automatic Sync Points

### 1. **App Startup** ⭐ IMPLEMENTED
- **When**: Every time the application launches
- **Condition**: Only if user has an active Twitch connection
- **Location**: `src/backend/core/ipc-handlers/startup.ts`
- **Details**: 
  - Runs once during `runStartupTasks()`
  - Syncs all three role types in parallel (fast)
  - Logs results to console
  - Silently handles errors without blocking startup

### 2. **Periodic Background Sync** ⭐ IMPLEMENTED
- **When**: Every 30 minutes while app is running
- **Condition**: Only runs if user has active session
- **Location**: `src/backend/core/ipc-handlers/startup.ts`
- **Details**:
  - Scheduled via `setInterval()` at startup
  - Runs silently in background
  - No UI notifications (reduces noise)
  - Automatically skips if not connected

### 3. **Manual Button Sync** ⭐ IMPLEMENTED
- **When**: User clicks "⟳ Sync from Twitch" button
- **Location**: Viewers screen (`src/frontend/screens/viewers/viewers.tsx`)
- **Details**:
  - User-initiated, explicit action
  - Shows syncing state in UI
  - Displays success message with counts
  - Auto-refreshes viewer list after completion

---

## 🎯 Recommended Future Sync Points

### 4. **On OAuth Connection** (NOT YET IMPLEMENTED)
- **When**: Immediately after successful Twitch authentication
- **Why**: Fresh token = fresh data opportunity
- **Implementation Location**: `src/backend/auth/twitch-oauth.ts`
- **Code Example**:
```typescript
// After successful OAuth, before returning result
const roleSyncService = new TwitchRoleSyncService();
await roleSyncService.syncAllRoles(userId, channelId, 'oauth-connect');
```

### 5. **On Stream Start** (NOT YET IMPLEMENTED)
- **When**: EventSub receives `stream.online` event
- **Why**: Critical time - stream starting, viewers arriving
- **Implementation Location**: EventSub handler (WebSocket event processing)
- **Code Example**:
```typescript
case 'stream.online':
  const roleSyncService = new TwitchRoleSyncService();
  await roleSyncService.syncAllRoles(channelId, userId, 'stream-start');
  break;
```

### 6. **After Access Denial** (OPTIONAL - LOW PRIORITY)
- **When**: Viewer's TTS request is denied due to lack of access
- **Why**: User might have just been granted VIP/mod status
- **Complexity**: Requires debouncing to avoid API spam
- **Not Recommended**: Better to rely on periodic sync

---

## 🛠️ Centralized Sync Service

### **TwitchRoleSyncService**
Location: `src/backend/services/twitch-role-sync.ts`

All sync operations now use this centralized service for:
- ✅ Consistent error handling
- ✅ Unified logging with source tracking
- ✅ Parallel execution (all 3 APIs called simultaneously)
- ✅ Combined results with counts
- ✅ Reusable across different sync triggers

#### **Usage Examples**

```typescript
import { TwitchRoleSyncService } from '../services/twitch-role-sync';

const syncService = new TwitchRoleSyncService();

// Sync all roles (recommended)
const result = await syncService.syncAllRoles(channelId, userId, 'source-name');
console.log(`Synced: ${result.subCount} subs, ${result.vipCount} VIPs, ${result.modCount} mods`);

// Sync only subscriptions
const subResult = await syncService.syncSubscriptionsOnly(channelId, userId, 'source');

// Sync only VIPs
const vipResult = await syncService.syncVIPsOnly(channelId, userId, 'source');

// Sync only moderators
const modResult = await syncService.syncModeratorsOnly(channelId, 'source');
```

---

## 📊 Sync Frequency Summary

| Trigger | Frequency | Auto/Manual | Status |
|---------|-----------|-------------|--------|
| **App Startup** | Once per launch | Automatic | ✅ Implemented |
| **Background Periodic** | Every 30 minutes | Automatic | ✅ Implemented |
| **Manual Button** | User-initiated | Manual | ✅ Implemented |
| **OAuth Connection** | Once per connect | Automatic | ⏳ Recommended |
| **Stream Start** | Once per stream | Automatic | ⏳ Optional |
| **Access Denial** | On-demand | Reactive | ❌ Not recommended |

---

## 🔍 How Role Determination Works

### **Data Flow**
```
1. Sync Trigger (startup/periodic/manual)
   ↓
2. TwitchRoleSyncService.syncAllRoles()
   ↓
3. Parallel API Calls:
   - GET /helix/subscriptions/user (OAuth: channel:read:subscriptions)
   - GET /helix/channels/vips (OAuth: channel:read:vips)
   - GET /helix/moderation/moderators (OAuth: moderation:read)
   ↓
4. Database Updates (atomic transactions):
   - Grant roles to viewers in API response
   - Revoke roles from viewers NOT in API response
   ↓
5. viewer_roles table updated (revoked_at = NULL for active)
   ↓
6. Access control queries check revoked_at IS NULL
```

### **Database Storage**
```sql
viewer_roles:
  - viewer_id (FK to viewers.id)
  - role_type ('vip' | 'moderator' | 'broadcaster')
  - granted_at (timestamp)
  - revoked_at (NULL = active, timestamp = revoked)
```

### **Access Check Query**
```sql
-- Check if viewer is VIP
SELECT COUNT(*) FROM viewer_roles 
WHERE viewer_id = ? 
  AND role_type = 'vip' 
  AND revoked_at IS NULL
```

---

## ⚡ Performance Characteristics

### **Parallel Execution**
All three API calls execute simultaneously:
- Reduces total sync time by ~3x
- Typical sync completes in 200-500ms
- API rate limits respected per endpoint

### **Database Transactions**
Each role type syncs atomically:
- Grant all active roles
- Revoke all inactive roles
- All-or-nothing per role type

### **Startup Impact**
- Startup sync is non-blocking
- App remains responsive
- Errors logged but don't crash app

---

## 🚨 Error Handling

### **Partial Success**
If one API fails but others succeed:
```typescript
{
  success: false,  // At least one failed
  subCount: 25,    // Successful
  vipCount: 0,     // Failed
  modCount: 3,     // Successful
  errors: ['VIPs: 401 Unauthorized - missing channel:read:vips scope']
}
```

### **Complete Failure**
If all APIs fail:
```typescript
{
  success: false,
  subCount: 0,
  vipCount: 0,
  modCount: 0,
  errors: ['Network error', 'API timeout', ...]
}
```

### **Missing OAuth Scopes**
- Error message indicates missing scope
- User must re-authenticate with Twitch
- Disconnect → Reconnect to get new permissions

---

## 📝 Logging

All sync operations log with source tracking:
```
[RoleSync:startup] Starting sync for channel 12345678...
[RoleSync:startup] Complete in 234ms: 15 subs, 2 VIPs, 3 mods
[RoleSync:manual-ui] Starting sync for channel 12345678...
[RoleSync:background-30min] Complete in 189ms: 15 subs, 2 VIPs, 3 mods
```

Sources used:
- `startup` - App launch sync
- `background-30min` - Periodic background sync
- `manual-ui` - User clicked sync button
- `oauth-connect` - After Twitch authentication (future)
- `stream-start` - When stream goes live (future)

---

## 🔐 Required OAuth Scopes

### **For Subscribers**
- `channel:read:subscriptions` ✅ Already in scope list

### **For VIPs**
- `channel:read:vips` ✅ Already in scope list
- `channel:manage:vips` ✅ Added (alternative scope)

### **For Moderators**
- `moderation:read` ✅ Added

**Note**: User must re-authenticate after scope changes!

---

## 🎯 Best Practices

### **When to Sync**
✅ **DO**: Sync on startup, periodically, and on user request
✅ **DO**: Sync after OAuth connection (when implemented)
✅ **DO**: Use centralized `TwitchRoleSyncService`
❌ **DON'T**: Sync on every TTS message (too frequent)
❌ **DON'T**: Sync multiple times per minute (API limits)

### **Error Handling**
✅ **DO**: Log errors but continue app operation
✅ **DO**: Show user-friendly messages in UI
✅ **DO**: Return partial success data
❌ **DON'T**: Crash app on sync failures
❌ **DON'T**: Spam user with error notifications

### **Performance**
✅ **DO**: Use parallel API calls
✅ **DO**: Use database transactions
✅ **DO**: Cache results between syncs
❌ **DON'T**: Block UI during sync
❌ **DON'T**: Sync more than once per 5 minutes from same trigger

---

## 📅 Maintenance

### **Cleanup Tasks**
The app automatically cleans up:
- Expired channel point grants (every 5 minutes)
- Keeps expired records for 7 days before deletion

### **No Cleanup Needed For**
- Revoked roles (kept indefinitely with `revoked_at` timestamp)
- Viewer records (never auto-deleted)
- Session history (grows unbounded currently)

---

## 🔮 Future Enhancements

1. **OAuth Connection Sync** - High priority, easy to implement
2. **Stream Start Sync** - Medium priority, requires EventSub handler
3. **Configurable Sync Interval** - Allow user to adjust 30-minute default
4. **Last Sync Timestamp UI** - Show users when data was last refreshed
5. **Sync Status Indicator** - Real-time badge showing sync health
6. **Manual Refresh Per Viewer** - Right-click → "Refresh Roles" for single viewer

---

## 📚 Related Files

- `src/backend/services/twitch-role-sync.ts` - Centralized sync service
- `src/backend/services/twitch-subscriptions.ts` - Subscription API calls
- `src/backend/services/twitch-vip.ts` - VIP API calls
- `src/backend/services/twitch-moderators.ts` - Moderator API calls
- `src/backend/database/repositories/viewer-roles.ts` - Role database operations
- `src/backend/core/ipc-handlers/startup.ts` - Startup and periodic sync
- `src/backend/core/ipc-handlers/twitch.ts` - Manual sync IPC handler
- `src/frontend/screens/viewers/viewers.tsx` - Manual sync button UI
