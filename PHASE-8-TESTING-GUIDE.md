# Phase 8: Action Editor Modal - Testing Guide

## 🧪 Quick Test Checklist

Use this guide to verify all ActionEditor functionality after building.

---

## ✅ Pre-Test Setup

1. **Build and Run**:
```powershell
cd c:\git\staffy\stream-synth
npm run build
npm start
```

2. **Navigate to Event Actions**:
   - Open Stream Synth application
   - Go to **Events** > **Event Actions** in sidebar
   - Ensure you have a channel connected

---

## 📝 Test Cases

### Test 1: Create New Action (Text Alert)
**Steps**:
1. Click **"➕ Create Action"** button
2. Verify modal opens with **General** tab active
3. Select **"Channel Follow"** from event type dropdown
4. Check **"Enable this action"** checkbox
5. Click **"Text Alert"** tab
6. Check **"Enable Text Alert"** checkbox
7. Enter template: `{user} just followed! Welcome! 🎉`
8. Set duration to `5000` ms
9. Click center position in 3x3 grid (top-center ↑)
10. Click **"Create Action"** button

**Expected Result**:
- ✅ Modal closes
- ✅ New action appears in action list
- ✅ Action shows "Channel Follow" event type
- ✅ Text alert enabled indicator visible
- ✅ No console errors

---

### Test 2: Edit Existing Action
**Steps**:
1. Click **"✏️ Edit"** on any existing action
2. Verify modal opens with pre-filled data
3. Verify **General** tab shows correct event type
4. Switch to **"Text Alert"** tab
5. Modify template text
6. Verify **"● Unsaved changes"** indicator appears in footer
7. Click **"Save Changes"** button

**Expected Result**:
- ✅ Modal opens with correct data
- ✅ All fields populated correctly
- ✅ Unsaved indicator appears after edit
- ✅ Modal closes after save
- ✅ Changes reflected in action list

---

### Test 3: Sound Alert Configuration
**Steps**:
1. Click **"➕ Create Action"**
2. Select event type
3. Click **"Sound Alert"** tab
4. Check **"Enable Sound Alert"** checkbox
5. Click **"Browse"** button
6. Select an MP3/WAV file from file dialog
7. Verify file path appears in input
8. Adjust volume slider to 75%
9. Verify volume shows "75%" above slider
10. Click **"Create Action"**

**Expected Result**:
- ✅ File picker opens native dialog
- ✅ Selected file path appears in input
- ✅ Volume slider updates value display
- ✅ Action saves successfully
- ✅ Sound alert badge (●) appears on tab

---

### Test 4: Image Alert with Position
**Steps**:
1. Click **"➕ Create Action"**
2. Select event type
3. Click **"Image Alert"** tab
4. Check **"Enable Image Alert"** checkbox
5. Click **"Browse"** and select PNG/JPG file
6. Set duration to `3000` ms
7. Click **bottom-right** position (↘)
8. Verify position button highlights in blue
9. Enter width: `400` and height: `300`
10. Click **"Create Action"**

**Expected Result**:
- ✅ File picker accepts image files
- ✅ Position selector highlights selection
- ✅ Width/height inputs accept numbers
- ✅ Action saves with correct settings
- ✅ Image alert badge (●) on tab

---

### Test 5: Video Alert Configuration
**Steps**:
1. Click **"➕ Create Action"**
2. Select event type
3. Click **"Video Alert"** tab
4. Check **"Enable Video Alert"** checkbox
5. Click **"Browse"** and select MP4 file
6. Adjust volume slider
7. Select middle-center position (●)
8. Leave width/height as "Auto"
9. Click **"Create Action"**

**Expected Result**:
- ✅ File picker accepts video files
- ✅ Volume slider works
- ✅ Position selector works
- ✅ Auto dimensions allowed (blank)
- ✅ Action saves successfully

---

### Test 6: Form Validation
**Steps**:
1. Click **"➕ Create Action"**
2. Leave event type **blank**
3. Click **"Create Action"** button
4. Verify error: "Event type is required"
5. Select event type
6. Go to **"Text Alert"** tab
7. Check **"Enable Text Alert"**
8. Leave template **blank**
9. Click **"Create Action"**
10. Verify error: "Text template is required when text alerts are enabled"

**Expected Result**:
- ✅ Event type error shows (red border + message)
- ✅ Template error shows when enabled but empty
- ✅ Save blocked when validation fails
- ✅ Errors clear when fields filled

---

### Test 7: Unsaved Changes Warning
**Steps**:
1. Click **"✏️ Edit"** on any action
2. Modify any field (e.g., change template text)
3. Verify **"● Unsaved changes"** appears in footer
4. Click **"Cancel"** button
5. Verify confirmation dialog: "You have unsaved changes. Are you sure you want to cancel?"
6. Click **Cancel** (in dialog) to continue editing
7. Click **"Cancel"** again
8. Click **OK** (in dialog) to discard

**Expected Result**:
- ✅ Unsaved indicator appears after edit
- ✅ Confirmation dialog shows on cancel
- ✅ Can choose to continue editing
- ✅ Can choose to discard changes
- ✅ Modal closes when discarding

---

### Test 8: Keyboard Shortcuts
**Steps**:
1. Click **"➕ Create Action"**
2. Fill in some fields
3. Press **Esc** key
4. Verify confirmation dialog appears
5. Click **Cancel** to continue
6. Fill in required fields
7. Press **Ctrl+S** (or Cmd+S on Mac)
8. Verify action saves

