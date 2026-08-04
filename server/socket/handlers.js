const jwt = require('jsonwebtoken');

// Track online users and their sockets
const onlineUsers = new Map(); // userId -> Set of socketIds
const userSockets = new Map(); // socketId -> userId
const typingUsers = new Map(); // conversationId -> Set of userIds

function setupSocketHandlers(io, db) {
  // Auth middleware for socket
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'nexus_secret');
      socket.userId = decoded.userId;
      socket.username = decoded.username;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.userId;
    console.log(`✅ User connected: ${socket.username} (${userId})`);

    // Track online status
    if (!onlineUsers.has(userId)) onlineUsers.set(userId, new Set());
    onlineUsers.get(userId).add(socket.id);
    userSockets.set(socket.id, userId);

    // Update DB online status
    db.prepare('UPDATE users SET is_online = 1, last_seen = ? WHERE id = ?').run(Date.now(), userId);

    // Join personal room
    socket.join(`user:${userId}`);

    // Join all conversation rooms
    const conversations = db.prepare('SELECT conversation_id FROM conversation_participants WHERE user_id = ?').all(userId);
    conversations.forEach(conv => {
      socket.join(`conversation:${conv.conversation_id}`);
    });

    // Broadcast online status
    io.emit('user_online', { userId, isOnline: true });

    // === MESSAGE EVENTS ===

    socket.on('typing_start', ({ conversationId }) => {
      if (!typingUsers.has(conversationId)) typingUsers.set(conversationId, new Set());
      typingUsers.get(conversationId).add(userId);

      socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
        conversationId,
        userId,
        isTyping: true
      });
    });

    socket.on('typing_stop', ({ conversationId }) => {
      if (typingUsers.has(conversationId)) {
        typingUsers.get(conversationId).delete(userId);
      }

      socket.to(`conversation:${conversationId}`).emit('typing_indicator', {
        conversationId,
        userId,
        isTyping: false
      });
    });

    socket.on('message_read', ({ conversationId, messageId }) => {
      // Update last read
      db.prepare('UPDATE conversation_participants SET last_read_message_id = ? WHERE conversation_id = ? AND user_id = ?')
        .run(messageId, conversationId, userId);

      db.prepare('INSERT OR IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)').run(messageId, userId);

      socket.to(`conversation:${conversationId}`).emit('messages_read', {
        conversationId,
        userId,
        messageId
      });
    });

    // === CALL EVENTS (WebRTC Signaling) ===

    socket.on('call_initiate', ({ targetUserId, conversationId, callType, offer }) => {
      try {
        console.log(`📞 Call initiated: ${userId} -> ${targetUserId} (${callType})`);
        const caller = db.prepare('SELECT id, display_name, avatar FROM users WHERE id = ?').get(userId);

        io.to(`user:${targetUserId}`).emit('incoming_call', {
          callerId: userId,
          callerName: caller.display_name,
          callerAvatar: caller.avatar,
          conversationId,
          callType,
          offer
        });

        // Log the call
        try {
          const { v4: uuidv4 } = require('uuid');
          db.prepare(`
            INSERT INTO call_logs (id, conversation_id, caller_id, type, status)
            VALUES (?, ?, ?, ?, 'ongoing')
          `).run(uuidv4(), conversationId, userId, callType);
        } catch (dbErr) {
          console.error('Failed to log call:', dbErr.message);
        }
      } catch (err) {
        console.error('call_initiate error:', err);
      }
    });

    socket.on('call_answer', ({ targetUserId, answer }) => {
      try {
        console.log(`📞 Call answered: ${userId} -> ${targetUserId}`);
        io.to(`user:${targetUserId}`).emit('call_answered', { answer, userId });
      } catch (err) {
        console.error('call_answer error:', err.message);
      }
    });

    socket.on('call_reject', ({ targetUserId, conversationId }) => {
      console.log(`📞 Call rejected: ${userId} -> ${targetUserId}`);
      io.to(`user:${targetUserId}`).emit('call_rejected', { userId });

      // Update call log
      try {
        db.prepare("UPDATE call_logs SET status = 'declined', ended_at = ? WHERE conversation_id = ? AND status = 'ongoing'")
          .run(Date.now(), conversationId);
      } catch (err) { console.error('call_reject db error:', err.message); }
    });

    socket.on('call_end', ({ targetUserId, conversationId }) => {
      console.log(`📞 Call ended: ${userId} -> ${targetUserId}`);
      io.to(`user:${targetUserId}`).emit('call_ended', { userId });

      try {
        db.prepare("UPDATE call_logs SET status = 'answered', ended_at = ?, duration = (? - started_at) / 1000 WHERE conversation_id = ? AND status = 'ongoing'")
          .run(Date.now(), Date.now(), conversationId);
      } catch (err) { console.error('call_end db error:', err.message); }
    });

    socket.on('ice_candidate', ({ targetUserId, candidate }) => {
      try {
        io.to(`user:${targetUserId}`).emit('ice_candidate', { candidate, userId });
      } catch (err) {
        console.error('ice_candidate error:', err.message);
      }
    });

    socket.on('screen_share_start', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('screen_share_started', { userId });
    });

    socket.on('screen_share_stop', ({ conversationId }) => {
      socket.to(`conversation:${conversationId}`).emit('screen_share_stopped', { userId });
    });

    // === GROUP EVENTS ===

    socket.on('join_conversation', ({ conversationId }) => {
      socket.join(`conversation:${conversationId}`);
    });

    socket.on('leave_conversation', ({ conversationId }) => {
      socket.leave(`conversation:${conversationId}`);
    });

    // === NOTE COLLABORATION ===

    socket.on('note_editing', ({ conversationId, noteId, content }) => {
      socket.to(`conversation:${conversationId}`).emit('note_content_update', {
        noteId,
        content,
        editedBy: userId
      });
    });

    // === PRESENCE ===

    socket.on('request_online_status', ({ userIds }) => {
      const statuses = {};
      userIds.forEach(uid => {
        statuses[uid] = onlineUsers.has(uid) && onlineUsers.get(uid).size > 0;
      });
      socket.emit('online_statuses', statuses);
    });

    // === DISCONNECT ===

    socket.on('disconnect', () => {
      console.log(`❌ User disconnected: ${socket.username}`);

      if (onlineUsers.has(userId)) {
        onlineUsers.get(userId).delete(socket.id);
        if (onlineUsers.get(userId).size === 0) {
          onlineUsers.delete(userId);

          // Update DB
          db.prepare('UPDATE users SET is_online = 0, last_seen = ? WHERE id = ?').run(Date.now(), userId);

          // Broadcast offline
          io.emit('user_online', { userId, isOnline: false, lastSeen: Date.now() });
        }
      }

      userSockets.delete(socket.id);

      // Clean typing indicators
      typingUsers.forEach((users, convId) => {
        if (users.has(userId)) {
          users.delete(userId);
          io.to(`conversation:${convId}`).emit('typing_indicator', {
            conversationId: convId,
            userId,
            isTyping: false
          });
        }
      });
    });
  });

  // Scheduled message checker (runs every minute)
  setInterval(() => {
    const now = Date.now();
    const pending = db.prepare('SELECT * FROM scheduled_messages WHERE scheduled_at <= ? AND is_sent = 0').all(now);

    pending.forEach(scheduled => {
      const { v4: uuidv4 } = require('uuid');
      const msgId = uuidv4();

      db.prepare(`
        INSERT INTO messages (id, conversation_id, sender_id, type, content, media_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(msgId, scheduled.conversation_id, scheduled.sender_id, scheduled.type, scheduled.content, scheduled.media_url, now, now);

      db.prepare('UPDATE conversations SET updated_at = ? WHERE id = ?').run(now, scheduled.conversation_id);
      db.prepare('UPDATE scheduled_messages SET is_sent = 1 WHERE id = ?').run(scheduled.id);

      const message = db.prepare(`
        SELECT m.*, u.display_name as sender_name, u.avatar as sender_avatar
        FROM messages m JOIN users u ON m.sender_id = u.id WHERE m.id = ?
      `).get(msgId);

      if (message) {
        message.reactions = [];
        io.to(`conversation:${scheduled.conversation_id}`).emit('new_message', message);
      }

      // Handle recurring
      if (scheduled.recurring) {
        let nextTime = scheduled.scheduled_at;
        switch (scheduled.recurring) {
          case 'daily': nextTime += 86400000; break;
          case 'weekly': nextTime += 604800000; break;
          case 'monthly': nextTime += 2592000000; break;
        }
        db.prepare('INSERT INTO scheduled_messages (id, conversation_id, sender_id, content, type, media_url, scheduled_at, recurring, timezone) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(uuidv4(), scheduled.conversation_id, scheduled.sender_id, scheduled.content, scheduled.type, scheduled.media_url, nextTime, scheduled.recurring, scheduled.timezone);
      }
    });
  }, 60000);
}

module.exports = { setupSocketHandlers };
