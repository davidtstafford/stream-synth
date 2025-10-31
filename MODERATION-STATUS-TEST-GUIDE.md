# Moderation Status Feature - Testing Guide

## Quick Test Checklist

Follow these steps to verify the moderation status feature is working correctly.

---

## Prerequisites

- [x] Application built successfully (`npm run build`)
- [x] Connected to Twitch with valid OAuth token
- [x] EventSub WebSocket connected
- [x] At least one viewer in the Viewers screen

---

## Test 1: Ban a User

### Steps:
1. Open the application and navigate to **Viewers** screen
2. Note a viewer's username (e.g., "testuser")
3. In Twitch chat (as a moderator or broadcaster), type:
   ```
   /ban testuser spam
   ```
4. **Expected Result:**
   - Viewers screen auto-refreshes (should happen within 1-2 seconds)
   - A red **BANNED** badge appears in the Moderation column
   - The reason "spam" appears below the badge in italics

### Console Logs to Check:
```
[Viewers] Moderation changed event received: { ... }
```

### Database Verification:
```sql
SELECT * FROM current_moderation_status WHERE user_login = 'testuser';
-- Should show: current_status = 'banned', reason = 'spam'
```

---

## Test 2: Unban a User

### Steps:
1. Keep the Viewers screen open
2. In Twitch chat, type:
   ```
   /unban testuser
   ```
3. **Expected Result:**
   - Viewers screen auto-refreshes
   - The **BANNED** badge disappears
   - Moderation column shows "—" (dash)

### Console Logs to Check:
```
[Viewers] Moderation changed event received: { ... }
```

---

## Test 3: Timeout a User

### Steps:
1. In Twitch chat, type:
   ```
   /timeout testuser 600 chat violation
   ```
   (600 seconds = 10 minutes)

2. **Expected Result:**
   - Viewers screen auto-refreshes
   - An orange **TIMED OUT** badge appears
   - Reason "chat violation" appears below badge
   - Hover over badge to see expiration time tooltip

### Console Logs to Check:
```
[Viewers] Moderation changed event received: { ... }
```

### Database Verification:
```sql
SELECT * FROM current_moderation_status WHERE user_login = 'testuser';
-- Should show: 
--   current_status = 'timed_out'
--   reason = 'chat violation'
--   timeout_expires_at = (current time + 600 seconds)
```

---

## Test 4: Manual Refresh

### Steps:
1. Ban a user via Twitch (without the app running)
2. Start the application
3. Navigate to Viewers screen
4. Click the **Refresh** button

**Expected Result:**
- Banned user shows **BANNED** badge
- Data loads from database correctly

---

## Test 5: Multiple Moderation Statuses

### Steps:
1. Have multiple viewers in your channel
2. Ban one user
3. Timeout another user
4. Leave others unbanned

**Expected Result:**
- Banned user: Red **BANNED** badge
- Timed out user: Orange **TIMED OUT** badge
- Normal users: "—" in Moderation column
- All visible simultaneously in table

---

## Test 6: EventSub Event Flow

### Verify Backend Logs:

When you ban a user, you should see:
```
[EventSubIntegration] ⚡ RECEIVED EVENT FROM FRONTEND: channel.ban
[EventRouter] Processing ban event: testuser
[EventRouter] ✓ Ban event recorded
```

When you unban a user:
```
[EventSubIntegration] ⚡ RECEIVED EVENT FROM FRONTEND: channel.unban
[EventRouter] Processing unban event: testuser
[EventRouter] ✓ Unban event recorded
```

---

## Test 7: Visual Verification

### Check Table Column Order:
| Display Name | Roles | **Moderation** ← Should be here | Subscription | First Seen | ... |

### Badge Styles:

**BANNED Badge:**
- Color: White text on dark red background (`#d32f2f`)
- Size: Small (11px font, 3px padding)
- Position: In Moderation column

**TIMED OUT Badge:**
- Color: White text on orange background (`#f57c00`)
- Has tooltip with expiration time
- Reason shown below in gray italics

---

## Troubleshooting

### Issue: Badge not appearing after ban

**Check:**
1. Is EventSub connected? (Connection screen → EventSub Dashboard)
2. Are ban/unban events subscribed? (Should be in default subscriptions)
3. Check console for errors
4. Try manual refresh button

