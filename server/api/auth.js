import express from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { config } from '../config.js';
import { validateUsername } from '../utils/validation.js';
import { handleDatabaseError, logError } from '../utils/errorHandler.js';

const router = express.Router();
const JWT_SECRET = config.JWT_SECRET;

export const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid token' });
    req.user = user;
    next();
  });
};

router.post('/register', async (req, res) => {
  const { username, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();
    const validUsername = usernameValidation.value;

    const stmt = db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)');
    stmt.run(userId, validUsername, hashedPassword);

    const token = jwt.sign({ id: userId, username: validUsername }, JWT_SECRET);
    res.json({ token, user: { id: userId, username: validUsername } });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      // More specific message since we know it's the username
      res.status(409).json({ error: 'Username already exists' });
    } else {
      logError('auth.register', error);
      res.status(500).json({ error: 'Failed to create account' });
    }
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!password) {
    return res.status(400).json({ error: 'Password is required' });
  }

  // Validate username
  const usernameValidation = validateUsername(username);
  if (!usernameValidation.valid) {
    return res.status(400).json({ error: usernameValidation.error });
  }

  try {
    const validUsername = usernameValidation.value;
    const user = db.prepare('SELECT * FROM users WHERE username = ?').get(validUsername);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    db.prepare('UPDATE users SET last_seen = unixepoch() WHERE id = ?').run(user.id);

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET);
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    logError('auth.login', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

export default router;