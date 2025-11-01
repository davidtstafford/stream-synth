# Viewer Detail Modal - Integration & Testing Guide

## System Integration Points

### 1. Database Layer
```
ViewerHistoryRepository
├── getViewerDetailedHistory(viewerId)
│   ├── Query: viewers table
│   ├── Query: viewer_roles table (history)
│   ├── Query: moderation_history table
│   ├── Query: follower_history table
│   ├── Query: viewer_subscriptions table
│   ├── Query: events table (count)
│   └── Combine: Sort by timestamp DESC
│
└── getViewerStats(viewerId)
    ├── first_seen: from viewers.created_at
    ├── last_seen: MAX(detected_at) from all tables
    ├── totalEvents: COUNT from events table
    ├── moderationActions: COUNT from moderation_history
    └── roleChanges: COUNT from viewer_roles
```

### 2. Service Layer
```
ViewerModerationActionsService
├── banUser()
│   ├── Input validation
│   ├── Fetch: POST /helix/moderation/bans
│   ├── Params: broadcaster_id, moderator_id
│   └── Body: user_id, reason (optional)
│
├── unbanUser()
│   ├── Fetch: DELETE /helix/moderation/bans
│   └── Params: broadcaster_id, moderator_id, user_id
│
├── timeoutUser()
│   ├── Duration validation (1-604800 seconds)
│   ├── Fetch: POST /helix/moderation/bans
│   └── Body: user_id, duration, reason (optional)
│
├── addModerator()
│   ├── Fetch: POST /helix/moderation/moderators
│   └── Body: user_id
│
├── removeModerator()
│   ├── Fetch: DELETE /helix/moderation/moderators
│   └── Params: broadcaster_id, user_id
│
├── addVIP()
│   ├── Fetch: POST /helix/channels/vips
│   └── Body: user_id
│
└── removeVIP()
    ├── Fetch: DELETE /helix/channels/vips
    └── Params: broadcaster_id, user_id
```

### 3. IPC Layer
```
setupDatabaseHandlers()
├── viewer:get-detailed-history
│   ├── Input: viewerId (string)
│   ├── Validation: viewerId required
│   └── Execute: viewerHistoryRepo.getViewerDetailedHistory()
│
├── viewer:get-stats
│   ├── Input: viewerId (string)
│   ├── Validation: viewerId required
│   └── Execute: viewerHistoryRepo.getViewerStats()
│
├── viewer:ban
│   ├── Input: {broadcasterId, userId, displayName, reason, accessToken, clientId}
│   ├── Validation: All required fields
│   └── Execute: moderationActionsService.banUser()
│
├── viewer:unban
│   ├── Input: {broadcasterId, userId, displayName, accessToken, clientId}
│   └── Execute: moderationActionsService.unbanUser()
│
├── viewer:timeout
│   ├── Input: {broadcasterId, userId, displayName, durationSeconds, reason, accessToken, clientId}
│   └── Execute: moderationActionsService.timeoutUser()
│
├── viewer:add-mod
│   ├── Input: {broadcasterId, userId, displayName, accessToken, clientId}
│   └── Execute: moderationActionsService.addModerator()
│
├── viewer:remove-mod
│   ├── Input: {broadcasterId, userId, displayName, accessToken, clientId}
│   └── Execute: moderationActionsService.removeModerator()
│
├── viewer:add-vip
│   ├── Input: {broadcasterId, userId, displayName, accessToken, clientId}
│   └── Execute: moderationActionsService.addVIP()
│
└── viewer:remove-vip
    ├── Input: {broadcasterId, userId, displayName, accessToken, clientId}
    └── Execute: moderationActionsService.removeVIP()
```

### 4. Frontend Service Layer
```
database.ts (Frontend)
├── getViewerDetailedHistory(viewerId)
│   └── ipcRenderer.invoke('viewer:get-detailed-history', viewerId)
│
├── getViewerStats(viewerId)
│   └── ipcRenderer.invoke('viewer:get-stats', viewerId)
│
├── banViewer(...)
│   └── ipcRenderer.invoke('viewer:ban', {...})
│
├── unbanViewer(...)
│   └── ipcRenderer.invoke('viewer:unban', {...})
│
├── timeoutViewer(...)
│   └── ipcRenderer.invoke('viewer:timeout', {...})
│
├── addModViewer(...)
│   └── ipcRenderer.invoke('viewer:add-mod', {...})
│
├── removeModViewer(...)
│   └── ipcRenderer.invoke('viewer:remove-mod', {...})
│
├── addVipViewer(...)
│   └── ipcRenderer.invoke('viewer:add-vip', {...})
│
└── removeVipViewer(...)
    └── ipcRenderer.invoke('viewer:remove-vip', {...})
```

