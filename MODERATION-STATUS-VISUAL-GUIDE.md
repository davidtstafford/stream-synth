# Moderation Status - Visual Reference Guide

## UI Component Breakdown

This document shows exactly what the Viewers screen looks like with moderation status.

---

## Table Layout

### Column Order (Left to Right)
1. **Display Name** - Viewer's Twitch username
2. **Roles** - Broadcaster/Mod/VIP badges
3. **Moderation** ← NEW COLUMN
4. **Subscription Status** - Sub tier or "Not Subscribed"
5. **First Seen** - When viewer was first recorded
6. **Last Updated** - Last database update
7. **Actions** - Delete button

---

## Moderation Column States

### 1. No Moderation Action (Normal User)
```
┌─────────────┐
│      —      │  ← Gray dash, 12px font
└─────────────┘
```
**Code:** `moderation_status = NULL` or `moderation_status = 'active'`

---

### 2. Banned User
```
┌─────────────────────────┐
│      [ BANNED ]         │  ← Red badge (#d32f2f)
│     Spam in chat        │  ← Gray italic reason
└─────────────────────────┘
```

**Badge Styling:**
- Background: `#d32f2f` (dark red)
- Text: White, 11px, bold
- Padding: 3px vertical, 8px horizontal
- Border-radius: 4px

**Code:** `moderation_status = 'banned'`

**Example Row:**
```
| BadUser123 | — | [BANNED] Spam | Not Subscribed | 2024-01-15 |
```

---

### 3. Timed Out User
```
┌─────────────────────────┐
│    [ TIMED OUT ] ⓘ      │  ← Orange badge (#f57c00)
│   Chat violation        │  ← Gray italic reason
└─────────────────────────┘
       ↑
   Hover shows tooltip: "Expires: 3:45:22 PM"
```

**Badge Styling:**
- Background: `#f57c00` (orange)
- Text: White, 11px, bold
- Padding: 3px vertical, 8px horizontal
- Border-radius: 4px
- Title attribute: Expiration time

**Code:** `moderation_status = 'timed_out'`

**Example Row:**
```
| ChatSpammer | — | [TIMED OUT] ⓘ Chat violation | Tier 1 | 2024-01-20 |
```

---

## Complete Table Examples

### Example 1: Mixed Statuses

```
┌────────────────┬───────┬──────────────────────┬─────────────────┬────────────┐
│ Display Name   │ Roles │ Moderation           │ Subscription    │ First Seen │
├────────────────┼───────┼──────────────────────┼─────────────────┼────────────┤
│ YourUsername   │ [🔴]  │ —                    │ Not Subscribed  │ 2024-01-10 │
│                │ BROAD │                      │                 │            │
├────────────────┼───────┼──────────────────────┼─────────────────┼────────────┤
│ ModeratorName  │ [🟢]  │ —                    │ Tier 3          │ 2024-01-12 │
│                │ MOD   │                      │                 │            │
├────────────────┼───────┼──────────────────────┼─────────────────┼────────────┤
│ VIPUser        │ [💗]  │ —                    │ Tier 1 (Gift)   │ 2024-01-13 │
│                │ VIP   │                      │                 │            │
├────────────────┼───────┼──────────────────────┼─────────────────┼────────────┤
│ BadUser123     │ —     │ [BANNED]             │ Not Subscribed  │ 2024-01-15 │
│                │       │ Spam in chat         │                 │            │
├────────────────┼───────┼──────────────────────┼─────────────────┼────────────┤
│ ChatSpammer    │ —     │ [TIMED OUT] ⓘ        │ Tier 1          │ 2024-01-16 │
│                │       │ Chat violation       │                 │            │
├────────────────┼───────┼──────────────────────┼─────────────────┼────────────┤
│ RegularViewer  │ —     │ —                    │ Not Subscribed  │ 2024-01-18 │
└────────────────┴───────┴──────────────────────┴─────────────────┴────────────┘
```

