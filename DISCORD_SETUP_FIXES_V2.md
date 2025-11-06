# Discord Bot Setup - Issues Fixed (V2)

## What Was Wrong

You identified 5 critical issues with the Discord bot setup process:

### 1. ❌ **Guide closed after entering token**
**What was happening:** When you clicked "Start Bot" in the setup guide, the guide would close immediately.

**What's fixed:** ✅ The guide now stays open so you can continue through all 5 steps without closing and reopening.

**How to use it:** After clicking "Start Bot", wait for the success message, and you'll automatically move to Step 4 to authorize the bot in Discord.

---

### 2. ❌ **Status shows "Disconnected" even with green checkmark**
**What was happening:** The bot would show as "Connected" in the guide, but then display "Disconnected" on the main screen.

**Root cause:** The frontend wasn't properly updating the bot status after starting.

**What's fixed:** ✅ When the bot starts from the guide:
- The `onBotStarted` callback now properly refreshes the bot status
- Status updates are fetched immediately after bot start
- Main screen gets the correct connected state

**What you'll see:**
- ✓ Success message in the guide
- ✓ Status automatically updates to "Connected" on main screen
- ✓ Guide stays open for next steps

---

### 3. ⚠️ **"Safari can't connect to localhost:3000" OAuth error**
**What's happening:** This is **EXPECTED and NOT A BUG**.

**Why it happens:**
- Stream Synth is a desktop app, not a web server
- When you authorize the bot, Discord tries to redirect to `http://localhost:3000/?code=...`
- Desktop apps can't actually listen on localhost ports for web callbacks
- But the authorization **HAS ALREADY HAPPENED** - the bot is already added to your server!

**What's fixed:** ✅ Step 4 now clearly explains this is normal and harmless:
```
⚠️ You may see "Safari can't connect to server 'localhost'" - this is EXPECTED and HARMLESS
The bot has already been authorized and added to your server - the error is just a browser limitation
```

**How to verify it worked:**
- Check your Discord server member list
- The bot should appear in the members list
- Try typing `/findvoice` in a Discord channel
- If it autocompletes → ✅ Bot is working!

---

### 4. ❌ **Discord portal doesn't show "Add Bot"**
**What's happening:** You're seeing the Discord Developer Portal page, but the "Add Bot" button isn't visible.

**Why this happens:**
- Discord portal may not have loaded completely
- The page might require scrolling
- You might be on the wrong section

**How to fix it:**
1. Go to https://discord.com/developers/applications
2. Click on your app (stream-synth)
3. On the left sidebar, click **"Bot"** (not "Settings")
4. You should see the Bot section with username, token, and "Add Bot" button
5. If it says "Add Bot", click it
6. If it says something else, you already have a bot created

**Screenshot location:** Look for the left sidebar navigation:
- Settings (gear icon) - General Information
- Installation (download icon)
- OAuth2 (arrow icon)
- **Bot** ← Click here

---

### 5. ❌ **No clear feedback when clicking "Start Bot"**
**What was happening:** Button would show loading state but unclear when complete.

**What's fixed:** ✅ Much clearer feedback:
- **Before clicking:** "▶ Start Bot in Stream Synth"
- **While running:** "🔄 Starting Bot..." (greyed out)
- **After success:** "✓ Bot is now running!" message appears
- **On screen:** Status card updates to show "Connected" with Bot ID and latency
- **In guide:** Auto-advances to Step 4 so you know it worked

---

## New Updated Setup Flow

### **Step 1: Create Discord Application**
1. Go to https://discord.com/developers/applications
2. Click "New Application"
3. Go to **Bot** section (left sidebar)
4. Click "Add Bot"
5. **Copy the token** and keep it secret

### **Step 2: Add Redirect URI & Get OAuth URL**
1. Go to **OAuth2** section (left sidebar)
2. Add Redirect: `http://localhost:3000`
3. **Important:** Select it from the "Select redirect URL" dropdown (required step!)
4. Select scope: `bot`
5. Select permissions: Send Messages, Embed Links, Read History, Use Slash Commands
6. Copy the **GENERATED URL** at the bottom

⚠️ **DO NOT visit this URL yet** - wait for Step 3!

### **Step 3: Start Bot in Stream Synth**
1. Open Stream Synth Discord Bot screen
2. Click "📋 Setup Guide"
3. Go through Step 1-2 in the guide
4. On **Step 3**, paste your bot token into the input box
5. Click "▶ Start Bot in Stream Synth"
6. **Wait for:** ✓ "Bot is now running!" message
7. **Guide auto-advances** to Step 4

