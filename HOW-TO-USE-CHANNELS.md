# Browser Source Channels - Quick Start Guide

## 🎯 What You Need to Know

### Creating Channels (✅ Fixed!)
1. Go to **Event Actions** screen
2. Click **"📺 Manage Channels"** button
3. Click **"Create Channel"**
4. Fill in **Display Name** → Create button enables immediately ✅
5. Pick an icon and color
6. Click **Create**

**The name auto-generates** - you don't need to worry about it!

### Assigning Events to Channels (✅ Already Implemented!)
1. Go to **Event Actions** screen
2. Click **Create Action** or **Edit** existing action
3. Open **General** tab (first tab)
4. Find **Browser Source Channel** dropdown
5. Select your channel from the list
6. Save the action

**Each action can be assigned to a different channel!**

### Using in OBS
1. In Channel Manager, find your channel
2. Copy the URL:
   - **Localhost URL** if OBS is on the same machine
   - **Network IP URL** if OBS is on a different machine
3. In OBS:
   - Add **Browser Source**
   - Paste the URL
   - Resize and position as needed

---

## 🎬 Common Use Cases

### Example 1: Main Alerts + TTS Corner
```
Channel 1: "Main Alerts" (default)
  └─ Subscriptions, Follows, Donations
  └─ Position: Top-center of stream

Channel 2: "TTS Corner"  
  └─ Channel Point Redemptions
  └─ Position: Bottom-right corner
```

### Example 2: Alert Categories
```
Channel 1: "Hype Events"
  └─ Subscriptions, Raids, Large Donations
  └─ Position: Center screen, full width

Channel 2: "Chat Interactions"
  └─ Channel Points, Polls, Predictions
  └─ Position: Side panel

Channel 3: "Quiet Notifications"
  └─ Follows, Small donations
  └─ Position: Small corner
```

---

## 🔍 Finding Things

### Where is the Channel Selector?
**Answer:** In the Action Editor → General Tab

### Where is the Channel Manager?
**Answer:** Event Actions screen → "📺 Manage Channels" button (top toolbar)

### Where do I see which channel an action uses?
**Answer:** Event Actions list shows colored badges for non-default channels

### Where do I filter actions by channel?
**Answer:** Event Actions screen → Channel filter dropdown (next to Search)

---

## ✅ What Works Now

- ✅ Create button enables as soon as you type Display Name
- ✅ Name auto-generates when you leave the field
- ✅ Name also auto-generates if you click Create immediately
- ✅ Channel selector in Action Editor works
- ✅ Both localhost and network IP URLs shown
- ✅ Channel filter and badges work
- ✅ All database migrations automatic

---

## 📝 Step-by-Step: First Time Setup

### 1. Create Your Channels
```
Event Actions → 📺 Manage Channels → Create Channel
```
- "Main Alerts" (📺 purple)
- "TTS Corner" (💬 blue)
- "Hype Events" (🎉 red)

### 2. Assign Actions to Channels
```
Event Actions → Edit any action → General tab → Browser Source Channel dropdown
```
- Subscription → "Hype Events"
- Follow → "Main Alerts"  
- Channel Points → "TTS Corner"

### 3. Add to OBS
```
OBS → Sources → + → Browser
```
- **Source 1:** Copy "Main Alerts" localhost URL → Position top-center
- **Source 2:** Copy "TTS Corner" localhost URL → Position bottom-right
- **Source 3:** Copy "Hype Events" localhost URL → Position center, large

### 4. Test It!
```
Event Actions → Click 📤 Test button on any action
```
- Alert should appear in the correct OBS browser source
- Each channel shows its own alerts independently

---

## 🎨 Visual Guide

### Channel Manager
```
┌─────────────────────────────────────┐
│ Browser Source Channels             │
│ [Create Channel] [Refresh]          │
├─────────────────────────────────────┤
│ 📺 Main Alerts                      │
│ The main alert overlay              │
│ default                             │
│ URL: localhost:3737/...             │
│ URL: 192.168.1.100:3737/...         │
│ [Edit] [Delete] [📋 Copy] [📋 Copy] │
└─────────────────────────────────────┘
```

### Action Editor - General Tab
```
┌─────────────────────────────────────┐
│ General Settings                    │
├─────────────────────────────────────┤
│ Event Type: [Channel Subscription ▼]│
│                                     │
│ Browser Source Channel:             │
│ [📺 Main Alerts            ▼]       │
│ ├─ 📺 Main Alerts                   │
│ ├─ 💬 TTS Corner                    │
│ └─ 🎉 Hype Events                   │
│                                     │
│ Choose which browser source channel │
│ will display this alert.            │
└─────────────────────────────────────┘
```

### Event Actions List (with Channel Badges)
```
┌─────────────────────────────────────┐
│ Event Actions                       │
│ Filter: [All Channels ▼] [Search]  │
├─────────────────────────────────────┤
│ 🔔 Subscription Alert               │
│ [🎉 Hype Events]  ← Purple badge    │
│                                     │
│ 💬 Follow Alert                     │
│ (no badge = default channel)        │
│                                     │
│ 🎁 Channel Points                   │
│ [💬 TTS Corner]   ← Purple badge    │
└─────────────────────────────────────┘
```

---

## 🐛 Troubleshooting

### Create Button Stays Disabled
**Fix:** ✅ Already fixed! Just type the Display Name and the button enables.

### Don't See Channel Selector
**Fix:** Open Action Editor → Check you're on the **General** tab (first tab)

### URL Not Working in OBS
**Fix:** 
- Use **localhost URL** if OBS is on the same computer
- Use **Network IP URL** if OBS is on a different computer
- Make sure the app is running before opening OBS

### Can't Find Channel Manager
**Fix:** Go to **Event Actions** screen → Look for **"📺 Manage Channels"** button in toolbar

---

## 📚 Related Documentation

- `PHASE-8D-BUTTON-FIX.md` - Technical details of the Create button fix
- `PHASE-8D-COMPLETE.md` - Complete Phase 8D documentation
- `BROWSER-SOURCE-CHANNELS-QUICK-REF.md` - User quick reference
- `PHASE-8-FINAL-SUMMARY.md` - Complete technical overview

---

**Last Updated:** 2025-01-03  
**Status:** All features working ✅
