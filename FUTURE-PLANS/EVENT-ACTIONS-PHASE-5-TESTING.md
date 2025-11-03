# Phase 5 IPC Handlers - Testing Guide

**Date:** November 2, 2025  
**Status:** Ready for testing

---

## Prerequisites

1. ✅ Stream Synth is running (`npm start`)
2. ✅ App is fully loaded
3. ✅ Browser source is accessible at `http://localhost:3737/browser-source`
4. ✅ Console shows: `[IPC] Event Action handlers registered`

---

## How to Test

### Open DevTools Console
1. Click on the Stream Synth window
2. Press `Ctrl+Shift+I` (Windows/Linux) or `Cmd+Option+I` (Mac)
3. Click the "Console" tab
4. Paste the test commands below

---

## Test Commands

### Setup: Get IPC Renderer
```javascript
const { ipcRenderer } = require('electron');
```

---

## Test 1: Browser Source Stats

**Purpose:** Verify browser source server is running

```javascript
const stats = await ipcRenderer.invoke('browser-source:get-stats');
console.log('Browser Source Stats:', stats);
```

**Expected Output:**
```javascript
{
  success: true,
  data: {
    isRunning: true,
    port: 3737,
    connectedClients: 1,  // Or more if you have browser source open
    alertsSent: 0,
    url: 'http://localhost:3737/browser-source'
  }
}
```

---

## Test 2: Create Event Action

**Purpose:** Create a follow alert configuration

```javascript
const createResult = await ipcRenderer.invoke('event-actions:create', {
  channel_id: '131323084',  // Use your actual channel ID
  event_type: 'channel.follow',
  is_enabled: true,
  text_enabled: true,
  text_template: '{{display_name}} just followed! ❤️',
  text_duration: 5000,
  text_position: 'top-center'
});
console.log('Create Result:', createResult);
```

**Expected Output:**
```javascript
{
  success: true,
  data: {
    id: 1,
    channel_id: '131323084',
    event_type: 'channel.follow',
    is_enabled: 1,
    text_enabled: 1,
    text_template: '{{display_name}} just followed! ❤️',
    text_duration: 5000,
    text_position: 'top-center',
    text_style: null,
    sound_enabled: 0,
    sound_file_path: null,
    sound_volume: 1,
    // ... more fields
    created_at: '2025-11-02 ...',
    updated_at: '2025-11-02 ...'
  }
}
```

---

## Test 3: Get All Event Actions

**Purpose:** Retrieve all event actions for your channel

```javascript
const allActions = await ipcRenderer.invoke('event-actions:get-all', '131323084');
console.log('All Actions:', allActions);
```

**Expected Output:**
```javascript
{
  success: true,
  data: [
    {
      id: 1,
      channel_id: '131323084',
      event_type: 'channel.follow',
      // ... full action object
    }
  ]
}
```

---

## Test 4: Get Action Stats

**Purpose:** Get count of total and enabled actions

```javascript
const statsResult = await ipcRenderer.invoke('event-actions:get-stats', '131323084');
console.log('Action Stats:', statsResult);
```

**Expected Output:**
```javascript
{
  success: true,
  data: {
    total: 1,
    enabled: 1
  }
}
```

---

## Test 5: Update Event Action

**Purpose:** Update an existing action

```javascript
const updateResult = await ipcRenderer.invoke('event-actions:update', {
  id: 1,
  payload: {
    text_duration: 8000,
    text_template: '🎉 {{display_name}} is now following! Welcome! ❤️'
  }
});
console.log('Update Result:', updateResult);
```

**Expected Output:**
```javascript
{
  success: true,
  data: {
    id: 1,
    // ... updated fields
    text_duration: 8000,
    text_template: '🎉 {{display_name}} is now following! Welcome! ❤️',
    updated_at: '2025-11-02 ...'  // Updated timestamp
  }
}
```

---

## Test 6: Test Alert (Simple)

**Purpose:** Send a test alert to browser source

