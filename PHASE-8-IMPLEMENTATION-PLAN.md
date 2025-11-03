# Phase 8: Action Editor Modal - Implementation Plan

**Status:** 🚀 IN PROGRESS  
**Estimated Time:** 5-6 hours  
**Started:** November 2, 2025  

---

## 🎯 Objectives

Create a comprehensive modal dialog for creating and editing event actions with:
1. Full form for all action properties
2. Browser source channel assignment
3. Text, sound, image, and video media settings
4. Template editing with variable support
5. Form validation and error handling
6. Unsaved changes warning

---

## 📋 Features to Implement

### 1. **Modal Component Structure**
- Modal backdrop with click-to-close
- Modal content container
- Header with event type and close button
- Tabbed interface for different settings sections
- Footer with Save/Cancel buttons

### 2. **Form Sections (Tabs)**
```
Tab 1: General Settings
  - Event type (read-only for edit, dropdown for create)
  - Enable/disable toggle
  - Browser source channel selector
  - Link to channel manager

Tab 2: Text Alert
  - Enable text checkbox
  - Template editor with variable insertion
  - Duration slider (1-30 seconds)
  - Position selector (9 positions)
  - Style customization (font, size, color, shadow, etc.)

Tab 3: Sound Alert
  - Enable sound checkbox
  - Sound file picker
  - Volume slider (0-100%)
  - Test sound button

Tab 4: Image Alert
  - Enable image checkbox
  - Image file picker
  - Duration slider (1-30 seconds)
  - Position selector (9 positions)
  - Size selector (small, medium, large, custom)
  - Preview thumbnail

Tab 5: Video Alert
  - Enable video checkbox
  - Video file picker
  - Position selector (9 positions)
  - Size selector (small, medium, large, custom, fullscreen)
  - Loop checkbox
  - Preview thumbnail
```

### 3. **Template Editor Features**
- Text input with syntax highlighting
- Variable insertion dropdown
- Available variables based on event type
- Live preview of template
- Common templates library

### 4. **Validation**
- Event type required (for new actions)
- At least one media type enabled
- Template required if text enabled
- File paths valid for sound/image/video
- Duration values in valid range
- Channel exists and is valid

### 5. **User Experience**
- Auto-save draft to localStorage
- Unsaved changes warning on close
- Keyboard shortcuts (Esc to cancel, Ctrl+S to save)
- Loading states during save
- Success/error feedback

---

## 🗂️ Files to Create

### 1. Action Editor Component
**File:** `src/frontend/components/ActionEditor.tsx` (800+ lines)

**Structure:**
```typescript
interface ActionEditorProps {
  action?: EventAction;           // undefined = create mode
  channelId: string;
  onSave: (action: EventAction) => void;
  onCancel: () => void;
}

export const ActionEditor: React.FC<ActionEditorProps> = ({...}) => {
  // State management
  const [activeTab, setActiveTab] = useState<'general' | 'text' | 'sound' | 'image' | 'video'>('general');
  const [formData, setFormData] = useState<ActionFormData>({...});
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
  // Render tabs
  // Render form sections
  // Validation logic
  // Save logic
  // Cancel with warning
  
  return (
    <div className="modal-backdrop">
      <div className="modal-content action-editor">
        <Header />
        <TabBar />
        <FormContent />
        <Footer />
      </div>
    </div>
  );
};
```

### 2. Action Editor Styles
**File:** `src/frontend/components/ActionEditor.css` (600+ lines)

**Key Styles:**
- Modal backdrop and content
- Tab navigation
- Form sections
- Input fields and controls
- Position selector grid
- File picker buttons
- Validation error states
- Save/cancel buttons

### 3. Template Editor Component (Optional Sub-component)
**File:** `src/frontend/components/TemplateEditor.tsx` (300+ lines)

**Features:**
- Syntax highlighting for variables
- Variable insertion dropdown
- Preview panel
- Common templates

### 4. Channel Selector Component
**File:** `src/frontend/components/ChannelSelector.tsx` (200+ lines)

**Features:**
- Dropdown with channel list
- Create new channel inline
- Browser source URL display
- Copy URL button

---

## 🎨 UI Design Mockup

