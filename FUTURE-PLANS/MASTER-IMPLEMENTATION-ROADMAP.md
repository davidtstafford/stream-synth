# Stream Synth - Master Implementation Roadmap

**Status:** 📋 **MASTER PLANNING DOCUMENT**  
**Purpose:** Complete implementation order with dependency resolution  
**Last Updated:** October 2025  
**Total Estimated Time:** 140-200 hours (~18-25 work days)

---

## Overview

This document provides the **definitive implementation order** for all future Stream Synth features. Each phase is designed to build upon previous work, respecting dependencies and maximizing development efficiency.

---

## Quick Reference: All Features

| # | Feature | Time | Priority | Dependencies |
|---|---------|------|----------|--------------|
| 1 | Polling Events Integration | 8-12h | High | Existing polling framework |
| 2 | Follower Polling | 8-12h | High | #1 |
| 3 | Moderation Status Polling | 10-14h | High | #1 |
| 4 | Enhanced Viewer TTS Rules | 6-10h | High | None (standalone UI) |
| 5 | Chat Commands System | 10-14h | High | #4 |
| 6 | Clip Polling | 11-17h | Medium | #1 |
| 7 | Event Actions | 20-30h | Medium | #1, #2, #3, #6 |
| 8 | Discord Webhooks | 6-10h | Medium | None (standalone) |
| 9 | Discord TTS Bot | 12-16h | Medium | #8 (optional), #5 (integration) |

**Total Time:** 91-135 hours (base features) + 49-65 hours (Discord features) = **140-200 hours**

---

## 🏗️ Architecture Quick Reference

**IMPORTANT**: Before implementing ANY phase, you MUST understand Stream Synth's core architecture patterns. These patterns are documented in detail in the main **README.md** file.

### Core Patterns Overview

#### 1. **IPC Framework Pattern** (Centralized Handler Registration)

All frontend-backend communication uses a centralized IPC framework that eliminates boilerplate and provides consistent error handling.

```typescript
// Backend: Register handler in src/backend/core/ipc-handlers/*.ts
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
      return result; // Framework auto-wraps as { success: true, data: result }
    },
    
    // Optional: Transform output
    transform: (output) => ({
      ...output,
      transformed: true
    })
  }
);

// Frontend: Call handler in React component
const response = await ipcRenderer.invoke('channel-name', inputData);
if (response.success) {
  const data = response.data; // Use typed data
} else {
  console.error('Error:', response.error);
}
```

**Key Points**:
- ✅ All handlers return `{ success: boolean; data?: T; error?: string }`
- ✅ Framework handles error wrapping automatically
- ✅ Never manually wrap returns in `{ success, data }` - return raw data
- ✅ Register handlers in appropriate file: `database.ts`, `tts.ts`, `twitch.ts`, etc.
- ✅ Call `setupXxxHandlers()` in `src/backend/core/ipc-handlers/index.ts`

**Documentation**: See README.md section "🔧 IPC Framework (Centralized Handler Pattern)"

---

#### 2. **Repository Pattern** (Database Operations)

All database operations use `BaseRepository<T>` which provides standard CRUD methods.

```typescript
// Extend BaseRepository for new tables
export class MyRepository extends BaseRepository<MyEntity> {
  constructor(db: Database.Database) {
    super(db, 'my_table', (row) => ({
      id: row.id,
      name: row.name,
      // ... map database row to typed entity
    }));
  }
  
  // Add custom methods
  async getByName(name: string): Promise<MyEntity | null> {
    return this.getByColumn('name', name);
  }
  
  // Batch operations
  async insertMany(entities: MyEntity[]): Promise<void> {
    const stmt = this.db.prepare(`INSERT INTO my_table ...`);
    const transaction = this.db.transaction((items) => {
      for (const item of items) {
        stmt.run(item.id, item.name);
      }
    });
    transaction(entities);
  }
}
```

**Key Points**:
- ✅ Always extend `BaseRepository<T>` from `src/backend/database/base-repository.ts`
- ✅ Provides: `getById()`, `getAll()`, `create()`, `update()`, `delete()`, `getByColumn()`
- ✅ Use `mapRow` function in constructor to convert database rows to typed entities
- ✅ Add table-specific methods as needed
- ✅ Export repository from `src/backend/database/repositories/index.ts`

**Documentation**: See `src/backend/database/base-repository.ts`

---

#### 3. **Service Pattern** (Business Logic)

Services contain business logic and orchestrate repositories, APIs, and other services.

```typescript
// Create service in src/backend/services/
export class MyService {
  constructor(
    private myRepo: MyRepository,
    private otherService: OtherService
  ) {}
  
  async processData(input: Input): Promise<Result> {
    // 1. Validate
    if (!input.isValid) throw new Error('Invalid input');
    
    // 2. Fetch data
    const data = await this.myRepo.getById(input.id);
    
    // 3. Business logic
    const processed = this.transform(data);
    
    // 4. Call other services
    await this.otherService.notify(processed);
    
    // 5. Return result
    return processed;
  }
}
```

**Key Points**:
- ✅ Services live in `src/backend/services/`
- ✅ Services orchestrate repositories and external APIs
- ✅ Keep business logic OUT of repositories (repositories = data access only)
- ✅ Initialize services in `src/backend/main.ts`
- ✅ Pass services to IPC handlers as needed

