# Stream Synth

A comprehensive Electron-based desktop application for Twitch streaming integration with support for real-time event handling, text-to-speech announcements, Discord webhooks, IRC chat, and viewer subscription tracking.

## 🎯 Overview

Stream Synth provides streamers with a centralized hub to manage Twitch events, automate TTS announcements, sync Discord channels, and track viewer subscriptions—all through a modern, typed architecture built on **Electron**, **TypeScript**, and **React**.

### Core Features

- **Twitch Integration**: OAuth authentication, EventSub WebSocket real-time events, automatic role syncing (Subscribers, VIPs, Moderators)
- **Text-to-Speech (TTS)**: Multi-provider support (WebSpeech, Azure, Google) with voice customization per viewer
- **TTS Access Control**: Three-tier access system (All Access, Limited Access, Premium Voice Access)
- **Channel Point Redeems**: Temporary TTS access via Channel Point redemptions with configurable duration
- **Dynamic Polling Framework**: User-configurable Twitch API polling with flexible units (seconds/minutes/hours), enable/disable toggles, and real-time updates
- **Event Subscriptions**: All Twitch events enabled by default with granular control; managed in Advanced settings
- **Discord Integration**: Webhook-based voice catalogue publishing and auto-updates
- **IRC Chat**: Real-time chat monitoring and message sending via tmi.js
- **Viewer Management**: Track subscribers, VIPs, moderators, and custom TTS voice preferences
- **Settings Management**: Comprehensive export/import including configs, voice preferences, polling settings, and TTS access rules
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
    │                                  │    │  • Connection (Twitch Auth)      │
    │  • Chat Management               │
    │  • TTS Configuration             │
    │  • Discord Webhooks              │
    │  • Viewers & Subscriptions       │
    │  • Advanced Settings:            │
    │    - Backup & Restore            │
    │    - Polling Configuration       │
    │    - Event Subscriptions         │
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

### Twitch Polling Handlers (5)

Located in `src/backend/core/ipc-handlers/twitch-polling.ts`

`twitch-polling:get-configs`, `twitch-polling:save-config`, `twitch-polling:reset-config`, `twitch-polling:get-status`, `twitch-polling:trigger-sync`

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

### Twitch API Polling Configuration

Stream Synth includes a **flexible, user-configurable polling framework** for managing Twitch Helix API request intervals. Users can customize how often the app syncs data from Twitch with dynamic, real-time updates.

**Features:**

- 🎚️ **Units-Based Intervals** - Configure polling in seconds, minutes, or hours with smart UI formatting
- 📏 **Configurable Ranges** - Each API type has custom min/max intervals with step controls
- ⚡ **Dynamic Updates** - Changes take effect immediately without app restart; no database recreation needed
- 🔘 **Enable/Disable Toggle** - Turn polling on/off per API type
- 📊 **Real-Time Status** - See which pollers are active and when they last ran
- 🔮 **Future-Proof** - Easily extensible for new API endpoints

**Current API Types:**

- **Role Sync** - Combined sync for Subscribers, VIPs, and Moderators
  - Default: 30 minutes
  - Range: 5-120 minutes
  - Step: 5 minutes
  - Status: Active

**Configuration Location:** Advanced Settings → Twitch API Polling Settings

**Database Schema:**

```sql
CREATE TABLE twitch_polling_config (
  api_type TEXT PRIMARY KEY,
  interval_value INTEGER NOT NULL,      -- The numeric value (e.g., 30)
  interval_units TEXT NOT NULL,          -- 'seconds', 'minutes', or 'hours'
  enabled INTEGER NOT NULL DEFAULT 1,
  min_interval INTEGER NOT NULL,         -- Minimum allowed value
  max_interval INTEGER NOT NULL,         -- Maximum allowed value
  step INTEGER NOT NULL                  -- UI step increment
);
```

**Technical Details:**

- Repository method `getIntervalMs()` converts units to milliseconds
- Dynamic polling manager restarts timers on configuration changes
- IPC handlers: `twitch-polling:get-configs`, `twitch-polling:save-config`, `twitch-polling:get-status`
- UI automatically formats display: "2 minutes", "120 seconds", "1 hour"

