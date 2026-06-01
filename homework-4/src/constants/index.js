const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  INTERNAL_ERROR: 500,
};

const ERROR_MESSAGES = {
  USER_NOT_FOUND: 'User not found',
  INVALID_INPUT: 'Invalid input provided',
  NAME_REQUIRED: 'Name is required',
  EMAIL_REQUIRED: 'Email is required',
  INVALID_EMAIL: 'Invalid email format',
  INTERNAL_ERROR: 'Internal server error',
};

const PAGINATION = {
  DEFAULT_PAGE: 1,
  DEFAULT_LIMIT: 10,
  MAX_LIMIT: 100,
};

module.exports = {
  HTTP_STATUS,
  ERROR_MESSAGES,
  PAGINATION,
};