**Examples**: 
- `twitch-role-sync.ts` - Orchestrates subscriber/VIP/moderator syncing
- `dynamic-polling-manager.ts` - Manages polling intervals
- `tts-access-control.ts` - Evaluates TTS access rules

---

#### 4. **Frontend Service Pattern** (IPC Wrapper)

Frontend services wrap IPC calls and normalize responses for React components.

```typescript
// Create service in src/frontend/services/
export async function myOperation(input: any): Promise<{ 
  success: boolean; 
  result?: any; 
  error?: string 
}> {
  const response = await ipcRenderer.invoke('my-handler', input);
  
  if (response.success && response.data) {
    return { success: true, result: response.data };
  }
  return { success: false, error: response.error };
}

// Use in React component
const handleClick = async () => {
  const result = await myService.myOperation(data);
  if (result.success) {
    setData(result.result);
  } else {
    setError(result.error);
  }
};
```

**Key Points**:
- ✅ Always create frontend service wrappers (don't call IPC directly in components)
- ✅ Extract `response.data` and return normalized format
- ✅ Handle errors gracefully
- ✅ Export from `src/frontend/services/`

**Examples**:
- `database.ts` - Wraps database IPC handlers
- `tts.ts` - Wraps TTS IPC handlers
- `twitch-api.ts` - Wraps Twitch IPC handlers

---

#### 5. **Database Migration Pattern**

All database schema changes go through migrations in `src/backend/database/migrations.ts`.

```typescript
// Add to migrations array
export const migrations: Migration[] = [
  // ...existing migrations...
  
  {
    version: 14, // Increment version
    description: 'Add my_table for new feature',
    up: (db: Database.Database) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS my_table (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_my_table_name 
        ON my_table(name);
      `);
    },
    down: (db: Database.Database) => {
      db.exec(`DROP TABLE IF EXISTS my_table;`);
    }
  }
];
```

**Key Points**:
- ✅ Always increment version number
- ✅ Provide descriptive `description`
- ✅ Implement both `up` (create) and `down` (rollback)
- ✅ Use `IF NOT EXISTS` for idempotency
- ✅ Create indexes for frequently queried columns
- ✅ Use TEXT for IDs, INTEGER for booleans (0/1), TEXT for timestamps (ISO 8601)

**Documentation**: See `src/backend/database/migrations.ts`

---

### Standard File Structure for Each Feature

Every feature typically requires these files:

```
Backend:
  src/backend/database/repositories/my-feature.ts    # Repository class
  src/backend/services/my-feature.ts                 # Service class
  src/backend/core/ipc-handlers/my-feature.ts        # IPC handlers
  
Frontend:
  src/frontend/services/my-feature.ts                # IPC wrapper
  src/frontend/screens/my-feature/my-feature.tsx     # React component
  
Database:
  src/backend/database/migrations.ts                 # Add migration
