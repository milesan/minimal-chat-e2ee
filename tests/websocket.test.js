import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { io as ioClient } from 'socket.io-client';
import { createServer } from 'http';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { initializeDatabase } from '../server/db/index.js';
import { handleSocketConnection } from '../server/websocket/index.js';
import db from '../server/db/index.js';
import { runMigrations } from '../server/db/migrations.js';

const JWT_SECRET = 'test-secret';

describe('WebSocket Communication', () => {
  let io;
  let httpServer;
  let clientSocket;
  let serverSocket;
  let port;
  let server;

  beforeAll(async () => {
    await initializeDatabase();
    runMigrations();
    // Clean up any existing data
    db.exec('PRAGMA foreign_keys = OFF');
    db.exec(`
      DELETE FROM link_comments;
      DELETE FROM link_ratings;
      DELETE FROM links;
      DELETE FROM voice_participants;
      DELETE FROM voice_sessions;
      DELETE FROM messages;
      DELETE FROM channels;
      DELETE FROM server_members;
      DELETE FROM servers;
      DELETE FROM users;
    `);
    db.exec('PRAGMA foreign_keys = ON');

    const userId = 'test-user-id';
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
      userId, 'testuser', 'hashedpassword'
    );

    const serverId = 'test-server-id';
    db.prepare('INSERT INTO servers (id, name, created_by) VALUES (?, ?, ?)').run(
      serverId, 'Test Server', userId
    );

    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(
      serverId, userId, 'owner'
    );

    const channelId = 'test-channel-id';
    db.prepare('INSERT INTO channels (id, server_id, name, created_by) VALUES (?, ?, ?, ?)').run(
      channelId, serverId, 'general', userId
    );

    httpServer = createServer();
    io = new Server(httpServer);

    io.on('connection', (socket) => {
      handleSocketConnection(io, socket);
      serverSocket = socket;
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
    // Don't close db as it's shared
  });

  beforeEach((done) => {
    clientSocket = ioClient(`http://localhost:${port}`, {
      transports: ['websocket'],
      autoConnect: false
    });

    clientSocket.on('connect', done);
    clientSocket.connect();
  });

  afterEach(() => {
    if (clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  it('should authenticate with valid token', (done) => {
    const token = jwt.sign({ id: 'test-user-id', username: 'testuser' }, JWT_SECRET);

    clientSocket.on('authenticated', (data) => {
      expect(data.userId).toBe('test-user-id');
      done();
    });

    clientSocket.emit('authenticate', token);
  });

  it('should reject invalid token', (done) => {
    clientSocket.on('auth_error', (data) => {
      expect(data.error).toBe('Invalid token');
      done();
    });

    clientSocket.emit('authenticate', 'invalid-token');
  });

  it('should join server', (done) => {
    const token = jwt.sign({ id: 'test-user-id', username: 'testuser' }, JWT_SECRET);

    clientSocket.on('authenticated', () => {
      clientSocket.emit('join_server', 'test-server-id');
    });

    clientSocket.on('joined_server', (data) => {
      expect(data.serverId).toBe('test-server-id');
      done();
    });

    clientSocket.emit('authenticate', token);
  });

  it('should send and receive messages', (done) => {
    const token = jwt.sign({ id: 'test-user-id', username: 'testuser' }, JWT_SECRET);

    clientSocket.on('authenticated', () => {
      clientSocket.emit('join_server', 'test-server-id');
    });

    clientSocket.on('joined_server', () => {
      clientSocket.emit('join_channel', 'test-channel-id');
    });

    clientSocket.on('joined_channel', () => {
      clientSocket.emit('send_message', { content: 'Hello, World!' });
    });

    clientSocket.on('new_message', (message) => {
      expect(message.content).toBe('Hello, World!');
      expect(message.user_id).toBe('test-user-id');
      expect(message.username).toBe('testuser');
      done();
    });

    clientSocket.emit('authenticate', token);
  });
});