# IPC Handlers - Module Documentation

This directory contains all Electron IPC (Inter-Process Communication) handlers, organized by domain. Each handler module manages a specific feature area and communicates between the main process and renderer process.

## Overview

The IPC handlers system is structured as follows:
- **Main entry point**: `index.ts` - Central registry that coordinates all handlers
- **Domain modules**: Specialized handlers for each feature area
- **Thin wrapper**: `../ipc-handlers.ts` - Facade for external access

## Handler Modules

### 1. **database.ts** - Database Operations
Handles all database CRUD (Create, Read, Update, Delete) operations.

**Responsibilities:**
- Viewer data management (create, update, delete viewers)
- Settings persistence (save/load application configuration)
- Events logging and retrieval
- Voice assignment tracking
- Session management
- Token storage (Twitch OAuth, API keys)

**IPC Events:**
- `db:create-viewer`, `db:get-viewer`, `db:update-viewer`, `db:delete-viewer`
- `db:get-settings`, `db:save-settings`
- `db:get-events`, `db:log-event`
- `db:get-voices`, `db:assign-voice`
- And more...

**Dependencies:** Database connection, repositories for each entity type

---

### 2. **tts.ts** - Text-to-Speech Operations
Manages all voice synthesis and speech functionality.

**Responsibilities:**
- Voice initialization and discovery
- Voice testing with custom or default messages
- Voice synthesis (speaking text)
- Provider management (WebSpeech, Azure)
- Voice detection and caching
- Real-time voice updates to renderer

**IPC Events:**
- `tts:initialize` - Load available voices
- `tts:test-voice` - Test a voice with optional custom message
- `tts:speak` - Synthesize and play speech
- `tts:stop` - Stop ongoing speech
- `tts:get-voices` - Retrieve cached voice list
- `tts:rescan-voices` - Force voice rediscovery

**Key Features:**
- Custom message support for voice testing
- Multi-provider support (WebSpeech API, Azure Cognitive Services)
- Voice caching for performance
- Error recovery and fallback mechanisms

**Dependencies:** TTS Manager, Platform-specific TTS handlers, Voice parser

---

### 3. **twitch.ts** - Twitch Authentication & WebSocket
Handles Twitch OAuth and real-time WebSocket connections.

**Responsibilities:**
- OAuth flow for Twitch authentication
- Authorization code handling
- WebSocket connection management for chat events
- Stream online/offline detection
- Event subscription handling

**IPC Events:**
- `twitch:start-auth` - Initiate OAuth flow
- `twitch:connect-websocket` - Establish WebSocket connection
- `twitch:disconnect-websocket` - Close WebSocket connection
- `twitch:get-channel-info` - Retrieve current channel data

**Key Features:**
- Secure OAuth token handling
- Real-time event streaming from Twitch
- Automatic reconnection logic
- Channel information caching

**Dependencies:** OAuth service, WebSocket API, Database for token storage

---

### 4. **irc.ts** - Twitch IRC Chat Operations
Handles Twitch IRC chat message handling and commands.

**Responsibilities:**
- IRC connection management
- Chat message parsing and event emission
- Command detection and routing
- User information extraction from chat
- Message history tracking

**IPC Events:**
- `irc:connect` - Start IRC connection to Twitch chat
- `irc:disconnect` - Close IRC connection
- `irc:send-message` - Post message to chat
- `irc:get-chat-history` - Retrieve recent messages

**Key Features:**
- Real-time chat message stream
- Command prefix detection (!commands)
- Moderator and badge recognition
- Automatic chat log storage

**Dependencies:** Twitch IRC service, Database for chat history

---

### 5. **viewer-rules.ts** - Viewer-Specific TTS Rules
Manages custom rules for individual viewers' TTS behavior.

**Responsibilities:**
- Per-viewer voice assignment
- Custom TTS phrase overrides
- Viewer-specific audio settings
- Rule priority and inheritance

**IPC Events:**
- `viewer-rules:get-rules` - Retrieve rules for a viewer
- `viewer-rules:set-voice` - Assign custom voice to viewer
- `viewer-rules:set-phrase` - Define text replacement rules
- `viewer-rules:delete-rule` - Remove viewer-specific rule
- `viewer-rules:get-all-rules` - List all configured rules

**Dependencies:** Database (viewer-rules-repository), Viewer data

---

### 6. **startup.ts** - Application Initialization
Handles one-time startup tasks and initialization routines.

**Responsibilities:**
- Database migration execution
- Voice system initialization
- Configuration validation
- Plugin/service startup
- Error checking on launch

**Export Functions:**
- `runStartupTasks()` - Execute all startup routines

**Called by:** `main.ts` during application startup

**Dependencies:** Database service, TTS Manager, Platform-specific handlers

---

## How They Work Together