### 5. React Component Layer
```
ViewersScreen
├── State: viewers[], selectedViewer, detailModalOpen, credentials
├── Effects:
│   ├── loadViewers() - on mount/search change
│   ├── loadCredentials() - on mount
│   └── Listen for role/moderation changes
├── Event Handlers:
│   ├── handleSyncFromTwitch()
│   ├── handleDeleteViewer()
│   ├── Row click → setSelectedViewer() + setDetailModalOpen(true)
│   └── Table renders rows with click handlers
└── Render:
    └── <ViewerDetailModal {...props} />

ViewerDetailModal
├── State:
│   ├── history: ViewerHistory | null
│   ├── stats: any | null
│   ├── loading: boolean
│   ├── actionLoading: boolean
│   ├── selectedAction: string | null
│   ├── actionReason: string
│   ├── timeoutDuration: number
│   └── messages: actionMessage, actionError
├── Effects:
│   ├── Load history on open
│   └── Reload after successful action
├── Event Handlers:
│   ├── handleAction(actionType) - Calls DB service, handles response
│   ├── Action panel toggle
│   └── Form inputs (reason, duration)
└── Render:
    ├── Header: Display name, close button
    ├── Left panel: Status badges, stats, action panel
    ├── Right panel: Timeline with events
    └── Modal overlay with semi-transparent background
```

## Data Flow Example: Ban User

```
User clicks viewer row
    ↓
ViewersScreen: setSelectedViewer(viewer)
ViewersScreen: setDetailModalOpen(true)
    ↓
ViewerDetailModal renders with viewer prop
    ↓
useEffect[] triggers:
    ├── db.getViewerDetailedHistory(viewer.id)
    ├── db.getViewerStats(viewer.id)
    └── Updates: history, stats state
    ↓
Modal displays with historical timeline
    ↓
User clicks "⚡ Moderation Actions"
    ↓
setShowActionPanel(true)
    ↓
Action panel expands with buttons
    ↓
User clicks "Ban User"
    ↓
setSelectedAction('ban')
    ↓
Ban form appears with reason input
    ↓
User types reason and clicks "Confirm Action"
    ↓
handleAction('ban') executed:
    ├── setActionLoading(true)
    ├── db.banViewer(
    │   broadcasterId,
    │   viewer.id,
    │   viewer.display_name,
    │   actionReason,
    │   accessToken,
    │   clientId
    │ )
    ↓
IPC call to backend: viewer:ban
    ↓
Backend IPC handler validates input
    ↓
ViewerModerationActionsService.banUser() called
    ↓
Fetch POST /helix/moderation/bans with auth headers
    ↓
Twitch API responds: 204 No Content (success)
    ↓
Backend returns: {success: true, message: "..."}
    ↓
Frontend receives response in handleAction()
    ↓
setActionMessage(result.message)
    ↓
setSelectedAction(null) - Close form
    ↓
setTimeout 1500ms then:
    ├── loadViewerDetails() - Refresh history
    ├── onActionComplete() - Callback to parent
    └── Modal refreshes to show new ban action in timeline
    ↓
Parent ViewersScreen.loadViewers() executed
    ↓
Viewers list refreshes with updated moderation status
```

## Error Handling Flow

```
handleAction('ban') called
    ↓
setActionLoading(true)
    ↓
db.banViewer(...) called
    ↓
IPC reaches backend successfully but:

Case 1: Validation Error
├── broadcasterId missing
├── Backend validation catches it
├── Returns: {success: false, error: "..."}
└── Frontend: setActionError(result.error)

Case 2: API Error
├── Fetch fails or returns 400
├── Backend catches in catch block
├── Parses error response
└── Returns: {success: false, error: "API error message"}

Case 3: Network Error
├── No connection to Twitch
├── Catch block in service
└── Returns: {success: false, error: "Network error"}

All cases:
    ↓
Modal shows error message: "✕ [error text]"
    ↓
Form remains open for user to:
├── Fix the error (e.g., add missing reason)
├── Retry the action
└── Or cancel and try different action
    ↓
No auto-retry happens - user must manually retry
```

## Testing Scenarios

### Scenario 1: View Timeline
```
1. Start app
2. Navigate to Viewers screen
3. Click on any viewer
4. ✓ Modal opens
5. ✓ Display name shows
6. ✓ Timeline populated with events
7. ✓ Events color-coded by type
8. ✓ Timestamps formatted correctly
9. ✓ Statistics displayed
```

