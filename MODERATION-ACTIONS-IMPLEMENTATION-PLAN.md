# Moderation Actions Implementation Plan

## 🎯 Decision: Add as Third Tab in Viewers Screen

### Rationale
1. **Logical Flow**: View → History → Moderate
2. **Context Preservation**: User already looking at viewer data
3. **Consistent Pattern**: Matches established tab architecture
4. **Discoverability**: Natural place to look
5. **Safety**: Still requires deliberate navigation (not accidental)

---

## 📐 Proposed Implementation

### Location
```
src/frontend/screens/viewers/
├── viewers.tsx (Main screen - UPDATE)
└── tabs/
    ├── ViewerDetailsTab.tsx ✅ Exists
    ├── ViewerHistoryTab.tsx ✅ Exists
    └── ModerationActionsTab.tsx 🆕 CREATE
```

### Tab Structure
```
Viewers Screen
┌─────────────────────────────────────────────────────┐
│ [Viewer Details] [Viewer History] [Moderation Actions] │
│                                    ══════════════════ │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 UI Design: Moderation Actions Tab

### Layout
```
┌─────────────────────────────────────────────────────────┐
│ Moderation Actions                                      │
├─────────────────────────────────────────────────────────┤
│                                                         │
│ 🔍 Search for Viewer                                    │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ [Search: ________________] (autocomplete)           │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 👤 Selected Viewer: Username                            │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ Current Status                                      │ │
│ │ • Roles: Moderator                                  │ │
│ │ • Following: Yes                                    │ │
│ │ • Moderation: Active                                │ │
│ └─────────────────────────────────────────────────────┘ │
│                                                         │
│ ⚠️  Moderation Actions                                 │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐    │
│ │   🚫 BAN     │ │  ⏱️ TIMEOUT  │ │  🔕 UNBAN    │    │
│ │              │ │              │ │              │    │
│ │   [BAN]      │ │ Duration:    │ │  [UNBAN]     │    │
│ │              │ │ [5 min ▼]    │ │              │    │
│ │              │ │ [TIMEOUT]    │ │              │    │
│ └──────────────┘ └──────────────┘ └──────────────┘    │
│                                                         │
│ 👑 Role Management                                      │
│ ┌──────────────┐ ┌──────────────┐                      │
│ │   VIP        │ │  MODERATOR   │                      │
│ │ ☐ Is VIP     │ │ ☐ Is Mod     │                      │
│ │ [Toggle]     │ │ [Toggle]     │                      │
│ └──────────────┘ └──────────────┘                      │
│                                                         │
│ ─────────────────────────────────────────────────────── │
│                                                         │
│ 📋 Recent Actions (This Session)                        │
│ • 5:23 PM - Banned User123 (Reason: Spam)              │
│ • 5:20 PM - Added User456 as VIP                        │
│ • 5:15 PM - Removed User789 as Moderator                │
└─────────────────────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### Step 1: Update Main Viewers Screen

**File**: `src/frontend/screens/viewers/viewers.tsx`

```typescript
// Update tab type
type TabType = 'details' | 'history' | 'moderation';

// Add moderation tab button
<button
  onClick={() => setActiveTab('moderation')}
  style={{
    padding: '12px 24px',
    backgroundColor: activeTab === 'moderation' ? '#9147ff' : 'transparent',
    color: activeTab === 'moderation' ? 'white' : '#888',
    border: 'none',
    borderBottom: activeTab === 'moderation' ? '3px solid #9147ff' : '3px solid transparent',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s'
  }}
>
  Moderation Actions
</button>

// Add tab content
{activeTab === 'moderation' && (
  <ModerationActionsTab 
    preselectedViewerId={selectedViewerId}
    broadcasterId={broadcasterId}
    accessToken={accessToken}
    clientId={clientId}
  />
)}
```

### Step 2: Create Moderation Actions Tab Component

**File**: `src/frontend/screens/viewers/tabs/ModerationActionsTab.tsx`

```typescript
interface ModerationActionsTabProps {
  preselectedViewerId?: string;
  broadcasterId: string;
  accessToken: string;
  clientId: string;
}

export const ModerationActionsTab: React.FC<ModerationActionsTabProps> = ({
  preselectedViewerId,
  broadcasterId,
  accessToken,
  clientId
}) => {
  const [selectedViewer, setSelectedViewer] = useState<ViewerWithSubscription | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ViewerWithSubscription[]>([]);
  const [actionHistory, setActionHistory] = useState<Action[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  // Autocomplete search (like History tab)
  // Action handlers (ban, timeout, VIP, mod)
  // Confirmation dialogs
  // Session history tracking
};
```

---

## 🎯 Features to Implement

