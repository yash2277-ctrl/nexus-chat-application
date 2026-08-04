const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Create group
router.post('/', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { name, description, avatar, memberIds = [] } = req.body;

    if (!name) return res.status(400).json({ error: 'Group name is required' });

    const convId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO conversations (id, type, name, description, avatar, created_by, created_at, updated_at)
      VALUES (?, 'group', ?, ?, ?, ?, ?, ?)
    `).run(convId, name, description || '', avatar || null, req.userId, now, now);

    // Add creator as admin
    db.prepare('INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, ?)')
      .run(convId, req.userId, 'admin');

    // Add members
    const addMember = db.prepare('INSERT INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, ?)');
    for (const memberId of memberIds) {
      addMember.run(convId, memberId, 'member');
    }

    // System message
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, type, content, created_at, updated_at)
      VALUES (?, ?, ?, 'system', ?, ?, ?)
    `).run(uuidv4(), convId, req.userId, `Group "${name}" created`, now, now);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(convId);
    const participants = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.is_online, u.last_seen, u.bio, u.status, cp.role
      FROM conversation_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(convId);

    const result = { ...conv, participants };

    // Notify all members
    [...memberIds, req.userId].forEach(uid => {
      io.to(`user:${uid}`).emit('new_conversation', result);
    });

    res.status(201).json(result);
  } catch (err) {
    console.error('Create group error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group
router.put('/:id', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { name, description, avatar } = req.body;

    const participant = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .get(req.params.id, req.userId);
    if (!participant || (participant.role !== 'admin' && participant.role !== 'moderator')) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const updates = [];
    const values = [];
    if (name) { updates.push('name = ?'); values.push(name); }
    if (description !== undefined) { updates.push('description = ?'); values.push(description); }
    if (avatar !== undefined) { updates.push('avatar = ?'); values.push(avatar); }
    updates.push('updated_at = ?'); values.push(Date.now());
    values.push(req.params.id);

    db.prepare(`UPDATE conversations SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
    io.to(`conversation:${req.params.id}`).emit('group_updated', conv);
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Add members
router.post('/:id/members', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { userIds } = req.body;

    const participant = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .get(req.params.id, req.userId);
    if (!participant || participant.role === 'member') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    const addMember = db.prepare('INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id, role) VALUES (?, ?, ?)');
    for (const uid of userIds) {
      addMember.run(req.params.id, uid, 'member');
    }

    const participants = db.prepare(`
      SELECT u.id, u.username, u.display_name, u.avatar, u.is_online, u.last_seen, u.bio, u.status, cp.role
      FROM conversation_participants cp JOIN users u ON cp.user_id = u.id
      WHERE cp.conversation_id = ?
    `).all(req.params.id);

    io.to(`conversation:${req.params.id}`).emit('members_updated', { conversationId: req.params.id, participants });
    userIds.forEach(uid => {
      const conv = db.prepare('SELECT * FROM conversations WHERE id = ?').get(req.params.id);
      io.to(`user:${uid}`).emit('new_conversation', { ...conv, participants });
    });

    res.json({ participants });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member
router.delete('/:id/members/:userId', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');

    const participant = db.prepare('SELECT * FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .get(req.params.id, req.userId);
    if (!participant || participant.role !== 'admin') {
      return res.status(403).json({ error: 'Not authorized' });
    }

    db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .run(req.params.id, req.params.userId);

    io.to(`user:${req.params.userId}`).emit('removed_from_group', { conversationId: req.params.id });
    io.to(`conversation:${req.params.id}`).emit('member_removed', { conversationId: req.params.id, userId: req.params.userId });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave group
router.post('/:id/leave', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');

    db.prepare('DELETE FROM conversation_participants WHERE conversation_id = ? AND user_id = ?')
      .run(req.params.id, req.userId);

    const now = Date.now();
    const user = db.prepare('SELECT display_name FROM users WHERE id = ?').get(req.userId);
    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, type, content, created_at, updated_at)
      VALUES (?, ?, ?, 'system', ?, ?, ?)
    `).run(uuidv4(), req.params.id, req.userId, `${user.display_name} left the group`, now, now);

    io.to(`conversation:${req.params.id}`).emit('member_left', { conversationId: req.params.id, userId: req.userId });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create poll
router.post('/:id/poll', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { question, options, isMultipleChoice = false, isAnonymous = false, closesAt = null } = req.body;

    if (!question || !options || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options required' });
    }

    const msgId = uuidv4();
    const pollId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, type, content, created_at, updated_at)
      VALUES (?, ?, ?, 'poll', ?, ?, ?)
    `).run(msgId, req.params.id, req.userId, question, now, now);

    db.prepare(`
      INSERT INTO polls (id, message_id, question, is_multiple_choice, is_anonymous, closes_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(pollId, msgId, question, isMultipleChoice ? 1 : 0, isAnonymous ? 1 : 0, closesAt);

    const insertOption = db.prepare('INSERT INTO poll_options (id, poll_id, text, position) VALUES (?, ?, ?, ?)');
    options.forEach((opt, idx) => {
      insertOption.run(uuidv4(), pollId, opt, idx);
    });

    db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, req.params.id);

    const message = db.prepare(`
      SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
      FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
    `).get(msgId);

    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
    const pollOptions = db.prepare('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position').all(pollId);

    message.poll = { ...poll, options: pollOptions.map(o => ({ ...o, votes: [] })) };
    message.reactions = [];

    io.to(`conversation:${req.params.id}`).emit('new_message', message);
    res.status(201).json(message);
  } catch (err) {
    console.error('Create poll error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Vote on poll
router.post('/polls/:pollId/vote', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { optionId } = req.body;

    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(req.params.pollId);
    if (!poll) return res.status(404).json({ error: 'Poll not found' });

    if (!poll.is_multiple_choice) {
      db.prepare('DELETE FROM poll_votes WHERE poll_id = ? AND user_id = ?').run(req.params.pollId, req.userId);
    }

    db.prepare('INSERT OR IGNORE INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?)')
      .run(req.params.pollId, optionId, req.userId);

    const options = db.prepare('SELECT * FROM poll_options WHERE poll_id = ? ORDER BY position').all(req.params.pollId);
    const enrichedOptions = options.map(opt => {
      const votes = db.prepare(`
        SELECT pv.user_id, u.username FROM poll_votes pv
        JOIN users u ON pv.user_id = u.id
        WHERE pv.option_id = ?
      `).all(opt.id);
      return { ...opt, votes };
    });

    const msg = db.prepare('SELECT conversation_id FROM messages WHERE id = ?').get(poll.message_id);
    io.to(`conversation:${msg.conversation_id}`).emit('poll_updated', {
      pollId: req.params.pollId,
      messageId: poll.message_id,
      options: enrichedOptions
    });

    res.json({ options: enrichedOptions });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Collaborative notes
router.post('/:id/notes', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { title, content } = req.body;

    const noteId = uuidv4();
    const now = Date.now();

    db.prepare(`
      INSERT INTO notes (id, conversation_id, title, content, created_by, updated_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(noteId, req.params.id, title || 'Untitled Note', content || '', req.userId, req.userId, now, now);

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(noteId);
    io.to(`conversation:${req.params.id}`).emit('note_created', note);
    res.status(201).json(note);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/notes', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const notes = db.prepare('SELECT * FROM notes WHERE conversation_id = ? ORDER BY updated_at DESC').all(req.params.id);
    res.json(notes);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/notes/:noteId', authMiddleware, (req, res) => {
  try {
    const db = req.app.get('db');
    const io = req.app.get('io');
    const { title, content } = req.body;

    const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.noteId);
    if (!note) return res.status(404).json({ error: 'Note not found' });

    db.prepare('UPDATE notes SET title = ?, content = ?, updated_by = ?, updated_at = ? WHERE id = ?')
      .run(title || note.title, content !== undefined ? content : note.content, req.userId, Date.now(), req.params.noteId);

    const updated = db.prepare('SELECT * FROM notes WHERE id = ?').get(req.params.noteId);
    io.to(`conversation:${note.conversation_id}`).emit('note_updated', updated);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
