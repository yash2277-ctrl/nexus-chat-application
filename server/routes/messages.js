const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Get conversations for current user
router.get('/conversations', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');

    const conversations = db.prepare(`
      SELECT c.*, cp.role, cp.is_muted, cp.last_read_message_id,
        (SELECT COUNT(*) FROM messages m 
         WHERE m.conversation_id = c.id 
         AND m.created_at > COALESCE(
           (SELECT m2.created_at FROM messages m2 WHERE m2.id = cp.last_read_message_id), 0
         )
         AND m.sender_id != ?
         AND m.is_deleted = 0
        ) as unread_count
      FROM conversations c
      JOIN conversation_participants cp ON c.id = cp.conversation_id
      WHERE cp.user_id = ?
      ORDER BY c.updated_at DESC
    `).all(req.userId, req.userId);

    // Enrich with participants and last message
    const enriched = conversations.map(conv => {
      const participants = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.avatar, u.is_online, u.last_seen, u.bio, u.status, cp.role
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
      `).all(conv.id);

      const lastMessage = db.prepare(`
        SELECT m.*, u.display_name as sender_name
        FROM messages m
        JOIN users u ON m.sender_id = u.id
        WHERE m.conversation_id = ? AND m.is_deleted = 0
        ORDER BY m.created_at DESC LIMIT 1
      `).get(conv.id);

      return { ...conv, participants, lastMessage };
    });

    res.json(enriched);
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get or create private conversation
router.post('/conversations/private', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { userId } = req.body;

    if (!userId) return res.status(400).json({ error: 'userId is required' });

    // Check if conversation exists
    const existing = db.prepare(`
      SELECT c.id FROM conversations c
      JOIN conversation_participants cp1 ON c.id = cp1.conversation_id AND cp1.user_id = ?
      JOIN conversation_participants cp2 ON c.id = cp2.conversation_id AND cp2.user_id = ?
      WHERE c.type = 'private'
    `).get(req.userId, userId);

    if (existing) {
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(existing.id);
      const participants = db.prepare(`
        SELECT u.id, u.username, u.display_name, u.avatar, u.is_online, u.last_seen, u.bio, u.status, cp.role
        FROM conversation_participants cp
        JOIN users u ON cp.user_id = u.id
        WHERE cp.conversation_id = ?
      `).all(conv.id);
      return res.json({ ...conv, participants });
    }

    // Create new conversation
    const convId = uuidv4();
    const now = Date.now();

    db.prepare('INSERT INTO conversations (id, type, created_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?)')
      .run(convId, 'private', req.userId, now, now);

    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, ?)')
      .run(convId, req.userId, 'member');
    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, ?)')
      .run(convId, userId, 'member');

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    const participants = db.prepare(`
SELECT u.id, u.username, u.display_name, u.avatar, u.is_online, u.last_seen, u.bio, u.status, cp.role
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(convId);

    res.status(201).json({ ...conv, participants });
  } catch (err) {
    console.error('Create conversation error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get messages for a conversation
router.get('/conversations/:id/messages', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { id } = req.params;
    const { before, limit = 50 } = req.query;

    // Verify user is participant
    const participant = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .get(id, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    let query = `
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar, u.username as sender_username,
        (SELECT json_group_array(json_object('emoji', mr.emoji, 'userId', mr.user_id, 'username', u2.username))
         FROM message_reactions mr
         JOIN users u2 ON mr.user_id = u2.id
         WHERE mr.message_id = m.id) as reactions
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ?
    `;
    const params = [id];

    if (before) {
      query += ' AND m.created_at < ?';
      params.push(parseInt(before));
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const messages = db.prepare(query).all(...params);

    // Get reply messages if any
    const enrichedMessages = messages.map(msg => {
      if (msg.reply_to) {
        const replyMsg = db.prepare(`
          SELECT m.id, m.content, m.type, m.sender_id, u.display_name as sender_name
          FROM messages m JOIN users u ON m.sender_id = u.id
          WHERE m.id = ?
        `).get(msg.reply_to);
        return { ...msg, replyMessage: replyMsg, reactions: JSON.parse(msg.reactions || '[]') };
      }
      return { ...msg, reactions: JSON.parse(msg.reactions || '[]') };
    });

    res.json(enrichedMessages.reverse());
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Send a message
router.post('/conversations/:id/messages', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { id } = req.params;
    const { content, type = 'text', mediaUrl, mediaThumbnail, mediaSize, mediaDuration, mediaDimensions, replyTo, encryptedContent } = req.body;

    // Verify participation
    const participant = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .get(id, req.userId);
    if (!participant) return res.status(403).json({ error: 'Not a participant' });

    const msgId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, type, content, encrypted_content, media_url, media_thumbnail, media_size, media_duration, media_dimensions, reply_to, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(msgId, id, req.userId, type, content || '', encryptedContent || null, mediaUrl || null, mediaThumbnail || null, mediaSize || 0, mediaDuration || 0, mediaDimensions || null, replyTo || null, now, now);

    // Update conversation timestamp
    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, id);

    // Get full message
    const message = db.prepare(`
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar, u.username as sender_username
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `).get(msgId);

    // Get reply if exists
    if (message.reply_to) {
      message.replyMessage = db.prepare(`
        SELECT m.id, m.content, m.type, m.sender_id, u.display_name as sender_name
        FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
      `).get(message.reply_to);
    }

    message.reactions = [];

    // Emit to all participants via Socket.IO
    io.to(`conversation:${id}`).emit('new_message', message);

    // Also emit conversation update
    const participants = db.prepare('SELECT user_id FROM conversation_participants WHERE conversation_id = ?').all(id);
    participants.forEach(p => {
      io.to(`user:${p.user_id}`).emit('conversation_updated', { conversationId: id, lastMessage: message });
    });

    res.status(201).json(message);
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Edit message
router.put('/messages/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { content } = req.body;

    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(req.params.id, req.userId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE messages SET content = ?, is_edited = 1, updated_at = ? WHERE id = ?')
      .run(content, Date.now(), req.params.id);

    const updated = db.prepare(`
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
      FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `).get(req.params.id);

    io.to(`conversation:${msg.conversation_id}`).emit('message_edited', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete message
router.delete('/messages/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');

    const msg = db.prepare('SELECT * FROM messages WHERE id = ? AND sender_id = ?').get(req.params.id, req.userId);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE messages SET is_deleted = 1, content = "This message was deleted", updated_at = ? WHERE id = ?')
      .run(Date.now(), req.params.id);

    io.to(`conversation:${msg.conversation_id}`).emit('message_deleted', { messageId: req.params.id, conversationId: msg.conversation_id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// React to message
router.post('/messages/:id/react', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { emoji } = req.body;

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    const existing = db.prepare('SELECT * FROM message_reactions WHERE message_id = ? AND user_id = ? AND emoji = ?')
      .get(req.params.id, req.userId, emoji);

    if (existing) {
      db.prepare('DELETE FROM message_reactions WHERE id = ?').run(existing.id);
    } else {
      db.prepare('INSERT INTO message_reactions (id, message_id, user_id, emoji) VALUES (?, ?, ?, ?)')
        .run(uuidv4(), req.params.id, req.userId, emoji);
    }

    const reactions = db.prepare(`
      SELECT mr.emoji, mr.user_id, u.username
      FROM message_reactions mr JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = ?
    `).all(req.params.id);

    io.to(`conversation:${msg.conversation_id}`).emit('message_reaction', { messageId: req.params.id, reactions });
    res.json({ reactions });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Pin/unpin message
router.post('/messages/:id/pin', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE messages SET is_pinned = ? WHERE id = ?').run(msg.is_pinned ? 0 : 1, req.params.id);

    io.to(`conversation:${msg.conversation_id}`).emit('message_pinned', { messageId: req.params.id, isPinned: !msg.is_pinned });
    res.json({ success: true, isPinned: !msg.is_pinned });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Star/unstar message
router.post('/messages/:id/star', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Message not found' });

    db.prepare('UPDATE messages SET is_starred = ? WHERE id = ?').run(msg.is_starred ? 0 : 1, req.params.id);
    res.json({ success: true, isStarred: !msg.is_starred });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Bookmark message
router.post('/messages/:id/bookmark', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { tags = [], note = '' } = req.body;

    const existing = db.prepare('SELECT * FROM bookmarks WHERE user_id = ? AND message_id = ?').get(req.userId, req.params.id);
    if (existing) {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existing.id);
      return res.json({ success: true, bookmarked: false });
    }

    db.prepare('INSERT INTO bookmarks (id, user_id, message_id, tags, note) VALUES (?, ?, ?, ?, ?)')
      .run(uuidv4(), req.userId, req.params.id, JSON.stringify(tags), note);

    res.json({ success: true, bookmarked: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get bookmarked messages
router.get('/bookmarks', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const bookmarks = db.prepare(`
      SELECT b.*, m.content, m.type, m.media_url, m.created_at as message_date,
        u.display_name as sender_name, c.name as conversation_name
      FROM bookmarks b
      JOIN messages m ON b.message_id = m.id
      JOIN users u ON m.sender_id = u.id
      JOIN conversations c ON m.conversation_id = c.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(req.userId);

    res.json(bookmarks);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Search messages
router.get('/search', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { q, conversationId } = req.query;
    if (!q) return res.json([]);

    let query = `
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar, c.name as conversation_name
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      JOIN conversations c ON m.conversation_id = c.id
      JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.user_id = ?
      WHERE m.content LIKE ? AND m.is_deleted = 0
    `;
    const params = [req.userId, `%${q}%`];

    if (conversationId) {
      query += ' AND m.conversation_id = ?';
      params.push(conversationId);
    }

    query += ' ORDER BY m.created_at DESC LIMIT 50';

    const messages = db.prepare(query).all(...params);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Mark messages as read
router.post('/conversations/:id/read', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { messageId } = req.body;

    db.prepare('UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?')
      .run(messageId, req.params.id, req.userId);

    // Insert read receipts for unread messages
    const unread = db.prepare(`
      SELECT id FROM messages WHERE conversation_id = ? AND sender_id != ? AND id NOT IN (
        SELECT message_id FROM message_reads WHERE user_id = ?
      )
    `).all(req.params.id, req.userId, req.userId);

    const insertRead = db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)');
    for (const msg of unread) {
      insertRead.run(msg.id, req.userId);
    }

    io.to(`conversation:${req.params.id}`).emit('messages_read', { userId: req.userId, conversationId: req.params.id });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Forward message
router.post('/messages/:id/forward', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { conversationIds } = req.body;

    const original = db.prepare('SELECT * FROM messages WHERE id = ?').get(req.params.id);
    if (!original) return res.status(404).json({ error: 'Message not found' });

    const forwarded = [];
    for (const convId of conversationIds) {
      const msgId = uuidv4();
      const now = Date.now();

      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, type, content, media_url, media_thumbnail, forwarded_from, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, convId, req.userId, original.type, original.content, original.media_url, original.media_thumbnail, original.id, now, now);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, convId);

      const msg = db.prepare(`
        SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
      `).get(msgId);

      io.to(`conversation:${convId}`).emit('new_message', msg);
      forwarded.push(msg);
    }

    res.json(forwarded);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create/manage scheduled messages
router.post('/scheduled', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const { conversationId, content, type = 'text', mediaUrl, scheduledAt, recurring, timezone = 'UTC' } = req.body;

    const id = uuidv4();
    db.prepare(`
      INSERT INTO scheduled_messages (id, conversation_id, sender_id, content, type, media_url, scheduled_at, recurring, timezone)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, conversationId, req.userId, content, type, mediaUrl || null, scheduledAt, recurring || null, timezone);

    res.status(201).json({ id, conversationId, content, scheduledAt, recurring, timezone });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/scheduled', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const messages = db.prepare('SELECT * FROM scheduled_messages WHERE sender_id = ? AND is_sent = 0 ORDER BY scheduled_at ASC')
      .all(req.userId);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get pinned messages
router.get('/conversations/:id/pinned', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const pinned = db.prepare(`
      SELECT m.*, u.display_name as sender_name
      FROM messages m JOIN users u ON m.sender_id = u.id
      WHERE m.conversation_id = ? AND m.is_pinned = 1
      ORDER BY m.updated_at DESC
    `).all(req.params.id);
    res.json(pinned);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
