# Codebase Research: Bug 002 - Null Reference Error

## Overview
Investigation of null reference crash in user lookup functionality.

## Affected Files

### src/services/userService.js:25-42
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

### src/routes/users.js:47-66
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

### src/db/database.js:41-44
```javascript
const getUserById = (id) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);  // Returns undefined if not found
};
```

### src/constants/index.js:9-16
```javascript
const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  // ...
};
```

## Analysis

### Bug Location
The bug is in `src/services/userService.js` at lines 30-39.

### Why It Crashes
1. `db.getUserById(999)` returns `undefined` for non-existent ID
2. Code tries to access `user.name.toUpperCase()`
3. `undefined.name` throws TypeError

### Existing Constants
`ERROR_MESSAGES.USER_NOT_FOUND` exists but is not used.

### Fix Strategy
1. Check if user exists before formatting
2. Return `null` if not found
3. Update route to return 404

## References
- `src/services/userService.js:30-39` - Bug location
- `src/routes/users.js:47-66` - Route handler
- `src/constants/index.js:10` - USER_NOT_FOUND message
- `src/db/database.js:41-44` - DB returns undefined for missing