```
╔══════════════════════════════════════════════════════════════╗
║  Edit Action: Follow                                    [X]  ║
╠══════════════════════════════════════════════════════════════╣
║  [General] [Text Alert] [Sound] [Image] [Video]             ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  General Settings                                            ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ Event Type:  Follow (channel.follow)                 │   ║
║  │              [This cannot be changed]                │   ║
║  │                                                       │   ║
║  │ Status:      [●────] Enabled                         │   ║
║  │                                                       │   ║
║  │ Browser Source Channel:                              │   ║
║  │              [Select Channel ▼]    [⚙️ Manage]       │   ║
║  │                                                       │   ║
║  │ 📺 Browser Source URL:                               │   ║
║  │ http://localhost:3737/browser-source?channel=default │   ║
║  │                                         [📋 Copy]     │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                          [Cancel] [Save Changes]             ║
╚══════════════════════════════════════════════════════════════╝
```

**Text Alert Tab:**
```
╔══════════════════════════════════════════════════════════════╗
║  Edit Action: Follow                                    [X]  ║
╠══════════════════════════════════════════════════════════════╣
║  [General] [Text Alert] [Sound] [Image] [Video]             ║
╠══════════════════════════════════════════════════════════════╣
║                                                              ║
║  Text Alert Settings                                         ║
║  ┌──────────────────────────────────────────────────────┐   ║
║  │ [✓] Enable text overlay                              │   ║
║  │                                                       │   ║
║  │ Template:                                            │   ║
║  │ ┌────────────────────────────────────────────────┐  │   ║
║  │ │ {user} just followed! Welcome!                 │  │   ║
║  │ └────────────────────────────────────────────────┘  │   ║
║  │ [Insert Variable ▼] [Common Templates ▼]           │   ║
║  │                                                       │   ║
║  │ Duration: [━━━━━○━━━━] 5 seconds                    │   ║
║  │                                                       │   ║
║  │ Position:                                            │   ║
║  │ ┌─────┬─────┬─────┐                                 │   ║
║  │ │  ⬜  │  ⬜  │  ⬜  │ Top                             │   ║
║  │ ├─────┼─────┼─────┤                                 │   ║
║  │ │  ⬜  │  ✅  │  ⬜  │ Middle (selected)               │   ║
║  │ ├─────┼─────┼─────┤                                 │   ║
║  │ │  ⬜  │  ⬜  │  ⬜  │ Bottom                          │   ║
║  │ └─────┴─────┴─────┘                                 │   ║
║  │   Left  Center Right                                │   ║
║  │                                                       │   ║
║  │ Text Style:                                          │   ║
║  │ Font Size: [━━━━○━━━━] 24px                         │   ║
║  │ Color: [⬛ #ffffff] [🎨 Picker]                      │   ║
║  │ Shadow: [✓] Enabled  Blur: [━━○━] 4px               │   ║
║  └──────────────────────────────────────────────────────┘   ║
║                                                              ║
╠══════════════════════════════════════════════════════════════╣
║                          [Cancel] [Save Changes]             ║
╚══════════════════════════════════════════════════════════════╝
```

---

## 📝 Implementation Steps

### Step 1: Database Schema Updates (Already Done in Phase 7)
The `event_actions` table already has all needed columns:
- ✅ `browser_source_channel` (added in planning)
- ✅ All text, sound, image, video fields
- ✅ Templates and style JSON

### Step 2: Create ActionEditor Component (Day 1 - 3-4 hours)

**2A: Basic Modal Structure**
```typescript
// Modal backdrop and container
// Header with title and close button
// Tab navigation
// Form content area
// Footer with buttons
```

**2B: General Settings Tab**
```typescript
// Event type selector (create) or display (edit)
// Enable/disable toggle
// Channel selector dropdown
// Browser source URL display with copy
```

**2C: Text Alert Tab**
```typescript
// Enable checkbox
// Template editor
// Variable insertion
// Duration slider
// Position selector (3x3 grid)
// Style customization
```

**2D: Sound/Image/Video Tabs**
```typescript
// Enable checkbox
// File picker
// Settings specific to each media type
// Preview functionality
```

### Step 3: Form Validation (Day 2 - 1-2 hours)

