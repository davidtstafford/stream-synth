# Viewer TTS Management: Architecture Before & After

**Status:** 📋 **DESIGN DOCUMENT**  
**Date:** October 30, 2025

---

## 🔴 BEFORE: Conflated Design (Current)

### Screen Structure
```
TTS Settings
  └── Viewer Rules (SINGLE SCREEN - CONFUSING!)
      ├── Search viewer
      ├── Voice Selection (voice, pitch, speed)
      └── TTS Restrictions (mute, cooldown) ⚠️ MIXED TOGETHER
```

### User Flow (Broken)
```
1. Navigate to "Viewer Rules"
2. Search for @Bob
3. Select @Bob
4. See "Create Rule" button
5. Click "Create Rule"
6. Now see BOTH voice settings AND mute/cooldown options
   ❌ PROBLEM: Voice settings required to see restrictions?
   ❌ PROBLEM: Can't see all muted users without searching each one
   ❌ PROBLEM: Chat command mutes invisible in UI
```

### Database (Actually Correct!)
```
viewer_rules                    viewer_tts_rules
├── viewer_id                   ├── viewer_id
├── voice_id                    ├── is_muted
├── provider                    ├── mute_period_mins
├── pitch                       ├── has_cooldown
└── speed                       └── cooldown_gap_seconds

SEPARATE TABLES ✅              But UI treats them as ONE THING ❌
```

### Problems Identified

**❌ UI/UX Issues:**
- Mixed concerns (voice customization vs moderation)
- No way to see "all muted users" at a glance
- Chat commands create rules but don't appear in UI
- "Existing Rules" table only shows voice preferences
- Confusing whether user has rules or not

**❌ Workflow Issues:**
- Must search for each user individually to see their restrictions
- Can't monitor active mutes/cooldowns easily
- Countdown timers not visible
- No notification when chat commands execute

**❌ Conceptual Issues:**
- Voice preferences are OPTIONAL customization
- Mutes/cooldowns are MODERATION tools
- Different purposes, different users, different workflows
- Should be completely separate

---

## 🟢 AFTER: Separated Design (Proposed)

### Screen Structure
```
TTS Settings
  ├── Viewer Voice Settings (OPTIONAL CUSTOMIZATION)
  │   ├── Search viewer
  │   ├── Voice Selection (voice, pitch, speed)
  │   ├── Save/Update/Delete preference
  │   └── Table: All viewers with custom voices
  │
  └── Viewer TTS Restrictions (MODERATION)
      ├── Add Restriction Form
      │   ├── Search viewer
      │   ├── Choose: Mute or Cooldown
      │   └── Configure parameters
      ├── Table: All Muted Users (with countdown)
      ├── Table: All Users with Cooldowns (with countdown)
      └── Help: Chat commands reference
```

### User Flow 1: Customize Voice (Optional)
```
Use Case: "Make @Bob sound like a robot"

1. Navigate to "Viewer Voice Settings"
2. Search for @Bob
3. Select custom voice (e.g., "Robot")
4. Adjust pitch to 1.5x
5. Save
6. Done! ✅

Result: @Bob's messages use robot voice with high pitch
Note: This is OPTIONAL, most viewers won't have custom voices
```

### User Flow 2: Moderate TTS (Common)
```
Use Case: "@Spammer is abusing TTS, mute for 30 minutes"

Option A: Via UI
1. Navigate to "Viewer TTS Restrictions"
2. Search for @Spammer
3. Choose "Mute"
4. Set duration: 30 minutes
5. Save
6. See @Spammer appear in "Muted Users" table with countdown ✅

Option B: Via Chat (FASTER)
1. Type in chat: ~mutevoice @Spammer 30
2. UI automatically refreshes ✅
3. See @Spammer appear in table immediately ✅
4. Countdown visible: "29m remaining" ✅
```

### User Flow 3: Monitor Restrictions
```
Use Case: "Who is currently muted?"

1. Navigate to "Viewer TTS Restrictions"
2. Look at "Muted Users" table
3. See all muted users at a glance ✅
   - @Spammer: 29m remaining
   - @Troll: Permanent
   - @Annoying: 5m remaining
4. Quick unmute button available ✅
```

