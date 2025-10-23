# Stream Synth - Events and Chat Screens Visual Guide

## Navigation Menu

The left sidebar menu now contains three items:
```
┌─────────────────┐
│ Connection      │  ← Existing screen
│ Events          │  ← NEW
│ Chat            │  ← NEW
└─────────────────┘
```

When active, the menu item is highlighted with:
- Background: #2d2d2d
- Left border: Purple (#9147ff)

---

## Events Screen Layout

```
╔════════════════════════════════════════════════════════════════╗
║                            Events                               ║
╠════════════════════════════════════════════════════════════════╣
║  ┌──────────────────── Filters ────────────────────────┐      ║
║  │                                                      │      ║
║  │  Event Type: [All Types ▼]    Search: [________]   │      ║
║  │  Start Date: [____/____]      End Date: [____/____] │      ║
║  │                                                      │      ║
║  │  [Clear Filters]  [Refresh]                         │      ║
║  └──────────────────────────────────────────────────────┘      ║
║                                                                 ║
║  Showing 50 of 150 events                                      ║
║                                                                 ║
║  ┌─────────────────────────────────────────────────────────┐  ║
║  │ Time           │ Type          │ Details       │ User   │  ║
║  ├────────────────┼───────────────┼───────────────┼────────┤  ║
║  │ 10:23:45 AM   │ Chat Message  │ testuser: hi! │ Test U │  ║
║  │ 10:22:30 AM   │ Subscribe     │ user123: Tier1│ User123│  ║
║  │ 10:20:15 AM   │ Raid          │ raider: 50... │ Raider │  ║
║  │ ...           │ ...           │ ...           │ ...    │  ║
║  └─────────────────────────────────────────────────────────┘  ║
║                                                                 ║
║  [Previous]         Page 1 of 3         [Next]                ║
╚════════════════════════════════════════════════════════════════╝
```

### Event Detail Modal
When clicking an event, a modal appears:

```
╔════════════════════════════════════════════╗
║  Channel Chat Message            [Close]  ║
╠════════════════════════════════════════════╣
║                                            ║
║  Time: 10/23/2025, 10:23:45 AM            ║
║  User: Test User (ID: 12345)              ║
║  Channel ID: channel123                   ║
║                                            ║
║  Event Data:                               ║
║  ┌────────────────────────────────────┐   ║
║  │ {                                  │   ║
║  │   "chatter_user_id": "12345",     │   ║
║  │   "chatter_user_name": "Test U.", │   ║
║  │   "message": {                     │   ║
║  │     "text": "Hello, world!"       │   ║
║  │   }                                │   ║
║  │ }                                  │   ║
║  └────────────────────────────────────┘   ║
╚════════════════════════════════════════════╝
```

### Event Type Filter Dropdown

The Event Type dropdown includes all event types:
```
┌─────────────────────────────────┐
│ All Types                    ▼ │
├─────────────────────────────────┤
│ All Types                       │
│ Channel Update                  │
│ New Subscription                │
│ Subscription Ended              │
│ Gift Subscription               │
│ Resub Message                   │
│ Bits Cheered                    │
│ Incoming Raid                   │
│ Chat Message                    │
│ Chat Cleared                    │
│ ... (all other event types)     │
│ User Joined Chat (IRC)          │
│ User Left Chat (IRC)            │
└─────────────────────────────────┘
```

### Search Functionality

The search box searches **within event data**:
- Example: Search "raid" finds all raid events
- Example: Search "test message" finds chat messages containing that text
- Search is case-insensitive
- Searches in the JSON event_data field

---

## Chat Screen Layout

```
╔════════════════════════════════════════════════════════════════╗
║                            Chat                                 ║
╠════════════════════════════════════════════════════════════════╣
║  Max Messages: [100 ▼]  [✓] Auto-scroll  [Clear Display]      ║
║  100 / 100 messages                                            ║
║                                                                 ║
║  ┌──────────────────────────────────────────────────────────┐  ║
║  │ 10:23:45  testuser:    Hello everyone!                  │  ║
║  │ 10:23:47  viewer123:   Hey testuser!                    │  ║
║  │ 10:23:50  moderator:   Welcome to the stream            │  ║
║  │ 10:23:52  testuser:    Thanks!                          │  ║
║  │ ...                                                      │  ║
║  │                                                          │  ║
║  │                                                          │  ║
║  │                                                          │  ║
║  │ (scrollable area)                                       │  ║
║  │                                                          │  ║
║  │                                                          │  ║
║  └──────────────────────────────────────────────────────────┘  ║
║                                                                 ║
║                              [↓ Jump to Bottom]  (if scrolled) ║
╚════════════════════════════════════════════════════════════════╝
```

### Chat Message Format

Each chat message displays:
```
[Timestamp]  [Username in color]:  [Message text]
10:23:45     testuser:              Hello everyone!
```

- **Timestamp**: HH:MM:SS format
- **Username**: Color-coded (using Twitch color if available)
- **Message**: Plain text, word-wrapped

Messages alternate background colors for readability:
- Even rows: #2a2a2a
- Odd rows: transparent

### Max Messages Dropdown

```
┌──────────┐
│ 100   ▼ │
├──────────┤
│ 50       │
│ 100      │
│ 200      │
│ 500      │
└──────────┘
```

This setting is saved to the database as `chat_max_messages`.

### Auto-scroll Behavior

- **Enabled** (default): Chat automatically scrolls to show newest messages
- **Disabled**: User can scroll up to review history
- When scrolled up, a "Jump to Bottom" button appears at bottom-right

---

## Color Scheme

The application uses a dark theme:
- **Background**: #1a1a1a (very dark gray)
- **Content area**: #1e1e1e (dark gray)
- **Borders**: #333 (medium gray)
- **Text**: #ffffff (white)
- **Secondary text**: #888, #b0b0b0 (light gray)
- **Accent color**: #9147ff (Twitch purple)
- **Success**: #6dff8e (green)
- **Error**: #ff6d6d (red)
- **Info**: #6d9fff (blue)

### Interactive Elements

**Buttons:**
- Default: #9147ff (purple)
- Hover: #7d3cdc (darker purple)
- Disabled: #555 (gray)

**Tables:**
- Header: #2a2a2a
- Row hover: slight highlight
- Selected row: #333

**Event type badges:**
- Background: #9147ff
- Text: white
- Rounded corners

---

## Real-time Updates

### Events Screen
- Auto-refreshes every 10 seconds (when not viewing event details)
- Can manually refresh with "Refresh" button
- New events appear at the top of the table

### Chat Screen
- Listens for `event:stored` IPC messages
- New chat messages appear immediately at the bottom
- No page refresh needed
- Auto-scrolls to newest message (if enabled)

---

## Data Persistence

### Events Screen
- All filters persist while on the screen
- Filters reset when navigating away
- Events are permanently stored in database

### Chat Screen
- Messages load from database on screen open
- Messages persist when navigating away and back
- Max messages setting saved in database
- Historical messages preserved across app restarts

---

## Performance Notes

- **Events Screen**: Pagination limits to 50 events per query
- **Chat Screen**: Limits display to configured max (default 100)
- **Database Indexes**: Fast queries even with thousands of events
- **Auto-refresh**: Only runs when not viewing details to prevent interruption

---

## Example Use Cases

### Finding a Specific Event

1. Navigate to **Events** screen
2. Select event type (e.g., "Incoming Raid")
3. See all raids that occurred
4. Click on a raid to see full details including raider's name and viewer count

### Reviewing Chat History

1. Navigate to **Chat** screen
2. Scroll up to review past messages
3. Messages are loaded from database
4. Search in Events screen with event type "Chat Message" for more advanced filtering

### Tracking a Specific User

1. Navigate to **Events** screen
2. Use search box to enter username
3. See all events involving that user
4. View their chat messages, subscriptions, etc.

### Finding Events by Date

1. Navigate to **Events** screen
2. Set Start Date and/or End Date
3. See all events in that time range
4. Combine with event type filter for specific event types in date range

---

## Tips

1. **Use filters together**: Combine event type + search + date for precise queries
2. **Chat persistence**: Chat messages remain available even after restarting the app
3. **Viewer tracking**: The same user appears with consistent name across all their events
4. **Event details**: Click any event to see the full JSON payload
5. **Performance**: Increase chat limit to 500 for longer sessions, or reduce to 50 for better performance

---

## Technical Notes

- All timestamps are displayed in local timezone
- Event data is stored as JSON strings
- Viewer records are automatically created on first event
- Foreign key constraints ensure data integrity
- Prepared statements prevent SQL injection
- Database location: `~/Library/Application Support/stream-synth/stream-synth.db` (macOS)
