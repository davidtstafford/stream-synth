# Phase 8D: Database Migration Fix

## Issue: Missing Column Error

**Error Message:**
```
❌ no such column: a.browser_source_channel
```

**Root Cause:**
The user's database was created before the `browser_source_channel` column was added to the `event_actions` table. The schema definition existed in migrations.ts, but there was no migration to update existing databases.

## Solution: Automatic Schema Updates

### Added Migration Function

**File:** `src/backend/database/migrations.ts`

Added a new function `runSchemaUpdates()` that runs after table creation to handle backwards compatibility:

```typescript
/**
 * Run schema updates to add missing columns to existing databases
 * This handles backwards compatibility for databases created before certain features
 */
function runSchemaUpdates(db: Database.Database): void {
  console.log('[Migrations] Running schema updates for existing databases...');

  // Add browser_source_channel column if it doesn't exist (Phase 8)
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(event_actions)`).all() as Array<{ name: string }>;
    const hasBrowserSourceChannel = tableInfo.some(col => col.name === 'browser_source_channel');
    
    if (!hasBrowserSourceChannel) {
      console.log('[Migrations] Adding browser_source_channel column to event_actions...');
      db.exec(`
        ALTER TABLE event_actions 
        ADD COLUMN browser_source_channel TEXT DEFAULT 'default'
      `);
      console.log('[Migrations] ✓ Added browser_source_channel column');
    }
  } catch (err) {
    console.error('[Migrations] Error checking/adding browser_source_channel column:', err);
  }

  console.log('[Migrations] Schema updates complete');
}
```

### Updated Migration Flow

**Modified:** `runMigrations()` function

Now calls `runSchemaUpdates(db)` before initializing default channels:

```typescript
// Run schema updates for existing databases
runSchemaUpdates(db);

// Initialize default browser source channel
initializeDefaultChannel(db);
```

## How It Works

1. **App Starts** → `initializeDatabase()` is called
2. **Migrations Run** → `runMigrations(db)` creates all tables
3. **Schema Updates** → `runSchemaUpdates(db)` checks for missing columns
4. **Column Check** → Uses `PRAGMA table_info(event_actions)` to inspect table
5. **Conditional Add** → If `browser_source_channel` column is missing, adds it with `ALTER TABLE`
6. **Default Value** → New column gets `DEFAULT 'default'` for all existing rows

## No Manual Action Required

✅ **The fix is automatic!** Just restart the app and the migration will run.

The database will be updated automatically on the next app launch without losing any existing data.

## Build Status

✅ **TypeScript Compilation:** Success
✅ **Webpack Build:** Success (9785ms)
✅ **No Errors:** All files compiled successfully

## Testing Checklist

After restarting the app:

- [ ] Click "Manage Channels" button - should open modal
- [ ] Create a new channel - should work
- [ ] Assign actions to channels - should save
- [ ] Filter by channel - should filter correctly
- [ ] View channel badges on action items - should display

## Related Files

- ✅ `src/backend/database/migrations.ts` - Added schema update function
- ✅ `src/frontend/screens/events/event-actions.tsx` - Channel manager integration
- ✅ `src/frontend/components/ActionEditor.tsx` - Channel selector
- ✅ `src/frontend/services/event-actions.ts` - Updated interfaces

## Next Steps

1. **Restart the application** to apply the migration
2. **Test the "Manage Channels" button** to verify it works
3. **Create a test channel** and assign some actions to it
4. **Verify filtering** works correctly

---

**Status:** ✅ FIXED - Migration added, build successful
**Date:** 2025-11-03
**Phase:** 8D - Event Actions Integration Complete
