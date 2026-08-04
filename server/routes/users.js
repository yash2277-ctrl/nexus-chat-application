const express = require('express');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Search users
router.get('/search', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { q } = req.query;
    if (!q || q.length < 2) return res.json([]);

    const users = db.prepare(`
      SELECT id, username, display_name, avatar, bio, status, is_online, last_seen
      FROM users
      WHERE (username LIKE ? OR display_name LIKE ? OR email LIKE ?) AND id != ?
      LIMIT 20
    `).all(`%${q}%`, `%${q}%`, `%${q}%`, req.userId);

    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user by ID
router.get('/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const user = db.prepare(`
      SELECT id, username, display_name, avatar, bio, status, is_online, last_seen, public_key, created_at
      FROM users WHERE id = ?
    `).get(req.params.id);

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all users (for contacts)
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const users = db.prepare(`
      SELECT id, username, display_name, avatar, bio, status, is_online, last_seen
      FROM users WHERE id != ?
      ORDER BY display_name ASC
    `).all(req.userId);
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Block/unblock user
router.post('/:id/block', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const existing = db.prepare('SELECT * FROM contacts WHERE user_id = ? AND contact_id = ?').get(req.userId, req.params.id);

    if (existing) {
      db.prepare('UPDATE contacts SET is_blocked = ? WHERE user_id = ? AND contact_id = ?')
        .run(existing.is_blocked ? 0 : 1, req.userId, req.params.id);
    } else {
      const { v4: uuidv4 } = require('uuid');
      db.prepare('INSERT INTO contacts (user_id, contact_id, is_blocked) VALUES (?, ?, 1)')
        .run(req.userId, req.params.id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add to favorites
router.post('/:id/favorite', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const existing = db.prepare('SELECT * FROM contacts WHERE user_id = ? AND contact_id = ?').get(req.userId, req.params.id);

    if (existing) {
      db.prepare('UPDATE contacts SET is_favorite = ? WHERE user_id = ? AND contact_id = ?')
        .run(existing.is_favorite ? 0 : 1, req.userId, req.params.id);
    } else {
      db.prepare('INSERT INTO contacts (user_id, contact_id, is_favorite) VALUES (?, ?, 1)')
        .run(req.userId, req.params.id);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user's public key for E2E encryption
router.get('/:id/public-key', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const user = db.prepare('SELECT public_key FROM users WHERE id = ?').get(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ publicKey: user.public_key });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
