# Codebase Research: Bug 001 - Off-by-One Error

## Overview
Investigation of pagination bug in user listing functionality.

## Affected Files

### src/services/userService.js:9-23
```javascript
const getUsers = (page = 1, limit = 10) => {
  const offset = page * limit; // BUG: should be (page - 1) * limit
  const users = db.getAllUsers(limit, offset);
  const total = db.countUsers();

  return {
    users,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};
```

### src/routes/users.js:8-24
```javascript
router.get('/', (req, res) => {
  try {
    const page = parseInt(req.query.page, 10) || PAGINATION.DEFAULT_PAGE;
    const limit = Math.min(
      parseInt(req.query.limit, 10) || PAGINATION.DEFAULT_LIMIT,
      PAGINATION.MAX_LIMIT
    );

    const result = userService.getUsers(page, limit);
    res.json(result);
  } catch (error) {
    res.status(HTTP_STATUS.INTERNAL_ERROR).json({
      error: ERROR_MESSAGES.INTERNAL_ERROR,
      message: error.message,
    });
  }
});
```

### src/db/database.js:36-39
```javascript
const getAllUsers = (limit, offset) => {
  const stmt = db.prepare('SELECT * FROM users LIMIT ? OFFSET ?');
  return stmt.all(limit, offset);
};
```

## Analysis

### Bug Location
The bug is in `src/services/userService.js` at line 10:
```javascript
const offset = page * limit;
```

### Why It's Wrong
For 1-based pagination (page starts at 1):
- Page 1: offset should be 0 → `(1-1) * 10 = 0`
- Page 2: offset should be 10 → `(2-1) * 10 = 10`

Current calculation:
- Page 1: offset is 10 → `1 * 10 = 10` (WRONG)
- Page 2: offset is 20 → `2 * 10 = 20` (WRONG)

### Fix
Change line 10 from:
```javascript
const offset = page * limit;
```
To:
```javascript
const offset = (page - 1) * limit;
```

## References
- `src/services/userService.js:10` - Bug location
- `src/constants/index.js:18-22` - Pagination defaults
- `src/db/database.js:36-39` - Database query (correct)
