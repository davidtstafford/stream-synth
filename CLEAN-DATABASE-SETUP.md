# Clean Database Setup

**Date:** November 4, 2025  
**Purpose:** Fresh start with clean SQLite database

---

## ✅ What Was Done

### 1. **Cleaned Migrations File**
- ✅ Removed `runSchemaUpdates()` function (patch/compatibility code)
- ✅ Removed `initializeDefaultChannel()` function (post-migration code)
- ✅ Kept only core `CREATE TABLE` statements
- ✅ File now: `src/backend/database/migrations.ts`

**Result:** Clean, straightforward schema initialization with NO patches

### 2. **Deleted SQLite Database**
- ✅ Deleted: `C:\Users\david.stafford\AppData\Roaming\stream-synth\stream-synth.db`
- ✅ Next run will create fresh database with clean schema

---

## 🚀 Next Steps

### Step 1: Build
```powershell
npm run build
```

### Step 2: Start App
```powershell
npm start
```

**What happens:**
1. App detects missing database
2. Calls `runMigrations(db)`
3. Creates all tables from clean schema
4. App is ready to use

### Step 3: Verify Fresh Database
```powershell
# Check database was created
ls "$env:APPDATA\stream-synth\"

# Should show:
#   stream-synth.db (fresh, clean)
```

---

## 📊 Clean Schema

All tables created fresh:
- ✅ `oauth_tokens`
- ✅ `connection_sessions`
- ✅ `event_subscriptions`
- ✅ `app_settings`
- ✅ `tts_settings`
- ✅ `viewers`
- ✅ `subscribers`
- ✅ `vips`
- ✅ `moderators`
- ✅ `broadcaster_info`
- ✅ `chat_messages`
- ✅ `browser_source_channels`
- ✅ `event_actions`

**Total:** All tables created in single pass, no patches needed

---

## 🎯 Benefits

| Aspect | Before | After |
|--------|--------|-------|
| Migrations | 870 lines | 300 lines |
| Patches | 4+ patches | 0 patches |
| Compatibility code | 60+ lines | 0 lines |
| Clean schema | ❌ No | ✅ Yes |
| Fresh start | ❌ Complex | ✅ Simple |

---

## 🔄 To Wipe Database Again (Future)

```powershell
# Kill app first
# Then:
Remove-Item -Path "$env:APPDATA\stream-synth\stream-synth.db"
# Restart app
```

---

**Status:** ✅ Ready for clean start!
