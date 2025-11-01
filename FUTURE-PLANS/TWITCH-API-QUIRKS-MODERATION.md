# Twitch API Quirks: Moderation Bans & Timeouts

**Reference Document**  
**Last Updated:** October 30, 2025  

---

## Overview

This document catalogs known quirks and inconsistencies in Twitch's Helix API `/moderation/banned` endpoint, discovered during Phase 3 implementation of Stream Synth.

---

## The Problem

### Expected API Behavior

According to Twitch's API documentation:

| Field | Type | Description |
|-------|------|-------------|
| `expires_at` | string \| null | RFC3339 timestamp of when timeout expires. **null if user is permanently banned** |

### Actual API Behavior

**Inconsistent!** Twitch returns different values for `expires_at` on permanent bans:

| Scenario | Expected `expires_at` | Actual `expires_at` | Frequency |
|----------|----------------------|---------------------|-----------|
| Permanent ban via `/ban` | `null` | `""` (empty string) | **MOST COMMON** ✅ |
| Permanent ban via `/ban` | `null` | `null` | Sometimes ✅ |
| Permanent ban via `/ban` | `null` | `"0001-01-01T00:00:00Z"` | Rare ❌ |
| Permanent ban via Twitch UI | `null` | Far future timestamp (year 9999+) | Very Rare ❌ |
| 10-minute timeout | RFC3339 timestamp | RFC3339 timestamp (e.g., `"2025-10-30T13:10:00Z"`) | Always ✅ |

---

## Detection Strategy

### ❌ Naive Approach (WRONG)

```typescript
const isPermanentBan = bannedUser.expires_at === null;
```

**Problem:** Only handles 1 of 3 permanent ban patterns!

### ✅ Robust Approach (CORRECT)

```typescript
function isPermanentBan(expiresAt: string | null): boolean {
  // Pattern 1: Explicitly null or empty string (MOST COMMON!)
  if (expiresAt === null || expiresAt === '') {
    return true;
  }

  // Pattern 2: "0001-01-01T00:00:00Z" (API bug)
  if (expiresAt.startsWith('0001-01-01')) {
    return true;
  }

  // Pattern 3: Far future date (> 1 year from now)
  const expiresDate = new Date(expiresAt);
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

  if (expiresDate > oneYearFromNow) {
    return true;
  }

  // Reasonable timestamp = timeout
  return false;
}
```

**Handles all 4 permanent ban patterns!** ✅

---

## Real-World Examples

### Example 1: Permanent Ban (Empty String Pattern) ⚠️ **MOST COMMON**

**API Response:**
```json
{
  "user_id": "1362524977",
  "user_login": "eggieberttestacc",
  "user_name": "eggieberttestacc",
  "expires_at": "",
  "created_at": "2025-10-30T13:03:02Z",
  "reason": "",
  "moderator_id": "131323084",
  "moderator_login": "eggiebert"
}
```

**Detection:** `isPermanentBan("")` → **true** ✅  
**Why:** Empty string is Twitch's most common way of indicating "no expiration"  
**Discovered:** October 30, 2025 via real-world testing with channel "eggiebert"

---

### Example 2: Permanent Ban (Null Pattern)

**API Response:**
```json
{
  "user_id": "12345",
  "user_login": "baduser",
  "user_name": "BadUser",
  "expires_at": null,
  "created_at": "2025-10-30T12:54:00Z",
  "reason": "Spam"
}
```

**Detection:** `isPermanentBan(null)` → **true** ✅

---

### Example 3: Permanent Ban (0001 Pattern) ⚠️

**API Response:**
```json
{
  "user_id": "12345",
  "user_login": "baduser",
  "user_name": "BadUser",
  "expires_at": "0001-01-01T00:00:00Z",
  "created_at": "2025-10-30T12:54:00Z",
  "reason": "Harassment"
}
```

