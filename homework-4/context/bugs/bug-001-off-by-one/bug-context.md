# Bug 001: Off-by-One Error in Pagination

## Summary
The `getUsers` function in `userService.js` calculates incorrect offset for pagination.

## Symptoms
- Page 1 returns empty results (skips first records)
- Users report missing data on first page
- Pagination shows correct total but wrong results

## Location
- **File**: `src/services/userService.js`
- **Function**: `getUsers(page, limit)`
- **Line**: ~10

## Expected Behavior
- Page 1 with limit 10 should return records 0-9 (offset 0)
- Page 2 with limit 10 should return records 10-19 (offset 10)

## Actual Behavior
- Page 1 with limit 10 returns records 10-19 (offset 10)
- First page of data is never accessible

## Root Cause
Offset calculation uses `page * limit` instead of `(page - 1) * limit`

## Impact
- **Severity**: HIGH
- **Users Affected**: All users viewing paginated lists
- **Data Loss**: No, but data inaccessible on page 1