### Initialization Flow

```
main.ts
  ↓
setupAllIpcHandlers(mainWindow)
  ↓
setupIpcHandlers()
  ├─ setupDatabaseHandlers()
  ├─ setupTwitchHandlers()
  ├─ setupTTSHandlers()
  ├─ setupViewerRulesHandlers()
  └─ setupIRCHandlers()
  ↓
setMainWindow(mainWindow)
  ├─ setMainWindowForTwitch(mainWindow)
  ├─ setMainWindowForTTS(mainWindow)
  ├─ setMainWindowForIRC(mainWindow)
  └─ setupEventStorageHandler(initializeTTS, mainWindow)
```

### Runtime Event Flow

**Example: Testing a Voice**

```
Frontend UI (tts.tsx)
  ↓ ipcInvoke('tts:test-voice', voiceId, options, testMessage)
  ↓
Main Process (tts.ts handler)
  ↓ receives message parameter
  ↓
TTS Manager (manager.ts)
  ↓ testVoice(voiceId, options, message)
  ↓
TTS Provider (webspeech.ts / azure-provider.ts)
  ↓ test(voiceId, options, message)
  ↓
Browser Audio Output
```

### Communication Pattern

Each handler module follows this standard pattern:

```typescript
// 1. Module state (private main window reference)
let mainWindow: BrowserWindow | null = null;

// 2. Setter function for main window reference
export function setMainWindowForDomain(window: BrowserWindow | null): void {
  mainWindow = window;
}

// 3. Handler registration function
export function setupDomainHandlers(): void {
  ipcMain.handle('domain:action', async (event, ...args) => {
    try {
      // Implementation
      return { success: true, data: result };
    } catch (error: any) {
      return { success: false, error: error.message };
    }
  });
}

// 4. Optional exports (utilities, initialization functions)
export { utilityFunction, initializationFunction };
```

## Integration Points

### Main Entry Point: `index.ts`

The `index.ts` file serves as the **central registry**:

1. **Imports** all domain modules
2. **Calls setup functions** in `setupIpcHandlers()`
3. **Distributes mainWindow reference** in `setMainWindow()`
4. **Re-exports** startup tasks from the startup module

### External Integration: `../ipc-handlers.ts`

The wrapper provides a unified API:

```typescript
export function setupAllIpcHandlers(mainWindow: BrowserWindow): void {
  setupIpcHandlers();
  setMainWindow(mainWindow);
}
```

This is called from `main.ts`:

```typescript
import { setupAllIpcHandlers } from './ipc-handlers';

// ... in BrowserWindow creation callback:
setupAllIpcHandlers(mainWindow);
```

## Data Flow Architecture

### Synchronous Operations (Settings, Config)
```
Renderer → IPC Handler → Database → Return Response
```

### Asynchronous Operations (TTS, WebSocket)
```
Renderer → IPC Handler → Service Layer
  ↓ (async operation)
  ↓ (event listener or callback)
Renderer ← IPC Event ← Main Process
```

### Real-Time Events (Chat, WebSocket)
```
External Service (Twitch) → IPC Handler
  ↓ (event listener)
Renderer ← IPC Event ← Main Process
```

## Adding a New Handler

To add a new domain handler:

1. **Create a module** (e.g., `newfeature.ts`)
2. **Implement the pattern**:
   - Export `setupNewFeatureHandlers()`
   - Export `setMainWindowForNewFeature()` if needed
3. **Add to `index.ts`**:
   - Import the setup and setter functions
   - Call setup function in `setupIpcHandlers()`
   - Call setter in `setMainWindow()` if needed
4. **Update wrapper** (`../ipc-handlers.ts`) if exporting new functions

## Error Handling

All handlers use a consistent error handling pattern:

```typescript
ipcMain.handle('domain:action', async (event, ...args) => {
  try {
    const result = await performAction(...args);
    return { success: true, data: result };
  } catch (error: any) {
    console.error('Error in domain:action:', error);
    return { success: false, error: error.message };
  }
});
```

Frontend code should check the `success` flag before using the response.

## Best Practices

1. **Keep modules focused** - Each handler should manage one feature area
2. **Use consistent naming** - IPC event names use `domain:action` format
3. **Maintain error boundaries** - Don't let one handler crash others
4. **Handle main window null** - Reference to mainWindow can be null during shutdown
5. **Document IPC events** - List all handled events and their parameters
6. **Use TypeScript types** - Define interfaces for complex arguments
7. **Test independently** - Each handler can be tested in isolation

## Related Files

- **Wrapper facade**: `../ipc-handlers.ts`
- **Application entry**: `../main.ts`
- **Architecture doc**: `../../IPC-ARCHITECTURE.md`
- **Modularization guide**: `../../IPC-HANDLERS-MODULARIZATION.md`