**Detection:** `isPermanentBan("0001-01-01T00:00:00Z")` → **true** ✅  
**Why:** Twitch uses year 1 AD (0001) as sentinel value for "no expiration"

---

### Example 3: Permanent Ban (Far Future Pattern) ⚠️

**API Response:**
```json
{
  "user_id": "12345",
  "user_login": "baduser",
  "user_name": "BadUser",
  "expires_at": "9999-12-31T23:59:59Z",
  "created_at": "2025-10-30T12:54:00Z",
  "reason": "Botting"
}
```

**Detection:** `isPermanentBan("9999-12-31T23:59:59Z")` → **true** ✅  
**Why:** Year 9999 is > 1 year from now, so treated as permanent

---

### Example 4: 10-Minute Timeout

**API Response:**
```json
{
  "user_id": "12345",
  "user_login": "chatterspammer",
  "user_name": "ChatterSpammer",
  "expires_at": "2025-10-30T13:04:00Z",
  "created_at": "2025-10-30T12:54:00Z",
  "reason": "Spamming emotes"
}
```

**Detection:** `isPermanentBan("2025-10-30T13:04:00Z")` → **false** ✅  
**Duration Calculation:**
```typescript
const durationSeconds = Math.floor(
  (new Date("2025-10-30T13:04:00Z").getTime() - new Date("2025-10-30T12:54:00Z").getTime()) / 1000
);
// Result: 600 seconds (10 minutes)
```

---

## Why This Happens

### Twitch's Internal Ban System Evolution

1. **Early Twitch (Pre-2016):** Bans used far future dates (year 9999) as "permanent"
2. **Modern Twitch (2016-2020):** Switched to `null` for permanent bans
3. **Current Twitch (2020+):** Mix of `null` and `"0001-01-01T00:00:00Z"`

**Result:** Legacy systems still return old formats, creating inconsistency!

### Why Twitch Uses "0001-01-01"

- Some database systems (e.g., SQL Server) don't support true `NULL` for datetime columns
- `"0001-01-01T00:00:00Z"` is the **minimum valid ISO 8601 date**
- Easier to handle in some backend systems than `null`

---

## Best Practices for Developers

### ✅ DO

1. **Use comprehensive detection logic** (check all 3 patterns)
2. **Log the raw `expires_at` value** during development to discover new patterns
3. **Treat far future dates (>1 year) as permanent** to be safe
4. **Test with real Twitch API**, not mocked data
5. **Document quirks** you discover for future developers

### ❌ DON'T

1. **Don't rely on `expires_at === null` alone**
2. **Don't assume Twitch's documented behavior is reality**
3. **Don't use exact string matching** (use `.startsWith()` for "0001-01-01")
4. **Don't hardcode far future dates** (use relative comparison like "1 year from now")
5. **Don't ignore API inconsistencies** thinking they'll be fixed soon (they won't!)

---

## Impact on Stream Synth

### Before Fix
- Permanent bans detected as timeouts ❌
- Events recorded as `channel.timeout` instead of `channel.ban` ❌
- Duration shown as `NaN` in UI ❌
- Statistics incorrect (ban count vs timeout count) ❌

### After Fix
- Permanent bans correctly identified ✅
- Events recorded with correct type ✅
- UI displays proper ban message ✅
- Statistics accurate ✅

---

## Related Resources

- **Twitch API Docs:** https://dev.twitch.tv/docs/api/reference/#get-banned-users
- **ISO 8601 Spec:** https://en.wikipedia.org/wiki/ISO_8601
- **RFC 3339 Spec:** https://www.rfc-editor.org/rfc/rfc3339

---

## Conclusion

**When working with Twitch's moderation API:**

> "Trust, but verify. And then verify again with a different account." 🔍

Always assume APIs have quirks, test thoroughly, and implement robust fallback logic!

---

**Document maintained by:** Stream Synth Development Team  
**Discovered by:** GitHub Copilot (during Phase 3 implementation)  
**Confirmed by:** Real-world testing with Twitch account "eggiebert"
