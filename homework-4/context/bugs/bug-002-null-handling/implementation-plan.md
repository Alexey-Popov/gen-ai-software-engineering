# Implementation Plan: Bug 002 - Null Handling Fix

## Summary
Add null check in `getUserById` and proper 404 handling in route.

## Changes

### Change 1: Add Null Check in Service

**File**: `src/services/userService.js`
**Lines**: 30-42

**Before**:
```javascript
const getUserById = (id) => {
  const user = db.getUserById(id);

  // BUG: crashes if user is null/undefined
  const formattedUser = {
    id: user.id,
    name: user.name.toUpperCase(),
    email: user.email,
    createdAt: user.created_at,
  };

  return formattedUser;
};
```

**After**:
```javascript
const getUserById = (id) => {
  const user = db.getUserById(id);

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    name: user.name.toUpperCase(),
    email: user.email,
    createdAt: user.created_at,
  };
};
```

### Change 2: Handle Null in Route

**File**: `src/routes/users.js`
**Lines**: 47-66

**Before**:
```javascript
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.INVALID_INPUT,
        message: 'Invalid user ID',
      });
    }

    const user = userService.getUserById(id);
    res.json(user);
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});
```

**After**:
```javascript
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      return res.status(HTTP_STATUS.BAD_REQUEST).json({
        error: ERROR_MESSAGES.INVALID_INPUT,
        message: 'Invalid user ID',
      });
    }

    const user = userService.getUserById(id);

    if (!user) {
      return res.status(HTTP_STATUS.NOT_FOUND).json({
        error: ERROR_MESSAGES.USER_NOT_FOUND,
        message: `User with ID ${id} not found`,
      });
    }

    res.json(user);
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});
```

**Test Command**: `npm test`

## Verification Steps

1. Start server: `npm start`
2. Request existing user: `curl http://localhost:3000/users/1`
3. Verify user data returned with 200 status
4. Request non-existent user: `curl http://localhost:3000/users/999`
5. Verify 404 status and "User not found" message

## Expected Results

### Before Fix
```
GET /users/999
HTTP 500 Internal Server Error
{ "error": "Internal server error", "message": "Cannot read property 'name' of undefined" }
```

### After Fix
```
GET /users/999
HTTP 404 Not Found
{ "error": "User not found", "message": "User with ID 999 not found" }
```

## Rollback
Revert both files to previous state if issues occur.