### Database (Unchanged!)
```
viewer_rules                    viewer_tts_rules
├── viewer_id                   ├── viewer_id
├── voice_id                    ├── is_muted
├── provider                    ├── mute_period_mins
├── pitch                       ├── has_cooldown
└── speed                       └── cooldown_gap_seconds

STILL SEPARATE ✅               NOW UI MATCHES ARCHITECTURE ✅
```

---

## 📊 Comparison Table

| Feature | BEFORE (Mixed Screen) | AFTER (Separate Screens) |
|---------|----------------------|--------------------------|
| **Find muted users** | Must search each user | See all in table at once ✅ |
| **Chat command visibility** | Not visible until search | Auto-appears in table ✅ |
| **Voice customization** | Mixed with restrictions | Clean, focused screen ✅ |
| **Countdown timers** | Not visible | Live countdowns ✅ |
| **Monitoring** | Impossible | Easy overview ✅ |
| **Workflow clarity** | Confusing | Clear purpose ✅ |
| **Real-time updates** | Partial | Full integration ✅ |

---

## 🎨 Visual Mockup: Restrictions Screen

```
┌─────────────────────────────────────────────────────────────┐
│ Viewer TTS Restrictions                                     │
│ Manage mutes and cooldowns for viewer TTS messages         │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ Add Restriction                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Search: [testuser____________]  [Search Results ▼]     │ │
│ │                                                         │ │
│ │ Selected: @testuser                                     │ │
│ │                                                         │ │
│ │ Type: [🔇 Mute] [⏰ Cooldown]                          │ │
│ │                                                         │ │
│ │ Duration: [30____] minutes (0 = Permanent)             │ │
│ │                                                         │ │
│ │ [Add Restriction] [Cancel]                             │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 🔇 Muted Users (3)                                         │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Viewer    │ Muted At          │ Duration  │ Expires In │ │
│ ├───────────┼───────────────────┼───────────┼────────────┤ │
│ │ @Spammer  │ Oct 30, 2:30 PM   │ 30 min    │ 29m ⏱️     │ │
│ │ @Troll    │ Oct 30, 1:00 PM   │ Permanent │ Never 🔒   │ │
│ │ @Annoying │ Oct 30, 2:55 PM   │ 10 min    │ 5m ⏱️      │ │
│ │           │                   │           │ [Unmute]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ ⏰ Users with Cooldowns (2)                                │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Viewer  │ Gap │ Set At          │ Duration  │ Expires  │ │
│ ├─────────┼─────┼─────────────────┼───────────┼──────────┤ │
│ │ @FastGuy│ 30s │ Oct 30, 2:00 PM │ 60 min    │ 55m ⏱️   │ │
│ │ @Chatty │ 45s │ Oct 30, 1:30 PM │ Permanent │ Never 🔒 │ │
│ │         │     │                 │           │ [Remove] │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│ 💬 Chat Commands                                           │
│ • ~mutevoice @user [minutes] - Mute user                   │
│ • ~unmutevoice @user - Remove mute                         │
│ • ~cooldownvoice @user <gap_sec> [period_min] - Cooldown  │
│                                                             │
│ ℹ️ Changes via chat appear here automatically              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧠 Design Philosophy

### Viewer Voice Settings
**Purpose:** OPTIONAL customization for FUN  
**Users:** Viewers, content creators  
**Frequency:** Rare (set once per viewer)  
**Workflow:** Search → Select → Customize → Save  
**Data:** Stored in `viewer_rules`

### Viewer TTS Restrictions
**Purpose:** MODERATION for CONTROL  
**Users:** Moderators, broadcaster  
**Frequency:** Common (during streams)  
**Workflow:** Quick action → Monitor → Adjust  
**Data:** Stored in `viewer_tts_rules`

### Why Separate?

1. **Different Users:**
   - Voice settings: Anyone can request custom voice
   - Restrictions: Only mods/broadcaster apply

2. **Different Workflows:**
   - Voice settings: Careful customization, test voice
   - Restrictions: Quick action, often via chat

3. **Different Monitoring:**
   - Voice settings: List of customizations
   - Restrictions: Active/expired status with countdowns

4. **Different Mental Models:**
   - Voice settings: "How should @Bob sound?"
   - Restrictions: "Who is currently muted?"

---

## 🔧 Technical Implementation

### Component Separation

**ViewerVoiceSettingsTab.tsx** (Renamed from ViewerRulesTab)
```typescript
// Responsibilities:
- Search viewers
- Select/configure custom voice
- Adjust pitch/speed
- Save voice preference
- Display list of voice preferences
- Delete voice preferences

