# Stream Synth

A comprehensive Electron-based desktop application for Twitch streaming integration with support for real-time event handling, text-to-speech announcements, Discord webhooks, IRC chat, and viewer subscription tracking.

## 🎯 Overview

Stream Synth provides streamers with a centralized hub to manage Twitch events, automate TTS announcements, sync Discord channels, and track viewer subscriptions—all through a modern, typed architecture built on **Electron**, **TypeScript**, and **React**.

### Core Features

- **Twitch Integration**: OAuth authentication, EventSub WebSocket real-time events, automatic role syncing (Subscribers, VIPs, Moderators)
- **Text-to-Speech (TTS)**: Multi-provider support (WebSpeech, Azure, Google) with voice customization per viewer
- **TTS Access Control**: Three-tier access system (All Access, Limited Access, Premium Voice Access)
- **Channel Point Redeems**: Temporary TTS access via Channel Point redemptions with configurable duration
- **Discord Integration**: Webhook-based voice catalogue publishing and auto-updates
- **IRC Chat**: Real-time chat monitoring and message sending via tmi.js
- **Event Subscriptions**: Granular control over which Twitch events trigger actions
- **Viewer Management**: Track subscribers, VIPs, moderators, and custom TTS voice preferences
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
         │                       │    ┌────▼────────────────────────▼───┐    │  IPC Handlers (85+ handlers)    │
    │  • Database (30)                │
    │  • TTS (20)                     │
    │  • TTS Access (4)               │
    │  • Twitch Polling (5)           │
    │  • Twitch (8)                   │
    │  • IRC (6)                      │
    │  • Discord (5)                  │
    │  • Startup (2)                  │
    │  • Other (5)                    │
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
│       ├── tts-access.ts            # TTS access control (4 handlers)
│       ├── twitch-polling.ts        # Twitch API polling config (5 handlers)
│       ├── twitch.ts                # Twitch integration (8 handlers)
│       ├── irc.ts                   # IRC chat (6 handlers)
│       ├── discord.ts               # Discord webhooks (5 handlers)
│       ├── startup.ts               # Startup operations (2 handlers)
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
│       ├── viewer-roles.ts          # Viewer role tracking (VIP, Mod, Sub)
│       ├── viewer-rules.ts          # Per-viewer TTS overrides
│       ├── subscriptions.ts         # Subscription tracking
│       ├── events.ts                # Event history
│       ├── voices.ts                # TTS voice cache
│       ├── tts.ts                   # TTS provider settings
│       ├── tts-access.ts            # TTS access control configuration
│       ├── channel-point-grants.ts  # Channel point redemption tracking
│       └── twitch-polling-config.ts # Twitch API polling intervals
├── services/
│   ├── export-import.ts             # Settings backup/restore
│   ├── twitch-subscriptions.ts      # Sync subscriptions from Twitch
│   ├── twitch-vip.ts                # Sync VIPs from Twitch
│   ├── twitch-moderators.ts         # Sync moderators from Twitch
│   ├── twitch-role-sync.ts          # Centralized role sync service
│   ├── dynamic-polling-manager.ts   # Dynamic API polling manager
│   ├── twitch-irc.ts                # IRC management via tmi.js
│   ├── tts-access-control.ts        # TTS access rule evaluation
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
│   ├── twitch-polling.ts            # IPC wrapper for polling config
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

### Twitch Handlers (8)
Located in `src/backend/core/ipc-handlers/twitch.ts`

`twitch-oauth`, `connect-websocket`, `export-settings`, `import-settings`, `get-export-preview`, `twitch:sync-subscriptions-from-twitch`, `twitch:sync-vips`, `twitch:sync-moderators`

### IRC Handlers (6)
Located in `src/backend/core/ipc-handlers/irc.ts`

`irc:connect`, `irc:disconnect`, `irc:send-message`, `irc:join-channel`, `irc:leave-channel`, `irc:get-status`

### Discord Handlers (5)
Located in `src/backend/core/ipc-handlers/discord.ts`

`discord:test-webhook`, `discord:generate-voice-catalogue`, `discord:post-voice-catalogue`, `discord:delete-webhook-messages`, `discord:auto-update-catalogue`

### TTS Access Handlers (4)
Located in `src/backend/core/ipc-handlers/tts-access.ts`

`tts-access:get-config`, `tts-access:save-config`, `tts-access:reset-config`, `tts-access:check-viewer-access`

### Startup Handlers (2)
Located in `src/backend/core/ipc-handlers/startup.ts`

`startup:sync-roles`, `periodic-sync:start`

---

## 🎛️ TTS Access Control System

Stream Synth includes a sophisticated **three-tier access control system** for Text-to-Speech with automatic role syncing.

### Access Modes

#### 1. **Access to All** (Default)
Everyone can use TTS with any voice - no restrictions.

#### 2. **Limited Access**
Only specific viewers can use TTS at all. Non-eligible viewers are completely blocked.

**Eligible Users:**
- ✅ Subscribers (required, cannot be disabled)
- ✅ VIPs (optional)
- ✅ Moderators (optional)
- ✅ Channel Point Redeem Users (temporary access with configurable duration)

**Configuration:**
- Option to deny gifted subscribers
- Channel Point Redeem: Custom redeem name + duration (1-60 minutes)

