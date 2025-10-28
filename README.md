# Stream Synth

A comprehensive Electron-based desktop application for Twitch streaming integration with support for real-time event handling, text-to-speech announcements, Discord webhooks, IRC chat, and viewer subscription tracking.

## 🎯 Overview

Stream Synth provides streamers with a centralized hub to manage Twitch events, automate TTS announcements, sync Discord channels, and track viewer subscriptions—all through a modern, typed architecture built on **Electron**, **TypeScript**, and **React**.

### Core Features

- **Twitch Integration**: OAuth authentication, EventSub WebSocket real-time events, subscription syncing
- **Text-to-Speech (TTS)**: Multi-provider support (Azure, Google) with voice customization per viewer
- **Discord Integration**: Webhook-based voice catalogue publishing and auto-updates
- **IRC Chat**: Real-time chat monitoring and message sending via tmi.js
- **Event Subscriptions**: Granular control over which Twitch events trigger actions
- **Viewer Management**: Track subscribers, subscriptions, and custom TTS voice preferences
- **Settings Management**: Export/import configuration, backup and restore functionality
- **Database-Backed**: SQLite with structured repositories for all data

---

## 🏗️ Architecture

### High-Level Design

```
┌─────────────────────────────────────────────────────────┐
│                   ELECTRON MAIN PROCESS                 │
│                   (src/backend/main.ts)                 │
│  • Manages windows, IPC, database, event handlers      │
│  • Runs TTS engine, IRC connection, EventSub listener  │
└────────────────────┬────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         │           │           │
    ┌────▼────┐  ┌──▼────┐  ┌──▼────────┐
    │   IPC   │  │ Files │  │ Database  │
    │Framework│  │System │  │ (SQLite)  │
    └────┬────┘  └───────┘  └───┬──────┘
         │                       │
    ┌────▼────────────────────────▼───┐
    │  IPC Handlers (71 handlers)     │
    │  • Database (30)                │
    │  • TTS (20)                     │
    │  • Twitch (6)                   │
    │  • IRC (6)                      │
    │  • Discord (5)                  │
    │  • Other (4)                    │
    └────┬─────────────────────────────┘
         │
    ┌────▼─────────────────────────────┐
    │   RENDERER PROCESS (React)       │
    │   (src/frontend/app.tsx)         │
    │                                  │
    │  • Connection (Twitch Auth)      │
    │  • Event Subscriptions           │
    │  • Chat Management               │
    │  • TTS Configuration             │
    │  • Discord Webhooks              │
    │  • Viewers & Subscriptions       │
    │  • Advanced Settings             │
    └──────────────────────────────────┘
```

### Backend Structure

```
src/backend/
├── main.ts                          # Electron entry point
├── auth/
│   └── twitch-oauth.ts              # OAuth browser window handling
├── core/
│   ├── ipc-handlers.ts              # Legacy handler setup
│   ├── ipc/
│   │   └── ipc-framework.ts         # Centralized IPC framework
│   └── ipc-handlers/
│       ├── database.ts              # Database operations (30 handlers)
│       ├── tts.ts                   # Text-to-speech (20 handlers)
│       ├── twitch.ts                # Twitch integration (6 handlers)
│       ├── irc.ts                   # IRC chat (6 handlers)
│       ├── discord.ts               # Discord webhooks (5 handlers)
│       └── index.ts                 # Handler initialization
├── database/
│   ├── connection.ts                # SQLite connection & init
│   ├── migrations.ts                # Schema initialization
│   ├── base-repository.ts           # Base repository class
│   └── repositories/
│       ├── settings.ts              # App settings
│       ├── sessions.ts              # Connection sessions
│       ├── tokens.ts                # OAuth tokens
│       ├── viewers.ts               # Viewer data
│       ├── subscriptions.ts         # Subscription tracking
│       ├── events.ts                # Event history
│       ├── voices.ts                # TTS voice cache
│       └── tts.ts                   # TTS provider settings
├── services/
│   ├── export-import.ts             # Settings backup/restore
│   ├── twitch-subscriptions.ts      # Sync subscriptions from Twitch
│   ├── twitch-irc.ts                # IRC management via tmi.js
│   └── tts/
│       ├── manager.ts               # TTS orchestration
│       ├── base.ts                  # Provider interface
│       ├── azure-provider.ts        # Azure Cognitive Services
│       ├── google-provider.ts       # Google Cloud TTS
│       ├── language-service.ts      # Language detection & mapping
│       └── voice-id-generator.ts    # Consistent voice IDs
└── security/
    └── csp.ts                       # Content Security Policy
```

### Frontend Structure

