const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Register
router.post('/register', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password || !displayName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const existing = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
    if (existing) {
      return res.status(409).json({ error: 'Username or email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const userId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO users (id, username, email, password, display_name, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, username, email, hashedPassword, displayName, now, now);

    const token = jwt.sign(
      { userId, username, email },
      process.env.JWT_SECRET || 'nexus_secret',
      { expiresIn: '30d' }
    );

    const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, status, theme FROM users WHERE id = ?').get(userId);

    res.status(201).json({ token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const db = req.app.get('db');
    const { login, password } = req.body;

    if (!login || !password) {
      return res.status(400).json({ error: 'Login and password are required' });
    }

    const user = db.prepare('SELECT * FROM users WHERE username = ? OR email = ?').get(login, login);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Update online status
    db.prepare('UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?').run(Date.now(), user.id);

    const token = jwt.sign(
      { userId: user.id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'nexus_secret',
      { expiresIn: '30d' }
    );

    const safeUser = db.prepare('SELECT id, username, email, display_name, avatar, bio, status, theme FROM users WHERE id = ?').get(user.id);
    res.json({ token, user: safeUser });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, phone, status, is_online, last_seen, theme, language, public_key, created_at FROM users WHERE id = ?').get(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update profile
router.put('/profile', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { displayName, bio, status, avatar, phone, theme, language } = req.body;

    const updates = [];
    const values = [];

    if (displayName !== undefined) { updates.push('display_name = ?'); values.push(displayName); }
    if (bio !== undefined) { updates.push('bio = ?'); values.push(bio); }
    if (status !== undefined) { updates.push('status = ?'); values.push(status); }
    if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
    if (phone !== undefined) { updates.push('phone = ?'); values.push(phone); }
    if (theme !== undefined) { updates.push('theme = ?'); values.push(theme); }
    if (language !== undefined) { updates.push('language = ?'); values.push(language); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    updates.push('updated_at = ?');
    values.push(Date.now());
    values.push(req.userId);

    db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const user = db.prepare('SELECT id, username, email, display_name, avatar, bio, phone, status, theme, language FROM users WHERE id = ?').get(req.userId);
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Store public key for E2E encryption
router.post('/public-key', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { publicKey } = req.body;
    db.prepare('UPDATE users SET public_key = ? WHERE id = ?').run(publicKey, req.userId);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
