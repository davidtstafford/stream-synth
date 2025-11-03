# Browser Source Channels - Quick Reference

## 🎯 What It Does

Organize your stream alerts into separate channels so you can:
- Display different alerts in different locations on your stream
- Create themed alert groups (VIP alerts, TTS messages, main alerts, etc.)
- Use multiple OBS browser sources with different alert types

## 🚀 Getting Started (3 Steps)

### Step 1: Create a Channel
1. Go to Event Actions screen
2. Click "📺 Manage Channels"
3. Click "➕ Create Channel"
4. Fill in details:
   - **Display Name:** "VIP Alerts" (what you see)
   - **Icon:** 💎 (pick from 12 options)
   - **Color:** Pink (pick from 8 options)
   - **Description:** "Alerts for VIP subscribers"
5. Click "Save"
6. URL is auto-generated: `vip-alerts`

### Step 2: Assign Actions to Channel
1. Create or edit an event action
2. In General tab, select "Browser Source Channel"
3. Choose your channel from dropdown: "💎 VIP Alerts"
4. Copy the URL preview
5. Save the action

### Step 3: Add to OBS
1. Add Browser Source to OBS
2. Paste URL: `http://localhost:3737/browser-source?channel=vip-alerts`
3. Set dimensions: 1920x1080
4. Position in your scene
5. Test an alert!

## 📊 UI Components

### Event Actions Screen
```
┌─────────────────────────────────────────────────┐
│ Toolbar:                                        │
│ [Search] [Channel: All ▼] [☑ Enabled Only]    │
│ [📺 Manage Channels] [➕ Create Action]        │
└─────────────────────────────────────────────────┘
```

### Channel Manager Modal
```
┌──────────────────────────────────────┐
│ Browser Source Channels              │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 📺 Default Channel             │  │
│ │ All unassigned alerts          │  │
│ │ Actions: 15 | URL: [📋 Copy]   │  │
│ │ [✏️ Edit] [🗑️ Delete]          │  │
│ └────────────────────────────────┘  │
│                                      │
│ ┌────────────────────────────────┐  │
│ │ 💎 VIP Alerts                  │  │
│ │ Special alerts for VIPs        │  │
│ │ Actions: 3 | URL: [📋 Copy]    │  │
│ │ [✏️ Edit] [🗑️ Delete]          │  │
│ └────────────────────────────────┘  │
│                                      │
│ [➕ Create Channel] [✕ Close]       │
└──────────────────────────────────────┘
```

### Action Editor - Channel Selector
```
┌─────────────────────────────────────┐
│ General Settings                    │
│                                     │
│ Browser Source Channel:             │
│ [💎 VIP Alerts ▼]                  │
│                                     │
│ Browser Source URL:                 │
│ ┌─────────────────────────────────┐ │
│ │ http://localhost:3737/browser-  │ │
│ │ source?channel=vip-alerts       │ │
│ │                    [📋 Copy]    │ │
│ └─────────────────────────────────┘ │
│ Organize alerts into different      │
│ channels for multiple browser       │
│ sources                             │
└─────────────────────────────────────┘
```

## 🎨 Icon & Color Options

### Available Icons (12)
📺 🎉 💬 💎 🔔 ⭐ 🎬 🎮 🎵 🎨 🚀 ⚡