```

**Integration Points**:
- Register IPC handlers in `src/backend/core/ipc-handlers/index.ts`
- Export repository from `src/backend/database/repositories/index.ts`
- Initialize service in `src/backend/main.ts`
- Add navigation in `src/frontend/components/Menu.tsx`

---

## 📋 Standard Implementation Checklist

Use this checklist for **EVERY** phase to ensure consistent implementation:

### ✅ Step 1: Database Layer (if new tables needed)

- [ ] Add migration to `src/backend/database/migrations.ts`
  - [ ] Increment version number
  - [ ] Define table schema with appropriate types
  - [ ] Add indexes for performance
  - [ ] Implement `up` and `down` functions
- [ ] Create repository in `src/backend/database/repositories/`
  - [ ] Extend `BaseRepository<T>`
  - [ ] Implement `mapRow` function
  - [ ] Add table-specific query methods
  - [ ] Export from `repositories/index.ts`
- [ ] Test repository methods work correctly

### ✅ Step 2: Service Layer (business logic)

- [ ] Create service in `src/backend/services/`
  - [ ] Import required repositories
  - [ ] Implement business logic methods
  - [ ] Handle edge cases and errors
  - [ ] Add logging for important operations
- [ ] Initialize service in `src/backend/main.ts`
  - [ ] Instantiate service with dependencies
  - [ ] Pass to IPC handlers if needed
- [ ] Test service methods work correctly

### ✅ Step 3: IPC Handlers (frontend-backend bridge)

- [ ] Create handler file in `src/backend/core/ipc-handlers/` (or add to existing)
  - [ ] Use `ipcRegistry.register()` for each handler
  - [ ] Add `validate` function for input validation
  - [ ] Implement `execute` function with service calls
  - [ ] Return raw data (framework handles wrapping)
- [ ] Register handlers in `src/backend/core/ipc-handlers/index.ts`
  - [ ] Import handler setup function
  - [ ] Call `setupXxxHandlers()` in `setupAllHandlers()`
- [ ] Test IPC handlers via Electron DevTools console

### ✅ Step 4: Frontend Service (IPC wrapper)

- [ ] Create service in `src/frontend/services/`
  - [ ] Import `ipcRenderer` from electron
  - [ ] Wrap each IPC handler in a function
  - [ ] Extract `response.data` from IPC response
  - [ ] Return normalized format `{ success, result?, error? }`
  - [ ] Export all functions
- [ ] Test frontend service calls work correctly

### ✅ Step 5: Frontend UI (React component)

- [ ] Create screen component in `src/frontend/screens/`
  - [ ] Import frontend service
  - [ ] Use React hooks (useState, useEffect)
  - [ ] Call service methods on user actions
  - [ ] Display data and handle errors
  - [ ] Add loading states
- [ ] Add navigation in `src/frontend/components/Menu.tsx`
  - [ ] Add menu item with route
  - [ ] Import screen component
  - [ ] Add route to router
- [ ] Test UI renders and functions correctly

### ✅ Step 6: Integration Testing

- [ ] Test full flow: UI → Frontend Service → IPC → Backend Service → Repository → Database
- [ ] Test error handling at each layer
- [ ] Test edge cases (empty data, invalid input, API failures)
- [ ] Test performance with realistic data volumes
- [ ] Verify no regressions in existing features

### ✅ Step 7: Documentation

- [ ] Update feature documentation with actual implementation notes
- [ ] Document any deviations from original plan
- [ ] Add comments for complex business logic
- [ ] Update README.md if new patterns introduced

---

## ⚠️ Common Pitfalls & How to Avoid Them

### ❌ Pitfall 1: Double-Wrapping IPC Responses

**WRONG**:
```typescript
ipcRegistry.register('my-handler', {
  execute: async (input) => {
    const data = await myService.getData();
    return { success: true, data }; // ❌ Manual wrapping
  }
});
```

**CORRECT**:
```typescript
ipcRegistry.register('my-handler', {
  execute: async (input) => {
    return await myService.getData(); // ✅ Return raw data
  }
});
```

**Why**: The IPC Framework automatically wraps returns in `{ success, data }`. Manual wrapping creates `{ success: true, data: { success: true, data: ... } }`.

---

### ❌ Pitfall 2: Business Logic in Repositories

**WRONG**:
```typescript
class MyRepository extends BaseRepository<MyEntity> {
  async processAndSave(data: Data): Promise<void> {
    // ❌ Business logic in repository
    const processed = this.validateAndTransform(data);
    await this.create(processed);
  }
}
```

**CORRECT**:
```typescript
// Repository: Data access only
class MyRepository extends BaseRepository<MyEntity> {
  async save(entity: MyEntity): Promise<void> {
    await this.create(entity);
  }
}

// Service: Business logic
class MyService {
  async processAndSave(data: Data): Promise<void> {
    const processed = this.validateAndTransform(data); // ✅ Logic in service
    await this.myRepo.save(processed);
  }
}
```

**Why**: Repositories should only handle data access. Business logic belongs in services for testability and reusability.

---

### ❌ Pitfall 3: Direct IPC Calls in React Components

**WRONG**:
```tsx
const MyComponent = () => {
  const handleClick = async () => {
    // ❌ Direct IPC call in component
    const response = await ipcRenderer.invoke('my-handler', data);
    if (response.success) setData(response.data);
  };
};
```

**CORRECT**:
```tsx
// src/frontend/services/my-service.ts
export async function getData(input: any) {
  const response = await ipcRenderer.invoke('my-handler', input);
  return response.success ? 
    { success: true, result: response.data } : 
    { success: false, error: response.error };
}

// Component
const MyComponent = () => {
  const handleClick = async () => {
    const result = await myService.getData(data); // ✅ Use service wrapper
    if (result.success) setData(result.result);
  };
};
```

**Why**: Service wrappers provide abstraction, type safety, and consistent error handling.

---

### ❌ Pitfall 4: Forgetting to Register IPC Handlers

**WRONG**:
```typescript
// Created handlers but forgot to register
// src/backend/core/ipc-handlers/my-feature.ts
export function setupMyFeatureHandlers(registry: IPCRegistry) {
  ipcRegistry.register(...);
}

// ❌ Not called in index.ts
```

**CORRECT**:
```typescript
// src/backend/core/ipc-handlers/index.ts
import { setupMyFeatureHandlers } from './my-feature';

export function setupAllHandlers(registry: IPCRegistry, deps: Dependencies) {
  // ...existing handlers...
  setupMyFeatureHandlers(registry, deps); // ✅ Register new handlers
}
```

**Why**: Handlers must be registered in `index.ts` to be available to frontend.

---

### ❌ Pitfall 5: Missing Database Migration

**WRONG**:
```typescript
// Created repository but no migration
class MyRepository extends BaseRepository<MyEntity> {
  constructor(db: Database.Database) {
    super(db, 'my_table', mapRow); // ❌ Table doesn't exist
  }
}
```

**CORRECT**:
```typescript
// 1. First add migration
export const migrations: Migration[] = [
  {
    version: 14,
    description: 'Add my_table',
    up: (db) => {
      db.exec(`CREATE TABLE my_table (...)`); // ✅ Create table first
    },
    down: (db) => {
      db.exec(`DROP TABLE my_table`);
    }
  }
];

