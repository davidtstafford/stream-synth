# Troubleshooting: Events and Chat Not Showing

## Expected Behavior
- Events screen should show all captured events (subscriptions, cheers, raids, chat messages, etc.)
- Chat screen should show live chat messages in real-time
- Both screens should auto-refresh with new data

## Diagnostic Checklist

### 1. Check if EventSub is Connected
- Open the app and go to Connection screen
- Verify you're connected to Twitch with a valid OAuth token
- Check that the WebSocket session ID is displayed
- Look for "Connected successfully" message

### 2. Check if Events are Being Stored
Open Developer Tools (View > Toggle Developer Tools) and check:

**Console logs to look for:**
```
WebSocket connection opened
Received event notification: {...}
Event received: {...}
```

**If you don't see "Event received" logs:**
- The onNotification handler in connection.tsx might not be firing
- WebSocket messages might not be EventSub notifications

### 3. Verify Database is Working
In Developer Tools Console, run:
```javascript
// Check if database functions are available
window.require('electron').ipcRenderer.invoke('db:get-event-count').then(console.log)

// Check if any events are stored
window.require('electron').ipcRenderer.invoke('db:get-events', { limit: 10 }).then(console.log)
```

**Expected output:**
```javascript
{ success: true, count: 5 }  // Or whatever count you have
{ success: true, events: [...] }  // Array of event objects
```

### 4. Check Event Subscriptions
Make sure you have event types enabled:

1. Go to Connection screen
2. Scroll down to "Event Subscriptions"
3. Click to expand the section
4. Verify that events are checked (at minimum: channel.chat.message for chat)
5. Check the browser console for any subscription errors

### 5. Trigger Test Events
To test if events are being captured:

**For Chat Messages:**
1. Make sure `channel.chat.message` is enabled in Event Subscriptions
2. Send a message in your Twitch chat (from another browser/device)
3. Check Developer Tools console for "Event received: { subscription: { type: 'channel.chat.message' } }"
4. Go to Chat screen and verify message appears

**For IRC Events (JOIN/PART):**
1. Enable `irc.chat.join` and `irc.chat.part` in Event Subscriptions
2. Have someone join or leave your chat
3. Check console for IRC event logs
4. Check Events screen for JOIN/PART events

### 6. Check Real-Time Updates
The screens should auto-refresh, but you can manually check:

**Events Screen:**
- Has auto-refresh every 10 seconds
- Also has a "Refresh" button
- Should show new events immediately when they're stored

**Chat Screen:**
- Listens for 'event:stored' IPC events
- Should show messages in real-time as they arrive
- Check if `ipcRenderer.on('event:stored', ...)` listener is attached

### 7. Common Issues

#### Issue: "No events found" in Events Screen
**Possible causes:**
- No events have been captured yet
- Wrong channel selected (check channelId)
- Events not being stored in database

**Debug:**
```javascript
// In Developer Tools Console
const { ipcRenderer } = window.require('electron');

// Check current session
ipcRenderer.invoke('db:get-current-session').then(console.log);

// Check event count
ipcRenderer.invoke('db:get-event-count').then(console.log);

// Check if database has any events
ipcRenderer.invoke('db:get-events', { limit: 1 }).then(console.log);
```

#### Issue: "No chat messages yet" in Chat Screen
**Possible causes:**
- channel.chat.message not enabled
- Not receiving chat messages
- channelId not set correctly

**Debug:**
```javascript
// Check if channelId is set
// Look in app.tsx state or check current session
const { ipcRenderer } = window.require('electron');
ipcRenderer.invoke('db:get-current-session').then(session => {
  console.log('Current channel:', session?.channel_id);
  
  // Check for chat events for this channel
  ipcRenderer.invoke('db:get-chat-events', session?.channel_id, 10).then(console.log);
});
```

#### Issue: Events stored but not showing in UI
**Possible causes:**
- Frontend not querying database correctly
- Filters preventing events from showing
- Component not re-rendering