### Scenario 2: Ban User
```
1. Open viewer modal
2. Click "⚡ Moderation Actions"
3. ✓ Action panel expands
4. Click "Ban User"
5. ✓ Reason field appears
6. Type reason: "spam"
7. Click "Confirm Action"
8. ✓ Loading state shows
9. ✓ Success message appears
10. ✓ Action button closes form
11. ✓ Timeline refreshes
12. ✓ New "Banned" entry appears at top
13. ✓ Status badge shows "BANNED" in red
14. Close modal
15. ✓ Viewers list shows user as banned
```

### Scenario 3: Timeout Duration
```
1. Open viewer modal
2. Click "⚡ Moderation Actions"
3. Click "Timeout User"
4. ✓ Duration dropdown appears
5. Select "10 minutes"
6. Type reason: "caps spam"
7. Click "Confirm Action"
8. ✓ Success message: "timed out for 10 minutes"
9. ✓ Timeline shows "Timed Out" entry
10. ✓ Status badge shows "TIMED OUT"
```

### Scenario 4: Moderator Changes
```
1. Open non-mod viewer
2. ✓ "MOD" badge not shown
3. Click "Add Mod"
4. ✓ Success message
5. ✓ "MOD" badge appears
6. Click "Remove Mod"
7. ✓ Success message
8. ✓ "MOD" badge disappears
```

### Scenario 5: VIP Changes
```
1. Open non-VIP viewer
2. ✓ "VIP" badge not shown
3. Click "Add VIP"
4. ✓ Success message
5. ✓ "VIP" badge appears in pink
6. Click "Remove VIP"
7. ✓ Success message
8. ✓ "VIP" badge disappears
```

### Scenario 6: Modal Close
```
1. Open modal
2. Click [✕] button
3. ✓ Modal closes
4. Click outside modal overlay
5. ✗ Should close but need to verify
6. Press Escape key
7. ✗ Not implemented, but could add
```

### Scenario 7: Multiple Actions
```
1. Open banned user
2. Click "Unban User"
3. ✓ Success
4. ✓ "BANNED" badge removed
5. ✓ "Unbanned" added to timeline
6. Click "Add Mod"
7. ✓ Success
8. ✓ "MOD" badge added
9. ✓ "Granted as MOD" added to timeline
10. Timeline now shows both new entries
```

## Performance Expectations

### Query Performance
- `getViewerDetailedHistory()`: ~50-100ms for 100 events
- `getViewerStats()`: ~10-20ms
- Combined load time: ~100-150ms (acceptable)

### API Performance
- Ban/Unban: ~500-1500ms (Twitch API latency)
- Timeout: ~500-1500ms
- Add/Remove Mod: ~500-1500ms
- Add/Remove VIP: ~500-1500ms

### UI Performance
- Modal render: Instant
- Timeline scroll: Smooth (not virtualized)
- Action panel toggle: Instant
- Form inputs: Instant

## Security Considerations

1. **OAuth Token Storage** - Loaded from encrypted session
2. **API Authentication** - All Helix calls authenticated
3. **CORS** - No CORS issues (Electron, not web)
4. **Input Validation** - Backend validates all inputs
5. **Moderator ID** - Always broadcaster ID (self-moderation only)
6. **XSS Protection** - React auto-escapes in templates
7. **SQL Injection** - Using better-sqlite3 (prepared statements)

## Future Enhancements

### Phase 2
- [ ] Batch moderation (apply to multiple users)
- [ ] Moderation templates
- [ ] Timeline export (CSV/JSON)
- [ ] Timeline filtering

### Phase 3
- [ ] Undo last action
- [ ] Custom notes on viewers
- [ ] Automatic moderation rules
- [ ] Integration with chat logging

### Phase 4
- [ ] Webhooks for external logging
- [ ] Moderation audit trail
- [ ] Role history graph
- [ ] Subscription lifetime analytics

## Deployment Checklist

- [x] Code compiles without errors
- [x] No TypeScript warnings
- [x] All imports correct
- [x] IPC handlers registered
- [x] Database service functions created
- [x] React component renders
- [ ] Tested with real Twitch account
- [ ] Credentials properly loaded
- [ ] All moderation actions tested
- [ ] Error scenarios tested
- [ ] Modal responsiveness tested
- [ ] Performance acceptable
- [ ] No memory leaks
- [ ] Security review complete

Ready for deployment: **After manual testing** ✓