### Event Subscription Management

Stream Synth provides **granular control over Twitch EventSub subscriptions** with all events enabled by default for maximum functionality.

**Default Behavior:**

- ✅ **All events enabled** - Every supported Twitch event is active by default
- 🔒 **Locked events** - Chat and Channel Points events are required and cannot be disabled
- ⚠️ **Warning system** - UI warns when disabling events may reduce functionality

**Configuration Location:** Advanced Settings → Event Subscriptions (collapsible section)

**Event Categories:**

1. **Channel Activity** - Follows, raids, stream status changes
2. **Subscriber Events** - New subs, resubs, gifted subs, subscription messages
3. **Channel Points** - Redemptions, reward updates (🔒 locked, always enabled)
4. **Chat Events** - Messages, clear events, moderation (🔒 locked, always enabled)
5. **Hype Train** - Begin, progress, end events
6. **Polls & Predictions** - Begin, progress, end events

**User Experience:**

- Section is collapsed by default to reduce visual clutter
- Requires active Twitch connection to configure
- Shows "Connect to Twitch first" message when not connected
- Orange warning banner appears when section is expanded and connected
- Locked events display 🔒 icon to indicate they cannot be disabled

**Technical Implementation:**

- Event preferences stored in `event_subscriptions` table
- Changes sync immediately via IPC handlers
- Export/import includes event subscription preferences
- Integration with WebSocket event handler for real-time updates

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
- **viewer_voice_preferences**: Individual pitch/speed settings per viewer
- **subscriptions**: Subscription tracking
- **channel_point_grants**: Temporary TTS access via Channel Point redemptions
- **twitch_polling_config**: Configurable Twitch API polling intervals with units support
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

**Latest Updates (January 2025)**:

- ✅ **Units-Based Polling Framework** - User-configurable API polling with seconds/minutes/hours, dynamic updates, and enable/disable toggles
- ✅ **Event Subscriptions Refactor** - Moved from Connection screen to Advanced settings; all events enabled by default
- ✅ **Enhanced Export/Import** - Now includes TTS access config, polling configs, and viewer voice preferences
- ✅ **TTS Access Control** - Three-tier system (All Access, Limited, Premium Voice Access)
- ✅ **Channel Point Redeems** - Temporary TTS access with configurable duration (1-60 mins)
- ✅ **Automatic Role Syncing** - Subscribers, VIPs, Moderators synced on startup, OAuth, and configurable intervals
- ✅ **Premium Voice Mutual Exclusion** - Prevents invalid configurations between voice selection and access modes
- ✅ **Voice Settings Improvements** - Enhanced UI with dark containers and better error messaging

**Technical Status**:

- **IPC Handlers**: ✅ 85+ handlers migrated to centralized framework
- **Build**: ✅ Passing (0 errors, 369 KiB)
- **Coverage**: ✅ Database, TTS, TTS Access, Twitch Polling, Twitch, IRC, Discord, Startup operations
- **Code Quality**: ✅ 100% TypeScript, zero boilerplate IPC code
- **Error Handling**: ✅ 8-second error display with manual dismiss capability

**Recent Implementations**:

1. Units-based polling framework with dynamic configuration UI
2. Event subscription management moved to Advanced screen
3. Comprehensive export/import system with all user preferences
4. TTS Access Control system with rule evaluation
5. Channel Point temporary access grants
6. Centralized role sync service (3x faster with parallel API calls)
7. Premium voice mutual exclusion validation
8. Enhanced Voice Settings tab styling

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

## 🎬 Event Actions & Browser Source Alerts

Stream Synth includes a **browser source alert system** for OBS integration, allowing streamers to display custom alerts for Twitch events like follows, subscriptions, raids, and more.

### Quick Overview

Event Actions transforms Twitch EventSub events into customizable browser source alerts:

