const path = require('path');

process.env.DB_PATH = path.join(__dirname, '../../data/test-users.db');

const userService = require('../../src/services/userService');
const db = require('../../src/db/database');

describe('UserService', () => {
  beforeAll(() => {
    db.getDb();
  });

  afterAll(() => {
    db.closeDb();
  });

  describe('getUsers', () => {
    it('should return users with pagination', () => {
      const result = userService.getUsers(1, 10);

      expect(result).toHaveProperty('users');
      expect(result).toHaveProperty('pagination');
      expect(Array.isArray(result.users)).toBe(true);
    });

    it('should return pagination metadata', () => {
      const result = userService.getUsers(1, 2);

      expect(result.pagination).toHaveProperty('page', 1);
      expect(result.pagination).toHaveProperty('limit', 2);
      expect(result.pagination).toHaveProperty('total');
      expect(result.pagination).toHaveProperty('totalPages');
    });
  });

  describe('createUser', () => {
    it('should create a user with valid input', () => {
      const name = 'Test User ' + Date.now();
      const email = `test${Date.now()}@example.com`;

      const user = userService.createUser(name, email);

      expect(user).toHaveProperty('id');
      expect(user.name).toBe(name);
      expect(user.email).toBe(email);
    });

    it('should throw error when name is missing', () => {
      expect(() => userService.createUser(null, 'test@example.com'))
        .toThrow('Name is required');
    });

    it('should throw error when email is missing', () => {
      expect(() => userService.createUser('Test', null))
        .toThrow('Email is required');
    });

    it('should throw error for invalid email', () => {
      expect(() => userService.createUser('Test', 'invalid-email'))
        .toThrow('Invalid email format');
    });
  });

  describe('searchUsers', () => {
    it('should return empty array for empty search', () => {
      const result = userService.searchUsers('');
      expect(result).toEqual([]);
    });

    it('should return users matching name', () => {
      const result = userService.searchUsers('Alice');
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