// 2. Then create repository
class MyRepository extends BaseRepository<MyEntity> {
  constructor(db: Database.Database) {
    super(db, 'my_table', mapRow); // ✅ Now table exists
  }
}
```

**Why**: Tables must exist before repositories can use them. Migrations create tables.

---

### ❌ Pitfall 6: Not Reusing Existing Repositories

**WRONG**:
```typescript
// Duplicating viewer lookup logic
class MyService {
  async getViewerByUsername(username: string): Promise<Viewer | null> {
    // ❌ Direct database query duplicates ViewersRepository logic
    const row = this.db.prepare(`SELECT * FROM viewers WHERE ...`).get();
    return row ? this.mapViewer(row) : null;
  }
}
```

**CORRECT**:
```typescript
class MyService {
  constructor(private viewersRepo: ViewersRepository) {}
  
  async getViewerByUsername(username: string): Promise<Viewer | null> {
    // ✅ Reuse existing repository method
    return await this.viewersRepo.getByColumn('user_login', username);
  }
}
```

**Why**: Reusing repositories ensures consistency and reduces duplication. Example: Discord TTS Bot should reuse `ViewersRepository`, `VoicesRepository`, `ViewerRulesRepository` instead of duplicating logic.

---

### ❌ Pitfall 7: Incorrect TypeScript Types in IPC Handlers

**WRONG**:
```typescript
ipcRegistry.register<any, any>('my-handler', { // ❌ any loses type safety
  execute: async (input) => {
    return input.data; // No autocomplete, no compile-time checks
  }
});
```

**CORRECT**:
```typescript
interface MyInput {
  id: string;
  name: string;
}

interface MyOutput {
  success: boolean;
  result: string;
}

