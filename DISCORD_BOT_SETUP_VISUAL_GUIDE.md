# Discord Bot Setup - Corrected Flow

## The Problem with the Original Flow

```
OLD (WRONG) FLOW:
┌─────────────┐     ┌──────────────┐     ┌───────────────┐     ┌──────────────┐
│ Copy Token  │────▶│ Get OAuth URL │────▶│ Authorize URL │────▶│ Enter Token  │
│             │     │ (Don't visit  │     │ (FAILS!)      │     │ in Stream    │
│ Step 1      │     │              │     │               │     │              │
└─────────────┘     │ Step 2)      │     │ Step 3        │     │ Step 4       │
                    └──────────────┘     └───────────────┘     └──────────────┘
                                                ❌
                              Browser can't connect to localhost:3000
                              (No web server running)
```

## The Correct Flow (NOW FIXED)

```
NEW (CORRECT) FLOW:
┌─────────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌──────────────────┐     ┌───────────────┐
│ 1. Create Bot   │────▶│ 2. Get OAuth    │────▶│ 3. Enter Token   │────▶│ 4. Authorize URL │────▶│ 5. Use Bot    │
│ & Copy Token    │     │    Invite URL   │     │    in Stream     │     │ (Now working!)   │     │ in Discord    │
│                 │     │    (don't visit │     │    Synth & Start │     │                  │     │               │
│ Discord Portal  │     │    yet!)        │     │    Bot First     │     │ Discord Portal   │     │ /findvoice    │
└─────────────────┘     └─────────────────┘     └──────────────────┘     └──────────────────┘     └───────────────┘
```

## Detailed Step Breakdown

### Step 1: Create Discord Application ✅
- **Where:** Discord Developer Portal (https://discord.com/developers/applications)
- **Actions:**
  1. Click "New Application"
  2. Go to "Bot" section → "Add Bot"
  3. Copy the bot token
  4. **Keep it secret!**
- **Duration:** ~2 minutes

### Step 2: Get OAuth2 Invite URL ✅
- **Where:** Discord Developer Portal
- **Actions:**
  1. Go to "OAuth2" section
  2. Add redirect URI `http://localhost:3000` in "Redirects"
  3. **Select it from dropdown** (important!)
  4. Select scope: `bot`
  5. Select permissions: Send Messages, Embed Links, Read History, Slash Commands
  6. Copy the generated URL
- **Important:** Don't visit this URL yet! 
- **Duration:** ~3 minutes

### Step 3: Configure in Stream Synth 🔑
- **Where:** Stream Synth app
- **Actions:**
  1. Click "Show →" next to "Bot Token"
  2. Paste your bot token
  3. Click "▶ Start Bot"
  4. Wait for status to show "Connected" (green indicator)
  5. You should see the bot ID displayed
- **Why first?** The bot needs to be running before Discord redirects to localhost:3000
- **Duration:** ~1 minute

### Step 4: Authorize the Bot 🔓
- **Where:** Browser (use the URL from Step 2)
- **Actions:**
  1. Paste/visit the OAuth2 URL in your browser
  2. Select your Discord server
  3. Review permissions (they should match what you selected)
  4. Click "Authorize"
  5. Complete CAPTCHA if prompted
  6. You should see a success page
- **Note:** If you see "Safari can't connect to localhost:3000" - that's OK! You've already authorized. 
  - This is just a browser limitation with desktop apps
  - You already got what you needed (the authorization)
  - The bot is already added to your server
- **Duration:** ~1 minute

### Step 5: Start Using Voice Discovery 🎉
- **Where:** Your Discord server
- **Actions:**
  1. Go to any channel
  2. Type `/findvoice` (should auto-complete with slash command)
  3. Search for a voice or preview one
  4. In Twitch chat, type `~setvoice [voice-id]` to activate it
- **That's it!** Your viewers can now discover voices in Discord

---

## Why the Original Order Was Wrong

### The OAuth2 Redirect Problem

When you visit the OAuth2 URL and click "Authorize", Discord redirects you to:
```
http://localhost:3000/?code=XXXX&guild_id=XXXX
```

**In a web app:** The server at `localhost:3000` catches this callback and exchanges the code for a token.

**In a desktop app (Stream Synth):** Nothing is listening on `localhost:3000`! There's no web server.
- ❌ Browser shows: "Safari can't connect to the server 'localhost'"
- ✓ But the authorization already happened!
- ✓ The bot is already added to your server!

### Why Starting the Bot First Helps

If you have the bot running in Stream Synth:
1. It's monitoring the Discord API
2. It might be able to catch/handle the redirect better
3. More importantly: It's just the right sequence

**The real fix:** Use the bot token directly (which we do) instead of relying on OAuth2 callbacks.

---

## Troubleshooting

### Problem: "Bot Token is required" but I entered one
**Solution:** Click "Show →" to reveal the input field if it's not visible

### Problem: Bot won't start / shows error
**Solution:** 
- Verify you copied the FULL token correctly
- Try regenerating a fresh token in Discord
- Check that you have bot permissions in your Discord server

### Problem: OAuth URL redirects fail with "Safari can't connect"
**Solution:** This is expected! You've already authorized. The bot is added to your server.

### Problem: Bot doesn't respond to `/findvoice` in Discord
**Solution:**
- Make sure the bot has "Slash Commands" permission
- Check that it was added to the server (should see it in member list)
- Try typing `/` to see if slash commands show up
- Check Stream Synth status shows "Connected"

### Problem: Changes I make to bot settings don't save
**Solution:** 
- The app needs to be running for the bot to stay connected
- When you close Stream Synth, the bot disconnects but your token stays saved
- When you restart the app, the bot should auto-connect if you enabled "Auto-start"

---

## Summary: Remember This Order

```
ALWAYS DO IT IN THIS ORDER:

1️⃣  Create bot in Discord Developer Portal
2️⃣  Get OAuth2 invite URL from Discord Portal
3️⃣  Enter token in Stream Synth (this is what authenticates the bot)
4️⃣  Start the bot in Stream Synth
5️⃣  Visit the OAuth2 URL to authorize (adds bot to server)
6️⃣  Use /findvoice in your Discord server
```

**The KEY insight:** 
- Discord Developer Portal = Create & configure the bot
- Stream Synth = Run the bot 
- Discord Server = Use the bot

Do them in this order and everything works! ✅
