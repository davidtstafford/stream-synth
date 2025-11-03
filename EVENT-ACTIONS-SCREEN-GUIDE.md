# Event Actions Screen - Quick Reference Guide

## 🎯 Overview

The **Event Actions** screen is your central hub for managing alert actions in Stream Synth. Configure what happens when Twitch events occur - display text, play sounds, show images, or play videos in your OBS browser source overlay.

---

## 📍 Accessing the Screen

**Navigation:** Click **"Event Actions"** in the left sidebar menu  
**Location:** Between "Events" and "Chat" menu items  
**Requirements:** Must have a Twitch channel connected

---

## 🖥️ Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│  🟢 Browser Source Running | Port: 3737 | Active: 2        │ <- Status Bar
├─────────────────────────────────────────────────────────────┤
│  📊 Total: 12 | ✅ Enabled: 8 | ⛔ Disabled: 4             │ <- Stats Bar
├─────────────────────────────────────────────────────────────┤
│  🔍 Search...          ☑️ Show only enabled    [+ New]     │ <- Toolbar
├─────────────────────────────────────────────────────────────┤
│  Event Type │ Media    │ Template      │ Status │ Actions  │ <- Headers
├─────────────────────────────────────────────────────────────┤
│  📢 Follow  │ 📝 Text  │ {user} ...    │ [ON]   │ Test Del │
│  📢 Sub     │ 🔊 Sound │ Thanks ...    │ [OFF]  │ Test Del │
│  📢 Raid    │ 🎬 Video │ Raid from ... │ [ON]   │ Test Del │
│  ...                                                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 🟢 Browser Source Status Bar

**What It Shows:**
- **🟢 Browser Source Running** - Server is active and ready
- **Port: 3737** - HTTP server port for OBS browser source
- **Active Connections: 2** - Number of connected browser sources

**Status Indicators:**
- **Green with pulse animation** - Server running, connections active
- **Red** - Server not running or error
- **Auto-refreshes every 5 seconds**

**OBS Setup:**
```
Browser Source URL: http://localhost:3737/browser-source.html
Width: 1920
Height: 1080
FPS: 60
```

---

## 📊 Statistics Bar

Shows real-time action counts:
- **Total:** All configured actions
- **Enabled:** Actions that will trigger
- **Disabled:** Actions that won't trigger

Updates automatically when you toggle or delete actions.

---

## 🔍 Toolbar Features

### Search Box
- Search by event type name (e.g., "follow", "subscribe")
- Search by template text (e.g., "raid", "thanks")
- Real-time filtering as you type

### Show Only Enabled Filter
- ☑️ **Checked:** Shows only enabled actions
- ☐ **Unchecked:** Shows all actions (default)

### New Action Button (Phase 8)
- Currently shows "Coming in Phase 8!" message
- Will open action editor modal in next phase

---

## 📋 Action List Columns

### 1. Event Type
```
📢 Follow
   channel.follow
```
- **Icon:** 📢 (broadcast emoji)
- **Display Name:** Human-readable event name
- **Event Code:** Technical event type ID

### 2. Media Types
Shows which media types are enabled for this action:

```
📝 Text    - Text overlay
🔊 Sound   - Audio playback
🖼️ Image   - Image display
🎬 Video   - Video playback
```

