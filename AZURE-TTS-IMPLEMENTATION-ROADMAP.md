# Azure TTS Implementation Roadmap

## 🎯 Implementation Order

### ✅ Approved Decisions
1. Azure region default: **East US**
2. Voice sync frequency: **Manual button + optional auto-sync**
3. Free tier warning: **80% and 95% thresholds**
4. Discord grouping: **Provider → Language**
5. Test connection: **Validate + fetch 10 voices**

---

## 📦 Phase 0: Azure Setup Wizard (Week 1)

### Goal
Create an intuitive onboarding experience for non-technical users to set up Azure Speech Services.

### Tasks
- [ ] **0.1** Create `AzureSetupWizard.tsx` component
  - 7-step wizard with progress indicator
  - Step 1: Introduction (benefits, costs, time estimate)
  - Step 2: Create Azure Account (with "Open Portal" button)
  - Step 3: Create Speech Resource (detailed form instructions)
  - Step 4: Get API Key & Region (copy/paste instructions)
  - Step 5: Enter Credentials (validation UI)
  - Step 6: Test Connection (real-time status updates)
  - Step 7: Success (next steps, tips)

- [ ] **0.2** Implement wizard navigation
  - Back/Next buttons
  - Progress saving (local storage)
  - Resume from last step
  - Close/cancel with confirmation

- [ ] **0.3** Add error handling screens
  - Invalid API key error
  - Wrong region error
  - Network error
  - Clear troubleshooting steps for each

- [ ] **0.4** Create entry points
  - "Setup Azure" button in Voice Settings
  - Warning when selecting Azure voice without credentials
  - Optional first-time setup prompt

- [ ] **0.5** Design wizard UI
  - Clean, minimal design
  - Large, readable fonts
  - Color-coded sections (green/yellow/red)
  - Help icons with tooltips
  - "Open Azure Portal" quick action buttons

### Deliverables
- `src/frontend/components/AzureSetupWizard.tsx`
- Wizard state management (React hooks)
- Error handling components
- Integration with Voice Settings tab

### Testing
- [ ] Walk through entire wizard flow
- [ ] Test error scenarios (invalid key, wrong region)
- [ ] Verify progress saving/resuming
- [ ] Test "Open Portal" buttons
- [ ] Verify wizard close/cancel behavior

---

## 📦 Phase 1: Azure Provider Implementation (Week 1-2)

### Goal
Implement Azure TTS provider backend with Speech SDK integration.

### Tasks
- [ ] **1.1** Install dependencies
  ```bash
  npm install microsoft-cognitiveservices-speech-sdk
  npm install --save-dev @types/node
  ```

- [ ] **1.2** Create `azure-provider.ts`
  - Implement `TTSProvider` interface
  - Initialize Speech SDK with credentials
  - `initialize(credentials)` method
  - `getVoices()` - fetch from Azure API
  - `speak(text, voiceId, options)` - SSML synthesis
  - `stop()` - cancel current speech
  - `test(voiceId)` - preview voice

- [ ] **1.3** Implement SSML generation
  - Build SSML from text + options
  - Map volume (0-100 → SSML percentage)
  - Map rate (0.5-2.0 → SSML rate)
  - Map pitch (0.5-2.0 → SSML pitch)
  - XML escaping for user text

- [ ] **1.4** Implement audio playback
  - Use `AudioConfig.fromDefaultSpeakerOutput()`
  - Handle synthesis completion
  - Handle errors (quota exceeded, invalid voice)
  - Release audio resources after playback

- [ ] **1.5** Voice metadata mapping
  - Convert Azure `VoiceInfo` to `TTSVoice`
  - Voice ID format: `azure_<locale>_<name>`
  - Example: `azure_en-US_AriaNeural`
  - Map gender (Female/Male → female/male)
  - Include styles array for neural voices

### Deliverables
- `src/backend/services/tts/azure-provider.ts`
- SSML generation utilities
- Voice metadata conversion
- Error handling for Azure API errors

### Testing
- [ ] Test with valid Azure credentials
- [ ] Test with invalid credentials
- [ ] Test voice fetching
- [ ] Test speech synthesis
- [ ] Test SSML generation
- [ ] Test error handling (quota, network, invalid voice)

---

## 📦 Phase 2: Manager Integration (Week 2)

### Goal
Integrate Azure provider into TTSManager with hybrid voice support.

### Tasks
- [ ] **2.1** Register Azure provider
  - Add to `providers` Map in constructor
  - Initialize on startup if credentials exist

- [ ] **2.2** Implement hybrid voice loading
  - Load Web Speech voices (from renderer/DB)
  - Load Azure voices (from provider)
  - Merge into single list
  - Handle Azure unavailable gracefully

