# Phase 8 Refactor: Modal → Dedicated Screen

## 🎯 Proposal

**Current**: ActionEditor as modal overlay  
**Proposed**: ActionEditor as dedicated screen (like Viewer → History pattern)

## ✅ Benefits

### User Experience
- **More screen space** - No 90% width constraint, use full viewport
- **No compression issues** - Tab bar won't get squeezed
- **Natural navigation** - Back button instead of modal close
- **Better workflow** - Feels like a proper feature, not a popup
- **Can bookmark** - Direct URL to edit specific action

### Developer Experience
- **Simpler layout** - No z-index/backdrop management
- **Better responsive** - Full control over layout
- **Easier testing** - Can navigate directly to screen
- **Cleaner code** - No modal state management

## 📐 Proposed Structure

```
Event Actions Screen (List View)
├─ Action 1 [Edit] → Navigate to Edit Action Screen
├─ Action 2 [Edit] → Navigate to Edit Action Screen  
└─ [Create Action] → Navigate to Edit Action Screen (create mode)

Edit Action Screen (Detail View)
├─ [← Back to Event Actions] button
├─ Action form (full width)
├─ Tab navigation (fixed height)
└─ Save/Cancel buttons (navigate back on save)
```

## 🔄 Navigation Pattern (Like Viewer Screen)

### Current Viewer Pattern
```
Viewers Screen (List)
  └─ Click user → Navigate to Viewer Detail Screen
      └─ Tabs: Overview | History | Moderation
          └─ [← Back to Viewers] returns to list
```

### Proposed Event Actions Pattern
```
Event Actions Screen (List)
  └─ Click [Edit] → Navigate to Edit Action Screen
      └─ Tabs: General | Text | Sound | Image | Video
          └─ [← Back to Event Actions] returns to list
```

## 📂 File Changes Required

### New/Modified Files

1. **src/frontend/screens/events/edit-action.tsx** (NEW)
   - Convert ActionEditor component to full screen
   - Add breadcrumb/back navigation
   - Use full viewport width
   - Remove modal backdrop/container

2. **src/frontend/screens/events/edit-action.css** (NEW)
   - Remove modal-specific styles
   - Use screen-based layout
   - Fixed tab bar height
   - Full-width forms

3. **src/frontend/App.tsx** (MODIFY)
   - Add route: `/events/actions/:actionId/edit` (edit mode)
   - Add route: `/events/actions/create` (create mode)
   - Pass action ID via route params

4. **src/frontend/screens/events/event-actions.tsx** (MODIFY)
   - Remove modal state (`selectedAction`, `isCreatingAction`)
   - Change [Edit] button to navigate to edit screen
   - Change [Create] button to navigate to create screen
   - Remove ActionEditor modal rendering

5. **DELETE**: src/frontend/components/ActionEditor.tsx
6. **DELETE**: src/frontend/components/ActionEditor.css

## 🎨 Screen Layout

```
┌─────────────────────────────────────────────────────────┐
│ ← Back to Event Actions                                 │
├─────────────────────────────────────────────────────────┤
│ Edit Action: Channel Follow                             │
├─────────────────────────────────────────────────────────┤
│ [General] [Text Alert●] [Sound Alert●] [Image] [Video] │ ← Fixed height
├─────────────────────────────────────────────────────────┤
│                                                          │
│  (Tab content - scrollable)                             │
│                                                          │
│  Form fields for selected tab...                        │
│                                                          │
│                                                          │
├─────────────────────────────────────────────────────────┤
│               [Cancel]  [Save Changes]                   │
└─────────────────────────────────────────────────────────┘
```

## 🛠️ Implementation Steps

### Step 1: Create Edit Action Screen
- Move ActionEditor.tsx → edit-action.tsx (in screens/events/)
- Convert from modal to full screen layout
- Add back button navigation
- Remove modal-specific code

### Step 2: Update Routing
- Add routes in App.tsx for edit/create
- Use React Router params for action ID
- Handle create vs edit mode via route

### Step 3: Update Event Actions Screen
- Replace modal with navigation
- Edit button: navigate to `/events/actions/${actionId}/edit`
- Create button: navigate to `/events/actions/create`
- Remove modal rendering code

### Step 4: Fix Tab Bar Height
- Use fixed height for tab navigation
- Prevent compression from content
- Ensure scrollable content area below tabs

### Step 5: Test & Polish
- Test navigation flow
- Test back button behavior
- Test save → navigate back
- Test cancel → navigate back

## 📝 Code Examples

### App.tsx Routes
```tsx
// In App.tsx routes
<Route path="/events/actions" element={<EventActionsScreen channelId={channelId} />} />
<Route path="/events/actions/create" element={<EditActionScreen channelId={channelId} />} />
<Route path="/events/actions/:actionId/edit" element={<EditActionScreen channelId={channelId} />} />
```

### Event Actions Screen Navigation
```tsx
// In event-actions.tsx
<button
  onClick={() => navigate(`/events/actions/${action.id}/edit`)}
>
  ✏️ Edit
</button>

<button
  onClick={() => navigate('/events/actions/create')}
>
  ➕ Create Action
</button>
```

### Edit Action Screen
```tsx
// edit-action.tsx
export const EditActionScreen: React.FC<Props> = ({ channelId }) => {
  const { actionId } = useParams();
  const navigate = useNavigate();
  const isEditMode = !!actionId;
  
  const handleSave = async (payload) => {
    // Save...
    navigate('/events/actions'); // Back to list
  };
  
  return (
    <div className="edit-action-screen">
      <div className="breadcrumb">
        <button onClick={() => navigate('/events/actions')}>
          ← Back to Event Actions
        </button>
      </div>
      
      <h2>{isEditMode ? 'Edit Action' : 'Create Action'}</h2>
      
      {/* Tab navigation - fixed height */}
      <div className="tabs-container">
        {/* Tabs */}
      </div>
      
      {/* Content - scrollable */}
      <div className="content-container">
        {/* Forms */}
      </div>
      
      {/* Footer - fixed */}
      <div className="footer-container">
        <button onClick={() => navigate('/events/actions')}>Cancel</button>
        <button onClick={handleSave}>Save</button>
      </div>
    </div>
  );
};
```

## 📊 Comparison

| Aspect | Modal (Current) | Screen (Proposed) |
|--------|----------------|-------------------|
| Screen space | 90% width | 100% width |
| Tab bar | Can compress | Fixed height ✅ |
| Scrolling | Content only | Better control ✅ |
| Navigation | Modal close | Browser back ✅ |
| URL | Same | Unique URL ✅ |
| Bookmarkable | ❌ | ✅ |
| Mobile UX | Cramped | Full screen ✅ |
| Code complexity | Higher | Lower ✅ |

## 🎯 Decision

**RECOMMEND**: Proceed with refactor to dedicated screen

This matches the existing pattern in the app (Viewer screen) and solves all current UX issues:
- ✅ Fixes tab bar compression
- ✅ Fixes badge rendering (more space for proper fonts)
- ✅ Provides more working space
- ✅ Better navigation flow
- ✅ Cleaner, more maintainable code

## 📅 Estimated Time

- **2-3 hours** to refactor existing code
- **30 min** to test navigation
- **30 min** to polish UI

**Total**: 3-4 hours

---

**Awaiting approval to proceed with refactor...**
