# Azure TTS Testing Guide

## Phase 1 Implementation Status: ✅ COMPLETE

All Phase 1 tasks have been completed successfully:
- ✅ Azure Speech SDK installed
- ✅ Azure Provider class implemented (278 lines)
- ✅ Voice fetching via REST API (400+ voices)
- ✅ SSML generation with prosody mapping
- ✅ Speech synthesis via Azure SDK
- ✅ Provider registered in manager
- ✅ Test connection handler updated to use real Azure API
- ✅ Build successful (298 KiB, 0 TypeScript errors)

---

## Prerequisites

Before testing, you'll need:

1. **Azure Account**: Create at https://azure.microsoft.com/free
2. **Speech Service Resource**: Create in Azure Portal
3. **API Key & Region**: Get from resource's "Keys and Endpoint" section

---

## Testing Procedure

### Step 1: Launch the Application

The app should already be running. If not:

```bash
npm start
```

### Step 2: Open Voice Settings

1. Navigate to the **TTS** tab
2. Look for the **Provider Settings** section
3. You should see three provider toggle options:
   - Web Speech API (default, enabled)
   - Azure TTS (new)
   - Google TTS (placeholder)

### Step 3: Enable Azure TTS

1. Click the **Enable** checkbox next to "Azure TTS"
2. Click the **"Azure Setup"** button that appears
3. The **Azure Setup Wizard** modal should open

### Step 4: Complete the Setup Wizard

The wizard has 7 steps:

#### Step 1: Introduction
- Read the overview
- Understand what you'll need
- Click **"Get Started"**