✅ **What you'll see on main screen:**
- Status changes to "Connected"
- Shows Bot ID and latency
- This means the bot is successfully running!

### **Step 4: Authorize Bot in Discord**
1. Guide shows the Step 4 instructions
2. Open the OAuth2 URL from Step 2 in your browser
3. Select your Discord server
4. Click "Authorize"
5. Complete CAPTCHA if prompted
6. ⚠️ **See "Safari can't connect"?** That's OK! Bot is already authorized.
7. Check your Discord server member list → bot should appear

### **Step 5: Use Voice Discovery**
1. Go to any channel in your Discord server
2. Type `/findvoice`
3. Search for or preview voices
4. Done! ✅

---

## Troubleshooting

### **Bot won't start - error message appears**
**"Bot token is required"**
- Make sure you pasted the full token from Discord
- No spaces at the beginning or end

**"Error: Invalid token"**
- Go back to Discord Developer Portal
- Copy your bot token again
- Make sure it's the full token (usually 70+ characters)

**"Error: Connection failed"**
- Check your internet connection
- Try regenerating the token in Discord Developer Portal
- Try again in 30 seconds

### **Status shows "Disconnected" after clicking Start Bot**
1. Wait 5 seconds - the bot is still initializing
2. Click "Start Bot" again
3. Check the error message for clues
4. Verify your bot token is correct

### **OAuth URL authorization doesn't work**
1. You MUST start the bot in Stream Synth first (Step 3)
2. Then visit the OAuth URL (Step 4)
3. If you still get errors:
   - Try a different browser (Chrome, Firefox)
   - Try in an Incognito/Private window
   - Check you have permission to manage the server

### **Bot appears in Discord but `/findvoice` doesn't work**
1. Close and reopen Discord
2. Make sure the bot has these permissions:
   - Send Messages
   - Use Slash Commands
   - Embed Links
   - Read Message History
3. Try typing `/` to see if slash commands show up
4. If bot permissions don't show, remove bot and re-authorize

### **"Discord can't connect to localhost:3000" after authorizing**
✅ **This is expected!** The bot HAS been authorized.

**Check if it worked:**
- Open your Discord server
- Look at member list
- See the bot there? ✅ Success!
- Try `/findvoice` command
- If it autocompletes? ✅ Success!

The "localhost" error is just a browser limitation with desktop apps - it doesn't mean the authorization failed.

---

## Summary of Changes

| Issue | Before | After |
|-------|--------|-------|
| Guide closes after start | ✗ Closed immediately | ✓ Stays open, auto-advances to next step |
| Status shows disconnected | ✗ Shows "Disconnected" on main screen | ✓ Updates to "Connected" with bot info |
| OAuth localhost error | ✗ Confusing, seemed like failure | ✓ Clearly explained as expected/harmless |
| Discord portal confusing | ✗ User couldn't find "Add Bot" button | ✓ Step-by-step guide with sidebar navigation |
| Bot start feedback | ✗ Unclear when done | ✓ Clear success message, auto-advance, status update |

---

## Testing Checklist

✅ Test these steps in order:

1. **Open Setup Guide**
   - Click "📋 Setup Guide" on main Discord Bot screen
   - Guide opens and shows Step 1

2. **Complete Steps 1-2**
   - Create Discord app and bot
   - Get OAuth URL
   - Copy bot token

3. **Start Bot in Guide (Step 3)**
   - Paste bot token
   - Click "▶ Start Bot in Stream Synth"
   - Should see: ✓ "Bot is now running!"
   - Guide should auto-advance to Step 4
   - **Main screen** should show "Connected" status

4. **Authorize in Discord (Step 4)**
   - Visit OAuth URL
   - Select server and authorize
   - Check server member list → bot appears
   - ⚠️ OK if you see "localhost" error

5. **Test in Discord (Step 5)**
   - Type `/findvoice` in Discord channel
   - Should autocomplete with suggestion
   - ✅ Success!

---

## Next Steps

The Discord bot setup should now be much clearer and more intuitive. The guide stays open during setup, provides clear feedback, and explains the expected OAuth behavior.

If you run into any other issues, check the troubleshooting section above!

**Still having problems?** Make sure:
- Bot token is pasted correctly (full 70+ character string)
- You're on the "Bot" section in Discord Developer Portal (not Settings)
- You've added AND selected the redirect URI (both steps required!)
- You start the bot in Stream Synth before authorizing in Discord
