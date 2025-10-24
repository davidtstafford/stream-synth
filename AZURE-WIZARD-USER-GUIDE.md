# Azure Setup Wizard - User Guide

## How to Access the Azure Setup Wizard

### Step 1: Navigate to TTS Settings
1. Launch Stream Synth
2. Click on the **"Text-to-Speech"** tab in the sidebar
3. Click on the **"🎙️ Voice Settings"** tab (first tab)

### Step 2: Select Azure Provider
1. Find the **"TTS Provider"** dropdown
2. Select **"Azure TTS (5M/month)"** from the dropdown
3. A new button will appear: **"🔧 Setup Azure TTS"**

### Step 3: Launch the Wizard
1. Click the **"🔧 Setup Azure TTS"** button
2. The Azure Setup Wizard will open as a modal overlay

---

## Wizard Steps

### Step 1: Introduction
- Learn about Azure TTS benefits
- Understand the free tier (5 million characters/month)
- Overview of setup process
- **Action:** Click "Next: Create Account"

### Step 2: Create Azure Account
- Instructions for creating a free Azure account
- **Action:** Click "Open Azure Portal" to create account in browser
- Once account is created, click "Next: Create Resource"

### Step 3: Create Speech Resource
- Step-by-step guide to create Speech Service resource in Azure
- Instructions to navigate to Azure Portal
- Details on selecting the Free tier (F0)
- **Action:** Click "Open Azure Portal" to create resource
- Once resource is created, click "Next: Get Credentials"

### Step 4: Get API Credentials
- Instructions to find your API key in Azure Portal
- Instructions to find your region
- Visual guidance for navigation
- **Action:** Copy your credentials, then click "Next: Enter Credentials"

### Step 5: Enter Credentials
- **API Key field:** Paste your Azure Speech API key
  - Must be at least 32 characters
  - Validated in real-time
- **Region dropdown:** Select your Azure region
  - 32 regions available
  - Alphabetically sorted
- **Action:** Fill in credentials, then click "Test Connection"

### Step 6: Test Connection
- Validates your API key and region
- Fetches preview voices from Azure
- Shows success message with voice count
- Shows sample voices (10 preview voices)
- **If successful:** Click "Complete Setup"
- **If failed:** Error message with troubleshooting steps

### Step 7: Success
- Confirmation message
- Next steps guidance
- **Action:** Click "Start Using Azure TTS"

---

## Features

### Progress Saving ✅
- Your progress is automatically saved to localStorage
- If you close the wizard, you can resume where you left off
- Credentials are remembered between sessions

### Error Handling ✅
- Clear error messages with troubleshooting guidance
- Validation feedback before proceeding
- Network error handling

### External Links ✅
- "Open Azure Portal" buttons open in your default browser
- No need to copy/paste URLs

### Resume Capability ✅
- Close wizard at any time
- Progress is saved
- Click "🔧 Setup Azure TTS" again to resume

---

## Testing Checklist

### Basic Flow
- [ ] Launch app
- [ ] Navigate to TTS → Voice Settings
- [ ] Select Azure provider
- [ ] "Setup Azure TTS" button appears
- [ ] Click button → Wizard opens
- [ ] Complete all 7 steps
- [ ] Wizard closes successfully
- [ ] Settings reload

### Progress Saving
- [ ] Open wizard
- [ ] Proceed to step 3
- [ ] Close wizard
- [ ] Reopen wizard
- [ ] Verify it resumes at step 3

### Validation
- [ ] Try to proceed with empty API key → blocked
- [ ] Try API key with < 32 characters → error shown
- [ ] Try valid 32+ character key → accepted
- [ ] Select region from dropdown → accepted

### Test Connection
- [ ] Enter valid credentials → success message
- [ ] See 10 preview voices
- [ ] See total voice count (400)
- [ ] Enter invalid credentials → error message
- [ ] Error shows troubleshooting guidance

### External Links
- [ ] Click "Open Azure Portal" in step 2 → Opens browser
- [ ] Click "Open Azure Portal" in step 3 → Opens browser
- [ ] URLs are correct Azure portal links

### Edge Cases
- [ ] Close wizard mid-flow → No errors
- [ ] Reopen wizard → Resumes correctly
- [ ] Complete wizard → Can run again
- [ ] Switch providers → No conflicts

---

## Expected Behavior

### When Wizard Opens:
- Modal overlay appears
- Main screen is dimmed/disabled
- Wizard is centered on screen
- Progress bar shows current step

### When Entering Credentials:
- API key field accepts text input
- Region dropdown shows all 32 regions
- Validation happens in real-time
- "Test Connection" button enabled when both fields filled

### When Testing Connection:
- Loading spinner appears
- Button shows "Testing..."
- Results appear after 1-2 seconds
- Success: Green message + voice preview
- Failure: Red message + troubleshooting

### When Complete:
- Wizard closes automatically
- "Success!" message briefly shown
- Voice Settings tab reloads
- Azure voices become available

---

## Troubleshooting

### Wizard Won't Open
- **Check:** Is Azure provider selected?
- **Check:** Is "Setup Azure TTS" button visible?
- **Fix:** Select "Azure TTS (5M/month)" from provider dropdown

### Can't Proceed Past Enter Credentials
- **Check:** Is API key at least 32 characters?
- **Check:** Is region selected from dropdown?
- **Fix:** Ensure both fields are filled and valid

### Test Connection Fails
- **Check:** Are credentials copied correctly?
- **Check:** Did you copy the full API key (no spaces)?
- **Check:** Is region exactly matching Azure Portal?
- **Fix:** Double-check credentials in Azure Portal

### Wizard Progress Lost
- **Check:** Did localStorage get cleared?
- **Check:** Did you use incognito/private mode?
- **Fix:** Re-enter credentials (only takes a minute)

---

## Phase 1 Preview

After Phase 0 testing is complete, Phase 1 will add:
- Real Azure SDK integration (replacing simulated test)
- Real voice fetching from Azure (400+ voices)
- SSML generation for advanced voice control
- Credential storage in database
- Voice catalog updates
- Discord integration for Azure voices

---

## Feedback

After testing the wizard, please provide feedback on:
1. Was the flow easy to follow?
2. Were instructions clear?
3. Were error messages helpful?
4. Did progress saving work correctly?
5. Any confusing steps?
6. Any missing information?
7. UI/UX improvements?

This feedback will help refine the wizard before Phase 1 implementation.
