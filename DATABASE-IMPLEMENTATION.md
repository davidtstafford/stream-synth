# SQLite State Management Implementation

## ✅ What's Been Implemented

### Database Architecture

**Location:** `~/Library/Application Support/stream-synth/stream-synth.db`  
**Encryption:** OAuth tokens stored in encrypted electron-store  
**Backend:** better-sqlite3 (synchronous, fast, embedded)

### Tables Created

1. **`app_settings`** - Key-value store for app configuration
   - `last_connected_user_id`
   - `last_connected_channel_id`
   - `window_bounds`
   - Any custom settings

2. **`connection_sessions`** - Connection history tracking
   - User ID, username, channel ID, channel name
   - Connection/disconnection timestamps
   - Current session flag (only one active)

3. **`event_subscriptions`** - Event preferences per user/channel
   - Remembers which events were enabled
   - Unique constraint: (user_id, channel_id, event_type)
   - Auto-restore on reconnect

4. **`oauth_tokens`** - Encrypted token storage (electron-store)
   - Access tokens encrypted at rest
   - Not stored in SQLite for security
   - Stored in: `~/Library/Application Support/stream-synth/secure-tokens.json`

### File Structure

```
src/backend/
├── main.ts                           # Initializes database on startup
├── core/
│   ├── ipc-handlers.ts               # 12 new IPC handlers for database
│   └── window.ts
├── database/                         # 🆕 New database layer
│   ├── connection.ts                 # SQLite connection management
│   ├── migrations.ts                 # Schema creation
│   └── repositories/                 # Data access layer
│       ├── settings.ts               # app_settings CRUD
│       ├── sessions.ts               # connection_sessions CRUD
│       ├── events.ts                 # event_subscriptions CRUD
│       └── tokens.ts                 # Encrypted token storage
└── ...

src/frontend/
├── services/
│   ├── database.ts                   # 🆕 Frontend database API wrapper
│   ├── twitch-api.ts
│   └── websocket.ts
```

### Available Frontend APIs

```typescript
import * as db from './services/database';

// Settings
await db.setSetting('theme', 'dark');
const theme = await db.getSetting('theme');

// Sessions
await db.createSession({
  user_id: '123',
  user_login: 'username',
  channel_id: '123',
  channel_login: 'username',
  is_broadcaster: true
});

const currentSession = await db.getCurrentSession();
await db.endCurrentSession();

// Event Subscriptions
await db.saveSubscription(userId, channelId, 'channel.follow', true);
const enabledEvents = await db.getEnabledEvents(userId, channelId);

// OAuth Tokens
await db.saveToken({ userId, accessToken, clientId });
const token = await db.getToken(userId);
await db.deleteToken(userId);
```

## 🎯 Next Steps: Auto-Reconnect Implementation

To complete the auto-reconnect feature, you need to:

### 1. Save State on Connection
In `connection.tsx`, after successful connection:
```typescript
// Save session
await db.createSession({
  user_id: userId,
  user_login: userLogin,
  channel_id: broadcasterId,
  channel_login: broadcasterLogin,
  is_broadcaster: isBroadcaster
});

// Save token
await db.saveToken({
  userId,
  accessToken,
  clientId: TWITCH_CLIENT_ID
});

// Save settings for auto-reconnect
await db.setSetting('last_connected_user_id', userId);
await db.setSetting('last_connected_channel_id', broadcasterId);
```

### 2. Save Event Subscriptions
In `EventSubscriptions.tsx`, when toggling events:
```typescript
const handleEventToggle = async (eventType: string) => {
  const newValue = !subscriptions[eventType];
  
  // ... existing code ...
  
  // Save to database
  await db.saveSubscription(userId, broadcasterId, eventType, newValue);
};
```

### 3. Auto-Reconnect on App Start
In `connection.tsx`, add `useEffect` on mount:
```typescript
useEffect(() => {
  async function autoReconnect() {
    // Check for saved session
    const lastUserId = await db.getSetting('last_connected_user_id');
    if (!lastUserId) return;

    // Try to get saved token
    const savedToken = await db.getToken(lastUserId);
    if (!savedToken || !savedToken.isValid) {
      console.log('No valid token found, showing login');
      return;
    }

    // Validate token with Twitch
    try {
      const response = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Authorization': `Bearer ${savedToken.accessToken}`,
          'Client-Id': savedToken.clientId
        }
      });

      if (!response.ok) {
        console.log('Token expired, clearing saved state');
        await db.deleteToken(lastUserId);
        return;
      }

      const data = await response.json();
      const user = data.data[0];

      // Get saved channel
      const lastChannelId = await db.getSetting('last_connected_channel_id');
      
      // Auto-connect!
      setAccessToken(savedToken.accessToken);
      setUserId(user.id);
      setUserLogin(user.login);
      setBroadcasterId(lastChannelId || user.id);
      // ... etc

      // Restore event subscriptions
      const savedEvents = await db.getEnabledEvents(user.id, lastChannelId);
      // Apply saved events to subscriptions state

    } catch (error) {
      console.error('Auto-reconnect failed:', error);
    }
  }

  autoReconnect();
}, []);
```

### 4. Clear State on Disconnect
```typescript
const handleDisconnected = async () => {
  // End session in database
  await db.endCurrentSession();
  
  // Optionally: keep token for next auto-reconnect
  // OR delete it if you want to force re-login:
  // await db.deleteToken(userId);
  
  // ... existing disconnect code ...
};
```

## 🔐 Security Notes

- ✅ OAuth tokens encrypted via electron-store
- ✅ Database stored in user data folder (sandboxed)
- ✅ Tokens never exported in backups
- ⚠️ Encryption key is hardcoded (for production, generate per-install)

## 📤 Export Feature (Future)

Add export button:
```typescript
const exportData = async () => {
  const settings = await db.getAllSettings();
  const sessions = await db.getRecentSessions(100);
  const subscriptions = await db.getSubscriptions(userId, channelId);
  
  const backup = {
    version: '1.0.0',
    exported_at: new Date().toISOString(),
    settings: settings.filter(s => !s.key.includes('token')),
    sessions,
    event_profiles: subscriptions
  };
  
  // Download as JSON
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  // Trigger download...
};
```

## 🎉 Benefits

✅ **Auto-reconnect** - Users don't have to login every time  
✅ **State persistence** - Event preferences saved per channel  
✅ **Connection history** - Can show "recent channels" dropdown  
✅ **Secure tokens** - Encrypted at rest  
✅ **Future-proof** - Easy to add more tables/features  
✅ **Backup/Export** - Users can save their configuration  

---

**Status:** Database layer complete ✅  
**Next:** Wire up auto-reconnect in frontend components