**Fix:**
```
1. Open Connection screen
2. Verify "Connected" status under EventSub
3. Check "Subscribed Events" list includes channel.ban and channel.unban
```

---

### Issue: Viewers screen not auto-refreshing

**Check:**
1. Open DevTools Console (Ctrl+Shift+I)
2. Look for: `[Viewers] Moderation changed event received`
3. If missing, IPC event not being emitted

**Fix:**
```javascript
// In DevTools Console, verify IPC listener is registered:
const { ipcRenderer } = window.require('electron');
ipcRenderer.eventNames(); // Should include 'eventsub:moderation-changed'
```

---

### Issue: Database shows moderation but UI doesn't

**Check:**
```sql
-- Verify view includes moderation fields
SELECT moderation_status, moderation_reason 
FROM viewer_subscription_status 
LIMIT 1;
```

**If NULL:**
- View might not have been updated
- Restart application to re-run migrations

---

## Advanced Testing

### Test Database Queries

```sql
-- Get all banned users
SELECT display_name, moderation_reason 
FROM viewer_subscription_status 
WHERE moderation_status = 'banned';

-- Get all timed out users with expiration
SELECT display_name, moderation_expires_at 
FROM viewer_subscription_status 
WHERE moderation_status = 'timed_out';

-- Get moderation history for a specific user
SELECT action, reason, moderator_login, action_at 
FROM moderation_history 
WHERE user_login = 'testuser' 
ORDER BY detected_at DESC;
```

### Test IPC Events Manually

```javascript
// In DevTools Console:
const { ipcRenderer } = window.require('electron');

// Simulate moderation event
ipcRenderer.send('eventsub-event-received', {
  type: 'channel.ban',
  data: {
    user_login: 'testuser',
    user_name: 'TestUser',
    user_id: '12345',
    broadcaster_user_login: 'yourchannel',
    broadcaster_user_id: '67890',
    moderator_user_login: 'moderator',
    moderator_user_id: '11111',
    reason: 'testing',
    banned_at: new Date().toISOString()
  },
  timestamp: new Date().toISOString()
});

// Should trigger auto-refresh in Viewers screen
```

---

## Expected Console Output

### On Ban Event:
```
[Connection] EventSub notification received: channel.ban
[EventSubIntegration] ⚡ RECEIVED EVENT FROM FRONTEND: channel.ban
[EventRouter] Processing ban event: testuser
[ModerationHistory] Recording ban: testuser by moderator (reason: testing)
[EventRouter] ✓ Ban event recorded
[Viewers] Moderation changed event received: { userId: '12345', action: 'ban' }
[Viewers] Loading viewers...
```

### On Unban Event:
```
[Connection] EventSub notification received: channel.unban
[EventSubIntegration] ⚡ RECEIVED EVENT FROM FRONTEND: channel.unban
[EventRouter] Processing unban event: testuser
[ModerationHistory] Recording unban: testuser by moderator
[EventRouter] ✓ Unban event recorded
[Viewers] Moderation changed event received: { userId: '12345', action: 'unban' }
[Viewers] Loading viewers...
```

---

## Success Criteria

- [x] Ban event shows red BANNED badge immediately
- [x] Unban event removes badge immediately
- [x] Timeout shows orange TIMED OUT badge with expiration tooltip
- [x] Reason text appears below badges
- [x] Manual refresh loads moderation status correctly
- [x] Multiple moderation statuses display simultaneously
- [x] No console errors during testing
- [x] Database queries return correct data

---

## Known Behaviors

### Normal:
- ✅ Timeout badge doesn't automatically disappear when timeout expires
  - *Requires manual refresh or next event to update*
- ✅ Moderation column shows "—" for users with no moderation actions
- ✅ Multiple bans/unbans update status to most recent action

### Not Normal (Report if seen):
- ❌ Badge appears but wrong color
- ❌ Console shows IPC event but UI doesn't refresh
- ❌ Database has data but UI shows "—"
- ❌ Badge persists after unban

---

## Next Steps After Testing

1. **If all tests pass:** Feature is working correctly ✅
2. **If some tests fail:** Check troubleshooting section above
3. **For new features:** See `MODERATION-STATUS-FEATURE-COMPLETE.md` → Future Enhancements

---

**Happy Testing!** 🎯

*Last Updated: October 31, 2025*