**Validation Rules:**
```typescript
interface ValidationErrors {
  event_type?: string;
  template?: string;
  channel?: string;
  sound_path?: string;
  image_path?: string;
  video_path?: string;
  general?: string;
}

const validateForm = (data: ActionFormData): ValidationErrors => {
  const errors: ValidationErrors = {};
  
  // Event type required for new actions
  if (!data.event_type) {
    errors.event_type = 'Event type is required';
  }
  
  // At least one media type
  if (!data.text_enabled && !data.sound_enabled && 
      !data.image_enabled && !data.video_enabled) {
    errors.general = 'Enable at least one media type';
  }
  
  // Template required if text enabled
  if (data.text_enabled && !data.text_template?.trim()) {
    errors.template = 'Template is required when text is enabled';
  }
  
  // File paths valid
  if (data.sound_enabled && !data.sound_path) {
    errors.sound_path = 'Sound file is required';
  }
  
  return errors;
};
```

### Step 4: Unsaved Changes Warning (Day 2 - 1 hour)

```typescript
// Track changes
useEffect(() => {
  const hasChanges = JSON.stringify(formData) !== JSON.stringify(originalData);
  setHasUnsavedChanges(hasChanges);
}, [formData]);

// Warn on close
const handleClose = () => {
  if (hasUnsavedChanges) {
    if (confirm('You have unsaved changes. Are you sure you want to close?')) {
      onCancel();
    }
  } else {
    onCancel();
  }
};

// Warn on tab switch (optional)
const handleTabChange = (newTab: string) => {
  // Auto-save current tab or warn
  setActiveTab(newTab);
};
```

### Step 5: Integration with Event Actions Screen (Day 2-3 - 1 hour)

**Update event-actions.tsx:**
```typescript
import { ActionEditor } from '../../components/ActionEditor';

// Replace placeholder modal with ActionEditor
{selectedAction && (
  <ActionEditor
    action={selectedAction}
    channelId={channelId}
    onSave={handleSaveAction}
    onCancel={() => setSelectedAction(null)}
  />
)}

// Add create mode
{isCreating && (
  <ActionEditor
    channelId={channelId}
    onSave={handleSaveAction}
    onCancel={() => setIsCreating(false)}
  />
)}
```

### Step 6: Testing & Polish (Day 3 - 1-2 hours)

- [ ] Test create new action
- [ ] Test edit existing action
- [ ] Test all validation rules
- [ ] Test unsaved changes warning
- [ ] Test keyboard shortcuts
- [ ] Test all media types
- [ ] Test channel selector
- [ ] Test template variables
- [ ] Test position selector
- [ ] Test file pickers
- [ ] Polish UI/UX
- [ ] Add loading states
- [ ] Add success/error toasts

---

## 🎯 Success Criteria

- [ ] Can create new event actions
- [ ] Can edit existing actions
- [ ] All form fields work correctly
- [ ] Validation prevents invalid data
- [ ] Unsaved changes warning works
- [ ] Channel selector integrates properly
- [ ] Template editor supports variables
- [ ] Position selector is intuitive
- [ ] File pickers work (or show path input)
- [ ] Save updates database and refreshes list
- [ ] Cancel discards changes
- [ ] UI is polished and professional
- [ ] No console errors
- [ ] Form is responsive
- [ ] Keyboard shortcuts work

---

## 📊 Estimated Breakdown

| Task | Time | Priority |
|------|------|----------|
| Modal structure | 1h | High |
| General tab | 1h | High |
| Text alert tab | 2h | High |
| Sound/Image/Video tabs | 2h | Medium |
| Validation | 1h | High |
| Unsaved changes | 1h | Medium |
| Integration | 1h | High |
| Testing | 2h | High |
| **Total** | **11h** | - |

*Adjusted to 5-6 hours by focusing on core features first*

---

## 🚀 Phase 8 Starts Now!

Let's begin with the modal structure and general settings tab.

**Next Steps:**
1. Create ActionEditor.tsx with basic structure
2. Create ActionEditor.css with styling
3. Implement General Settings tab
4. Test basic modal functionality
5. Proceed to other tabs

---

**Status:** Ready to begin implementation! 🎉
