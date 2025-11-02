# Phase 7: Event Actions Screen - Visual Guide

## 🎨 Screen Layout & Components

This document provides a visual representation of all UI components implemented in Phase 7.

---

## 📐 Full Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ ┌─ MENU ──┐  ┌─── EVENT ACTIONS SCREEN ─────────────────────────────────────┐ │
│ │          │  │                                                               │ │
│ │Connection│  │  ┌─ BROWSER SOURCE STATUS BAR ────────────────────────────┐  │ │
│ │Events    │  │  │ 🟢 Browser Source Running | Port: 3737 | Active: 2      │  │ │
│ │►Actions  │  │  └──────────────────────────────────────────────────────────┘  │ │
│ │Chat      │  │                                                               │ │
│ │Commands  │  │  ┌─ STATISTICS BAR ──────────────────────────────────────┐  │ │
│ │Viewers   │  │  │ 📊 Total: 12 | ✅ Enabled: 8 | ⛔ Disabled: 4         │  │ │
│ │TTS       │  │  └──────────────────────────────────────────────────────────┘  │ │
│ │Discord   │  │                                                               │ │
│ │          │  │  ┌─ TOOLBAR ───────────────────────────────────────────────┐  │ │
│ ├──────────┤  │  │ 🔍 [Search box...]  ☑️ Show only enabled  [+ New]      │  │ │
│ │Advanced  │  │  └──────────────────────────────────────────────────────────┘  │ │
│ └──────────┘  │                                                               │ │
│               │  ┌─ ACTION LIST (GRID) ────────────────────────────────────┐  │ │
│               │  │ ┌────────────────────────────────────────────────────┐  │  │ │
│               │  │ │Event Type│Media│Template  │Status│Actions         │  │  │ │
│               │  │ ├────────────────────────────────────────────────────┤  │  │ │
│               │  │ │📢 Follow │📝   │{user}... │[ON]  │🧪 Test 🗑️ Del  │  │  │ │
│               │  │ │📢 Sub    │🔊📝 │Thanks... │[OFF] │🧪 Test 🗑️ Del  │  │  │ │
│               │  │ │📢 Raid   │🎬📝 │Raid...   │[ON]  │🧪 Test 🗑️ Del  │  │  │ │
│               │  │ │📢 Cheer  │🖼️📝 │{bits}... │[ON]  │🧪 Test 🗑️ Del  │  │  │ │
│               │  │ │...                                                 │  │  │ │
│               │  │ └────────────────────────────────────────────────────┘  │  │ │
│               │  └──────────────────────────────────────────────────────────┘  │ │
│               └───────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🟢 Component 1: Browser Source Status Bar

### Active State
```
╔════════════════════════════════════════════════════════════╗
║ 🟢 Browser Source Running | Port: 3737 | Active: 2        ║
╚════════════════════════════════════════════════════════════╝
```

**Visual Properties:**
- Background: Linear gradient `#27ae60` to `#229954` (green)
- Border radius: `8px`
- Padding: `12px 16px`
- Font size: `14px`
- Font weight: `500`
- Animation: Pulse effect (opacity 0.8 → 1.0, 2s infinite)

**States:**
- **Running:** Green gradient with pulse
- **Not Running:** Red gradient, no pulse
- **No Connections:** Orange gradient

**Auto-refresh:** Every 5 seconds

---

## 📊 Component 2: Statistics Bar

```
╔════════════════════════════════════════════════════════════╗
║ 📊 Total: 12 | ✅ Enabled: 8 | ⛔ Disabled: 4             ║
╚════════════════════════════════════════════════════════════╝
```

**Visual Properties:**
- Background: Linear gradient `#8e44ad` to `#6c3483` (purple)
- Border radius: `8px`
- Padding: `12px 16px`
- Font size: `14px`
- Font weight: `500`
- Gap between items: `20px`

**Dynamic Counts:**
- Total: All actions
- Enabled: Actions with `is_enabled = true`
- Disabled: Actions with `is_enabled = false`

---

## 🔧 Component 3: Toolbar

```
╔════════════════════════════════════════════════════════════╗
║  🔍 Search actions...     ☑️ Show only enabled  [+ New]   ║
╚════════════════════════════════════════════════════════════╝
```