- [ ] **2.3** Implement smart voice routing
  - Detect provider from voice ID prefix
  - Route `webspeech_*` to renderer
  - Route `azure_*` to Azure provider
  - Fallback to global voice if not found

- [ ] **2.4** Update `speak()` method
  - Check voice ID prefix
  - Send to appropriate provider
  - Pass voiceId, volume, rate, pitch
  - Handle provider-specific errors

- [ ] **2.5** Update `handleChatMessage()`
  - Resolve viewer custom voice (could be Web Speech or Azure)
  - Queue with correct voiceId
  - Process queue with provider routing

### Deliverables
- Updated `src/backend/services/tts/manager.ts`
- Provider registration logic
- Hybrid voice resolution
- Smart routing logic

### Testing
- [ ] Test Web Speech voice selection (no regression)
- [ ] Test Azure voice selection
- [ ] Test mixed viewer voices (Web Speech + Azure)
- [ ] Test fallback when voice not found
- [ ] Test queue processing with mixed providers

---

## 📦 Phase 3: Frontend UI Updates (Week 2-3)

### Goal
Update Voice Settings and Viewers tabs to support Azure voices.

### Tasks
- [ ] **3.1** Voice Settings - Azure Credentials Section
  - Show setup wizard button if not configured
  - Show connected status if configured
  - API Key input (password field)
  - Region dropdown (all Azure regions)
  - "Test Connection" button
  - "Refresh Voices" button
  - "Remove Credentials" button
  - Usage meter (characters used / free tier limit)
  - Warning at 80% and 95%

- [ ] **3.2** Voice Settings - Voice Picker Enhancement
  - Group voices by provider in dropdown
  - `<optgroup label="🌐 Web Speech (Free)">`
  - `<optgroup label="☁️ Azure Neural (API Key Required)">`
  - Show provider badge next to selected voice
  - Disable Azure voices if not configured (with tooltip)

- [ ] **3.3** Viewers Tab - Voice Display
  - Show provider badge (🌐 or ☁️) next to voice name
  - Same grouped dropdown as Voice Settings
  - Warning if Azure voice selected but not configured
  - Test voice button (works for both providers)

- [ ] **3.4** Add warning dialogs
  - When selecting Azure voice without credentials → Open setup wizard
  - When removing Azure credentials → Confirm action
  - When approaching free tier limit → Show warning

### Deliverables
- Updated `src/frontend/screens/tts/tts.tsx`
- Azure credentials form component
- Grouped voice picker component
- Provider badge component
- Usage meter component

### Testing
- [ ] Test Azure credentials form (save/load)
- [ ] Test connection button
- [ ] Test voice picker grouping
- [ ] Test provider badges display
- [ ] Test warnings and dialogs
- [ ] Test viewers tab with mixed voices

---

## 📦 Phase 4: Database & Voice Sync (Week 3)

### Goal
Sync Azure voices to database and maintain numeric IDs.

### Tasks
- [ ] **4.1** Voice sync service
  - Create `syncAzureVoices()` function
  - Fetch voices from Azure provider
  - Insert/update in voices table
  - Assign sequential numeric IDs
  - Preserve existing Web Speech voices

- [ ] **4.2** Voice sync triggers
  - Sync on first Azure setup (wizard completion)
  - Optional sync on app startup
  - Manual sync button in Voice Settings
  - Track last sync timestamp

- [ ] **4.3** Voice repository updates
  - `getVoicesByProvider(provider)` method
  - `getProviderStats()` method (count by provider)
  - `syncVoices(provider, voices)` method
  - Handle duplicate voice_id (update instead of error)

- [ ] **4.4** Settings storage
  - Save `azure_api_key` (encrypted if possible)
  - Save `azure_region`
  - Save `azure_last_sync`
  - Save `azure_usage_characters` (for tracking)

### Deliverables
- Updated `src/backend/database/repositories/voices.ts`
- Voice sync service
- Settings encryption (optional)
- Sync progress feedback

### Testing
- [ ] Test initial voice sync
- [ ] Test sync preserves Web Speech voices
- [ ] Test numeric ID assignment
- [ ] Test manual refresh
- [ ] Test startup sync (if enabled)

---

## 📦 Phase 5: Discord Integration (Week 3)

### Goal
Update Discord voice catalog to show both providers with clear labeling.

### Tasks
- [ ] **5.1** Update catalog generation
  - Group by provider first, then language
  - Format: `🌐 Web Speech - English (US)`
  - Format: `☁️ Azure Neural - English (US)`
  - Show provider count in description
  - Example: "557 voices (157 Web Speech + 400 Azure)"

- [ ] **5.2** Update embed format
  - Add provider icons to field names
  - Keep voice lines consistent: `001 │ Samantha ♀️`
  - Add Azure info to footer
  - Update example commands in description