### Available Colors (8)
- 🟣 Twitch Purple (#9147ff)
- 🔴 Red (#ef4444)
- 🟢 Green (#22c55e)
- 🔵 Blue (#3b82f6)
- 🟠 Orange (#f97316)
- 🌸 Pink (#ec4899)
- 🔵 Cyan (#06b6d4)
- 🟡 Yellow (#eab308)

## 📋 Common Use Cases

### Use Case 1: Separate Main Alerts from TTS
```
Channel 1: "Main Alerts" (default)
- Subscriptions
- Follows
- Raids
- Bits

Channel 2: "TTS Messages" (tts-messages)
- Chat messages (TTS enabled)

OBS Setup:
- Browser Source 1: Top-center for main alerts
- Browser Source 2: Bottom-center for TTS messages
```

### Use Case 2: VIP vs Regular Alerts
```
Channel 1: "VIP Alerts" (vip-alerts)
- Tier 3 subscriptions
- Large bits (1000+)
- VIP role assignments

Channel 2: "Regular Alerts" (default)
- All other events

OBS Setup:
- Browser Source 1: Prominent position for VIP
- Browser Source 2: Standard position for regular
```

### Use Case 3: Game-Specific Alerts
```
Channel 1: "Game Events" (game-events)
- Custom game integrations
- Achievement unlocks

Channel 2: "Stream Events" (default)
- Standard Twitch events

OBS Scenes:
- Gaming Scene: Show both
- Chatting Scene: Show stream events only
```

## 🔐 Rules & Protections

### Cannot Delete
- ❌ Default channel (always required)
- ❌ Channels with assigned actions

### Cannot Rename
- ❌ Channel names (URLs would break)
- ✅ Can change display name, icon, color, description

### Name Requirements
- ✅ 2-50 characters
- ✅ URL-safe: lowercase letters, numbers, hyphens, underscores
- ✅ Auto-sanitized from display name
- ❌ Reserved names: 'all', 'none', 'create', 'edit'

## 🔑 Keyboard Shortcuts

### Channel Manager
- `Esc` - Close modal
- `Enter` - Save (when editing)

### Channel Editor
- `Esc` - Cancel
- `Ctrl+S` / `Cmd+S` - Save

## 📡 URL Format

```
http://localhost:3737/browser-source?channel={channel-name}
```

**Examples:**
- `?channel=default` - Default channel
- `?channel=vip-alerts` - VIP alerts channel
- `?channel=tts-messages` - TTS messages channel

## 🛠️ Troubleshooting

### "Channel not found"
- Verify channel name in URL matches exactly
- Channel names are case-sensitive in database
- Check channel exists and is enabled

### "No alerts showing"
- Verify actions are assigned to correct channel
- Check actions are enabled
- Test alert from Event Actions screen
- Verify browser source is connected (check stats)

### "Cannot delete channel"
- Check if channel has assigned actions
- Reassign actions to different channel first
- Cannot delete default channel (by design)

## 📊 Statistics

### Channel Manager Shows:
- **Action Count:** Number of actions assigned to each channel
- **URL:** Browser source URL for OBS
- **Status:** Enabled/Disabled

### Event Actions Screen Shows:
- **Channel Filter:** Filter actions by channel
- **Channel Badges:** Visual indicator on action items
- **Browser Stats:** Connected clients, alerts sent

## 🎬 Complete Workflow Example

```
1. Create Channel "vip-alerts"
   → URL generated: http://localhost:3737/browser-source?channel=vip-alerts

2. Create Action: Tier 3 Subscription
   → Assign to "vip-alerts" channel
   → Configure special VIP animation

3. Add to OBS
   → New Browser Source
   → URL: http://localhost:3737/browser-source?channel=vip-alerts
   → Position: Top-center, full screen

4. Test
   → Click "🧪 Test" on the action
   → Alert appears only in vip-alerts browser source
   → Default browser source shows nothing

5. Result
   → VIP subs show in special location
   → Regular alerts show in default location
   → Full control over alert positioning
```

## 📚 Related Documentation

- `PHASE-8-COMPLETE-SUMMARY.md` - Complete feature documentation
- `PHASE-8A-8B-COMPLETE.md` - Backend implementation
- `PHASE-8C-COMPLETE.md` - UI components
- `PHASE-8D-COMPLETE.md` - Event Actions integration
- `PHASE-8D-DATABASE-MIGRATION-FIX.md` - Migration details

## 🎯 Pro Tips

1. **Use Descriptive Names:** "Subscriber Alerts" not just "Subs"
2. **Consistent Icons:** Use related icons for grouped channels
3. **Color Coding:** Match channel colors to your stream theme
4. **Default Channel:** Keep it for general/unclassified alerts
5. **Test First:** Always test before going live
6. **OBS Naming:** Name browser sources to match channels

---

**Quick Help:**
- Press `F12` in browser source to debug
- Check console for connection status
- Use "Test" button to send test alerts
- Stats bar shows connected clients

**Support:** Check console logs for errors or connection issues