### Search Box
```
┌─────────────────────────┐
│ 🔍 Search actions...    │
└─────────────────────────┘
```
- Width: `300px`
- Padding: `8px 12px`
- Background: `#1a1a1a`
- Border: `1px solid #444`
- Border radius: `4px`
- Placeholder color: `#666`

### Show Only Enabled Checkbox
```
☑️ Show only enabled
```
- Custom checkbox design
- Purple accent when checked
- Label font size: `14px`

### New Action Button (Phase 8)
```
┌───────────┐
│  + New    │
└───────────┘
```
- Background: `#9147ff` (purple)
- Padding: `8px 16px`
- Border radius: `4px`
- Hover: Darker purple

---

## 📋 Component 4: Action List Headers

```
╔════════════════════════════════════════════════════════════════════╗
║ Event Type    │ Media Types │ Template      │ Status │ Actions    ║
╚════════════════════════════════════════════════════════════════════╝
```

**Column Widths:**
- Event Type: `250px` (flex)
- Media Types: `150px`
- Template: `300px` (flex)
- Status: `100px`
- Actions: `180px`

**Styling:**
- Background: `#1a1a1a`
- Font weight: `600`
- Font size: `12px`
- Text transform: `uppercase`
- Letter spacing: `0.5px`
- Color: `#999`

---

## 📄 Component 5: Action List Items

### Full Action Row
```
┌────────────────────────────────────────────────────────────────────┐
│ 📢 Follow              │ 📝 Text      │ {user} just... │ ●──○ │ 🧪 🗑️│
│    channel.follow      │              │                │      │      │
└────────────────────────────────────────────────────────────────────┘
```

### Event Type Column
```
┌──────────────────┐
│ 📢 Follow        │
│    channel.follow│
└──────────────────┘
```
- **Icon:** 📢 (32px font size)
- **Display Name:** Bold, 14px
- **Event Code:** Gray, 11px, italic

### Media Types Column
```
┌────────────────┐
│ 📝 Text        │
│ 🔊 Sound       │
│ 🖼️ Image       │
│ 🎬 Video       │
└────────────────┘
```

**Badge Styling:**
```css
📝 Text   → Blue   (#3498db)
🔊 Sound  → Green  (#2ecc71)
🖼️ Image  → Orange (#e67e22)
🎬 Video  → Red    (#e74c3c)
```
- Padding: `4px 8px`
- Border radius: `12px`
- Font size: `11px`
- Font weight: `500`
- Inline-flex display
- Gap: `4px`

### Template Column
```
┌─────────────────────────────┐
│ {user} just followed! We... │
└─────────────────────────────┘
```
- Font family: `Consolas, monospace`
- Font size: `12px`
- Color: `#e0e0e0`
- Text overflow: `ellipsis`
- Max width: Template truncated if too long

### Status Column (Toggle Switch)

**OFF State:**
```
┌──────┐
│ ○──● │  OFF
└──────┘
```

**ON State:**
```
┌──────┐
│ ●──○ │  ON
└──────┘
```

**Toggle Switch CSS:**
```css
Width: 50px
Height: 24px
Border-radius: 12px
Background (OFF): #555
Background (ON): #9147ff (purple)

Slider:
  Width: 20px
  Height: 20px
  Border-radius: 50%
  Background: white
  Transition: transform 0.2s
  Transform (ON): translateX(26px)
```

### Actions Column
```
┌─────────────────┐
│ 🧪 Test 🗑️ Del │
└─────────────────┘
```

**Test Button:**
- Background: `#2ecc71` (green)
- Padding: `6px 12px`
- Border radius: `4px`
- Font size: `12px`
- Hover: Darker green
- Click: Changes to "✅ Sent!" for 2s

**Delete Button:**
- Background: `#e74c3c` (red)
- Padding: `6px 12px`
- Border radius: `4px`
- Font size: `12px`
- Hover: Darker red

---

## 🎭 Visual States

### Enabled Action
```
┌────────────────────────────────────────────────────────────────────┐
│ 📢 Follow              │ 📝 Text      │ {user}...      │ ●──○ │ 🧪 🗑️│
└────────────────────────────────────────────────────────────────────┘
```
- Background: `#2a2a2a`
- Border: `1px solid #3a3a3a`
- Opacity: `100%`
- Full brightness

