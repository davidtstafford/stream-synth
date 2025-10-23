# IRC Integration for Stream Synth

## Overview

This app uses a **hybrid approach** to Twitch event monitoring:

- **EventSub WebSocket** (Primary): 52 events including follows, subs, raids, channel points, polls, etc.
- **IRC/TMI** (Secondary): JOIN/PART events + chat message sending

## Why Both?

| Feature | EventSub | IRC |
|---------|----------|-----|
| Chat messages | ✅ | ✅ |
| Subscriptions | ✅ | ✅ |
| Raids | ✅ | ✅ |
| **JOIN events** | ❌ | ✅ |
| **PART events** | ❌ | ✅ |
| **Send messages** | ❌ | ✅ |
| Channel points | ✅ | ❌ |
| Follows | ✅ | ❌ |
| Polls/Predictions | ✅ | ❌ |

We use **EventSub for everything except JOIN/PART/Sending** to avoid duplicate events and get better data quality.

## Architecture

### Backend Services

#### `src/backend/services/twitch-irc.ts`
- Handles IRC connection via tmi.js
- Listens only to JOIN and PART events
- Provides `sendMessage()` for bot functionality
- Singleton instance: `twitchIRCService`

#### Event Flow
```
IRC Server (irc-ws.chat.twitch.tv)
    ↓
TwitchIRCService (backend)
    ↓
IPC Events (main → renderer)
    ↓
Frontend listeners (onChatJoin, onChatPart)
```

### IPC Handlers

Located in `src/backend/core/ipc-handlers.ts`:

- `irc:connect` - Connect to IRC
- `irc:disconnect` - Disconnect from IRC
- `irc:send-message` - Send chat message
- `irc:get-status` - Get connection status
- `irc:join-channel` - Join additional channel
- `irc:leave-channel` - Leave a channel

Events sent to renderer:
- `irc:chat-join` - User joined chat
- `irc:chat-part` - User left chat
- `irc:status` - Connection status changed

### Frontend API

Located in `src/frontend/services/irc-api.ts`:

**Connection:**
```typescript
import { connectIRC, disconnectIRC } from '../services/irc-api';

// Connect (usually after EventSub connects)
await connectIRC(username, accessToken);

// Disconnect
await disconnectIRC();
```

**Sending Messages:**
```typescript
import { sendChatMessage } from '../services/irc-api';

// Send to current channel
await sendChatMessage('Hello chat!');

// Send to specific channel
await sendChatMessage('Hello!', 'channelname');
```

**Listening to Events:**
```typescript
import { onChatJoin, onChatPart } from '../services/irc-api';

// Listen for users joining
const cleanupJoin = onChatJoin((event) => {
  console.log(`${event.username} joined #${event.channel}`);
});

// Listen for users leaving
const cleanupPart = onChatPart((event) => {
  console.log(`${event.username} left #${event.channel}`);
});

// Cleanup when component unmounts
useEffect(() => {
  return () => {
    cleanupJoin();
    cleanupPart();
  };
}, []);
```

## Implementation Status

✅ **Completed:**
- IRC service with JOIN/PART event handling
- IPC handlers for IRC communication
- Frontend API wrappers
- Send chat message scaffolding
- CSP updated for IRC WebSocket
- TypeScript types
- Error handling

⏳ **TODO (Future):**
- Connect IRC when EventSub connects
- Display JOIN/PART events in UI
- Chat send UI component
- Store IRC status in database
- Reconnection logic
- Rate limiting for message sending

## Usage Example

```typescript
// In your connection screen component

import { connectIRC, onChatJoin, onChatPart, sendChatMessage } from '../services/irc-api';

function ConnectionScreen() {
  useEffect(() => {
    // After EventSub connects successfully...
    if (connected && userInfo) {
      // Also connect to IRC
      connectIRC(userInfo.login, accessToken);
    }
  }, [connected, userInfo, accessToken]);

  useEffect(() => {
    // Listen for JOIN/PART events
    const cleanupJoin = onChatJoin((event) => {
      console.log('User joined:', event.username);
      // Update viewer list, show notification, etc.
    });

    const cleanupPart = onChatPart((event) => {
      console.log('User left:', event.username);
      // Update viewer list
    });

    return () => {
      cleanupJoin();
      cleanupPart();
    };
  }, []);

  return (
    <div>
      {/* Your connection UI */}
      <button onClick={() => sendChatMessage('!hello')}>
        Send Test Message
      </button>
    </div>
  );
}
```

## Security

- IRC uses the same OAuth token as EventSub
- Token is passed from frontend to backend via secure IPC
- CSP allows `wss://irc-ws.chat.twitch.tv`
- No token storage in IRC service (uses token from database)

## Dependencies

- `tmi.js` - Official Twitch IRC library
- `@types/tmi.js` - TypeScript definitions

## Notes

- IRC connection is **secondary** to EventSub
- We deliberately avoid duplicate events by not listening to messages/subs/raids on IRC
- JOIN/PART events can be high volume on popular streams
- Message sending has rate limits (20 messages per 30 seconds for regular users)