// Uses:
- viewer-rules:* IPC handlers
- viewer_rules database table

// Does NOT handle:
- Mutes ❌
- Cooldowns ❌
- Restrictions ❌
```

**ViewerTTSRestrictionsTab.tsx** (NEW)
```typescript
// Responsibilities:
- Display all muted users
- Display all cooldown users
- Add new restrictions
- Remove restrictions
- Monitor expiration countdowns
- Listen for chat command events
- Auto-refresh when rules change

// Uses:
- viewer-tts-rules:* IPC handlers
- viewer_tts_rules database table

// Does NOT handle:
- Voice selection ❌
- Pitch/speed ❌
- Voice preferences ❌
```

### State Management

**Voice Settings State:**
```typescript
const [rules, setRules] = useState<VoicePreference[]>([]);
const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
const [editingRule, setEditingRule] = useState<VoicePreference | null>(null);
const [voiceSearchTerm, setVoiceSearchTerm] = useState('');
const [providerFilter, setProviderFilter] = useState('all');
```

**Restrictions State:**
```typescript
const [mutedUsers, setMutedUsers] = useState<TTSRules[]>([]);
const [cooldownUsers, setCooldownUsers] = useState<TTSRules[]>([]);
const [selectedViewer, setSelectedViewer] = useState<Viewer | null>(null);
const [restrictionType, setRestrictionType] = useState<'mute' | 'cooldown'>('mute');
const [mutePeriodMins, setMutePeriodMins] = useState(0);
const [cooldownGapSeconds, setCooldownGapSeconds] = useState(30);
```

**Zero Overlap ✅**

---

## 📈 Benefits Summary

### User Experience
✅ Clear separation of concerns  
✅ Easy to find active restrictions  
✅ Real-time monitoring with countdowns  
✅ Chat commands visible immediately  
✅ No confusion about "rules"  

### Developer Experience
✅ Single responsibility per component  
✅ Easier to test  
✅ Easier to maintain  
✅ Easier to extend  
✅ Matches database architecture  

### Performance
✅ Simpler queries (no unnecessary JOINs)  
✅ Faster load times (focused data)  
✅ Better caching strategies  
✅ Optimized for each use case  

---

## 🚀 Migration Path

### Phase 1: Rename (No Breaking Changes)
```
ViewerRulesTab.tsx → ViewerVoiceSettingsTab.tsx
- Update imports
- Update tab registration
- Update labels
```

### Phase 2: Remove Restrictions Logic
```
From ViewerVoiceSettingsTab:
- Remove mute/cooldown state
- Remove TTS rules functions
- Remove restrictions UI
- Keep only voice preference logic
```

### Phase 3: Create Restrictions Screen
```
New ViewerTTSRestrictionsTab:
- Build from scratch
- Focus on monitoring
- Integrate chat command events
- Add countdown timers
```

### Phase 4: Test & Deploy
```
- Test both screens independently
- Test chat command integration
- Verify database consistency
- Deploy with confidence
```

---

## ✅ Validation Checklist

**After implementation, verify:**

- [ ] Can set voice preference WITHOUT creating restriction
- [ ] Can create restriction WITHOUT setting voice preference
- [ ] Voice settings screen has ZERO restriction logic
- [ ] Restrictions screen has ZERO voice preference logic
- [ ] Chat command `~mutevoice @user` appears in restrictions screen
- [ ] Chat command does NOT create voice preference
- [ ] Deleting voice preference does NOT affect restrictions
- [ ] Clearing restrictions does NOT affect voice preference
- [ ] All muted users visible in single table
- [ ] All cooldown users visible in single table
- [ ] Countdown timers update every 10 seconds
- [ ] Event listener receives real-time updates
- [ ] No TypeScript errors
- [ ] No database errors
- [ ] Build succeeds

---

**Status:** Ready for implementation tomorrow! 🎉  
**Confidence:** Very High - Clear architecture, well-defined scope  
**Risk:** Very Low - No database changes, clean separation
