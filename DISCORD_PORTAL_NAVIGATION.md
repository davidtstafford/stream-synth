# Finding the "Add Bot" Button in Discord Developer Portal

The issue you encountered is that Discord's Developer Portal can be confusing about where the Bot section is. Here's exactly where to look:

## The Problem

When you go to your Discord app, you see many options in the left sidebar, and it's not always clear where the "Add Bot" button is located.

## The Solution

### **Step-by-Step**

1. **Go to Applications:**
   - https://discord.com/developers/applications

2. **Click on your app:**
   - You should see "stream-synth" in the list
   - Click it to open

3. **Look at the LEFT SIDEBAR**
   - You'll see several options:
     - ⚙️ Settings → General Information
     - 📥 Installation 
     - 🔐 OAuth2 ← For generating invite URLs
     - 🤖 **Bot** ← YOU NEED THIS ONE
     - 😀 Emojis
     - 🔗 Webhooks
     - And more...

4. **Click "Bot" in the sidebar**
   - This is NOT in Settings!
   - Look for the robot/bot icon

5. **You should now see:**
   - "USERNAME" field
   - "TOKEN" section with a copy button
   - **"Add Bot"** button (if you haven't created a bot yet)
   - OR
   - Reset Token option (if bot already exists)

## If You Don't See the Bot Section

**Reason 1: Page Not Fully Loaded**
- Wait 2-3 seconds for the page to load
- Refresh the page (F5)
- Try a different browser

**Reason 2: Wrong App Selected**
- Make sure you clicked on "stream-synth" app
- Not another test app

**Reason 3: Sidebar Hidden**
- On mobile/narrow screens, sidebar might be hidden
- Look for a hamburger menu (☰) icon
- Click it to show the sidebar

## Comparing Sections

```
GENERAL INFORMATION (⚙️ Settings)
├─ App ID
├─ Public Key
└─ Personal Settings

OAUTH2 (🔐 OAuth2) 
├─ Client ID
├─ Client Secret
├─ Redirect URLs ← Where you add http://localhost:3000
└─ Scopes & Permissions ← Where you generate invite URL

BOT SECTION (🤖 Bot) ← THIS IS WHERE "ADD BOT" IS
├─ Username
├─ Bot Icon
├─ TOKEN ← Copy this for Stream Synth
├─ Add Bot button (first time only)
├─ Public Bot toggle
├─ Requires OAuth2 Code Grant
└─ Privileged Gateway Intents
```

## The Exact Location

When you're on the Bot page, you should see:

```
┌─────────────────────────────────────────┐
│ Bot                                     │
├─────────────────────────────────────────┤
│ USERNAME                                │
│ [stream-synth] ▼                       │
│ #1728                                   │
│                                         │
│ TOKEN                                   │
│ [Reset Token] [Copy]                   │
│ ●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●      │
│                                         │
│ ⚠️ For security, tokens can only be    │
│ viewed once when created.               │
│                                         │
│ [PUBLIC BOT TOGGLE]                    │
│ [CODE GRANT TOGGLE]                    │
│                                         │
│ PRIVILEGED GATEWAY INTENTS              │
│ ✓ Presence Intent                      │
│ ✓ Server Members Intent                │
│ ✓ Message Content Intent               │
└─────────────────────────────────────────┘
```

## Common Mistakes

❌ **WRONG:** Looking in General Information (⚙️)
- This shows App ID, Public Key, but NOT the bot token

❌ **WRONG:** Looking in OAuth2 (🔐)  
- This is for scopes and redirect URLs, not the bot itself

✅ **CORRECT:** Look in Bot (🤖)
- This is where the Add Bot button is
- This is where you copy the token

## Visual Navigation

```
🔐 OAuth2                           🤖 Bot
├─ Client ID                        ├─ Username: stream-synth
├─ Client Secret                    ├─ Token: [COPY BUTTON]
├─ Redirect URLs                    ├─ Add Bot (first time)
│  └─ http://localhost:3000 ← Add here   ├─ Public Bot toggle
└─ Scopes & Permissions             └─ Gateway Intents
   ├─ bot (select this)             
   ├─ bot permissions...
   └─ URL: https://discord.com/... ← Copy this
```

## Quick Checklist

- [ ] Went to https://discord.com/developers/applications
- [ ] Clicked on "stream-synth" app
- [ ] **Clicked "Bot" in the LEFT SIDEBAR (not Settings)**
- [ ] See "Add Bot" button
- [ ] Clicked "Add Bot"
- [ ] Copied the bot TOKEN
- [ ] TOKEN is a long string starting with "M..." or similar

## Still Can't Find It?

1. **Try a different browser** - Sometimes Discord portal has issues
2. **Try Chrome or Firefox** - Mobile browsers can be limited
3. **Check Discord status** - Maybe the portal is down temporarily
4. **Refresh the page** - F5 or Cmd+R
5. **Sign out and sign back in** - Clear the session

## Next Steps After Getting Token

Once you have the bot token:

1. Go to **OAuth2** section
2. Add redirect: `http://localhost:3000`
3. **Select** it from dropdown (important!)
4. Select `bot` scope
5. Pick permissions
6. Copy the generated URL
7. Paste bot token into Stream Synth (Step 3 in guide)
8. Click "Start Bot"
9. Then visit the OAuth URL

---

If you're still having trouble finding it, the Discord portal can be confusing. Feel free to:
- Take a screenshot of what you're seeing
- Describe which section you're in
- And I can point you to the exact location!
