# Viewer Detail Modal - Visual Guide

## Modal Layout

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                         Viewer Detail Modal - 1000px wide                      ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║  Display Name                                                            [✕]  ║
║  User ID: 123456789                                                          ║
╠═══════════════════════════════════════════════════════════════════════════════╣
║                                                                                ║
║  LEFT PANEL (280px)          │  RIGHT PANEL (Flexible)                        ║
║  ════════════════════════════╪═════════════════════════════════════════════   ║
║                              │                                                ║
║  ┌─ Current Status ─────┐    │  Action Timeline (47)                         ║
║  │ ⚠️ BANNED             │    │  ┌──────────────────────────────────────────┐ ║
║  │ 👥 FOLLOWING          │    │  │ 👤 Granted as MOD                        │ ║
║  │ MOD                   │    │  │ 2025-10-31 14:23:45                      │ ║
║  │ VIP                   │    │  │ role: moderator                          │ ║
║  │ Tier 1 Subscriber     │    │  └──────────────────────────────────────────┘ ║
║  └───────────────────────┘    │  ┌──────────────────────────────────────────┐ ║
║                              │  │ ⚠️ Banned                                  │ ║
║  ┌─ Statistics ──────────┐    │  │ 2025-10-30 09:15:30                      │ ║
║  │ First Seen: Oct 31... │    │  │ reason: spam                             │ ║
║  │ Total Events: 42      │    │  │ moderator: broadcaster_name              │ ║
║  │ Mod Actions: 5        │    │  └──────────────────────────────────────────┘ ║
║  │ Role Changes: 3       │    │  ┌──────────────────────────────────────────┐ ║
║  └───────────────────────┘    │  │ 🎁 Subscribed                            │ ║
║                              │  │ 2025-10-25 16:42:12                      │ ║
║  [⚡ Moderation Actions]      │  │ tier: tier_2                             │ ║
║                              │  │ isGift: 0                                 │ ║
║  Or if opened:               │  │ endDate: null                             │ ║
║                              │  └──────────────────────────────────────────┘ ║
║  ┌─ Action Panel ────────┐    │  ┌──────────────────────────────────────────┐ ║
║  │ [Ban User]            │    │  │ 👥 Started Following                     │ ║
║  │ [Unban User]          │    │  │ 2025-10-20 22:05:18                      │ ║
║  │ [Timeout User]        │    │  │ followedAt: 2025-10-20T22:05:18Z         │ ║
║  │ ────────────────────  │    │  └──────────────────────────────────────────┘ ║
║  │ [Add Mod]             │    │  ┌──────────────────────────────────────────┐ ║
║  │ [Remove Mod]          │    │  │ 🔔 Event occurred                        │ ║
║  │ ────────────────────  │    │  │ 2025-10-15 11:30:00                      │ ║
║  │ [Add VIP]             │    │  └──────────────────────────────────────────┘ ║
║  │ [Remove VIP]          │    │                                              ║
║  └───────────────────────┘    │     [Scroll for more events]                 ║
║                              │                                                ║
║                              │                                                ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## Timeline Event Types & Colors

### 👤 Role Changes (Green #51cf66)
```
Granted as MOD
Granted as VIP
Revoked MOD status
Revoked VIP status
```

### ⚠️ Moderation (Red #ff6b6b)
```
Banned - reason: spam, moderator: broadcaster_name
Unbanned
Timed Out - 10 minutes, reason: excessive caps
Timeout Lifted
```

### 🎁 Subscriptions (Gold #ffd700)
```
Tier 1 Subscriber - start_date: ..., end_date: null
Tier 2 Subscriber (Gift) - start_date: ..., end_date: 2025-12-31
Subscription Ended - tier: tier_1
```

### 👥 Following (Purple #9147ff)
```
Started Following - followedAt: 2025-10-31T14:23:45Z
Unfollowed
```

### 🔔 General Events (Blue #2196f3)
```
Any other event from events table
```

## Action Panel States

### Closed State
```
┌─────────────────────┐
│ ⚡ Moderation Actions │
└─────────────────────┘
```