```javascript
const testAlert = await ipcRenderer.invoke('event-actions:test-alert', {
  event_type: 'channel.follow',
  channel_id: '131323084',
  formatted: {
    html: '<strong>TestUser</strong> followed!',
    plainText: 'TestUser followed!',
    emoji: '❤️',
    variables: { username: 'TestUser', display_name: 'TestUser' }
  },
  text: {
    content: 'TestUser just followed! ❤️',
    duration: 5000,
    position: 'top-center',
    style: {
      fontSize: '32px',
      fontFamily: 'Arial, sans-serif',
      color: '#ffffff',
      backgroundColor: 'rgba(145, 71, 255, 0.9)',
      padding: '20px 40px',
      borderRadius: '10px',
      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)'
    }
  },
  timestamp: new Date().toISOString()
});
console.log('Test Alert Result:', testAlert);
```

**Expected:**
- Console shows: `{ success: true, data: { success: true, message: 'Test alert sent...' } }`
- If browser source is open: Alert appears on screen!

---

## Test 7: Process Event (Full Pipeline)

**Purpose:** Process an event through the full action pipeline

```javascript
const processResult = await ipcRenderer.invoke('event-actions:process-event', {
  event_type: 'channel.follow',
  event_data: {
    user_id: '12345',
    user_login: 'testfollower',
    user_name: 'TestFollower',
    broadcaster_user_id: '131323084',
    broadcaster_user_login: 'your_channel',
    broadcaster_user_name: 'YourChannel',
    followed_at: new Date().toISOString()
  },
  channel_id: '131323084',
  viewer_username: 'testfollower',
  viewer_display_name: 'TestFollower'
});
console.log('Process Result:', processResult);
```

**Expected:**
- Console shows success message
- Backend logs show event processing
- Alert appears in browser source with formatted template

---

## Test 8: Get Action by Event Type

**Purpose:** Retrieve specific action configuration

```javascript
const actionByType = await ipcRenderer.invoke('event-actions:get-by-type', {
  channel_id: '131323084',
  event_type: 'channel.follow'
});
console.log('Action by Type:', actionByType);
```

---

## Test 9: Check if Action Exists

**Purpose:** Quick check if an action is configured

```javascript
const exists = await ipcRenderer.invoke('event-actions:exists', {
  channel_id: '131323084',
  event_type: 'channel.follow'
});
console.log('Exists:', exists);
```

**Expected:**
```javascript
{
  success: true,
  data: true  // or false if doesn't exist
}
```

---

## Test 10: Create Multiple Event Types

**Purpose:** Set up actions for different events

```javascript
// Subscribe alert
await ipcRenderer.invoke('event-actions:create', {
  channel_id: '131323084',
  event_type: 'channel.subscribe',
  is_enabled: true,
  text_enabled: true,
  text_template: '⭐ {{display_name}} subscribed! Thank you!',
  text_duration: 6000,
  text_position: 'top-center'
});

// Cheer alert
await ipcRenderer.invoke('event-actions:create', {
  channel_id: '131323084',
  event_type: 'channel.cheer',
  is_enabled: true,
  text_enabled: true,
  text_template: '💎 {{display_name}} cheered {{bits}} bits!',
  text_duration: 5000,
  text_position: 'middle-center'
});

// Raid alert
await ipcRenderer.invoke('event-actions:create', {
  channel_id: '131323084',
  event_type: 'channel.raid',
  is_enabled: true,
  text_enabled: true,
  text_template: '🚀 {{from_broadcaster_user_name}} is raiding with {{viewers}} viewers!',
  text_duration: 8000,
  text_position: 'top-center'
});

console.log('Created 3 event actions!');

// Verify
const all = await ipcRenderer.invoke('event-actions:get-all', '131323084');
console.log('Total actions:', all.data.length);
```

---

## Test 11: Delete Event Action

**Purpose:** Remove an action

```javascript
// Delete by ID
const deleteResult = await ipcRenderer.invoke('event-actions:delete', 1);
console.log('Delete Result:', deleteResult);

// Or delete by type
const deleteByType = await ipcRenderer.invoke('event-actions:delete-by-type', {
  channel_id: '131323084',
  event_type: 'channel.follow'
});
console.log('Delete by Type Result:', deleteByType);
```

---

## Test 12: Upsert (Create or Update)

**Purpose:** Create if doesn't exist, update if it does

