const db = require('../db/database');
const { ERROR_MESSAGES } = require('../constants');

/**
 * BUG #1: Off-by-One Error
 * Offset should be (page - 1) * limit, not page * limit
 * Page 1 skips first records instead of starting from 0
 */
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

/**
 * BUG #2: Null Reference Error
 * No null check before accessing user properties
 * Crashes with "Cannot read property 'name' of undefined"
 */
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

const searchUsers = (name) => {
  if (!name || name.trim() === '') {
    return [];
  }
  return db.searchUsersByName(name);
};

const createUser = (name, email) => {
  if (!name) {
    throw new Error(ERROR_MESSAGES.NAME_REQUIRED);
  }

  if (!email) {
    throw new Error(ERROR_MESSAGES.EMAIL_REQUIRED);
  }

  if (!isValidEmail(email)) {
    throw new Error(ERROR_MESSAGES.INVALID_EMAIL);
  }

  return db.createUser(name, email);
};

const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

module.exports = {
  getUsers,
  getUserById,
  searchUsers,
  createUser,
};
