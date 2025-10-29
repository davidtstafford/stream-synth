# TTS Access Control - Quick Start Guide

## 🎯 What is TTS Access Control?

Control **who can use Text-to-Speech** in your Twitch chat with three powerful modes.

---

## 🎚️ Three Access Modes

### 1️⃣ **Access to All** (Default)
**Everyone can use TTS with any voice - no restrictions.**

✅ Use when: You want all viewers to have full TTS access  
✅ Best for: Growing channels, community engagement

---

### 2️⃣ **Limited Access**
**Only specific viewers can use TTS at all. Others are completely blocked.**

**Who Can Use TTS:**
- ✅ Subscribers (always enabled)
- ✅ VIPs (optional - you choose)
- ✅ Moderators (optional - you choose)
- ✅ Channel Point Redeem users (temporary access)

**Options:**
- 🎁 **Deny Gifted Subscribers** - Block users with gifted subs
- 🎟️ **Channel Point Redeem** - Give temporary access via Channel Points

✅ Use when: You want TTS as a subscriber/VIP perk  
✅ Best for: Established channels, reducing spam

**Setup Example:**
```
Mode: Limited Access
✓ Allow Subscribers (required)
✓ Allow VIPs
✗ Deny Gifted Subscribers
✓ Channel Point Redeem: "TTS Access Trial" (30 minutes)
```

---

### 3️⃣ **Premium Voice Access**
**Everyone can use TTS, but only specific viewers get premium voices (Azure/Google).**

**Who Gets Premium Voices:**
- ✅ Subscribers
- ✅ VIPs (optional)
- ✅ Moderators (optional)
- ✅ Channel Point Redeem users (temporary)

**Everyone Else:**
- Gets free WebSpeech voices only

**⚠️ Important:** Your global voice must be set to WebSpeech (not Azure/Google)

✅ Use when: You want to reward subscribers with better voice quality  
✅ Best for: Cost control while offering premium perks

**Setup Example:**
```
Mode: Premium Voice Access
Global Voice: Microsoft David (WebSpeech)
✓ Allow Subscribers (premium voices)
✓ Allow VIPs (premium voices)
Non-subscribers: WebSpeech voices only
```

---

## 🎟️ Channel Point Redeems

### What Are They?
Give viewers **temporary TTS access** by redeeming Channel Points.

### How to Set Up

1. Go to **TTS Access** tab
2. Choose **Limited Access** or **Premium Voice Access**
3. Scroll to **Channel Point Redeem Access**
4. Enter your redeem name (e.g., "TTS Trial")
5. Set duration with slider (1-60 minutes)
6. Check "Enable Channel Point Redeem Access"

**Example Configuration:**
```
Redeem Name: "30 Minute TTS Pass"
Duration: 30 minutes
✓ Enable Channel Point Redeem Access
```

### On Twitch
1. Create a Channel Point Reward with the same name
2. Set cost (e.g., 5,000 points)
3. When viewer redeems → Gets TTS access for 30 minutes
4. Access expires automatically

---

## 🔄 Automatic Role Syncing

### What Gets Synced?
- 👑 Subscribers
- ⭐ VIPs  
- 🛡️ Moderators

### When Does It Sync?
- ✅ When app starts
- ✅ After you connect to Twitch
- ✅ Every 30 minutes (automatically)
- ✅ When you click "Sync Viewer Roles"

### Why It Matters
Your TTS access rules automatically update when viewer roles change on Twitch!

---

## 🎙️ Premium Voice Mutual Exclusion

### The Rule
You **cannot** have both:
1. A premium voice (Azure/Google) as your global voice
2. "Premium Voice Access" mode enabled

### Why?
In Premium Voice Access mode, non-eligible viewers need a WebSpeech fallback voice.

### What Happens?
- Trying to enable Premium Voice Access with Azure/Google voice → ❌ Blocked
- Trying to select Azure/Google voice in Premium mode → ❌ Blocked

### Error Message
> "A premium voice is currently set. Pick a Web Speech voice in Voice Settings first."