- **🎨 Custom Alert Templates** - Use `{{variable}}` syntax for dynamic content
- **📺 OBS Integration** - Clean browser source output (no debug UI visible)
- **🎯 Channel Filtering** - Multiple channels for different scenes
- **🔧 Flexible Configuration** - Database-backed with template support

### Getting Started

1. **Start the application**: The browser source server runs automatically on port 7474
2. **Add browser source in OBS**: 
   - URL: `http://localhost:7474/alert`
   - Width: 1920, Height: 1080 (or match your canvas)
   - Optional: Add `?channel=NAME` for filtered alerts
3. **Configure alerts**: Create event actions via database or future UI (coming soon)
4. **Test**: Real events trigger automatically, or use test endpoint: `http://localhost:7474/test`

### Template Variables

Templates support dynamic variables that get replaced with actual event data:

```
{{username}} just followed! ❤️
{{display_name}} subscribed for {{months}} months!
{{from_broadcaster_user_name}} raided with {{viewers}} viewers!
```

**Common Variables:**
- `{{username}}`, `{{display_name}}`, `{{user_name}}` - Viewer's display name
- `{{event_type}}` - Type of event (e.g., "channel.follow")
- `{{timestamp}}` - When the event occurred

**Event-Specific Variables:**
- Follows: `{{user_id}}`, `{{followed_at}}`
- Subscriptions: `{{tier}}`, `{{is_gift}}`, `{{months}}`
- Raids: `{{from_broadcaster_user_name}}`, `{{viewers}}`
- Channel Points: `{{reward_title}}`, `{{reward_cost}}`, `{{user_input}}`

See [EVENT-ACTIONS-README.md](./EVENT-ACTIONS-README.md) for complete documentation.

### Architecture

```
Twitch EventSub 
  → EventSubManager 
  → EventSubEventRouter 
  → EventActionProcessor
  → BrowserSourceServer (Socket.IO)
  → Browser Source Client (OBS)
```

**Key Components:**

- **EventActionProcessor** (`src/backend/services/event-action-processor.ts`) - Processes events and executes actions
- **BrowserSourceServer** (`src/backend/services/browser-source-server.ts`) - HTTP + Socket.IO server (port 7474)
- **Browser Source Client** (`dist/backend/public/browser-source.html`) - OBS browser source page
- **Database Tables**: `event_actions`, `browser_source_channels`

### Database Schema

```sql
CREATE TABLE event_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  action_type TEXT NOT NULL,
  action_config TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE browser_source_channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
```

### Current Status

- ✅ **Backend Integration Complete** - All services integrated and tested
- ✅ **Browser Source Server** - Socket.IO server running on port 7474
- ✅ **Template Processing** - Dynamic variable replacement with aliases
- ✅ **Channel Filtering** - Multi-channel support for different OBS scenes
- ✅ **Debug Mode** - Hidden by default, accessible via `?debug=true`
- ✅ **Build Verified** - 0 errors, 569 KiB bundle
- ⏳ **User Testing** - Phase 12 in progress
- 📋 **Frontend UI** - Planned (configuration screen for managing actions)

### Debug Mode

For testing and troubleshooting, append `?debug=true` to the browser source URL:

```
http://localhost:7474/alert?debug=true
```

This displays connection status and real-time event logs. In production (OBS), use the clean URL without debug parameter.

### Future Enhancements

Planned features for Event Actions:

- **TTS Browser Source** - Parallel audio stream for chat TTS (1-2 hours)
- **In-App Alert Popup** - Desktop notifications without OBS (2-3 hours)
- **Event Actions UI** - Configuration screen for managing actions (4-6 hours)

### Technical Documentation

For complete technical details including:
- Architecture diagrams
- API reference
- Integration points
- Troubleshooting guide
- Template system deep dive

See **[EVENT-ACTIONS-README.md](./EVENT-ACTIONS-README.md)**

---

## 📚 Further Reading

- **IPC Framework Details**: See `src/backend/core/ipc/ipc-framework.ts`
- **Handler Examples**: See `src/backend/core/ipc-handlers/*.ts`
- **Event Actions Technical Guide**: See `EVENT-ACTIONS-README.md`
