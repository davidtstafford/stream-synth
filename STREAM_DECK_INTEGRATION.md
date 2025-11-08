# Stream Deck Integration Guide

## Overview

Stream Synth provides Stream Deck-compatible HTTP API endpoints for controlling TTS (Text-to-Speech) functionality remotely. This allows you to toggle TTS on/off, enable/disable TTS, or check TTS status directly from your Stream Deck device.

**IMPORTANT:** After building the application, you must **restart the app** for the IPC notifications to be properly initialized. This ensures the frontend receives real-time updates when the TTS state is changed via the Stream Deck API.

## Prerequisites

- Stream Synth app running on your computer  
- Browser Source Server enabled (default on startup)
- Network connectivity between Stream Deck and computer (same network or localhost)
- Stream Deck desktop app with custom HTTP action support
- Application restarted after build (required for full functionality)

## Server Information

**Base URL:** `http://localhost:3737`

**Server Port:** 3737 (configurable in app settings)

**Server Dashboard:** Visit `http://localhost:3737` to see server status and available endpoints

## Stream Deck API Endpoints

### Toggle TTS
**Endpoint:** `/api/tts/toggle`

**Method:** GET or POST

**Description:** Toggle TTS between enabled and disabled states

**Example:**
```
http://localhost:3737/api/tts/toggle
```

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "message": "TTS enabled"
}
```

### Enable TTS
**Endpoint:** `/api/tts/enable`

**Method:** GET or POST

**Description:** Enable TTS (if not already enabled)

**Example:**
```
http://localhost:3737/api/tts/enable
```

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "message": "TTS enabled"
}
```

### Disable TTS
**Endpoint:** `/api/tts/disable`

**Method:** GET or POST

**Description:** Disable TTS (if not already disabled)

**Example:**
```
http://localhost:3737/api/tts/disable
```

**Response:**
```json
{
  "success": true,
  "enabled": false,
  "message": "TTS disabled"
}
```

### Get TTS Status
**Endpoint:** `/api/tts/status`

**Method:** GET

**Description:** Get current TTS status and settings

**Example:**
```
http://localhost:3737/api/tts/status
```

**Response:**
```json
{
  "success": true,
  "enabled": true,
  "voiceId": "azure_en_US_GuyNeural",
  "volume": 100,
  "rate": 1.0,
  "pitch": 1.0
}
```

## Stream Deck Configuration

### Adding an HTTP GET Action

1. **Open Stream Deck Desktop App**
2. **Create or Edit a Profile**
3. **Add an Action:** Drag "Open URL" or "Custom HTTP Request" action to your button
   - If your Stream Deck app has a dedicated HTTP action, use that
   - Otherwise, use the generic "Open URL" action
4. **Configure the URL:**
   - For Toggle: `http://localhost:3737/api/tts/toggle`
   - For Enable: `http://localhost:3737/api/tts/enable`
   - For Disable: `http://localhost:3737/api/tts/disable`
5. **Optional:** Set a custom button icon and name
6. **Save and Test**

### Button Icon Suggestions

- **Toggle:** 🔊 (speaker emoji) or 🎙️ (microphone emoji)
- **Enable:** ✓ (checkmark) or 🟢 (green circle)
- **Disable:** ✗ (X mark) or 🔴 (red circle)

## Advanced Configuration

### Using MultiAction with Status Indicator

For a more sophisticated setup:

1. **Create a MultiAction** with:
   - First action: HTTP request to `/api/tts/status` (optional, for status display)
   - Second action: HTTP request to `/api/tts/toggle` (main action)

2. **Set up dynamic icon changes:**
   - Use a custom profile/button template to show different icons based on TTS state
   - Stream Deck Pro supports this via profile switching

### Network Access

If you need to access Stream Synth from a different computer:

1. **Note the computer's IP address:** Example `192.168.1.100`
2. **Replace `localhost` with the IP address:**
   ```
   http://192.168.1.100:3737/api/tts/toggle
   ```

⚠️ **Security Note:** The API has no authentication. Only use this on trusted networks.

## Troubleshooting

### "Connection Failed" or "URL Not Found"

1. **Verify Stream Synth is running**
   - Check System Tray for Stream Synth icon
   - Verify browser source server started (check app logs)

2. **Check port availability**
   - Make sure port 3737 is not blocked by firewall
   - Verify no other app is using port 3737

3. **Test manually**
   - Open browser and visit `http://localhost:3737`
   - Should see the server info page
   - Try accessing `/api/tts/status` directly

### "Connection Refused"

1. **Browser Source Server not started**
   - Restart Stream Synth
   - Check app settings to ensure server auto-start is enabled

2. **Firewall blocking**
   - Add Stream Synth to firewall exceptions
   - On Windows: Settings > Firewall > Allow app through firewall
   - On macOS: System Preferences > Security & Privacy > Firewall > Firewall Options

### TTS Not Toggling

1. **Verify TTS is configured**
   - Open Stream Synth app
   - Go to TTS - Voice Settings
   - Verify a voice provider is enabled (Web Speech, Azure, or Google)

2. **Check database permissions**
   - Ensure Stream Synth has write access to its database
   - Re-launch app with admin privileges if needed

3. **View app logs**
   - Check browser console (F12) for errors
   - Look for `[BrowserSourceServer]` entries in logs

## Examples

### Stream Deck Button Setup Example

**Button Name:** "Toggle TTS"
**Button Icon:** 🎙️
**Action:** HTTP GET Request
**URL:** `http://localhost:3737/api/tts/toggle`
**Short Press:** Toggle TTS on/off
**Long Press (optional):** Show status popup

### Keyboard Shortcut as Alternative

If using Stream Deck software on keyboard:
```
Alt + T → Toggle TTS
Alt + E → Enable TTS
Alt + D → Disable TTS
```

Map these shortcuts to the API endpoints through Stream Deck's macro feature.

## API Response Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad Request (missing parameters) |
| 500 | Server Error (check logs) |

## Debugging

### Enable verbose logging (optional)

1. Open Stream Synth
2. Developer Tools (F12 or Ctrl+Shift+I)
3. Filter console for `[BrowserSourceServer]` messages
4. Check log output when making API requests

### Test with curl

```bash
# Toggle TTS
curl http://localhost:3737/api/tts/toggle

# Get status
curl http://localhost:3737/api/tts/status

# Enable TTS
curl http://localhost:3737/api/tts/enable

# Disable TTS
curl http://localhost:3737/api/tts/disable
```

## Limitations

- API has **no authentication** - only use on trusted networks
- Changes made via API **are persisted** to the database
- Other connected clients (browser sources, viewers) **will not be notified** immediately of state changes
- Maximum connection limit: Same as browser source server limit

## Future Enhancements

Potential additions for future releases:
- API authentication/tokens
- Webhook support for status notifications
- Advanced TTS control (change voice, volume, rate, pitch)
- Batch API operations
- Request rate limiting
- CORS configuration

## Support

For issues or feature requests:
1. Check this guide first
2. Review app logs in Developer Tools
3. Ensure all prerequisites are met
4. Test manually via curl or browser
5. Report issues with detailed logs and screenshots

---

**Last Updated:** November 2024
**Stream Synth Version:** 1.0.0+