or

> "Premium Voice Access mode is currently enabled. Remove the Premium Voice Access setting in the TTS Access tab first."

### How to Fix
**Option 1:** Switch global voice to WebSpeech → Then enable Premium Voice Access  
**Option 2:** Disable Premium Voice Access → Then select premium voice

---

## 📋 Quick Reference Table

| Feature | Access to All | Limited Access | Premium Voice Access |
|---------|---------------|----------------|---------------------|
| **Who can use TTS** | Everyone | Subs/VIPs/Mods only | Everyone |
| **Voice quality** | All voices | All voices | WebSpeech (default)<br>Premium (eligible) |
| **Best for** | Open access | Subscriber perk | Cost control |
| **Channel Points** | N/A | Temp full access | Temp premium access |
| **Global voice** | Any | Any | WebSpeech only |

---

## 🛠️ Common Setups

### Setup 1: Open Access
**Goal:** Everyone can use TTS
```
Mode: Access to All
Global Voice: Any voice you like
```

### Setup 2: Subscriber Perk
**Goal:** Only subs/VIPs can use TTS
```
Mode: Limited Access
✓ Allow Subscribers
✓ Allow VIPs
✗ Deny Gifted Subscribers
Channel Point Redeem: "TTS Trial" (15 minutes)
```

### Setup 3: Premium Reward
**Goal:** Subs get better voices
```
Mode: Premium Voice Access
Global Voice: Microsoft David (WebSpeech)
✓ Allow Subscribers (get Azure/Google)
✓ Allow VIPs (get Azure/Google)
Everyone else: WebSpeech only
```

### Setup 4: Strict Control
**Goal:** Subs only, no gifted
```
Mode: Limited Access
✓ Allow Subscribers
✗ Deny Gifted Subscribers
✗ Allow VIPs
✗ Allow Moderators
```

---

## ❓ FAQ

### Q: Can I test voices before choosing?
**A:** Yes! Go to **Voice Settings** → Select voice → Enter test message → Click "Test Voice"

### Q: How do I know if a viewer has access?
**A:** Go to **Viewers** tab → Find viewer → Check their role status

### Q: Can I override rules for specific viewers?
**A:** Yes! Go to **Viewer Rules** tab → Find viewer → Set custom voice or enable/disable

### Q: What if I want mods to always have access?
**A:** In Limited or Premium mode, check "Allow Moderators"

### Q: Do Channel Point redeems work automatically?
**A:** Yes! As long as the redeem name matches and EventSub is connected

### Q: Can I use multiple Channel Point redeems?
**A:** Not yet - only one redeem configuration per mode

### Q: What happens when access expires?
**A:** Viewer automatically loses TTS access (or premium voices)

---

## 🎯 Pro Tips

💡 **Start with "Access to All"** to test your setup  
💡 **Use Premium Voice Access** to control costs on premium providers  
💡 **Set reasonable Channel Point costs** (5,000-10,000 points)  
💡 **Check "Sync Viewer Roles"** after big events (sub trains, raids)  
💡 **Override rules per viewer** for special cases (regulars, friends)  
💡 **Test your configuration** before going live  

---

## 🚨 Troubleshooting

### "Error: Cannot enable Premium Voice Access"
**Solution:** Go to Voice Settings → Select a WebSpeech voice → Try again

### "My subscriber lost TTS access"
**Solution:** Click "Sync Viewer Roles" button to update from Twitch

### "Channel Point redeem not working"
**Solution:** Make sure:
1. Redeem name matches exactly (case-sensitive)
2. EventSub is connected
3. You enabled the checkbox

### "TTS not working for anyone"
**Solution:** Check:
1. TTS is enabled (Voice Settings tab)
2. Access mode is configured correctly
3. At least one voice is selected

---

## 📞 Need Help?

1. Check error messages (they tell you exactly what to fix)
2. Review this guide
3. Check the main README.md for technical details
4. Verify your Twitch connection is active

---

**Happy Streaming! 🎉**
