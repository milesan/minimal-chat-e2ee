import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { handleVoiceEvents } from './voice.js';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export const handleSocketConnection = (io, socket) => {
  let userId = null;
  let currentWorkspace = null;
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

  socket.on('join_workspace', (workspaceId) => {
    if (!userId) {
      return socket.emit('error', { error: 'Not authenticated' });
    }

    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    if (!member) {
      return socket.emit('error', { error: 'Not a workspace member' });
    }

    if (currentWorkspace) {
      socket.leave(`workspace:${currentWorkspace}`);
    }

    currentWorkspace = workspaceId;
    socket.join(`workspace:${workspaceId}`);
    socket.emit('joined_workspace', { workspaceId });
  });

  socket.on('join_channel', (channelId) => {
    if (!userId || !currentWorkspace) {
      return socket.emit('error', { error: 'Not in workspace' });
    }

    const channel = db.prepare('SELECT * FROM channels WHERE id = ? AND workspace_id = ?').get(channelId, currentWorkspace);
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
  });

  socket.on('send_message', (data) => {
    if (!userId || !currentChannel) {
      return socket.emit('error', { error: 'Not in channel' });
    }

    const { content, threadId, encrypted, encryptionMetadata } = data;
    if (!content || content.trim().length === 0) {
      return socket.emit('error', { error: 'Message content required' });
    }

    try {
      const messageId = uuidv4();
      const timestamp = Math.floor(Date.now() / 1000);
      const encryptedValue = encrypted ? 1 : 0;

      db.prepare('INSERT INTO messages (id, channel_id, user_id, content, thread_id, created_at, encrypted, encryption_metadata) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
        messageId, currentChannel, userId, content, threadId || null, timestamp, encryptedValue, encryptionMetadata || null
      );

      const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);

      const message = {
        id: messageId,
        channel_id: currentChannel,
        user_id: userId,
        username: user.username,
        content,
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
  });

  socket.on('join_thread', (threadId) => {
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
  });

  socket.on('typing', (data) => {
    if (!userId || !currentChannel) return;

    const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
    
    socket.to(`channel:${currentChannel}`).emit('user_typing', {
      userId,
      username: user.username,
      channelId: currentChannel
    });
  });

  socket.on('stop_typing', () => {
    if (!userId || !currentChannel) return;

    socket.to(`channel:${currentChannel}`).emit('user_stopped_typing', {
      userId,
      channelId: currentChannel
    });
  });

  socket.on('dm_message', (message) => {
    if (!userId) return;
    
    // Emit to the receiver if they're online
    socket.to(`user:${message.receiver_id}`).emit('new_dm', message);
  });

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