**Debug:**
1. Clear all filters in Events screen
2. Set event type filter to "All Types"
3. Click "Refresh" button
4. Check browser console for error messages

### 8. Verify IPC Handlers are Working
In Developer Tools Console:
```javascript
const { ipcRenderer } = window.require('electron');

// Test event storage
ipcRenderer.invoke('db:store-event', 
  'test.event', 
  { message: 'test' }, 
  'test_channel_123'
).then(console.log);

// Should return: { success: true, id: <number> }

// Then check if it was stored
ipcRenderer.invoke('db:get-events', { 
  channelId: 'test_channel_123',
  limit: 1 
}).then(console.log);

// Should return: { success: true, events: [{...}] }
```

### 9. Check Event Flow
The complete flow should be:

1. **EventSub receives notification** → 
2. **onNotification handler in connection.tsx** → 
3. **Extract event type and viewer info** → 
4. **Call db.storeEvent()** → 
5. **IPC invoke 'db:store-event'** → 
6. **Backend storeEvent() in events repository** → 
7. **Backend sends 'event:stored' to renderer** → 
8. **Chat screen receives 'event:stored'** → 
9. **Chat screen updates UI**

**Break points to check:**
- Set console.log in connection.tsx onNotification
- Set console.log in events.ts storeEvent()
- Set console.log in chat.tsx event:stored listener

### 10. Check Backend Logs
The Electron main process logs should show:
```
Initializing database at: <path>
Database migrations completed
Database initialized successfully
```

If events are being stored, you won't see specific logs unless you add them.

## Quick Fix Attempts

### Fix 1: Reload Event Subscriptions
1. Go to Connection screen
2. Click "Deselect All" in Event Subscriptions
3. Wait 2 seconds
4. Click "Select Default" or manually select events you want
5. Wait for subscriptions to complete
6. Try triggering an event

### Fix 2: Reconnect
1. Note your current channel
2. Close the app completely
3. Reopen the app
4. It should auto-reconnect
5. Check Events/Chat screens

### Fix 3: Force Database Refresh
1. Go to Events screen
2. Click "Clear Filters"
3. Click "Refresh"
4. Go to Chat screen
5. Change "Max Messages" dropdown (this triggers a reload)

### Fix 4: Check if EventSub Session is Active
```javascript
// In Developer Tools Console
const { ipcRenderer } = window.require('electron');

// Get current session info
ipcRenderer.invoke('db:get-current-session').then(session => {
  console.log('Session:', session);
  
  // Try to get events for this session
  if (session) {
    ipcRenderer.invoke('db:get-events', {
      channelId: session.channel_id,
      limit: 10
    }).then(console.log);
  }
});
```

## Manual Test: Send a Test Event
To manually verify the entire pipeline works:

```javascript
// In Developer Tools Console
const { ipcRenderer } = window.require('electron');

// Get current session
const session = await ipcRenderer.invoke('db:get-current-session');
console.log('Current session:', session);

// Manually store a test chat message
const result = await ipcRenderer.invoke('db:store-event',
  'channel.chat.message',
  {
    message: { text: 'Test message from console' },
    chatter: {
      login: 'testuser',
      name: 'TestUser'
    },
    color: '#FF0000'
  },
  session.channel_id,
  'test_user_123'
);

console.log('Store result:', result);

// Check if it shows up in Events screen (refresh the page or click Refresh button)
// Check if it shows up in Chat screen (should appear immediately)
```

## Need More Help?
If events still aren't showing:

1. Share the output of all diagnostic commands above
2. Share any console errors (red text in Developer Tools)
3. Share a screenshot of:
   - Connection screen showing you're connected
   - Event Subscriptions section showing which events are enabled
   - Events screen showing "No events found"
   - Chat screen showing "No chat messages yet"
4. Describe what you've tried so far
