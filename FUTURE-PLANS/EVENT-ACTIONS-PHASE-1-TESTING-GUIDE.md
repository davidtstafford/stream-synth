# Phase 1 Testing Guide - Event Formatter

**Status:** ✅ Ready for Testing  
**Date:** November 1, 2025

---

## What Changed

### Before Phase 1
- Events screen had a **500+ line switch statement** for formatting events
- All formatting logic was **duplicated** and hard to maintain
- Adding new event types required modifying the massive switch statement

### After Phase 1
- Events screen now uses **shared event formatter** (11 lines!)
- All formatting logic is in **one reusable module**
- Future features can use the same formatter (Event Actions, Browser Source, etc.)

---

## Quick Test Checklist

### 1️⃣ Basic Functionality Test
- [ ] Launch the app (`npm start`)
- [ ] Navigate to **Events** screen
- [ ] Verify events are displaying (should look identical to before)
- [ ] Check that all columns render correctly

### 2️⃣ Event Display Test
Test that these event types display correctly (if you have stored events):

**Chat Events:**
- [ ] `channel.chat.message` - Shows username and message
- [ ] `channel.chat.clear` - Shows "All chat messages cleared"
- [ ] `channel.chat_settings.update` - Shows chat settings

**Channel Events:**
- [ ] `channel.follow` - Shows "X followed the channel" with 💜 emoji
- [ ] `channel.subscribe` - Shows subscription with tier
- [ ] `channel.cheer` - Shows bits amount
- [ ] `channel.raid` - Shows raider and viewer count

**Stream Events:**
- [ ] `stream.online` - Shows "Stream went live" with 🔴
- [ ] `stream.offline` - Shows "Stream ended"

**Other Events:**
- [ ] Any poll, prediction, goal, or hype train events
- [ ] Moderation events (bans, timeouts, etc.)
- [ ] Channel points redemptions

### 3️⃣ Live Event Test (Recommended)
If possible, trigger some real events to verify:

1. **Test Follower Event:**
   - Have someone follow your channel
   - Check it appears in Events screen immediately
   - Verify formatting is correct

2. **Test Chat Event:**
   - Send a chat message in your channel
   - Verify it appears with username and message

3. **Test Subscription Event (if applicable):**
   - If someone subs, verify tier displays correctly
   - Check gift subs format properly

### 4️⃣ Edge Cases
- [ ] Events with missing data (should not crash)
- [ ] Events with very long text (should truncate properly)
- [ ] Events with special characters (emojis, etc.)
- [ ] Anonymous users (should show "Anonymous")

---

## What to Look For

### ✅ Expected Behavior
- **Events display identically** to how they did before Phase 1
- **All emojis appear** correctly (💜, 🎉, 🎯, etc.)
- **Usernames are bold** and stand out
- **Numbers are formatted** with commas (1,000 not 1000)
- **Long text is truncated** with "..." at the end
- **No console errors** in the app

### ❌ Signs of Problems
- Events not appearing in the list
- Formatting looks broken or different
- Console errors mentioning "formatEvent" or "event-formatter"
- Missing emojis or usernames
- Text overflow (no truncation)
- TypeScript errors in the terminal

---

## How to Test

### Option 1: Quick Visual Test (2 minutes)
```powershell
# Start the app
npm start

# Then:
# 1. Click "Events" in the menu
# 2. Scroll through the list
# 3. Verify events look correct
# 4. Done!
```

### Option 2: Comprehensive Test (10-15 minutes)
```powershell
# Start the app
npm start

# Then:
# 1. Open Events screen
# 2. Trigger live events (follow, chat, etc.)
# 3. Verify each event type displays correctly
# 4. Check filters work
# 5. Test search functionality
# 6. Export events to verify data integrity
```

### Option 3: Code Verification (5 minutes)
```powershell
# Check for TypeScript errors
npm run build

# Expected output: 
# ✅ "compiled successfully"
# ✅ No errors or warnings
```

---

## Testing Different Event Types

### To Test Chat Events:
1. Connect to your channel
2. Send messages in chat
3. Clear chat (as mod)
4. Update chat settings

### To Test Follower Events:
1. Have someone follow your channel
2. Or unfollow and re-follow yourself (on another account)
3. Check Events screen immediately

### To Test Subscription Events:
1. Wait for someone to subscribe
2. Or gift a sub yourself
3. Check formatting of tier, username, message

### To Test Channel Points:
1. Create a channel point reward
2. Have someone redeem it
3. Verify redemption shows correctly

---

## If You Find Issues

### Issue: Events not displaying
**Check:**
- Is EventSub connected? (Check Dashboard)
- Are there any console errors?
- Is the database accessible?

**Fix:**
- Restart the app
- Check EventSub Dashboard for connection status

### Issue: Formatting looks wrong
**Check:**
- Compare with old screenshots (if you have any)
- Check console for errors
- Verify `event-formatter.ts` was bundled correctly

**Fix:**
- Run `npm run build` again
- Check for TypeScript errors
- Report the specific event type that's broken

### Issue: Console errors
**Check:**
- Full error message
- Which file is causing the error
- Which event type triggered it

**Fix:**
- Share the error message with me
- I can help debug and fix

---

## Success Criteria

Phase 1 is successful if:

- ✅ All events display correctly (identical to before)
- ✅ No console errors
- ✅ Build completes successfully
- ✅ No functionality regressions
- ✅ Code is cleaner (529 lines removed!)

---

## After Testing

### If Everything Works ✅
Great! Phase 1 is complete. We can move on to **Phase 2: Database Layer**

### If You Find Issues ❌
Let me know:
1. Which event type(s) have issues
2. What the formatting looks like (screenshot if possible)
3. Any console errors
4. I'll fix it immediately

---

## Quick Reference

**Files Modified:**
- `src/shared/utils/event-formatter.ts` (NEW - 1000+ lines)
- `src/frontend/screens/events/events.tsx` (REDUCED - 1034→505 lines)

**Build Command:**
```powershell
npm run build
```

**Run Command:**
```powershell
npm start
```

**Expected Build Time:** ~10-15 seconds  
**Expected Bundle Size:** event-formatter.ts = 33.5 KiB

---

## Why This Matters

This refactoring creates the **foundation for Event Actions**:

1. ✅ **Single source of truth** for event formatting
2. ✅ **Reusable across features** (Events, Alerts, Browser Source)
3. ✅ **Template variables extracted** for customization
4. ✅ **Cleaner, maintainable code** (529 lines removed!)

**Once tested and verified, we're ready for Phase 2!** 🚀

---

**Happy Testing!** If everything looks good, just say "Phase 1 looks good!" and we can move to Phase 2.