### 1. Viewer Search ✅
- Autocomplete dropdown (reuse from History tab)
- Shows matching viewers as you type
- Click to select

### 2. Current Status Display ✅
- Show viewer's current roles
- Show moderation status
- Show follower status
- Visual indicators (badges)

### 3. Ban Actions 🆕
```typescript
const handleBan = async (reason?: string) => {
  // Show confirmation dialog
  // Call Twitch API to ban
  // Update local database
  // Add to session history
  // Refresh viewer data
};

const handleUnban = async () => {
  // Show confirmation
  // Call Twitch API
  // Update database
  // Log action
};
```

### 4. Timeout Actions 🆕
```typescript
const handleTimeout = async (duration: number, reason?: string) => {
  // Duration selector (1min, 5min, 10min, 1hr, 1day)
  // Optional reason input
  // Confirmation dialog
  // API call
  // Update database
  // Log action
};
```

### 5. Role Management 🆕
```typescript
const handleToggleVIP = async () => {
  if (viewer.is_vip) {
    // Remove VIP
  } else {
    // Add VIP
  }
  // Confirmation dialog
  // API call
  // Update database
  // Log action
};

const handleToggleModerator = async () => {
  // Similar to VIP
};
```

### 6. Confirmation Dialogs 🆕
```typescript
interface ConfirmationDialog {
  title: string;
  message: string;
  action: () => Promise<void>;
  danger?: boolean; // Red for ban, orange for timeout
}

// Example:
{
  title: "Ban User?",
  message: "Are you sure you want to ban User123? This action is permanent.",
  action: () => banUser(),
  danger: true
}
```

### 7. Session History 🆕
```typescript
interface Action {
  timestamp: Date;
  action: 'ban' | 'unban' | 'timeout' | 'add_vip' | 'remove_vip' | 'add_mod' | 'remove_mod';
  viewerId: string;
  viewerName: string;
  reason?: string;
  duration?: number; // For timeouts
}

// Store in component state
// Display in chronological order
// Clear on tab close or refresh
```

---

## 🔐 Safety Features

### 1. Confirmation Dialogs
- **Always confirm** before destructive actions
- Show viewer name clearly
- Show what will happen
- Require explicit confirmation

### 2. Visual Warnings
```typescript
// Ban button
style={{
  backgroundColor: '#d32f2f', // Red
  border: '2px solid #ff5252'
}}

// Timeout button
style={{
  backgroundColor: '#f57c00', // Orange
  border: '2px solid #ff9800'
}}
```

### 3. Reason Input
- Optional but encouraged
- Pre-fill common reasons dropdown
- Custom reason text input
- Stored in database for audit

### 4. Session History
- Show recent actions
- Prevents duplicate actions
- Provides audit trail
- Can undo recent actions?

---

## 🗂️ File Structure

```
src/frontend/screens/viewers/
├── viewers.tsx (UPDATE)
│   └── Add 'moderation' tab
│
├── tabs/
│   ├── ViewerDetailsTab.tsx ✅
│   ├── ViewerHistoryTab.tsx ✅
│   └── ModerationActionsTab.tsx 🆕
│       ├── Viewer search
│       ├── Current status display
│       ├── Ban/Unban actions
│       ├── Timeout actions
│       ├── VIP management
│       ├── Moderator management
│       ├── Confirmation dialogs
│       └── Session history
│
└── components/ (optional)
    ├── ConfirmationDialog.tsx 🆕
    ├── ActionButton.tsx 🆕
    └── ActionHistoryItem.tsx 🆕
```

---

## 🎨 Component Breakdown

### ModerationActionsTab.tsx (Main)
- Search interface
- Selected viewer display
- Action buttons
- Session history

### ConfirmationDialog.tsx (Reusable)
```typescript
interface Props {
  isOpen: boolean;
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  danger?: boolean;
}
```

### ActionButton.tsx (Reusable)
```typescript
interface Props {
  label: string;
  onClick: () => void;
  variant: 'danger' | 'warning' | 'primary';
  disabled?: boolean;
  icon?: React.ReactNode;
}
```

---

## 📋 Implementation Checklist

### Phase 1: Basic Structure ⏳
- [ ] Update `viewers.tsx` with 3rd tab
- [ ] Create `ModerationActionsTab.tsx` skeleton
- [ ] Add viewer search (reuse from History)
- [ ] Display selected viewer info
- [ ] Add "no viewer selected" state

### Phase 2: Ban/Unban ⏳
- [ ] Add ban button
- [ ] Add unban button
- [ ] Create confirmation dialog
- [ ] Implement ban API call
- [ ] Implement unban API call
- [ ] Update local database
- [ ] Test ban/unban flow