#### Step 2: Create Azure Account
- Click **"Open Azure Portal"** to launch https://azure.microsoft.com/free
- Create your free account (if you don't have one)
- Free tier includes 500k characters/month
- Click **"I've Created My Account"**

#### Step 3: Create Speech Resource
- Click **"Open Azure Portal"** to launch https://portal.azure.com
- Follow the instructions to create a Speech resource:
  1. Search for "Speech Services"
  2. Click "+ Create"
  3. Fill in details (Resource group, Region, Name, Pricing tier)
  4. Click "Review + Create"
- Click **"I've Created the Resource"**

#### Step 4: Get Your Credentials
- Click **"Open Resource Keys"** to go to your Speech resource
- Copy your **API Key** (Key 1 or Key 2)
- Note your **Region** (e.g., eastus, westus2, etc.)
- Click **"I Have My Credentials"**

#### Step 5: Enter Credentials
- Paste your **API Key** (32+ characters)
- Select your **Region** from the dropdown (32 options)
- The wizard validates that the key is at least 32 characters
- Click **"Test Connection"**

#### Step 6: Testing Connection
- The wizard will:
  1. Validate your credentials
  2. Initialize the Azure Speech SDK
  3. Fetch voices from Azure (400+ voices)
  4. Display the first 10 voices as a preview
- If successful, you'll see:
  - Voice count (e.g., "Found 423 voices")
  - Preview list of 10 voices
- If it fails, you'll see an error screen with troubleshooting steps

#### Step 7: Success!
- Credentials are saved
- Azure TTS is now enabled
- Click **"Start Using Azure TTS"** to close the wizard

### Step 5: Select an Azure Voice

1. The Voice Settings page should now show:
   - Azure TTS enabled
   - "Azure Setup" button (to reconfigure if needed)
   
2. In the voice dropdown, you should see Azure voices with the format:
   - `azure_en-US_AriaNeural`
   - `azure_en-GB_RyanNeural`
   - `azure_es-ES_ElviraNeural`
   - etc.

3. Select an Azure voice for testing

### Step 6: Test Speech Synthesis

#### Option A: Use the Test Button
1. Click the **"Test Voice"** button in Voice Settings
2. Listen for: "This is a test of the text to speech system"
3. Verify the voice sounds correct and uses Azure quality

#### Option B: Use Chat Integration
1. Go to the Chat tab
2. Type a test message in the input
3. Submit it
4. The message should be spoken using your selected Azure voice

#### Option C: Use Manual TTS Queue
1. Open the TTS Viewers tab
2. Add a viewer with an Azure voice selected
3. Queue a message for that viewer
4. Listen for speech synthesis

### Step 7: Test Hybrid Mode

The key feature of this implementation is **hybrid multi-provider support**. Test it:

1. Create **Viewer 1** with a **Web Speech voice** (e.g., `webspeech_Samantha`)
2. Create **Viewer 2** with an **Azure voice** (e.g., `azure_en-US_AriaNeural`)
3. Queue messages for both viewers
4. Verify both voices work simultaneously
5. Confirm the correct provider is used for each voice

---

## Expected Behavior

### ✅ Successful Implementation

- **Voice Count**: 400+ Azure voices available
- **Voice Prefix**: All Azure voices start with `azure_`
- **Voice Quality**: High-quality Neural voices
- **SSML Support**: Volume, rate, and pitch adjustments work
- **Hybrid Mode**: Can use Web Speech + Azure simultaneously
- **Provider Routing**: Voice ID prefix correctly routes to Azure provider
- **Audio Output**: Speech plays through system speakers
- **No Crashes**: App remains stable during all operations

### Voice ID Format

Azure voices use this format:
```
azure_<locale>_<voiceName>
```

Examples:
- `azure_en-US_AriaNeural` (US English, Aria)
- `azure_en-GB_RyanNeural` (UK English, Ryan)
- `azure_es-ES_ElviraNeural` (Spanish, Elvira)
- `azure_ja-JP_NanamiNeural` (Japanese, Nanami)

### SSML Prosody Mapping

The Azure provider maps your settings to SSML:

**Volume (0-100)**:
- 0-20: `x-soft`
- 21-40: `soft`
- 41-60: `medium`
- 61-80: `loud`
- 81-100: `x-loud`

**Rate (0.5-2.0)**:
- 0.5 → `-50%`
- 1.0 → `0%` (default)
- 2.0 → `+100%`

**Pitch (0.5-2.0)**:
- 0.5 → `-50%`
- 1.0 → `0%` (default)
- 2.0 → `+50%`

---

## Troubleshooting

### Issue: "Azure option not showing in provider toggles"

**Solution**: The Azure toggle should be visible in Voice Settings. If not:
1. Restart the app
2. Check the console for errors
3. Verify the build completed successfully

### Issue: "Setup wizard not opening"

**Solution**: 
1. Check browser console for JavaScript errors
2. Verify `AzureSetupWizard.tsx` was compiled
3. Try clicking "Azure Setup" button again

### Issue: "Test connection fails"

**Possible Causes**:
1. **Invalid API Key**: Must be 32+ characters
2. **Wrong Region**: Must match your Azure resource's region
3. **Network Issues**: Check your internet connection
4. **Quota Exceeded**: Check your Azure usage limits
5. **Resource Not Ready**: Wait a few minutes after creating resource

**Solutions**:
1. Double-check your API key (copy again from Azure Portal)
2. Verify the region matches exactly (case-sensitive)
3. Try a different network
4. Check Azure Portal for resource status
5. Wait 2-3 minutes and try again

### Issue: "No voices appear after successful connection"

**Solution**:
1. Check the response from `azure:test-connection` in DevTools
2. Verify the Azure API returned voices
3. Check that voices are mapped correctly with `azure_` prefix
4. Restart the app to reload voices

### Issue: "Speech synthesis fails"

**Possible Causes**:
1. **Audio Output Issue**: No speakers/headphones connected
2. **Synthesizer Not Initialized**: Provider not set up correctly
3. **Invalid SSML**: Malformed SSML document
4. **Quota Exceeded**: Free tier limit reached

**Solutions**:
1. Check system audio output is working
2. Re-run the setup wizard
3. Check console for SSML errors
4. Check Azure Portal for usage metrics

### Issue: "Voice doesn't sound like Azure quality"

**Solution**:
1. Verify the voice ID starts with `azure_`
2. Check the console to confirm Azure provider is being used
3. Verify the voice name is a Neural voice (ends with `Neural`)
4. Test with the Azure Speech Studio to compare: https://speech.microsoft.com/portal

### Issue: "Hybrid mode not working"

**Solution**:
1. Verify voice IDs have correct prefixes:
   - Web Speech: `webspeech_<voiceURI>`
   - Azure: `azure_<locale>_<name>`
2. Check `processQueue()` in `manager.ts` for routing logic
3. Verify both providers are enabled in settings
4. Check console for provider selection logs

---

## Known Limitations

1. **Voice Fetching Delay**: Initial voice fetch takes 2-3 seconds
2. **No Voice Caching**: Voices refetched on every app restart
3. **No Usage Tracking**: Can't monitor quota usage in-app
4. **No Offline Mode**: Requires internet connection
5. **Free Tier Limits**: 500k characters/month

---

## Next Steps After Testing

### If Testing Succeeds ✅

Proceed to **Phase 2**:
1. Database integration (sync voices to `tts_voices` table)
2. Voice statistics (provider breakdown)
3. Discord integration (post Azure voices to webhook)
4. Voice catalog updates (provider badges)

### If Issues Found ❌

1. Document the exact error messages
2. Check console logs for stack traces
3. Verify Azure Portal resource configuration
4. Test with Azure Speech Studio to isolate issue
5. Report issues for debugging

---

## Verification Checklist

Before marking Phase 1 as complete, verify:

- [ ] Azure Setup Wizard opens successfully
- [ ] All 7 wizard steps complete without errors
- [ ] Test connection returns 400+ voices
- [ ] Voice preview shows 10 example voices
- [ ] Azure voices appear in voice dropdown with `azure_` prefix
- [ ] Test voice button plays Azure speech
- [ ] Speech quality is high (Neural voices)
- [ ] Volume/Rate/Pitch controls work with SSML
- [ ] Hybrid mode allows Web Speech + Azure simultaneously
- [ ] No crashes or memory leaks during extended use
- [ ] Build completes with 0 TypeScript errors
- [ ] Console shows no critical errors

---

## Testing Complete!

Once all tests pass, Phase 1 is officially complete. The Azure TTS integration is production-ready for basic usage.

**Estimated Testing Time**: 15-20 minutes

**Ready to proceed to Phase 2?** Let me know the results! 🚀