```javascript
// First time: creates
const upsert1 = await ipcRenderer.invoke('event-actions:upsert', {
  channel_id: '131323084',
  event_type: 'channel.follow',
  text_enabled: true,
  text_template: 'First version'
});
console.log('Upsert 1 (create):', upsert1.data.id);

// Second time: updates
const upsert2 = await ipcRenderer.invoke('event-actions:upsert', {
  channel_id: '131323084',
  event_type: 'channel.follow',
  text_template: 'Updated version'
});
console.log('Upsert 2 (update) - same ID:', upsert2.data.id);
```

---

## Test 13: Get Connected Browser Source Clients

**Purpose:** See how many browser sources are connected

```javascript
const clients = await ipcRenderer.invoke('browser-source:get-clients');
console.log('Connected Clients:', clients);
```

**Expected:**
```javascript
{
  success: true,
  data: ['socketid1', 'socketid2']  // Array of socket IDs
}
```

---

## Visual Testing

### Open Browser Source
1. Open browser: `http://localhost:3737/browser-source?debug=1`
2. Should show "Connected" status
3. Run Test 6 or Test 7 above
4. **Expected:** Alert appears on screen with animation!

---

## Troubleshooting

### Error: "channel_id is required"
- You forgot to pass required parameters
- Check the handler validation requirements

### Error: "Browser source server not running"
- Restart Stream Synth
- Check console for startup errors

### Error: "Event action processor not initialized"
- Check main.ts initialization
- Restart app

### Alerts not appearing
1. Check browser source is open
2. Check browser source shows "Connected"
3. Check browser console for errors
4. Try refreshing browser source page

---

## Quick Test Script

**Copy/paste this entire block to test everything:**

```javascript
const { ipcRenderer } = require('electron');

async function testPhase5() {
  console.log('=== Phase 5 IPC Handlers Test ===\n');
  
  // Test 1: Browser Source Stats
  console.log('1. Browser Source Stats...');
  const stats = await ipcRenderer.invoke('browser-source:get-stats');
  console.log('✅ Stats:', stats.data);
  
  // Test 2: Create Follow Action
  console.log('\n2. Creating follow action...');
  const create = await ipcRenderer.invoke('event-actions:create', {
    channel_id: '131323084',
    event_type: 'channel.follow',
    is_enabled: true,
    text_enabled: true,
    text_template: '{{display_name}} just followed! ❤️',
    text_duration: 5000,
    text_position: 'top-center'
  });
  console.log('✅ Created action ID:', create.data.id);
  
  // Test 3: Get All Actions
  console.log('\n3. Getting all actions...');
  const all = await ipcRenderer.invoke('event-actions:get-all', '131323084');
  console.log('✅ Total actions:', all.data.length);
  
  // Test 4: Get Stats
  console.log('\n4. Getting action stats...');
  const actionStats = await ipcRenderer.invoke('event-actions:get-stats', '131323084');
  console.log('✅ Stats:', actionStats.data);
  
  // Test 5: Send Test Alert
  console.log('\n5. Sending test alert...');
  const testAlert = await ipcRenderer.invoke('event-actions:test-alert', {
    event_type: 'channel.follow',
    channel_id: '131323084',
    formatted: {
      html: '<strong>TestUser</strong> followed!',
      plainText: 'TestUser followed!',
      emoji: '❤️',
      variables: { username: 'TestUser', display_name: 'TestUser' }
    },
    text: {
      content: 'TestUser just followed! ❤️',
      duration: 5000,
      position: 'top-center',
      style: {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: 'rgba(145, 71, 255, 0.9)',
        padding: '20px 40px',
        borderRadius: '10px'
      }
    },
    timestamp: new Date().toISOString()
  });
  console.log('✅ Test alert sent:', testAlert.data.message);
  
  console.log('\n=== All Tests Passed! ===');
  console.log('Check http://localhost:3737/browser-source?debug=1 to see the alert!');
}

testPhase5();
```

---

## Success Criteria

✅ All IPC handlers respond without errors  
✅ Create/Read/Update/Delete operations work  
✅ Test alerts appear in browser source  
✅ Stats are accurate  
✅ Error handling works for invalid input  

---

## Next Steps

After verifying Phase 5 works:
- **Phase 6:** Frontend Service Wrapper (type-safe IPC wrapper)
- **Phase 7:** Frontend UI - Main Alert Management Screen
- **Phase 8:** Frontend UI - Action Editor Component