```
src/frontend/
├── app.tsx                          # Main React app
├── index.html                       # HTML template
├── components/
│   ├── Menu.tsx                     # Navigation menu
│   ├── Connection.tsx               # Twitch OAuth flow
│   ├── EventSubscriptions.tsx       # Event subscription UI
│   ├── ExportImport.tsx             # Settings backup UI
│   ├── AzureSetupWizard.tsx         # TTS setup
│   └── ChannelSelector.tsx          # Channel selection
├── screens/
│   ├── connection/                  # Twitch connection & status
│   ├── events/                      # Event subscription management
│   ├── chat/                        # IRC chat viewer
│   ├── tts/                         # TTS settings & configuration
│   ├── discord/                     # Discord webhook setup
│   ├── viewers/                     # Viewer management & preferences
│   └── advanced/                    # Export/import, settings
├── services/
│   ├── database.ts                  # IPC wrapper for database ops
│   ├── tts.ts                       # IPC wrapper for TTS ops
│   ├── twitch-api.ts                # IPC wrapper for Twitch ops
│   ├── irc-api.ts                   # IPC wrapper for IRC ops
│   ├── ipc-client.ts                # Generic IPC client
│   └── websocket.ts                 # WebSocket management
└── config/
    └── event-types.ts               # Twitch EventSub event definitions
```

---

## 🔧 IPC Framework (Centralized Handler Pattern)

The application uses a **centralized IPC framework** to eliminate boilerplate and provide consistent error handling across all 71 handlers.

### Framework Architecture

```typescript
// Backend Registration Pattern
ipcRegistry.register<InputType, OutputType>(
  'channel-name',
  {
    // Optional: Validate input
    validate: (input) => {
      if (!input.required_field) return 'Field is required';
      return null; // null = valid
    },
    
    // Required: Execute handler
    execute: async (input) => {
      // Your logic here
      return result;
    },
    
    // Optional: Transform output before sending
    transform: (output) => ({
      ...output,
      transformed: true
    })
  }
);
```

### Response Format

All IPC handlers return a **unified response format**:

```typescript
interface IPCResponse<T> {
  success: boolean;      // true if successful, false on error
  data?: T;              // The actual data (only if success=true)
  error?: string;        // Error message (only if success=false)
}
```

### Frontend Usage Pattern

```typescript
// Call IPC handler
const response = await ipcRenderer.invoke('channel-name', inputData);

// Handle unified response
if (response.success) {
  const data = response.data; // Typed data
  // Use data
} else {
  console.error('Error:', response.error);
}
```

### Key Benefits

✅ **No boilerplate**: No manual error wrapping or try-catch blocks in handlers  
✅ **Consistent errors**: All errors logged the same way  
✅ **Type safety**: Full TypeScript support for input/output  
✅ **Input validation**: Optional validator runs before execute  
✅ **Output transformation**: Optional transform runs after execute  
✅ **Future-proof**: Adding handlers follows the same pattern  

---

## 📝 Handler Categories

### Database Handlers (30)
Located in `src/backend/core/ipc-handlers/database.ts`

**Settings**: `db:get-setting`, `db:set-setting`, `db:get-all-settings`  
**Sessions**: `db:create-session`, `db:get-current-session`, `db:end-current-session`, `db:get-recent-sessions`  
**Voices**: `db:get-voice`, `db:set-voice`, `db:get-all-voices`, `db:get-grouped-voices`  
**Events**: `db:store-event`, `db:get-events`, `db:get-event-count`, `db:delete-event`  
**Viewers**: `db:get-viewer`, `db:get-all-viewers`, `db:search-viewers`, `db:create-viewer`, `db:delete-viewer`  
**Subscriptions**: `db:get-subscription`, `db:save-subscription`, `db:delete-subscription`, `db:get-all-viewers-with-status`  
**Tokens**: `db:save-token`, `db:get-token`, `db:invalidate-token`, `db:delete-token`  

### TTS Handlers (20)
Located in `src/backend/core/ipc-handlers/tts.ts`

**Core**: `tts:speak`, `tts:stop`, `tts:test-voice`  
**Sync**: `tts:sync-voices`, `provider:rescan-immediate`, `provider:check-sync-needed`  
**Settings**: `tts:get-settings`, `tts:save-settings`, `tts:get-grouped-voices`  
**Metadata**: `tts:get-voices`, `tts:get-voice-by-id`, `tts:get-voice-stats`, `tts:get-providers`  

### Twitch Handlers (6)
Located in `src/backend/core/ipc-handlers/twitch.ts`

`twitch-oauth`, `connect-websocket`, `export-settings`, `import-settings`, `get-export-preview`, `twitch:sync-subscriptions-from-twitch`

### IRC Handlers (6)
Located in `src/backend/core/ipc-handlers/irc.ts`

`irc:connect`, `irc:disconnect`, `irc:send-message`, `irc:join-channel`, `irc:leave-channel`, `irc:get-status`

### Discord Handlers (5)
Located in `src/backend/core/ipc-handlers/discord.ts`

`discord:test-webhook`, `discord:generate-voice-catalogue`, `discord:post-voice-catalogue`, `discord:delete-webhook-messages`, `discord:auto-update-catalogue`

---

## 🚀 Development Guide

### Getting Started

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Build the application**:
   ```bash
   npm run build
   ```

3. **Run in development mode**:
   ```bash
   npm run dev
   ```

### Adding a New IPC Handler

Example: Adding a new Discord handler to post an embed.

**Step 1**: Add handler registration in `src/backend/core/ipc-handlers/discord.ts`