**Badge Colors:**
- Text: Blue (#3498db)
- Sound: Green (#2ecc71)
- Image: Orange (#e67e22)
- Video: Red (#e74c3c)

### 3. Template
Shows a preview of the template text:
```
"{user} just followed! Welcome!"
"{user} subscribed for {months} months!"
```

Truncated if too long to fit in column.

### 4. Status
Toggle switch to enable/disable the action:
- **🟢 ON** - Action will trigger
- **⚫ OFF** - Action won't trigger

Click to toggle instantly.

### 5. Actions
Two buttons for each action:
- **🧪 Test** - Send test alert to browser source
- **🗑️ Delete** - Remove action (with confirmation)

---

## 🎬 How to Use

### Toggle Action On/Off
1. Find the action in the list
2. Click the toggle switch in the "Status" column
3. Action updates instantly
4. Stats bar updates automatically

**Use Cases:**
- Temporarily disable annoying alerts
- Test one action at a time
- Turn off alerts during important streams

### Test an Alert
1. Click the **🧪 Test** button next to any action
2. Test alert is sent to all connected browser sources
3. Button changes to **✅ Sent!** for 2 seconds
4. Watch your OBS browser source to see the alert

**What Gets Tested:**
- Text overlay (if enabled)
- Sound playback (if enabled)
- Image display (if enabled)
- Video playback (if enabled)

**Test Payload:**
```javascript
{
  event_type: "channel.follow",
  formatted: {
    html: "<strong>Test Alert</strong> for Follow",
    plainText: "Test Alert for Follow",
    emoji: "🧪"
  },
  text: {
    content: "{user} just followed!",
    duration: 5000,
    position: "top-center",
    style: { fontSize: "24px", color: "#ffffff" }
  }
}
```

### Delete an Action
1. Click the **🗑️ Delete** button
2. Confirmation dialog appears:
   ```
   Delete alert for "Follow"?
   [Cancel] [OK]
   ```
3. Click **OK** to confirm deletion
4. Action is removed from list
5. Stats bar updates automatically

**Warning:** This action cannot be undone!

### Search for Actions
1. Click in the search box
2. Type your search query:
   - Event name: `follow`, `subscribe`, `raid`
   - Template text: `thanks`, `welcome`, `bits`
3. List filters in real-time
4. Clear search to see all actions again

### Filter to Enabled Only
1. Check the **☑️ Show only enabled** checkbox
2. List shows only actions that are ON
3. Uncheck to see all actions again

**Combines with search:**
- Search for "sub" + Show only enabled
- Result: Only enabled subscription-related actions

---

## 📭 Empty States

### No Channel Connected
```
⚠️ No channel connected
Please connect to a Twitch channel first.
```
**Solution:** Go to Connection screen and connect.

### No Actions Configured
```
📭 No alert actions configured
Click "New Action" to create your first alert!
```
**Solution:** Wait for Phase 8, then create actions.

### No Search Results
```
🔍 No actions match your search
Try a different search term or clear the filter.
```
**Solution:** Change search query or clear filters.

---

## 🎨 Visual States

### Enabled Action
```css
Background: #2a2a2a (dark gray)
Border: 1px solid #3a3a3a
Opacity: 100%
Toggle: Purple (ON)
```

### Disabled Action
```css
Background: #2a2a2a (dark gray)
Border: 1px solid #3a3a3a
Opacity: 50% (dimmed)
Toggle: Gray (OFF)
```

### Hover States
- Action row: Slight border color change
- Buttons: Background color change
- Toggle: Scale animation

---

## ⌨️ Keyboard Shortcuts

**Coming in Phase 12:**
- `Ctrl+F` - Focus search box
- `Ctrl+N` - New action
- `Enter` - Edit selected action
- `Delete` - Delete selected action
- `Space` - Toggle selected action

---

## 🔧 Troubleshooting

### Problem: No actions showing
**Solutions:**
1. Check if channel is connected
2. Check search filters
3. Check "Show only enabled" filter
4. Try refreshing the screen

### Problem: Browser source not running
**Solutions:**
1. Check backend logs for errors
2. Verify port 3737 is not in use
3. Restart the application
4. Check firewall settings

### Problem: Test alert not appearing
**Solutions:**
1. Verify browser source is open in OBS
2. Check browser source URL: `http://localhost:3737/browser-source.html`
3. Check browser source stats shows active connections
4. Check console for errors (F12 in browser source)

### Problem: Can't delete action
**Solutions:**
1. Check if action is enabled (try disabling first)
2. Check backend database is writable
3. Check error message for details
4. Try restarting application

---

## 💡 Tips & Best Practices

### Organization
- Use consistent naming in templates
- Group similar actions together
- Disable unused actions instead of deleting
- Test before enabling for live stream

### Testing
- Always test new actions before going live
- Test with multiple browser sources
- Verify timing and positioning
- Check sound levels

### Performance
- Limit number of enabled actions
- Disable heavy video alerts when needed
- Monitor browser source stats
- Close unused browser sources

### Templates (Phase 9)
- Use variables for dynamic content
- Keep templates concise
- Test with different values
- Use emoji for visual appeal

---

## 🚀 Coming in Phase 8

The **Action Editor Modal** will allow you to:
- ✏️ Edit all action properties
- 🎨 Customize text styles (font, color, size, shadow)
- 🎵 Configure sound settings (volume, fade)
- 🖼️ Set image properties (position, size, animation)
- 🎬 Adjust video settings (position, size, loop)
- 👁️ Live preview of templates
- 💾 Save and cancel changes
- ⚠️ Unsaved changes warning

**Current Workaround:** Delete and recreate actions to make changes.

---

## 📊 Technical Details

### Component
- **File:** `src/frontend/screens/events/event-actions.tsx`
- **Lines:** 423 lines
- **Type:** React functional component
- **State:** React hooks (useState, useEffect)

### Styling
- **File:** `src/frontend/screens/events/event-actions.css`
- **Lines:** 700+ lines
- **Theme:** Dark (#2a2a2a)
- **Accent:** Purple (#9147ff)

### Services Used
- `eventActionsService.getAllActions()`
- `eventActionsService.getActionStats()`
- `eventActionsService.getBrowserSourceStats()`
- `eventActionsService.toggleAction()`
- `eventActionsService.deleteAction()`
- `eventActionsService.testAlert()`

### Performance
- Auto-refresh: Browser stats every 5 seconds
- Debounced: Search filtering (real-time)
- Memoized: Filtered actions list
- Optimized: Renders only visible rows

---

## 📚 Related Documentation

- **Phase 6:** Frontend Service Wrapper - API methods
- **Phase 5:** IPC Handlers - Backend communication
- **Phase 4:** Browser Source Server - Alert display
- **Phase 1:** Event Formatter - Template variables

---

## 🎓 Example Workflow

### Creating Your First Alert Setup

1. **Connect to Twitch**
   - Go to Connection screen
   - Authorize with Twitch
   - Select your channel

2. **Navigate to Event Actions**
   - Click "Event Actions" in menu
   - See "No actions configured" message

3. **Wait for Phase 8** (Action Editor)
   - Create follow alert
   - Set template: "{user} just followed! Welcome!"
   - Enable text overlay
   - Set duration: 5 seconds
   - Save action

4. **Test the Alert**
   - Click 🧪 Test button
   - Watch OBS browser source
   - Verify text appears correctly

5. **Go Live**
   - Enable the action (toggle ON)
   - When someone follows, alert triggers automatically
   - Alert displays in OBS overlay

---

**Need Help?** Check the troubleshooting section or review Phase 7 completion documentation.

---

*Last Updated: November 2, 2025*  
*Stream Synth - Event Actions Feature*
