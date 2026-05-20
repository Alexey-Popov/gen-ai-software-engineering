const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

let db = null;

const getDb = () => {
  if (!db) {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../../data/users.db');
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    db = new Database(dbPath);
    initializeSchema();
  }
  return db;
};

const initializeSchema = () => {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const count = db.prepare('SELECT COUNT(*) as count FROM users').get();
  if (count.count === 0) {
    const insert = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
    insert.run('Alice Johnson', 'alice@example.com');
    insert.run('Bob Smith', 'bob@example.com');
    insert.run('Charlie Brown', 'charlie@example.com');
    insert.run('Diana Prince', 'diana@example.com');
    insert.run('Eve Wilson', 'eve@example.com');
  }
};

const getAllUsers = (limit, offset) => {
  const stmt = db.prepare('SELECT * FROM users LIMIT ? OFFSET ?');
  return stmt.all(limit, offset);
};

const getUserById = (id) => {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  return stmt.get(id);
};

/**
 * SECURITY VULNERABILITY: SQL Injection
 * Uses string concatenation instead of parameterized queries.
 * Attack example: searchUsersByName("'; DROP TABLE users; --")
 */
const searchUsersByName = (name) => {
  const query = 'SELECT * FROM users WHERE name LIKE \'%' + name + '%\'';
  return db.prepare(query).all();
};

const createUser = (name, email) => {
  const stmt = db.prepare('INSERT INTO users (name, email) VALUES (?, ?)');
  const result = stmt.run(name, email);
  return { id: result.lastInsertRowid, name, email };
};

const countUsers = () => {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM users');
  return stmt.get().count;
};

const closeDb = () => {
  if (db) {
    db.close();
    db = null;
  }
};

module.exports = {
  getDb,
  getAllUsers,
  getUserById,
  searchUsersByName,
  createUser,
  countUsers,
  closeDb,
};