```typescript
ipcRegistry.register<{ content: string }, { success: boolean }>(
  'discord:post-embed',
  {
    validate: (input) => {
      if (!input.content) return 'Content is required';
      return null;
    },
    execute: async (input) => {
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: input.content })
      });
      
      if (!response.ok) {
        throw new Error(`Discord API error: ${response.status}`);
      }
      
      return true; // Framework wraps as { success: true, data: true }
    }
  }
);
```

**Step 2**: Add frontend service wrapper in `src/frontend/services/discord.ts` (if needed)

```typescript
export async function postEmbed(content: string): Promise<{ success: boolean; error?: string }> {
  const response = await ipcRenderer.invoke('discord:post-embed', { content });
  
  if (response.success) {
    return { success: true };
  }
  return { success: false, error: response.error };
}
```

**Step 3**: Use in React component

```typescript
const handlePostEmbed = async () => {
  const result = await discordService.postEmbed('Hello Discord!');
  if (result.success) {
    setMessage({ type: 'success', text: 'Posted!' });
  } else {
    setMessage({ type: 'error', text: result.error });
  }
};
```

### Key Development Patterns

#### Pattern 1: Simple Handler (No Manual Wrapping)
```typescript
ipcRegistry.register<string, string>(
  'my-handler',
  {
    execute: async (input) => {
      return input.toUpperCase(); // Return raw data
    }
  }
);
```
Frontend receives: `{ success: true, data: "HELLO" }`

#### Pattern 2: Handler with Validation
```typescript
ipcRegistry.register<{ userId: string }, any>(
  'get-user',
  {
    validate: (input) => input.userId ? null : 'User ID required',
    execute: async (input) => {
      return await userRepo.getById(input.userId);
    }
  }
);
```

#### Pattern 3: Handler with Transformation
```typescript
ipcRegistry.register<void, any[]>(
  'get-users',
  {
    execute: async () => await userRepo.getAll(),
    transform: (users) => ({
      count: users.length,
      users: users
    })
  }
);
```
Frontend receives: `{ success: true, data: { count: 5, users: [...] } }`

### Frontend Service Wrapper Pattern

Always create service wrappers that:
1. Call the IPC handler
2. Extract data from `response.data`
3. Return normalized response format

```typescript
export async function myOperation(input: any): Promise<{ success: boolean; result?: any; error?: string }> {
  const response = await ipcRenderer.invoke('my-handler', input);
  
  if (response.success && response.data) {
    return { success: true, result: response.data };
  }
  return { success: false, error: response.error };
}
```

### Building & Running

```bash
# Build only (compile TypeScript)
npm run build

# Development mode (build + watch + run)
npm run dev

# Package as standalone executable
npm run package
```

---

## 🔐 Getting a Twitch Client ID

1. Go to https://dev.twitch.tv/console/apps
2. Register a new application
3. Set the **OAuth Redirect URL** to `http://localhost:3300/auth/twitch/callback`
4. Copy your **Client ID**
5. Use it in the Connection screen

---

## 🗄️ Database Structure

The application uses **SQLite** with the following tables:

- **app_settings**: Application configuration
- **tts_settings**: TTS provider settings
- **voices**: TTS voice cache
- **viewers**: User/streamer data
- **subscriptions**: Subscription tracking
- **event_subscriptions**: User's event preferences
- **connection_sessions**: OAuth and connection history
- **oauth_tokens**: Twitch tokens (encrypted)
- **events**: Event history for chat and events

---

## 🎯 Technologies

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Desktop** | Electron 22+ | Desktop app framework |
| **Language** | TypeScript 5+ | Type-safe development |
| **UI Framework** | React 18+ | Component-based UI |
| **Bundler** | Webpack 5+ | Module bundling |
| **Database** | SQLite 3+ | Persistent storage |
| **Twitch API** | EventSub, OAuth 2.0 | Real-time events |
| **TTS** | Azure Cognitive Services, Google Cloud TTS | Speech synthesis |
| **IRC** | tmi.js | Twitch chat |
| **Discord** | Webhooks | Channel notifications |

---

## 📊 Current Status

**Phase 3 Complete**: ✅ All 71 IPC handlers migrated to centralized framework  
**Build**: ✅ Passing (0 errors)  
**Coverage**: ✅ Database, TTS, Twitch, IRC, Discord operations  
**Code Quality**: ✅ 100% TypeScript, zero boilerplate IPC code  

---

## 🐛 Troubleshooting

### Black screen when loading preview?
This usually means invalid data is being rendered. Ensure objects are properly unwrapped from `response.data` in frontend services.

### IPC handler not responding?
Check that:
1. Handler is registered in the appropriate file (database.ts, tts.ts, etc.)
2. `setupXxxHandlers()` is called in `src/backend/core/ipc-handlers.ts`
3. Handler returns proper type (not wrapped in extra object)

### Double-wrapping response errors?
The IPC Framework automatically wraps returns in `{ success, data }`. Don't manually wrap—return raw data instead.

---

## 📚 Further Reading

- **IPC Framework Details**: See `src/backend/core/ipc/ipc-framework.ts`
- **Handler Examples**: See `src/backend/core/ipc-handlers/*.ts`
