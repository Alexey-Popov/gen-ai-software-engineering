# Implementation Plan: Bug 001 - Off-by-One Fix

## Summary
Fix pagination offset calculation in `getUsers` function.

## Changes

### Change 1: Fix Offset Calculation

**File**: `src/services/userService.js`
**Line**: 10

**Before**:
```javascript
const offset = page * limit; // BUG: should be (page - 1) * limit
```

**After**:
```javascript
const offset = (page - 1) * limit;
```

**Test Command**: `npm test`

## Verification Steps

1. Start server: `npm start`
2. Request page 1: `curl http://localhost:3000/users?page=1&limit=2`
3. Verify first user (id=1) is in response
4. Request page 2: `curl http://localhost:3000/users?page=2&limit=2`
5. Verify users 3-4 are returned (not 1-2)

## Expected Results

### Before Fix
```json
GET /users?page=1&limit=2
{
  "users": [
    { "id": 3, "name": "Charlie Brown" },
    { "id": 4, "name": "Diana Prince" }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 5 }
}
```

### After Fix
```json
GET /users?page=1&limit=2
{
  "users": [
    { "id": 1, "name": "Alice Johnson" },
    { "id": 2, "name": "Bob Smith" }
  ],
  "pagination": { "page": 1, "limit": 2, "total": 5 }
}
```

## Rollback
If issues occur, revert line 10 to: `const offset = page * limit;`
