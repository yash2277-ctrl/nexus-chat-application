const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create story
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { type = 'text', content, mediaUrl, backgroundColor, fontStyle } = req.body;

    const storyId = uuidv4();
    const now = Date.now();
    const expiresAt = now + 24 * 60 * 60 * 1000; // 24 hours

    db.prepare(`
      INSERT INTO stories (id, user_id, type, content, media_url, background_color, font_style, expires_at, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(storyId, req.userId, type, content || '', mediaUrl || null, backgroundColor || '#6366f1', fontStyle || 'normal', expiresAt, now);

    const story = db.prepare(`
      SELECT s.*, u.display_name, u.avatar, u.username
      FROM stories s JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `).get(storyId);

    io.emit('new_story', story);
    res.status(201).json(story);
  } catch (err) {
    console.error('Create story error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all stories
router.get('/', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const now = Date.now();

    // Clean expired stories
    db.prepare('DELETE FROM stories WHERE expires_at < ?').run(now);

    const stories = db.prepare(`
      SELECT s.*, u.display_name, u.avatar, u.username,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as views_count,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id AND sv.user_id = ?) as has_viewed
      FROM stories s
      JOIN users u ON s.user_id = u.id
      WHERE s.expires_at > ?
      ORDER BY s.created_at DESC
    `).all(req.userId, now);

    // Group by user
    const grouped = {};
    stories.forEach(story => {
      if (!grouped[story.user_id]) {
        grouped[story.user_id] = {
          userId: story.user_id,
          username: story.username,
          displayName: story.display_name,
          avatar: story.avatar,
          stories: [],
          hasUnviewed: false
        };
      }
      grouped[story.user_id].stories.push(story);
      if (!story.has_viewed) grouped[story.user_id].hasUnviewed = true;
    });

    // Sort: own stories first, then unviewed, then viewed
    const sorted = Object.values(grouped).sort((a, b) => {
      if (a.userId === req.userId) return -1;
      if (b.userId === req.userId) return 1;
      if (a.hasUnviewed && !b.hasUnviewed) return -1;
      if (!a.hasUnviewed && b.hasUnviewed) return 1;
      return 0;
    });

    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// View story
router.post('/:id/view', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    db.prepare('INSERT OR IGNORE INTO story_views (story_id, user_id) VALUES (?, ?)')
      .run(req.params.id, req.userId);

    db.prepare('UPDATE stories SET views_count = views_count + 1 WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// React to story
router.post('/:id/react', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { emoji } = req.body;

    db.prepare('INSERT INTO story_reactions (id, story_id, user_id, emoji) VALUES (?, ?, ?, ?)')
      .run(uuidv4(), req.params.id, req.userId, emoji);

    const story = db.prepare('SELECT user_id FROM stories WHERE id = ?').get(req.params.id);
    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.userId);

    if (story) {
      io.to(`user:${story.user_id}`).emit('story_reaction', {
        storyId: req.params.id,
        emoji,
        from: user.display_name
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get story viewers
router.get('/:id/viewers', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const viewers = db.prepare(`
      SELECT u.id, u.display_name, u.avatar, sv.viewed_at
      FROM story_views sv JOIN users u ON sv.user_id = u.id
      WHERE sv.story_id = ?
      ORDER BY sv.viewed_at DESC
    `).all(req.params.id);
    res.json(viewers);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete story
router.delete('/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const story = db.prepare('SELECT * FROM stories WHERE id = ? AND user_id = ?').get(req.params.id, req.userId);
    if (!story) return res.status(404).json({ error: 'Story not found' });

    db.prepare('DELETE FROM stories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