ipcRegistry.register<MyInput, MyOutput>('my-handler', { // ✅ Typed
  execute: async (input) => {
    // input.id and input.name have autocomplete
    return { success: true, result: `Processed ${input.name}` };
  }
});
```

**Why**: TypeScript types provide autocomplete, compile-time checks, and documentation.

---

### ❌ Pitfall 8: Not Handling Async Errors

**WRONG**:
```typescript
const handleClick = async () => {
  const result = await myService.getData(); // ❌ No error handling
  setData(result.result); // Crashes if result.result is undefined
};
```

**CORRECT**:
```typescript
const handleClick = async () => {
  try {
    const result = await myService.getData();
    if (result.success) {
      setData(result.result);
    } else {
      setError(result.error || 'Unknown error'); // ✅ Handle failure
    }
  } catch (err) {
    console.error('Unexpected error:', err);
    setError('An unexpected error occurred');
  }
};
```

**Why**: Always handle both service failures (`result.success === false`) and unexpected errors (network issues, etc.).

---

## Implementation Phases

### 🚀 Phase 1: Polling Infrastructure Enhancement (8-12 hours)

**Goal:** Enable all pollers to write events to the database

#### Features
- ✅ Polling Events Integration

#### Why First?
- **No dependencies** - builds on existing polling framework
- **Foundation for all pollers** - establishes pattern for event recording
- **High impact** - benefits followers, moderation, and clips features
- **Low risk** - additive change, doesn't break existing functionality

#### Deliverables
1. `PollingEventFormatter` utility service
2. `EventsRepository` enhancements (batch insert)
3. Updated `DynamicPollingManager` with event writing
4. Integration with existing role sync service
5. Documentation and examples

#### Acceptance Criteria
- [ ] State changes write events to database
- [ ] No duplicate events on unchanged state
- [ ] Batch operations work for multiple changes
- [ ] Events appear in Events screen
- [ ] No performance degradation

#### Files to Create/Modify
- **Create:** `src/backend/services/polling-event-formatter.ts`
- **Modify:** `src/backend/database/repositories/events.ts`
- **Modify:** `src/backend/services/dynamic-polling-manager.ts`
- **Modify:** `src/backend/services/twitch-role-sync.ts`

**Documentation:** `FUTURE-PLANS/POLLING-EVENTS-INTEGRATION.md`

---

### 🚀 Phase 2: Follower Polling Feature (8-12 hours)

**Goal:** Track follower state changes with automatic event recording

#### Features
- ✅ Follower Polling

#### Why Second?
- **Depends on:** Phase 1 (polling events)
- **Simplest poller** - good learning ground for polling pattern
- **High user value** - followers are important engagement metric
- **Enables Event Actions** - provides new event type for alerts

#### Deliverables
1. Database migration: `follower_history` table + `current_followers` view
2. `FollowerHistoryRepository` class
3. `TwitchFollowersService` class
4. Polling config entry (120 seconds default)
5. Integration with `DynamicPollingManager`
6. IPC handlers for follower queries
7. `FollowersScreen` frontend component
8. Event types: `channel.follow`, `channel.unfollow`

#### Acceptance Criteria
- [ ] Detects new followers
- [ ] Detects unfollows
- [ ] Records follow/unfollow events
- [ ] Statistics screen shows metrics
- [ ] Polling interval configurable
- [ ] Auto-creates viewer on first follow

#### Files to Create
- `src/backend/database/repositories/follower-history.ts`
- `src/backend/services/twitch-followers.ts`
- `src/backend/core/ipc-handlers/followers.ts`
- `src/frontend/screens/followers/followers.tsx`
- `src/frontend/services/followers.ts`

#### Files to Modify
- `src/backend/database/migrations.ts` (add tables/view)
- `src/backend/services/dynamic-polling-manager.ts` (add handler)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)

**Documentation:** `FUTURE-PLANS/FOLLOWER-POLLING-FEATURE.md`

---

### 🚀 Phase 3: Moderation Status Polling Feature (10-14 hours)

**Goal:** Track bans, unbans, timeouts, and timeout lifts

#### Features
- ✅ Moderation Status Polling

#### Why Third?
- **Depends on:** Phase 1 (polling events)
- **Moderately complex** - dual API polling (bans + timeouts)
- **High moderation value** - important for channel management
- **Provides 4 event types** - enriches Event Actions capability

#### Deliverables
1. Database migration: `moderation_history` table + `current_moderation_status` view
2. `ModerationHistoryRepository` class
3. `TwitchModerationService` class (dual API polling)
4. Polling config entry (300 seconds default)
5. Integration with `DynamicPollingManager`
6. IPC handlers for moderation queries
7. `ModerationScreen` frontend component
8. Event types: `channel.user.banned`, `channel.user.unbanned`, `channel.user.timed_out`, `channel.user.timeout_lifted`

#### Acceptance Criteria
- [ ] Detects new bans
- [ ] Detects unbans
- [ ] Detects new timeouts with duration
- [ ] Detects timeout expiry
- [ ] Records all moderation events
- [ ] Statistics screen shows active/historical data
- [ ] Moderator info tracked

#### Files to Create
- `src/backend/database/repositories/moderation-history.ts`
- `src/backend/services/twitch-moderation.ts`
- `src/backend/core/ipc-handlers/moderation.ts`
- `src/frontend/screens/moderation/moderation.tsx`
- `src/frontend/services/moderation.ts`

#### Files to Modify
- `src/backend/database/migrations.ts` (add tables/view)
- `src/backend/services/dynamic-polling-manager.ts` (add handler)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)

**Documentation:** `FUTURE-PLANS/MODERATION-STATUS-POLLING-FEATURE.md`

---

### 🚀 Phase 4: Enhanced Viewer TTS Rules UI (6-10 hours)

**Goal:** Add mute and cooldown controls to Viewer Rules screen

#### Features
- ✅ Enhanced Viewer TTS Rules

#### Why Fourth?
- **No dependencies** - standalone UI enhancement
- **Prepares for Chat Commands** - creates database schema needed
- **High user value** - visual controls for TTS restrictions
- **Low risk** - UI-only changes

#### Deliverables
1. Database migration: `viewer_tts_rules` table
2. `ViewerTTSRulesRepository` class
3. Enhanced `ViewerRulesTTSTab` component with sliders
4. IPC handlers for rule management
5. Background cleanup job for expired rules
6. Integration with TTS manager

#### Acceptance Criteria
- [ ] Mute viewer checkbox and slider work
- [ ] Cooldown viewer checkbox and sliders work
- [ ] Permanent vs temporary restrictions configurable
- [ ] Status displays show time remaining
- [ ] Auto-expiry works
- [ ] Clear all rules button works
- [ ] TTS manager respects rules

#### Files to Create
- `src/backend/database/repositories/viewer-tts-rules.ts`
- `src/backend/core/ipc-handlers/viewer-tts-rules.ts`

#### Files to Modify
- `src/backend/database/migrations.ts` (add table)
- `src/frontend/screens/viewers/tabs/ViewerRulesTTSTab.tsx` (add UI)
- `src/backend/services/tts/manager.ts` (check rules)
- `src/backend/main.ts` (background cleanup job)

**Documentation:** `FUTURE-PLANS/ENHANCED-VIEWER-TTS-RULES.md`

---

### 🚀 Phase 5: Chat Commands System (10-14 hours)

**Goal:** Enable viewer and moderator commands in Twitch chat

#### Features
- ✅ Chat Commands System

#### Why Fifth?
- **Depends on:** Phase 4 (viewer TTS rules schema)
- **High user engagement** - interactive chat features
- **Enables Discord integration** - ~voices command references Discord bot
- **Moderator tools** - real-time TTS management

#### Deliverables
1. Database migration: `chat_commands_config` + `chat_command_usage` tables
2. `ChatCommandsConfigRepository` class
3. `ChatCommandHandler` service with 8 commands
4. Integration with `TwitchIRCService`
5. IPC handlers for command configuration
6. `ChatCommandsScreen` frontend component
7. Rate limiting and permission system

#### Commands Implemented
- **Viewer:** `~hello`, `~voices`, `~setvoice`
- **Moderator:** `~mutevoice`, `~unmutevoice`, `~cooldownvoice`, `~mutetts`, `~unmutetts`

#### Acceptance Criteria
- [ ] All 8 commands work correctly
- [ ] Permission checks enforce viewer/mod/broadcaster tiers
- [ ] Rate limiting prevents spam
- [ ] Command enable/disable toggles work
- [ ] Usage tracking records statistics
- [ ] ~setvoice validates voice IDs
- [ ] Mod commands update viewer TTS rules

#### Files to Create
- `src/backend/database/repositories/chat-commands-config.ts`
- `src/backend/services/chat-command-handler.ts`
- `src/backend/core/ipc-handlers/chat-commands.ts`
- `src/frontend/screens/chat-commands/chat-commands.tsx`

#### Files to Modify
- `src/backend/database/migrations.ts` (add tables)
- `src/backend/services/twitch-irc.ts` (integrate handler)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)

**Documentation:** `FUTURE-PLANS/CHAT-COMMANDS-SYSTEM.md`

---

### 🎯 Phase 6: Clip Polling Feature (11-17 hours)

**Goal:** Auto-detect new clips via Twitch API

#### Features
- ✅ Clip Polling

#### Why Sixth?
- **Depends on:** Phase 1 (polling events)
- **Medium complexity** - larger API response handling
- **Moderate user value** - nice-to-have for clip tracking
- **Enables Event Actions** - provides clip event type

#### Deliverables
1. Database migration: `clips` table
2. `ClipRepository` class
3. `TwitchClipsService` class
4. Polling config entry (900 seconds/15 mins default)
5. Integration with `DynamicPollingManager`
6. IPC handlers for clip queries
7. `ClipsScreen` frontend component
8. Browser source integration capability
9. Event type: `channel.clip.created`

#### Acceptance Criteria
- [ ] Detects new clips
- [ ] Stores clip metadata (title, URL, creator, views)
- [ ] Records clip creation events
- [ ] Statistics screen shows recent clips
- [ ] Filter by creator, date range
- [ ] Pagination works
- [ ] OBS browser source setup documented

#### Files to Create
- `src/backend/database/repositories/clips.ts`
- `src/backend/services/twitch-clips.ts`
- `src/backend/core/ipc-handlers/clips.ts`
- `src/frontend/screens/clips/clips.tsx`
- `src/frontend/services/clips.ts`

#### Files to Modify
- `src/backend/database/migrations.ts` (add table)
- `src/backend/services/dynamic-polling-manager.ts` (add handler)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)

**Documentation:** `FUTURE-PLANS/CLIP-POLLING-FEATURE.md`

---

### 🎯 Phase 7: Event Actions Feature (20-30 hours)

**Goal:** Customizable alerts (text/sound/image/video) for all events

#### Features
- ✅ Event Actions

#### Why Seventh?
- **Depends on:** Phases 1, 2, 3, 6 (needs polling events for full value)
- **Most complex feature** - involves shared formatter, browser source, Socket.IO
- **Highest user value** - customizable stream alerts
- **Critical path item** - requires extracting event formatter from Events screen

#### Deliverables
1. **Shared event formatter** - `src/shared/utils/event-formatter.ts`
2. Database migration: `event_actions` table
3. `EventActionsRepository` class
4. `EventActionProcessor` service
5. `BrowserSourceServer` with Socket.IO
6. IPC handlers for event action management
7. `EventActionsScreen` frontend component
8. `AlertPopup` in-app component
9. Browser source HTML page
10. Refactor Events screen to use shared formatter

#### Event Types Supported
- All 41+ existing event types
- Follower: `channel.follow`, `channel.unfollow`
- Moderation: 4 types (ban, unban, timeout, timeout_lifted)
- Clips: `channel.clip.created`
- Role changes: VIP/mod granted/revoked

#### Acceptance Criteria
- [ ] Shared formatter used by Events screen
- [ ] Shared formatter used by event actions
- [ ] Shared formatter used by browser source
- [ ] Create/edit/delete event actions
- [ ] Action types: text, sound, image, video
- [ ] Template variables work ({{username}}, etc.)
- [ ] In-app alerts display
- [ ] Browser source receives alerts via Socket.IO
- [ ] OBS integration works

#### Files to Create
- `src/shared/utils/event-formatter.ts` ⭐ **CRITICAL**
- `src/backend/database/repositories/event-actions.ts`
- `src/backend/services/event-action-processor.ts`
- `src/backend/services/browser-source-server.ts`
- `src/backend/core/ipc-handlers/event-actions.ts`
- `src/frontend/screens/event-actions/event-actions.tsx`
- `src/frontend/components/AlertPopup.tsx`
- `src/frontend/services/event-actions.ts`

#### Files to Modify
- `src/backend/database/migrations.ts` (add table)
- `src/frontend/screens/events/events.tsx` (use shared formatter)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)

**Documentation:** `FUTURE-PLANS/EVENT-ACTIONS-FEATURE.md`

---

### 💬 Phase 8: Discord Webhooks Feature (6-10 hours)

**Goal:** Send custom messages to Discord channels

#### Features
- ✅ Discord Webhooks

#### Why Eighth?
- **No dependencies** - standalone feature
- **Simpler Discord feature** - no bot required
- **Prepares for Discord Bot** - tests Discord integration
- **Medium user value** - useful for community updates

#### Deliverables
1. Database migration: `discord_webhooks` + `discord_webhook_history` tables
2. `DiscordWebhooksRepository` class
3. `DiscordWebhookSender` service
4. IPC handlers for webhook management
5. `DiscordWebhooksScreen` frontend component
6. Template variable support
7. Test webhook functionality

#### Acceptance Criteria
- [ ] Create/edit/delete webhooks
- [ ] Send messages to Discord
- [ ] Test webhooks before saving
- [ ] Template variables work
- [ ] Message history tracked
- [ ] Custom bot username/avatar
- [ ] Error handling for invalid URLs

#### Files to Create
- `src/backend/database/repositories/discord-webhooks.ts`
- `src/backend/services/discord-webhook-sender.ts`
- `src/backend/core/ipc-handlers/discord-webhooks.ts`
- `src/frontend/screens/discord-webhooks/discord-webhooks.tsx`

#### Files to Modify
- `src/backend/database/migrations.ts` (add tables)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)

**Documentation:** `FUTURE-PLANS/DISCORD-WEBHOOKS-FEATURE.md`

---

### 💬 Phase 9: Discord TTS Bot Feature (12-16 hours)

**Goal:** Discord bot that answers TTS-related queries

#### Features
- ✅ Discord TTS Bot

#### Why Ninth?
- **Depends on:** Phase 5 (chat commands - ~voices integration)
- **Optional dependency:** Phase 8 (Discord webhooks - tests Discord API)
- **Most complex Discord feature** - requires Discord.js, bot auth
- **High user engagement** - cross-platform TTS management
- **Completes ecosystem** - Twitch + Discord integration

#### Deliverables
1. Install `discord.js` dependency
2. Database migration: `discord_bot_config` table
3. `DiscordBotConfigRepository` class
4. `VoiceSearchService` class (reuses existing repos)
5. `DiscordBotService` class
6. `DiscordCommandHandler` class with 5 commands
7. IPC handlers for bot management
8. `DiscordBotScreen` frontend component
9. Setup instructions documentation

#### Commands Implemented
- `!tts search [filters]` - Search voices
- `!tts myvoice` - Show user's current voice
- `!tts access` - Display TTS access restrictions
- `!tts lookup <voice_id>` - Get voice details
- `!tts help` - Show help

#### Acceptance Criteria
- [ ] Bot connects to Discord successfully
- [ ] All 5 commands work
- [ ] Voice search with filters
- [ ] Pagination for large results
- [ ] User voice lookup works
- [ ] Access restrictions display correctly
- [ ] Integration with existing TTS system
- [ ] No logic duplication (reuses repositories)

#### Files to Create
- `src/backend/database/repositories/discord-bot-config.ts`
- `src/backend/services/voice-search-service.ts`
- `src/backend/services/discord-bot-service.ts`
- `src/backend/services/discord-command-handler.ts`
- `src/backend/core/ipc-handlers/discord-bot.ts`
- `src/frontend/screens/discord-bot/discord-bot.tsx`

#### Files to Modify
- `src/backend/database/migrations.ts` (add table)
- `src/backend/core/ipc-handlers/index.ts` (register handlers)
- `src/frontend/components/Menu.tsx` (add navigation)
- `package.json` (add discord.js dependency)

**Documentation:** `FUTURE-PLANS/DISCORD-TTS-BOT-FEATURE.md`

---

## Dependency Graph

```
Phase 1: Polling Events Integration (Foundation)
    ↓
    ├─→ Phase 2: Follower Polling ──┐
    │                                 │
    ├─→ Phase 3: Moderation Polling ─┤
    │                                 │
    └─→ Phase 6: Clip Polling ────────┤
                                      ↓