### Disabled Action
```
┌────────────────────────────────────────────────────────────────────┐
│ 📢 Follow              │ 📝 Text      │ {user}...      │ ○──● │ 🧪 🗑️│
└────────────────────────────────────────────────────────────────────┘
```
- Background: `#2a2a2a`
- Border: `1px solid #3a3a3a`
- Opacity: `50%`
- Dimmed appearance

### Hover State
```
┌────────────────────────────────────────────────────────────────────┐
│ 📢 Follow              │ 📝 Text      │ {user}...      │ ●──○ │ 🧪 🗑️│ ← Highlighted
└────────────────────────────────────────────────────────────────────┘
```
- Border color: `#9147ff` (purple accent)
- Background: Slightly lighter
- Cursor: Pointer
- Transition: 0.2s

---

## 📭 Empty States

### No Connection
```
╔═══════════════════════════════════════╗
║                                       ║
║           ⚠️                          ║
║      No channel connected             ║
║                                       ║
║  Please connect to a Twitch channel   ║
║  first to manage alert actions.       ║
║                                       ║
╚═══════════════════════════════════════╝
```

### No Actions
```
╔═══════════════════════════════════════╗
║                                       ║
║           📭                          ║
║   No alert actions configured         ║
║                                       ║
║  Click "New Action" to create your    ║
║  first alert!                         ║
║                                       ║
╚═══════════════════════════════════════╝
```

### No Search Results
```
╔═══════════════════════════════════════╗
║                                       ║
║           🔍                          ║
║   No actions match your search        ║
║                                       ║
║  Try a different search term or       ║
║  clear the filter.                    ║
║                                       ║
╚═══════════════════════════════════════╝
```

**Empty State Styling:**
- Text align: Center
- Padding: `60px 20px`
- Icon size: `48px`
- Text color: `#999`
- Font size: `16px`

---

## 🔄 Loading State

```
╔═══════════════════════════════════════╗
║                                       ║
║              ⏳                       ║
║         Loading actions...            ║
║                                       ║
║         [Spinner animation]           ║
║                                       ║
╚═══════════════════════════════════════╝
```

**Spinner CSS:**
```css
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

.loading-spinner {
  border: 3px solid #444;
  border-top: 3px solid #9147ff;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}
```

---

## ⚠️ Error State

```
╔═══════════════════════════════════════╗
║                                       ║
║              ❌                       ║
║         Failed to load actions        ║
║                                       ║
║  Error: Database connection failed    ║
║                                       ║
║        [Try Again Button]             ║
║                                       ║
╚═══════════════════════════════════════╝
```

**Error Styling:**
- Background: `rgba(231, 76, 60, 0.1)` (red tint)
- Border: `1px solid #e74c3c`
- Padding: `20px`
- Border radius: `8px`

---

## 🎨 Color Palette

### Primary Colors
```
Background:      #0d0d0d  ████████
Container:       #2a2a2a  ████████
Border:          #3a3a3a  ████████
Accent:          #9147ff  ████████ (Twitch purple)
```

### Status Colors
```
Success/Green:   #2ecc71  ████████
Warning/Orange:  #e67e22  ████████
Error/Red:       #e74c3c  ████████
Info/Blue:       #3498db  ████████
```

### Text Colors
```
Primary:         #ffffff  ████████
Secondary:       #e0e0e0  ████████
Muted:           #999999  ████████
Disabled:        #666666  ████████
```

### Media Badge Colors
```
Text:            #3498db  ████████ (Blue)
Sound:           #2ecc71  ████████ (Green)
Image:           #e67e22  ████████ (Orange)
Video:           #e74c3c  ████████ (Red)
```

---

## 📱 Responsive Breakpoints

### Desktop (> 1200px)
```
┌──────────────────────────────────────────────────┐
│ [Full 5-column layout]                           │
│ Event Type | Media | Template | Status | Actions │
└──────────────────────────────────────────────────┘
```

### Tablet (900px - 1200px)
```
┌────────────────────────────────────┐
│ [4-column layout]                  │
│ Event | Media+Template | Status | Actions │
└────────────────────────────────────┘
```

### Mobile (< 900px)
```
┌──────────────────┐
│ [Stacked cards]  │
│ ┌──────────────┐ │
│ │ Event Type   │ │
│ │ Media Badges │ │
│ │ Template     │ │
│ │ [Toggle] [Actions] │
│ └──────────────┘ │
└──────────────────┘
```

---

## 🎭 Interaction Animations