- [ ] **5.3** Handle pagination
  - Split long sections into multiple fields
  - Respect Discord's 25 field limit
  - Prioritize English voices if limit reached

### Deliverables
- Updated `src/backend/core/ipc-handlers.ts` (startup tasks)
- New Discord catalog format
- Provider-aware grouping logic

### Testing
- [ ] Test catalog with Web Speech only
- [ ] Test catalog with Web Speech + Azure
- [ ] Test catalog pagination (many voices)
- [ ] Test Discord embed rendering
- [ ] Test auto-post on startup

---

## 📦 Phase 6: Testing & Polish (Week 4)

### Goal
Comprehensive testing and bug fixes.

### Tasks
- [ ] **6.1** Unit tests
  - Azure provider tests
  - Voice routing tests
  - SSML generation tests
  - Voice sync tests

- [ ] **6.2** Integration tests
  - End-to-end chat → Azure voice
  - End-to-end chat → Web Speech voice
  - Mixed viewer voices
  - Queue processing with both providers

- [ ] **6.3** Error scenario testing
  - Invalid Azure credentials
  - Network errors
  - Quota exceeded
  - Voice not found
  - Provider unavailable

- [ ] **6.4** Performance testing
  - Voice loading time
  - Speech synthesis latency
  - Queue processing speed
  - Memory usage

- [ ] **6.5** UI/UX polish
  - Loading states
  - Error messages
  - Success confirmations
  - Tooltips and help text
  - Responsive design

### Deliverables
- Test suite
- Bug fixes
- Performance optimizations
- Documentation updates

### Testing
- [ ] Run full test suite
- [ ] Manual testing checklist
- [ ] User acceptance testing
- [ ] Performance profiling

---

## 📦 Phase 7: Documentation & Deployment (Week 4)

### Goal
Complete documentation and deploy to users.

### Tasks
- [ ] **7.1** User documentation
  - Azure setup guide (in-app and external)
  - Voice selection guide
  - Troubleshooting guide
  - FAQ

- [ ] **7.2** Developer documentation
  - Architecture overview
  - Provider implementation guide
  - Voice ID format conventions
  - Adding new providers (template for Google)

- [ ] **7.3** Release preparation
  - Version bump (e.g., v2.0.0)
  - Changelog
  - Migration guide (for existing users)
  - Release notes

- [ ] **7.4** Deployment
  - Build and test release
  - Publish to users
  - Monitor for issues
  - Collect feedback

### Deliverables
- Complete documentation
- Release package
- Deployment checklist
- Monitoring plan

---

## 🎯 Success Criteria

### Phase 0 Success
- ✅ Non-technical user can complete Azure setup in 5-10 minutes
- ✅ Wizard handles errors gracefully with clear guidance
- ✅ User successfully connects to Azure without external help

### Overall Success
- ✅ Azure voices available alongside Web Speech voices
- ✅ Users can mix providers (viewer A = Web Speech, viewer B = Azure)
- ✅ Zero breaking changes for existing users
- ✅ Discord catalog clearly shows both providers
- ✅ Errors handled gracefully with fallbacks
- ✅ Performance remains fast (< 500ms speech latency)
- ✅ Documentation is clear and comprehensive

### Metrics to Track
- Setup completion rate (% who start vs finish wizard)
- Azure adoption rate (% of users who set up Azure)
- Voice usage distribution (Web Speech vs Azure)
- Free tier exhaustion rate (% who exceed 500k chars/month)
- Error rates (API errors, network errors, etc.)
- User satisfaction (feedback, support tickets)

---

## 🔄 Next: Google TTS (Phase 2)

After Azure is complete and stable, we'll follow the same pattern:

### Google Implementation
1. ✅ Create Google Setup Wizard (similar to Azure)
2. ✅ Implement Google TTS Provider
3. ✅ Integrate with Manager (hybrid with Web Speech + Azure + Google)
4. ✅ Update UI (three-way provider grouping)
5. ✅ Update Discord catalog
6. ✅ Test and deploy

### Estimated Timeline
- Azure Implementation: **3-4 weeks**
- Stabilization & Feedback: **1 week**
- Google Implementation: **2-3 weeks** (faster, using Azure pattern)
- **Total**: ~7-8 weeks

---

## 📝 Notes

### Dependencies
```json
{
  "microsoft-cognitiveservices-speech-sdk": "^1.36.0"
}
```

### Future Providers (Post-Google)
- ElevenLabs (voice cloning)
- Amazon Polly
- IBM Watson
- OpenAI TTS

### Extensibility
The architecture is designed to support unlimited providers:
- Each provider implements `TTSProvider` interface
- Voice ID prefix determines routing
- UI automatically groups by provider
- Discord catalog scales to N providers

---

**Let's build this! 🚀**
