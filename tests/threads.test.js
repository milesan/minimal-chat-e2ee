import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import authRoutes from '../server/api/auth.js';
import channelRoutes from '../server/api/channels.js';
import { initializeDatabase } from '../server/db/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';
import { io as ioClient } from 'socket.io-client';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { handleSocketConnection } from '../server/websocket/index.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);

describe('Threads and Quotes', () => {
  let authToken;
  let userId;
  let workspaceId;
  let channelId;
  let parentMessageId;
  let io, httpServer, clientSocket;
  let port;

  beforeAll(async () => {
    await initializeDatabase();
    runMigrations();
    // Clean up any existing data
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      DELETE FROM direct_messages;
      DELETE FROM link_comments;
      DELETE FROM link_ratings;
      DELETE FROM links;
      DELETE FROM voice_participants;
      DELETE FROM voice_sessions;
      DELETE FROM messages;
      DELETE FROM channels;
      DELETE FROM workspace_members;
      DELETE FROM workspaces;
      DELETE FROM users;
    `);
    db.exec('PRAGMA foreign_keys = ON');

    // Create test user
    const authResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'threaduser',
        password: 'testpassword123'
      });
    
    authToken = authResponse.body.token;
    userId = authResponse.body.user.id;

    // Create workspace
    const workspaceResponse = await request(app)
      .post('/api/channels/workspaces')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'Thread Test Workspace'
      });
    
    workspaceId = workspaceResponse.body.id;

    // Create channel
    const channelResponse = await request(app)
      .post(`/api/channels/workspaces/${workspaceId}/channels`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: 'thread-test-channel'
      });
    
    channelId = channelResponse.body.id;

    // Create a parent message for threading
    const stmt = db.prepare(`
      INSERT INTO messages (channel_id, user_id, content)
      VALUES (?, ?, ?)
    `);
    const result = stmt.run(channelId, userId, 'This is a parent message');
    parentMessageId = result.lastInsertRowid;

    // Setup WebSocket server
    httpServer = createServer();
    io = new Server(httpServer);

    io.on('connection', (socket) => {
      handleSocketConnection(io, socket);
    });

    await new Promise((resolve) => {
      httpServer.listen(0, () => {
        port = httpServer.address().port;
        resolve();
      });
    });
  });

  afterAll(() => {
    if (io) io.close();
    if (httpServer) httpServer.close();
  });

  describe('Threaded Messages', () => {
    it('should create a thread reply', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, thread_id)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        'This is a thread reply',
        parentMessageId
      );

      expect(result.changes).toBe(1);

      // Verify the thread relationship
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.thread_id).toBe(parentMessageId);
    });

    it('should retrieve thread messages', () => {
      // Add more thread replies
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, thread_id)
        VALUES (?, ?, ?, ?)
      `);
      
      stmt.run(channelId, userId, 'Thread reply 2', parentMessageId);
      stmt.run(channelId, userId, 'Thread reply 3', parentMessageId);

      // Get thread messages
      const threadMessages = db.prepare(`
        SELECT * FROM messages 
        WHERE thread_id = ? 
        ORDER BY created_at ASC
      `).all(parentMessageId);

      expect(threadMessages.length).toBeGreaterThanOrEqual(3);
      expect(threadMessages.every(msg => msg.thread_id === parentMessageId)).toBe(true);
    });

    it('should count thread replies', () => {
      const count = db.prepare(`
        SELECT COUNT(*) as reply_count 
        FROM messages 
        WHERE thread_id = ?
      `).get(parentMessageId);

      expect(count.reply_count).toBeGreaterThanOrEqual(3);
    });

    it('should handle nested threads correctly', () => {
      // Create a reply to a thread message
      const threadReply = db.prepare(`
        SELECT id FROM messages 
        WHERE thread_id = ? 
        LIMIT 1
      `).get(parentMessageId);

      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, thread_id)
        VALUES (?, ?, ?, ?)
      `);
      
      // Thread replies should still reference the original parent
      const result = stmt.run(
        channelId,
        userId,
        'Nested thread reply',
        threadReply.id
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.thread_id).toBe(threadReply.id);
    });
  });

  describe('Quote/Reply Functionality', () => {
    let quotedMessageId;

    beforeAll(() => {
      // Create a message to quote
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content)
        VALUES (?, ?, ?)
      `);
      const result = stmt.run(channelId, userId, 'Message to be quoted');
      quotedMessageId = result.lastInsertRowid;
    });

    it('should create a message with a quote', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, quoted_message_id)
        VALUES (?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        'This is a reply to the quoted message',
        quotedMessageId
      );

      expect(result.changes).toBe(1);

      // Verify the quote relationship
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.quoted_message_id).toBe(quotedMessageId);
    });

    it('should retrieve quoted message details', () => {
      const messageWithQuote = db.prepare(`
        SELECT m.*, 
               q.content as quoted_content,
               q.user_id as quoted_user_id,
               u.username as quoted_username
        FROM messages m
        LEFT JOIN messages q ON m.quoted_message_id = q.id
        LEFT JOIN users u ON q.user_id = u.id
        WHERE m.quoted_message_id IS NOT NULL
        LIMIT 1
      `).get();

      expect(messageWithQuote).toBeDefined();
      expect(messageWithQuote.quoted_content).toBe('Message to be quoted');
      expect(messageWithQuote.quoted_username).toBe('threaduser');
    });

    it('should handle quotes in threads', () => {
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, thread_id, quoted_message_id)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      const result = stmt.run(
        channelId,
        userId,
        'Thread reply with quote',
        parentMessageId,
        quotedMessageId
      );

      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message.thread_id).toBe(parentMessageId);
      expect(message.quoted_message_id).toBe(quotedMessageId);
    });

    it('should handle deleted quoted messages gracefully', () => {
      // Create a message with quote
      const stmt = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content, quoted_message_id)
        VALUES (?, ?, ?, ?)
      `);
      
      const tempMsgResult = db.prepare(`
        INSERT INTO messages (channel_id, user_id, content)
        VALUES (?, ?, ?)
      `).run(channelId, userId, 'Temp message');
      
      const result = stmt.run(
        channelId,
        userId,
        'Quote of soon-to-be-deleted message',
        tempMsgResult.lastInsertRowid
      );

      // Delete the quoted message
      db.prepare('DELETE FROM messages WHERE id = ?').run(tempMsgResult.lastInsertRowid);

      // Verify the quoting message still exists
      const message = db.prepare('SELECT * FROM messages WHERE id = ?').get(result.lastInsertRowid);
      expect(message).toBeDefined();
      expect(message.quoted_message_id).toBe(tempMsgResult.lastInsertRowid);

      // Verify the join returns null for deleted message
      const messageWithQuote = db.prepare(`
        SELECT m.*, q.content as quoted_content
        FROM messages m
        LEFT JOIN messages q ON m.quoted_message_id = q.id
        WHERE m.id = ?
      `).get(result.lastInsertRowid);

      expect(messageWithQuote.quoted_content).toBeNull();
    });
  });

  describe('WebSocket Thread Events', () => {
    it('should emit thread updates via WebSocket', (done) => {
      clientSocket = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: false
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('authenticate', authToken);
      });

      clientSocket.on('authenticated', () => {
        clientSocket.emit('join_workspace', workspaceId);
      });

      clientSocket.on('joined_workspace', () => {
        clientSocket.emit('join_channel', channelId);
      });

      clientSocket.on('joined_channel', () => {
        clientSocket.emit('send_message', {
          content: 'WebSocket thread message',
          thread_id: parentMessageId
        });
      });

      clientSocket.on('new_message', (message) => {
        if (message.content === 'WebSocket thread message') {
          expect(message.thread_id).toBe(parentMessageId);
          clientSocket.disconnect();
          done();
        }
      });

      clientSocket.connect();
    });
  });
});