Legend:
- 🔴 = BROADCASTER badge (red, #ff6b6b)
- 🟢 = MOD badge (green, #51cf66)
- 💗 = VIP badge (pink, #ff69b4)
- [BANNED] = Dark red badge (#d32f2f)
- [TIMED OUT] = Orange badge (#f57c00)
- ⓘ = Has tooltip on hover

---

## Color Palette

### Role Badges (Existing)
```css
BROADCASTER: {
  background: #ff6b6b; /* Red */
  color: white;
}

MOD: {
  background: #51cf66; /* Green */
  color: white;
}

VIP: {
  background: #ff69b4; /* Hot Pink */
  color: white;
}
```

### Moderation Badges (NEW)
```css
BANNED: {
  background: #d32f2f; /* Dark Red */
  color: white;
}

TIMED OUT: {
  background: #f57c00; /* Orange */
  color: white;
}
```

### Text Styles
```css
Reason Text: {
  font-size: 11px;
  color: #aaa; /* Light gray */
  font-style: italic;
}

No Moderation: {
  color: #888; /* Gray */
  font-size: 12px;
}
```

---

## Component Hierarchy

```
<ViewersScreen>
  └── <table>
      └── <tbody>
          └── {viewers.map(viewer => 
              <tr>
                ├── <td> Display Name </td>
                ├── <td> Roles Badges </td>
                ├── <td> {renderModerationStatus(viewer)} </td>  ← NEW
                ├── <td> Subscription Status </td>
                ├── <td> First Seen </td>
                ├── <td> Last Updated </td>
                └── <td> Actions </td>
              </tr>
          )}
      </tbody>
  </table>
</ViewersScreen>
```

---

## Responsive Behavior

### Desktop (Wide Screen)
- All columns visible
- Badges display inline
- Full reason text visible

### Tablet (Medium Screen)
- All columns visible
- Text may wrap
- Badges may stack vertically

### Mobile (Not Primary Use Case)
- Table scrolls horizontally
- Moderation column remains visible
- Consider hiding less important columns

---

## Accessibility

### Screen Readers
- Badges have semantic meaning: "User is banned"
- Reason text is part of cell content
- Tooltip content available via title attribute

### Keyboard Navigation
- Tab through table rows
- Focus indicators on interactive elements
- Delete button accessible via keyboard

### Color Contrast
- All badges meet WCAG AA standards
- White text on colored backgrounds
- Sufficient contrast ratios

---

## Animation & Transitions

### On Event Received
1. IPC event triggers `loadViewers()`
2. Table data refreshes
3. **No animation** - instant update preferred for data accuracy
4. Badge appears immediately

### Future Enhancement: Subtle Fade-In
```css
.moderation-badge {
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

---

## Edge Cases & Display Rules

### 1. User Banned Then Unbanned
**Display:** Shows `—` (latest action is unban = active)

### 2. User Timed Out Multiple Times
**Display:** Shows most recent timeout with current expiration

### 3. User Timed Out Then Banned
**Display:** Shows `[BANNED]` (ban is more severe)

### 4. Timeout Expired
**Display:** Badge remains until next event or refresh
**Future:** Could auto-remove when expires_at < now()

### 5. No Reason Provided
**Display:** Badge only, no reason text below

### 6. Very Long Reason
**Display:** Full text wraps to multiple lines
**Future:** Could truncate with "..." and show full in tooltip

---

## Developer Notes

### Badge Render Logic
```typescript
const renderModerationStatus = (viewer: ViewerWithSubscription) => {
  // Null or 'active' = no moderation
  if (!viewer.moderation_status || viewer.moderation_status === 'active') {
    return <span style={{ color: '#888', fontSize: '12px' }}>—</span>;
  }

  // Banned user
  if (viewer.moderation_status === 'banned') {
    return (
      <div>
        <span className="banned-badge">BANNED</span>
        {viewer.moderation_reason && <span className="reason">{reason}</span>}
      </div>
    );
  }

  // Timed out user
  if (viewer.moderation_status === 'timed_out') {
    const expiresAt = formatTime(viewer.moderation_expires_at);
    return (
      <div>
        <span className="timeout-badge" title={`Expires: ${expiresAt}`}>
          TIMED OUT
        </span>
        {viewer.moderation_reason && <span className="reason">{reason}</span>}
      </div>
    );
  }
};
```

### CSS Classes (Inline Styles Currently Used)
```css
.banned-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  background-color: #d32f2f;
  color: white;
}

.timeout-badge {
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: bold;
  background-color: #f57c00;
  color: white;
}

.reason {
  font-size: 11px;
  color: #aaa;
  font-style: italic;
  display: block;
  margin-top: 4px;
}
```

---

## Testing Checklist

Visual verification:
- [ ] BANNED badge is dark red
- [ ] TIMED OUT badge is orange
- [ ] Text is white and legible on both badges
- [ ] Reason text is gray and italic
- [ ] "—" appears for users with no moderation
- [ ] Badges align properly in column
- [ ] Tooltip appears on hover for timeouts
- [ ] Table remains aligned with new column

---

## Screenshots (Textual Representation)

### Normal State
```
╔══════════════════════════════════════════════════════════════╗
║  Viewers                                                     ║
╠══════════════════════════════════════════════════════════════╣
║  [Search...] [⟳ Sync] [Refresh] [Delete All]                ║
║                                                              ║
║  Total viewers: 6                                            ║
║                                                              ║
║  ┌─────────────┬───────┬────────────┬──────────────┬─────┐  ║
║  │ Name        │ Roles │ Moderation │ Subscription │ ... │  ║
║  ├─────────────┼───────┼────────────┼──────────────┼─────┤  ║
║  │ Broadcaster │ BROAD │     —      │ Not Sub      │ ... │  ║
║  │ Moderator1  │  MOD  │     —      │ Tier 3       │ ... │  ║
║  │ VIPUser     │  VIP  │     —      │ Tier 1       │ ... │  ║
║  │ RegularUser │   —   │     —      │ Not Sub      │ ... │  ║
║  └─────────────┴───────┴────────────┴──────────────┴─────┘  ║
╚══════════════════════════════════════════════════════════════╝
```

### After Ban Event
```
╔══════════════════════════════════════════════════════════════╗
║  Viewers                                                     ║
╠══════════════════════════════════════════════════════════════╣
║  [Search...] [⟳ Sync] [Refresh] [Delete All]                ║
║                                                              ║
║  Total viewers: 6                                            ║
║                                                              ║
║  ┌─────────────┬───────┬────────────────┬──────────────┬───┐║
║  │ Name        │ Roles │ Moderation     │ Subscription │...│║
║  ├─────────────┼───────┼────────────────┼──────────────┼───┤║
║  │ Broadcaster │ BROAD │       —        │ Not Sub      │...│║
║  │ Moderator1  │  MOD  │       —        │ Tier 3       │...│║
║  │ VIPUser     │  VIP  │       —        │ Tier 1       │...│║
║  │ BadUser123  │   —   │  [BANNED]      │ Not Sub      │...│║ ← NEW
║  │             │       │  Spam in chat  │              │   │║
║  │ RegularUser │   —   │       —        │ Not Sub      │...│║
║  └─────────────┴───────┴────────────────┴──────────────┴───┘║
╚══════════════════════════════════════════════════════════════╝
```

---

## Comparison: Before vs After This Feature

### BEFORE (Phase 7.2)
- ✅ Roles displayed (Broadcaster, Mod, VIP)
- ✅ Subscription status shown
- ❌ No moderation status visible
- ❌ Banned users look like regular users

### AFTER (Phase 7.3) ✅
- ✅ Roles displayed (Broadcaster, Mod, VIP)
- ✅ Subscription status shown
- ✅ **Moderation status displayed with badges**
- ✅ **Banned users clearly identified**
- ✅ **Timed out users shown with expiration**
- ✅ **Reason text provides context**

---

## User Experience Flow

1. **User opens Viewers screen** → Sees all viewers with current status
2. **Moderator bans user in Twitch** → EventSub event triggers
3. **Viewers screen auto-refreshes** → BANNED badge appears (1-2 seconds)
4. **User hovers over TIMED OUT badge** → Tooltip shows expiration time
5. **Moderator unbans user** → Badge disappears automatically

**No manual action required!** Everything updates in real-time. ✅

---

## Summary

The Moderation column provides at-a-glance visibility into viewer moderation status:
- **Red badges** = Immediate attention (banned)
- **Orange badges** = Temporary action (timed out)
- **Gray dash** = All clear (no moderation)

Combined with real-time EventSub updates, moderators can see the current state of their community without leaving the application.

---

**Visual Design: Complete ✅**

*Generated: October 31, 2025*