**Expected Result**:
- ✅ Esc triggers cancel flow
- ✅ Confirmation shows if unsaved changes
- ✅ Ctrl+S triggers save
- ✅ Saves without clicking button

---

### Test 9: Tab Navigation and Badges
**Steps**:
1. Click **"➕ Create Action"**
2. Select event type
3. Go to **"Text Alert"** tab
4. Check **"Enable Text Alert"**
5. Verify badge (●) appears on **"Text Alert"** tab
6. Go to **"Sound Alert"** tab
7. Check **"Enable Sound Alert"**
8. Verify badge appears on **"Sound Alert"** tab
9. Go to **"General"** tab
10. Verify summary shows both enabled

**Expected Result**:
- ✅ Tabs switch smoothly
- ✅ Badges appear when alerts enabled
- ✅ Badges disappear when disabled
- ✅ Summary on General tab accurate
- ✅ All tabs accessible

---

### Test 10: Multiple Alert Types
**Steps**:
1. Click **"➕ Create Action"**
2. Select **"Channel Subscribe"** event
3. Enable **all four alert types**:
   - Text: `{user} subscribed! Tier {tier}! 🎊`
   - Sound: Browse and select MP3
   - Image: Browse and select PNG
   - Video: Browse and select MP4
4. Configure each with different positions
5. Click **"Create Action"**
6. Verify action shows all 4 badges

**Expected Result**:
- ✅ Can enable all 4 alert types simultaneously
- ✅ All configurations save correctly
- ✅ Action list shows all enabled alerts
- ✅ Test button triggers all 4 alerts

---

### Test 11: Position Selector Visual Feedback
**Steps**:
1. Open any action editor
2. Go to **"Text Alert"** tab, enable it
3. Click each position in the 3x3 grid:
   - ↖ (top-left)
   - ↑ (top-center)
   - ↗ (top-right)
   - ← (middle-left)
   - ● (middle-center)
   - → (middle-right)
   - ↙ (bottom-left)
   - ↓ (bottom-center)
   - ↘ (bottom-right)
4. Verify each click highlights that button

**Expected Result**:
- ✅ Each position button clickable
- ✅ Active button shows blue background
- ✅ Only one position selected at a time
- ✅ Icons clear and recognizable

---

### Test 12: Responsive Design (Optional)
**Steps**:
1. Open action editor modal
2. Resize window to tablet size (768px)
3. Verify layout adjusts
4. Resize to mobile size (375px)
5. Verify all controls still accessible

**Expected Result**:
- ✅ Modal width adjusts to screen
- ✅ Tabs remain visible (scrollable)
- ✅ Buttons stack vertically on mobile
- ✅ All content accessible

---

## 🎯 Critical Path Test (5 minutes)

**Quick validation of core functionality**:

1. ✅ **Create** action with text alert → saves successfully
2. ✅ **Edit** action → changes reflected
3. ✅ **Cancel** with unsaved → confirmation shows
4. ✅ **Validation** → blocks save with missing required fields
5. ✅ **File picker** → opens native dialog
6. ✅ **Tabs** → all 5 tabs accessible and functional

---

## 🐛 Common Issues & Solutions

### Issue: File picker doesn't open
**Solution**: Ensure running in Electron (not browser). File picker uses Electron's native dialog.

### Issue: Modal doesn't close after save
**Solution**: Check console for save errors. Verify IPC handlers are running.

### Issue: Validation errors don't clear
**Solution**: Type in the field - errors should clear on input.

### Issue: Keyboard shortcuts don't work
**Solution**: Ensure modal has focus (click inside modal first).

---

## ✅ Success Criteria

Phase 8 is working correctly if:

- ✅ Modal opens for create and edit
- ✅ All 5 tabs render and are interactive
- ✅ Form validation prevents invalid saves
- ✅ File pickers open and populate paths
- ✅ Position selector highlights selections
- ✅ Volume sliders update values
- ✅ Unsaved changes warning works
- ✅ Keyboard shortcuts (Esc, Ctrl+S) work
- ✅ Actions save to database
- ✅ Action list refreshes after save
- ✅ No console errors during any operation

---

## 📊 Test Results Template

```
PHASE 8 TESTING - [Your Name] - [Date]

✅ Test 1: Create New Action - PASS
✅ Test 2: Edit Existing Action - PASS
✅ Test 3: Sound Alert Config - PASS
✅ Test 4: Image Alert Position - PASS
✅ Test 5: Video Alert Config - PASS
✅ Test 6: Form Validation - PASS
✅ Test 7: Unsaved Warning - PASS
✅ Test 8: Keyboard Shortcuts - PASS
✅ Test 9: Tab Navigation - PASS
✅ Test 10: Multiple Alerts - PASS
✅ Test 11: Position Selector - PASS
✅ Test 12: Responsive Design - PASS

Overall: PHASE 8 COMPLETE ✅
```

---

## 🚀 Next Steps

Once all tests pass:
1. Mark Phase 8 as complete ✅
2. Review PHASE-8-VISUAL-GUIDE.md
3. Review PHASE-8-COMPLETION-REPORT.md
4. Plan Phase 9: Template Builder
5. Celebrate! 🎉

---

**Happy Testing!** 🧪