### Toggle Switch
```
OFF → ON
○──●  →  ●──○
(0.2s ease transition)
Background: #555 → #9147ff
Slider: translateX(0) → translateX(26px)
```

### Test Button
```
Normal → Click → Feedback → Reset
🧪 Test  →  [Pressed]  →  ✅ Sent!  →  🧪 Test
(Instant)   (0.1s)      (2s)         (0.3s fade)
```

### Hover Effects
```
Action Row:
  Border: #3a3a3a → #9147ff (0.2s)
  
Buttons:
  Scale: 1.0 → 1.05 (0.15s)
  
Toggle:
  Scale: 1.0 → 1.1 (0.15s)
```

### Browser Status Pulse
```
Opacity: 0.8 → 1.0 → 0.8
Duration: 2s
Timing: ease-in-out
Iteration: infinite
```

---

## 🔤 Typography

### Font Families
```
UI Text:      'Segoe UI', sans-serif
Monospace:    'Consolas', 'Monaco', monospace (templates)
```

### Font Sizes
```
Headers:      12px (uppercase, bold)
Body:         14px (normal)
Small:        11px (event codes, badges)
Large:        16px (empty states)
Icon:         32px (event icons)
Emoji:        14px (inline)
```

### Font Weights
```
Light:        300 (not used)
Normal:       400 (body text)
Medium:       500 (labels, status)
Bold:         600 (headers, event names)
Extra Bold:   700 (not used)
```

---

## 🎯 Component Hierarchy

```
EventActionsScreen
├── BrowserSourceStatus
│   ├── StatusIndicator (🟢)
│   ├── PortInfo
│   └── ConnectionCount
│
├── StatsBar
│   ├── TotalCount
│   ├── EnabledCount
│   └── DisabledCount
│
├── Toolbar
│   ├── SearchBox
│   ├── ShowOnlyEnabledCheckbox
│   └── NewActionButton
│
└── ActionList
    ├── ListHeader
    │   ├── EventTypeHeader
    │   ├── MediaTypesHeader
    │   ├── TemplateHeader
    │   ├── StatusHeader
    │   └── ActionsHeader
    │
    └── ActionItems[]
        ├── EventTypeCell
        │   ├── EventIcon
        │   ├── DisplayName
        │   └── EventCode
        │
        ├── MediaTypesCell
        │   └── MediaBadges[]
        │       ├── TextBadge
        │       ├── SoundBadge
        │       ├── ImageBadge
        │       └── VideoBadge
        │
        ├── TemplateCell
        │   └── TemplatePreview
        │
        ├── StatusCell
        │   └── ToggleSwitch
        │       ├── Track
        │       ├── Slider
        │       └── Label
        │
        └── ActionsCell
            ├── TestButton
            └── DeleteButton
```

---

## 📏 Spacing & Layout

### Container Padding
```
Main container:   20px
Status bar:       12px 16px
Stats bar:        12px 16px
Toolbar:          16px
Action item:      16px
```

### Gaps
```
Between sections: 20px
Between items:    12px
Between badges:   8px
Between buttons:  8px
In toolbar:       16px
```

### Border Radius
```
Containers:       8px
Buttons:          4px
Badges:           12px
Toggle track:     12px
Search box:       4px
```

---

## 🎨 Design Patterns Used

### Card Design
```
┌─────────────────┐
│ [Content]       │
│                 │
└─────────────────┘
```
- Background: Darker than main bg
- Border: Subtle outline
- Padding: Consistent spacing
- Border radius: Rounded corners

### Badge Design
```
╭─────────╮
│ 📝 Text │
╰─────────╯
```
- Pill shape (high border radius)
- Icon + text
- Color-coded by type
- Compact size

### Button Design
```
┌───────────┐
│ 🧪 Test   │
└───────────┘
```
- Icon + text
- Color-coded by action
- Hover states
- Active states

### Toggle Design
```
╭──────╮
│ ●──○ │
╰──────╯
```
- Track + slider
- Smooth transition
- Color change on state
- Scale on hover

---

**Visual Guide Complete!** ✅

This guide provides a comprehensive visual reference for all UI components in Phase 7. Use this when implementing Phase 8 (Action Editor Modal) to maintain consistent styling.

---

*Created: November 2, 2025*  
*Stream Synth - Event Actions Feature - Phase 7*
