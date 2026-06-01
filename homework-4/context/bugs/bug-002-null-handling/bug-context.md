# Bug 002: Null Reference Error in getUserById

## Summary
The `getUserById` function crashes when user is not found instead of returning 404.

## Symptoms
- Server crashes when requesting non-existent user
- 500 Internal Server Error instead of 404 Not Found
- Error: "Cannot read property 'name' of undefined"

## Location
- **File**: `src/services/userService.js`
- **Function**: `getUserById(id)`
- **Line**: ~30-42

## Expected Behavior
- Return `null` when user not found
- Route returns 404 status code
- Graceful error message to client

## Actual Behavior
- Function attempts to access `user.name` on undefined
- Throws TypeError
- Server returns 500 Internal Server Error

## Root Cause
No null check before accessing properties on `user` object returned from database.

## Impact
- **Severity**: HIGH
- **Users Affected**: Anyone requesting non-existent user IDs
- **System Impact**: Unhandled exception, poor error messages