### Open - Main Menu
```
┌─────────────────────┐
│ ✓ Action success    │
├─────────────────────┤
│ [Ban User]          │
│ [Unban User]        │
│ [Timeout User]      │
│ ─────────────────── │
│ [Add Mod]           │
│ [Remove Mod]        │
│ ─────────────────── │
│ [Add VIP]           │
│ [Remove VIP]        │
└─────────────────────┘
```

### Open - Ban Selected
```
┌─────────────────────┐
│ [← Back]            │
├─────────────────────┤
│ [Reason field...]   │
│                     │
│ [Confirm Action]    │
└─────────────────────┘
```

### Open - Timeout Selected
```
┌─────────────────────┐
│ [← Back]            │
├─────────────────────┤
│ [Reason field...]   │
│ [Duration dropdown] │
│  ├ 1 minute         │
│  ├ 5 minutes        │
│  ├ 10 minutes       │
│  ├ 30 minutes       │
│  ├ 1 hour           │
│  ├ 1 day            │
│  └ 7 days           │
│ [Confirm Action]    │
└─────────────────────┘
```

## Interaction Flow

```
1. Click viewer row
       ↓
2. Modal opens with history
       ↓
3. User clicks "⚡ Moderation Actions"
       ↓
4. Action panel expands
       ↓
5. User selects action (Ban, Timeout, etc)
       ↓
6. Optional fields appear (reason, duration)
       ↓
7. User clicks "Confirm Action"
       ↓
8. API call sent to Twitch
       ↓
9. Success/Error message shown
       ↓
10. History auto-refreshes if successful
       ↓
11. User can take another action or close modal
       ↓
12. Click [✕] or click outside to close
       ↓
13. Viewer list auto-refreshes
```

## Status Badge Examples

```
┌──────────────────────┐
│ ⚠️ BANNED             │  Red background #ff6b6b
│ 👥 FOLLOWING          │  Purple background #9147ff
│ MODERATOR            │  Green background #51cf66
│ VIP                  │  Pink background #ff69b4
│ Tier 1 Subscriber    │  Gold background #ffd700
└──────────────────────┘
```

## Responsive Behavior

### Full Width (1000px+)
- Left panel: 280px fixed
- Right panel: Flexible, fills remaining space
- Both panels visible simultaneously
- Timeline scrolls independently

### Medium Width (700px - 1000px)
- Left panel: 280px fixed
- Right panel: Still flexible
- Slight horizontal scroll on modal itself

### Small Width (< 700px)
- Modal width: 90% of viewport
- Panels stack or side-by-side with overflow
- Timeline has horizontal scroll
- Action panel grows/shrinks as needed

## Color Palette

```
Background:         #1a1a1a (Dark)
Border/Divider:     #333
Text Primary:       #fff
Text Secondary:     #888
Text Tertiary:      #666

Role (Green):       #51cf66
Moderation (Red):   #ff6b6b
Subscription (Gold):#ffd700
Follow (Purple):    #9147ff
Event (Blue):       #2196f3
VIP (Pink):         #ff69b4
Broadcaster (Red):  #ff6b6b
```

## Example Timeline Entry

```
┌──────────────────────────────────────────────────────┐
│ 👤 Granted as MOD                                    │ ← Icon + Action
│ 2025-10-31 14:23:45                                  │ ← Timestamp
│ role: moderator                                      │ ← Details
│ revokedAt: null                                      │ ← Full JSON
└──────────────────────────────────────────────────────┘
```

With green left border (#51cf66) for Role category.

## Key Features

✅ **Click to open** - Single click on viewer row
✅ **Historical timeline** - Complete action history
✅ **Real-time status** - Current badges showing state
✅ **Color-coded events** - 5 categories with unique colors
✅ **Direct actions** - Ban/Unban/Timeout/Mod/VIP controls
✅ **Auto-refresh** - Updates after successful action
✅ **Error handling** - Shows messages for failed actions
✅ **Statistics** - Quick stats on left panel
✅ **Scrollable** - Both timeline and action panel scroll
✅ **Modal overlay** - Semi-transparent dark backdrop