### Phase 3: Timeout ⏳
- [ ] Add timeout button
- [ ] Add duration selector
- [ ] Add reason input
- [ ] Implement timeout API call
- [ ] Test timeout flow

### Phase 4: Role Management ⏳
- [ ] Add VIP toggle
- [ ] Add Moderator toggle
- [ ] Implement add/remove VIP
- [ ] Implement add/remove Moderator
- [ ] Test role management

### Phase 5: Session History ⏳
- [ ] Create action history state
- [ ] Log all actions
- [ ] Display recent actions
- [ ] Add timestamps
- [ ] Add action details

### Phase 6: Polish ⏳
- [ ] Add loading states
- [ ] Add error handling
- [ ] Add success messages
- [ ] Add keyboard shortcuts
- [ ] Add accessibility features

---

## 🔌 API Integration

### Existing IPC Handlers (Already Available)
```typescript
// From viewer-detail-modal.tsx (can reuse)
ipcRenderer.invoke('twitch:ban-user', { 
  broadcasterId, 
  viewerId, 
  accessToken, 
  clientId, 
  reason 
});

ipcRenderer.invoke('twitch:unban-user', { 
  broadcasterId, 
  viewerId, 
  accessToken, 
  clientId 
});

ipcRenderer.invoke('twitch:timeout-user', { 
  broadcasterId, 
  viewerId, 
  accessToken, 
  clientId, 
  duration, 
  reason 
});

ipcRenderer.invoke('twitch:add-vip', { ... });
ipcRenderer.invoke('twitch:remove-vip', { ... });
ipcRenderer.invoke('twitch:add-moderator', { ... });
ipcRenderer.invoke('twitch:remove-moderator', { ... });
```

### Database Updates
```typescript
// After successful action, update local DB
await db.updateViewerModerationStatus(viewerId, {
  status: 'banned',
  reason: reason,
  timestamp: new Date()
});
```

---

## 🎓 Design Principles

### 1. Safety First
- Always confirm destructive actions
- Clear visual warnings
- Reason tracking
- Undo capability (future)

### 2. Clarity
- Clear action labels
- Visual feedback
- Success/error messages
- Current status always visible

### 3. Efficiency
- Quick viewer search
- One-click actions (after confirmation)
- Keyboard shortcuts
- Recent actions visible

### 4. Consistency
- Matches existing tab pattern
- Reuses autocomplete pattern
- Same color scheme
- Familiar UI elements

---

## 🚀 Migration from Old Modal

### What We Have (Old Modal Code)
The old `viewer-detail-modal.tsx` already has:
✅ Ban/unban handlers
✅ Timeout handler
✅ VIP add/remove handlers
✅ Moderator add/remove handlers
✅ API integration
✅ Error handling

### What We Need to Do
1. **Extract** action handlers from modal
2. **Adapt** for new tab component
3. **Add** confirmation dialogs
4. **Add** session history tracking
5. **Improve** UX with better layout

---

## 📊 Estimated Effort

| Task | Effort | Priority |
|------|--------|----------|
| Tab structure update | 30 min | High |
| Basic component skeleton | 1 hour | High |
| Viewer search integration | 1 hour | High |
| Ban/Unban actions | 2 hours | High |
| Timeout actions | 2 hours | High |
| Role management | 2 hours | Medium |
| Confirmation dialogs | 1 hour | High |
| Session history | 1 hour | Medium |
| Polish & testing | 2 hours | Medium |
| **Total** | **~12 hours** | |

---

## ✅ Success Criteria

### Must Have
- ✅ Tab accessible from Viewers screen
- ✅ Viewer search works
- ✅ Can ban/unban users
- ✅ Can timeout users
- ✅ Confirmation dialogs work
- ✅ Actions update database
- ✅ No crashes or errors

### Nice to Have
- ✅ Session history tracking
- ✅ Role management (VIP/Mod)
- ✅ Reason tracking
- ✅ Success/error notifications
- ✅ Keyboard shortcuts

### Future Enhancements
- ⏳ Bulk moderation
- ⏳ Moderation templates
- ⏳ Full audit log (permanent)
- ⏳ Undo recent action
- ⏳ Scheduled unmutes/unbans

---

## 🎯 Next Steps

1. **Approve this plan** ✅
2. **Create ModerationActionsTab.tsx**
3. **Update viewers.tsx with 3rd tab**
4. **Implement basic structure**
5. **Add action handlers**
6. **Test thoroughly**
7. **Document usage**

---

**Recommendation**: Implement as **Third Tab in Viewers Screen**  
**Reason**: Best balance of discoverability, safety, and consistency  
**Effort**: ~12 hours for full implementation  
**Priority**: Medium (functional workaround exists via old modal if needed)

Would you like me to start implementing this?
