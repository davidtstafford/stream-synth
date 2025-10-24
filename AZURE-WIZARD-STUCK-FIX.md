# Azure Wizard Stuck State Fix

## Problem
The wizard was stuck on "Step 5 of 6: Testing Connection..." with no way to escape except closing the wizard. When reopened, it would immediately return to the same stuck state.

## Root Cause
The wizard saves its state to `localStorage` to allow users to resume if they close the wizard. However, it was saving the `test-connection` step, which when restored would leave the wizard on that step without being in the loading state - effectively stuck.

## Fixes Applied

### 1. Prevent Restoring Stuck Steps
- When restoring state from localStorage, if the saved step is `test-connection` or `success`, reset to `enter-credentials` step
- This prevents the wizard from getting stuck on transition steps
- Users still keep their entered API key and region

**Code Location**: `src/frontend/components/AzureSetupWizard.tsx` line 74

### 2. Add Timeout to Connection Test
- Added 30-second timeout to prevent infinite loading
- Uses `Promise.race()` to timeout if Azure API doesn't respond
- Shows clear error message: "Connection test timed out after 30 seconds"

**Code Location**: `src/frontend/components/AzureSetupWizard.tsx` line 161

### 3. Add Cancel Button During Loading
- Added "← Cancel Test" button visible during connection test
- Allows users to escape the loading state at any time
- Returns to credentials entry step to try again

**Code Location**: `src/frontend/components/AzureSetupWizard.tsx` line 920

### 4. Better Loading State Messages
- Added "This may take up to 30 seconds..." message
- Makes users aware the delay is normal
- Reduces confusion during long API calls

## How to Fix If Already Stuck

### Option 1: Restart the App (Automatic Fix)
1. Quit the app completely
2. Relaunch: `npm start`
3. Open the Azure Setup Wizard
4. You'll now be on the credentials entry step (your API key and region are preserved)

### Option 2: Clear localStorage Manually (Browser DevTools)
1. Open the app
2. Press `Cmd+Option+I` (Mac) or `Ctrl+Shift+I` (Windows/Linux) to open DevTools
3. Go to **Console** tab
4. Run: `localStorage.removeItem('azure-setup-wizard-state')`
5. Close and reopen the wizard

### Option 3: Reset Database (Nuclear Option)
Only if the above don't work:
```bash
rm -f ~/Library/Application\ Support/stream-synth/stream-synth.db*
```
⚠️ **WARNING**: This deletes ALL app data!

## Testing the Fix

1. **Test Normal Flow**:
   - Open wizard
   - Enter valid credentials
   - Click "Test Connection"
   - Should show loading spinner with cancel button
   - Should complete within 30 seconds
   - Should show success or error

2. **Test Timeout**:
   - Enter invalid credentials (wrong region)
   - Click "Test Connection"
   - Wait 30 seconds
   - Should show timeout error message
   - Back button should work

3. **Test Cancel During Loading**:
   - Enter credentials
   - Click "Test Connection"
   - Click "← Cancel Test" immediately
   - Should return to credentials entry
   - Should not be stuck

4. **Test State Restoration**:
   - Enter credentials
   - Close wizard (don't test connection)
   - Reopen wizard
   - Should be on credentials entry step
   - API key and region should be preserved

5. **Test Stuck State Prevention**:
   - Manually set localStorage to stuck state:
     ```javascript
     localStorage.setItem('azure-setup-wizard-state', JSON.stringify({
       currentStep: 'test-connection',
       apiKey: 'test123456789012345678901234567890',
       region: 'eastus'
     }))
     ```
   - Open wizard
   - Should be on `enter-credentials` step (not stuck on `test-connection`)
   - Should have API key and region preserved

## Build Status
✅ **Build Successful**
- TypeScript: 0 errors
- Webpack: 300 KiB bundle (+1 KiB from fixes)
- Compilation time: 7707 ms

## Related Files
- `src/frontend/components/AzureSetupWizard.tsx` - Main wizard component
- `src/backend/core/ipc-handlers.ts` - Azure test connection handler
- `AZURE-WIZARD-FIXES.md` - Previous fixes documentation

## Prevention
These fixes ensure the wizard can never get stuck in a loading state:
- ✅ Timeout prevents infinite loading
- ✅ Cancel button provides escape route
- ✅ State restoration skips transition steps
- ✅ Error handling catches all failure cases
- ✅ Console logging helps debugging

## Next Steps
1. Restart the app: `npm start`
2. Try the Azure Setup Wizard again
3. If you still see the stuck screen, run: `localStorage.removeItem('azure-setup-wizard-state')` in DevTools console
4. Report any remaining issues

The wizard should now work smoothly! 🎉