#### 3. **Premium Voice Access**
Everyone can use TTS, but only specific viewers can use premium voices (Azure/Google). Non-eligible viewers fall back to WebSpeech voices.

**Eligible for Premium Voices:**
- ✅ Subscribers
- ✅ VIPs (optional)
- ✅ Moderators (optional)
- ✅ Channel Point Redeem Users (temporary access)

**Requirements:**
- Global voice must be set to WebSpeech (enforced via mutual exclusion)
- Azure/Google voices reserved for eligible users only

### Automatic Role Syncing

Viewer roles (Subscribers, VIPs, Moderators) are automatically synced from Twitch Helix APIs:
- ✅ **On Startup** - When app launches
- ✅ **On OAuth Connection** - After successful authentication
- ✅ **Periodic Background Sync** - Configurable interval (default: every 30 minutes)
- ✅ **Manual Sync** - Via "Sync Viewer Roles" button

**Implementation:** Centralized `twitch-role-sync.ts` service with parallel API execution for 3x speed improvement.

**Customization:** Configure sync frequency in **Advanced Settings** (5-120 minutes, default: 30 minutes).

### Dynamic Polling Framework

Stream Synth includes a **flexible polling framework** for managing Twitch Helix API request intervals. Users can customize how often the app syncs data from Twitch.

**Features:**
- 🎚️ **Configurable Intervals** - Adjust polling frequency from 5 to 120 minutes
- ⚡ **Dynamic Updates** - Changes take effect immediately without app restart
- 🔘 **Enable/Disable Toggle** - Turn polling on/off per API type
- 📊 **Real-Time Status** - See which pollers are active and when they last ran
- 🔮 **Future-Proof** - Easily extensible for new API endpoints

**Available in:** Advanced Settings → Twitch API Polling Settings

**Current API Types:**
- `role_sync` - Combined sync for Subscribers, VIPs, and Moderators (active)

### Premium Voice Mutual Exclusion

To prevent invalid configurations, the system enforces mutual exclusion:

**Rule 1:** Cannot select "Premium Voice Access" mode if a premium voice (Azure/Google) is currently selected as global voice.

**Rule 2:** Cannot select a premium voice (Azure/Google) as global voice if "Premium Voice Access" mode is enabled.

**User Flow:**
- Error messages display for 8 seconds with dismiss button
- Clear instructions on which setting to change
- Validation happens in both Voice Settings and TTS Access tabs

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
- **tts_access_config**: TTS access control configuration (Limited/Premium modes)
- **voices**: TTS voice cache (WebSpeech, Azure, Google)
- **viewers**: User/streamer data
- **viewer_roles**: Viewer role tracking (Subscriber, VIP, Moderator status)
- **viewer_rules**: Per-viewer TTS overrides (custom voices, enabled/disabled)
- **subscriptions**: Subscription tracking
- **channel_point_grants**: Temporary TTS access via Channel Point redemptions
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
| **TTS** | WebSpeech API, Azure Cognitive Services, Google Cloud TTS | Speech synthesis |
| **IRC** | tmi.js | Twitch chat |
| **Discord** | Webhooks | Channel notifications |

---

## 📊 Current Status

**Latest Updates (October 2025)**:
- ✅ **TTS Access Control** - Three-tier system (All Access, Limited, Premium Voice Access)
- ✅ **Channel Point Redeems** - Temporary TTS access with configurable duration (1-60 mins)
- ✅ **Automatic Role Syncing** - Subscribers, VIPs, Moderators synced on startup, OAuth, and every 30 minutes
- ✅ **Premium Voice Mutual Exclusion** - Prevents invalid configurations between voice selection and access modes
- ✅ **Voice Settings Improvements** - Enhanced UI with dark containers and better error messaging

**Technical Status**:
- **IPC Handlers**: ✅ 80+ handlers migrated to centralized framework
- **Build**: ✅ Passing (0 errors, 363 KiB)
- **Coverage**: ✅ Database, TTS, TTS Access, Twitch, IRC, Discord, Startup operations
- **Code Quality**: ✅ 100% TypeScript, zero boilerplate IPC code
- **Error Handling**: ✅ 8-second error display with manual dismiss capability

**Recent Implementations**:
1. TTS Access Control system with rule evaluation
2. Channel Point temporary access grants
3. Centralized role sync service (3x faster with parallel API calls)
4. Premium voice mutual exclusion validation
5. Enhanced Voice Settings tab styling

---

## 🐛 Troubleshooting

### Black screen when loading preview?
This usually means invalid data is being rendered. Ensure objects are properly unwrapped from `response.data` in frontend services.

### IPC handler not responding?
Check that:
1. Handler is registered in the appropriate file (database.ts, tts.ts, tts-access.ts, twitch.ts, etc.)
2. `setupXxxHandlers()` is called in `src/backend/core/ipc-handlers/index.ts`
3. Handler returns proper type (not wrapped in extra object)
4. For TTS Access handlers, ensure `tts_access_config` table exists in database

### Double-wrapping response errors?
The IPC Framework automatically wraps returns in `{ success, data }`. Don't manually wrap—return raw data instead.

---

## 📚 Further Reading

- **IPC Framework Details**: See `src/backend/core/ipc/ipc-framework.ts`
- **Handler Examples**: See `src/backend/core/ipc-handlers/*.ts`
