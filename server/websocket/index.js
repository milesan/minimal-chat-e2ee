import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { config } from '../config.js';
import { handleVoiceEvents } from './voice.js';
import { applyRateLimit } from './rateLimiter.js';
import { validateMessage } from '../utils/validation.js';

const JWT_SECRET = config.JWT_SECRET;

export const handleSocketConnection = (io, socket) => {
  let userId = null;
  let currentServer = null;
  let currentChannel = null;

  socket.on('authenticate', (token) => {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      userId = decoded.id;
      socket.userId = userId;
      socket.join(`user:${userId}`);
      socket.emit('authenticated', { userId });
      
      db.prepare('UPDATE users SET last_seen = unixepoch() WHERE id = ?').run(userId);
    } catch (error) {
      socket.emit('auth_error', { error: 'Invalid token' });
      socket.disconnect();
    }
  });

  socket.on('join_server', applyRateLimit(socket, 'join_server', (serverId) => {
    if (!userId) {
      return socket.emit('error', { error: 'Not authenticated' });
    }

    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member) {
      return socket.emit('error', { error: 'Not a server member' });
    }

    if (currentServer) {
      socket.leave(`server:${currentServer}`);
    }

    currentServer = serverId;
    socket.join(`server:${serverId}`);
    socket.emit('joined_server', { serverId });
  }));

  socket.on('join_channel', applyRateLimit(socket, 'join_channel', (channelId) => {
    if (!userId || !currentServer) {
      return socket.emit('error', { error: 'Not in server' });
    }

    const channel = db.prepare('SELECT * FROM channels WHERE id = ? AND server_id = ?').get(channelId, currentServer);
    if (!channel) {
      return socket.emit('error', { error: 'Channel not found' });
    }

    if (currentChannel) {
      socket.leave(`channel:${currentChannel}`);
    }

    currentChannel = channelId;
    socket.join(`channel:${channelId}`);
    socket.emit('joined_channel', { channelId });

    io.to(`channel:${channelId}`).emit('user_joined_channel', { userId, channelId });
  }));

  socket.on('send_message', applyRateLimit(socket, 'send_message', (data) => {
    if (!userId || !currentChannel) {
      return socket.emit('error', { error: 'Not in channel' });
    }

    const { content, threadId, encrypted, encryptionMetadata } = data;
    
    // Validate message content
    const messageValidation = validateMessage(content);
    if (!messageValidation.valid) {
      return socket.emit('error', { error: messageValidation.error });
    }

    try {
      const messageId = uuidv4();
      const timestamp = Math.floor(Date.now() / 1000);
      const encryptedValue = encrypted ? 1 : 0;
      const validContent = messageValidation.value;

      db.prepare('INSERT INTO messages (id, channel_id, user_id, content, thread_id, created_at, encrypted, encryption_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        messageId, currentChannel, userId, validContent, threadId || null, timestamp, encryptedValue, encryptionMetadata || null
      );

      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

      const message = {
        id: messageId,
        channel_id: currentChannel,
        user_id: userId,
        username: user.username,
        content: validContent,
        thread_id: threadId || null,
        created_at: timestamp,
        encrypted: encryptedValue,
        encryption_metadata: encryptionMetadata || null
      };

      if (threadId) {
        io.to(`thread:${threadId}`).emit('new_thread_message', message);
      } else {
        io.to(`channel:${currentChannel}`).emit('new_message', message);
      }
    } catch (error) {
      socket.emit('error', { error: 'Failed to send message' });
    }
  }));

  socket.on('join_thread', applyRateLimit(socket, 'join_thread', (threadId) => {
    if (!userId) {
      return socket.emit('error', { error: 'Not authenticated' });
    }

    socket.join(`thread:${threadId}`);
    
    const messages = db.prepare(`
      SELECT m.*, u.username
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.thread_id = ?
      ORDER BY m.created_at
    `).all(threadId);

    socket.emit('thread_messages', { threadId, messages });
  }));

  socket.on('typing', applyRateLimit(socket, 'typing', (data) => {
    if (!userId || !currentChannel) return;

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    
    socket.to(`channel:${currentChannel}`).emit('user_typing', {
      userId,
      username: user.username,
      channelId: currentChannel
    });
  }));

  socket.on('stop_typing', applyRateLimit(socket, 'stop_typing', () => {
    if (!userId || !currentChannel) return;

    socket.to(`channel:${currentChannel}`).emit('user_stopped_typing', {
      userId,
      channelId: currentChannel
    });
  }));


  socket.on('disconnect', () => {
    if (userId) {
      db.prepare('UPDATE users SET last_seen = unixepoch() WHERE id = ?').run(userId);
      
      if (currentChannel) {
        io.to(`channel:${currentChannel}`).emit('user_left_channel', { userId, channelId: currentChannel });
      }
    }
  });

  handleVoiceEvents(io, socket);
};