Phase 4: Enhanced Viewer TTS Rules → Phase 7: Event Actions (Combines all polling events)
    ↓
Phase 5: Chat Commands ──────────────┐
                                     │
Phase 8: Discord Webhooks ───────────┤
                                     ↓
                                Phase 9: Discord TTS Bot
```

---

## Critical Path Items

### 🔴 Must Complete in Order

1. **Phase 1** before any polling features (2, 3, 6)
2. **Phase 4** before Phase 5 (database schema dependency)
3. **Phases 2, 3, 6** before Phase 7 for full value
4. **Phase 5** before Phase 9 (chat command integration)

### 🟡 Can Be Parallelized

- **Phase 4** can be done anytime (no dependencies)
- **Phase 8** can be done anytime (no dependencies)
- **Phases 2, 3, 6** can be done in any order after Phase 1

---

## Recommended Implementation Schedule

### Week 1: Foundation (20-26 hours)
- ✅ Phase 1: Polling Events Integration (8-12h)
- ✅ Phase 2: Follower Polling (8-12h)
- ✅ Phase 4: Enhanced Viewer TTS Rules (6-10h) - parallel track

### Week 2: Polling + Commands (20-28 hours)
- ✅ Phase 3: Moderation Status Polling (10-14h)
- ✅ Phase 5: Chat Commands System (10-14h)

### Week 3: Clips + Event Actions Part 1 (21-27 hours)
- ✅ Phase 6: Clip Polling (11-17h)
- ✅ Phase 7: Event Actions - Shared Formatter + Database (10h estimate)

### Week 4: Event Actions Part 2 + Discord (26-36 hours)
- ✅ Phase 7: Event Actions - Browser Source + UI (10-20h estimate)
- ✅ Phase 8: Discord Webhooks (6-10h)

### Week 5: Discord Bot (12-16 hours)
- ✅ Phase 9: Discord TTS Bot (12-16h)

**Total:** 5 weeks @ ~20-30 hours/week = 100-150 hours

---

## Feature Checklist

### Core Features
- [ ] Phase 1: Polling Events Integration ✅ 8-12h
- [ ] Phase 2: Follower Polling ✅ 8-12h
- [ ] Phase 3: Moderation Status Polling ✅ 10-14h
- [ ] Phase 4: Enhanced Viewer TTS Rules ✅ 6-10h
- [ ] Phase 5: Chat Commands System ✅ 10-14h

### Advanced Features
- [ ] Phase 6: Clip Polling ✅ 11-17h
- [ ] Phase 7: Event Actions ✅ 20-30h

### Discord Features
- [ ] Phase 8: Discord Webhooks ✅ 6-10h
- [ ] Phase 9: Discord TTS Bot ✅ 12-16h

---

## Risk Assessment

| Phase | Risk Level | Mitigation |
|-------|------------|------------|
| Phase 1 | Low | Additive change, no breaking changes |
| Phase 2 | Low | Simplest poller, well-documented API |
| Phase 3 | Medium | Dual API polling - test thoroughly |
| Phase 4 | Low | UI-only changes |
| Phase 5 | Medium | Chat integration - needs rate limiting |
| Phase 6 | Medium | Large API responses - pagination critical |
| Phase 7 | High | Complex - shared formatter is critical path |
| Phase 8 | Low | Standard webhook API |
| Phase 9 | Medium | Discord bot auth complexity |

---

## Success Metrics

### Phase 1 Completion
- ✅ All pollers write events
- ✅ No duplicate events
- ✅ Events screen shows polling events

### Phase 2-3-6 Completion
- ✅ Follower/mod/clip changes detected
- ✅ Statistics screens functional
- ✅ Polling configs adjustable

### Phase 4-5 Completion
- ✅ Viewer TTS rules UI complete
- ✅ All 8 chat commands work
- ✅ Moderators can manage TTS via chat

### Phase 7 Completion
- ✅ Shared formatter extracted
- ✅ In-app alerts work
- ✅ Browser source receives alerts
- ✅ OBS integration tested

### Phase 8-9 Completion
- ✅ Discord webhooks send messages
- ✅ Discord bot connects and responds
- ✅ Voice search works via Discord

---

## Testing Strategy

### Per-Phase Testing
1. **Unit Tests** - Repository methods (if time allows)
2. **Integration Tests** - IPC handlers work correctly
3. **UI Tests** - Frontend components render and function
4. **End-to-End Tests** - Full feature flow works

### Final Integration Testing
1. **Cross-Feature** - Event Actions receive all event types
2. **Performance** - Polling doesn't degrade app performance
3. **Error Handling** - Graceful failures for API errors
4. **User Acceptance** - Real streamer testing

---

## Rollback Plan

Each phase is designed to be:
- ✅ **Additive** - No breaking changes to existing features
- ✅ **Toggleable** - Features can be disabled via config
- ✅ **Reversible** - Database migrations can be rolled back
- ✅ **Independent** - Phase failures don't cascade

---

## Notes for Implementation

### Key Architectural Decisions

1. **Shared Event Formatter (Phase 7)**
   - Extract from Events screen FIRST
   - Single source of truth for all event formatting
   - Used by: Events screen, Event Actions, Browser Source

2. **Polling Events (Phase 1)**
   - Foundation for all pollers
   - Must be solid before building on it

3. **Viewer TTS Rules (Phase 4)**
   - Creates database schema needed by Chat Commands
   - Can be done in parallel with other phases

4. **Discord Features (Phases 8-9)**
   - Independent from core TTS features
   - Can be deferred if needed

### Performance Considerations

- **Polling intervals** - Start conservative, optimize later
- **Event batching** - Use transactions for multiple events
- **Browser source** - Socket.IO connection management
- **Background jobs** - Cleanup expired rules every 5 minutes

### Code Quality

- Follow existing patterns
- Reuse repositories where possible
- Document complex logic
- Add error handling
- Log important operations

---

## Post-Implementation

### After All Phases Complete

1. **User Documentation** - Write user guides for each feature
2. **Performance Tuning** - Optimize polling intervals
3. **Bug Fixes** - Address issues from real-world usage
4. **Optional Refactoring** - Consider items from OPTIONAL-REFACTORING-OPPORTUNITIES.md

### Future Enhancements

- Event action conditions (if subscriber, if VIP, etc.)
- Advanced browser source layouts
- Event action templates
- Analytics dashboard
- Multi-channel support

---

## Summary

This roadmap provides a clear, dependency-aware path for implementing all Stream Synth future features. By following this order, you'll:

1. ✅ Build a solid foundation (polling events)
2. ✅ Add valuable user features incrementally
3. ✅ Avoid rework from dependency issues
4. ✅ Deliver working features at each phase
5. ✅ Minimize risk through independent phases

**Start with Phase 1 and work sequentially through the phases. Good luck! 🚀**

---

**Document Version:** 1.0  
**Created:** October 2025  
**Owner:** Development Team  
**Review Cadence:** After each phase completion
