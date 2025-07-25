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

describe('Voice Calls (WebRTC)', () => {
  let io, httpServer;
  let clientSocket1, clientSocket2;
  let port;
  let userId1, userId2;
  let workspaceId, channelId;
  let authToken1, authToken2;

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

    // Create test users
    userId1 = 'voice-user-1';
    userId2 = 'voice-user-2';
    
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
      userId1, 'voiceuser1', 'hashedpassword'
    );
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(
      userId2, 'voiceuser2', 'hashedpassword'
    );

    // Create workspace
    workspaceId = 'voice-workspace-id';
    db.prepare('INSERT INTO workspaces (id, name, created_by) VALUES (?, ?, ?)').run(
      workspaceId, 'Voice Test Workspace', userId1
    );

    // Add users to workspace
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
      workspaceId, userId1, 'owner'
    );
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(
      workspaceId, userId2, 'member'
    );

    // Create channel
    channelId = 'voice-channel-id';
    db.prepare('INSERT INTO channels (id, workspace_id, name, created_by) VALUES (?, ?, ?, ?)').run(
      channelId, workspaceId, 'voice-general', userId1
    );

    // Create auth tokens
    authToken1 = jwt.sign({ id: userId1, username: 'voiceuser1' }, JWT_SECRET);
    authToken2 = jwt.sign({ id: userId2, username: 'voiceuser2' }, JWT_SECRET);

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
    if (clientSocket1 && clientSocket1.connected) clientSocket1.disconnect();
    if (clientSocket2 && clientSocket2.connected) clientSocket2.disconnect();
    if (io) io.close();
    if (httpServer) httpServer.close();
  });

  describe('Voice Call Initiation', () => {
    beforeEach((done) => {
      let connectedCount = 0;
      
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: false
      });

      clientSocket2 = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: false
      });

      const checkAllConnected = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };

      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', authToken1);
      });

      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_workspace', workspaceId);
      });

      clientSocket1.on('joined_workspace', () => {
        clientSocket1.emit('join_channel', channelId);
      });

      clientSocket1.on('joined_channel', checkAllConnected);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('authenticate', authToken2);
      });

      clientSocket2.on('authenticated', () => {
        clientSocket2.emit('join_workspace', workspaceId);
      });

      clientSocket2.on('joined_workspace', () => {
        clientSocket2.emit('join_channel', channelId);
      });

      clientSocket2.on('joined_channel', checkAllConnected);

      clientSocket1.connect();
      clientSocket2.connect();
    });

    afterEach(() => {
      if (clientSocket1.connected) clientSocket1.disconnect();
      if (clientSocket2.connected) clientSocket2.disconnect();
    });

    it('should start a voice call', (done) => {
      clientSocket1.on('voice_call_started', (data) => {
        expect(data).toHaveProperty('sessionId');
        expect(data.channelId).toBe(channelId);
        
        // Verify session in database
        const session = db.prepare('SELECT * FROM voice_sessions WHERE id = ?').get(data.sessionId);
        expect(session).toBeDefined();
        expect(session.channel_id).toBe(channelId);
        expect(session.started_by).toBe(userId1);
        expect(session.ended_at).toBeNull();
        
        done();
      });

      clientSocket1.emit('start_voice_call', { channelId });
    });

    it('should notify other users when someone joins voice', (done) => {
      let sessionId;

      clientSocket1.on('voice_call_started', (data) => {
        sessionId = data.sessionId;
        clientSocket2.emit('join_voice_call', { sessionId });
      });

      clientSocket2.on('voice_participant_joined', (data) => {
        expect(data.userId).toBe(userId2);
        expect(data.sessionId).toBe(sessionId);
        
        // Verify participant in database
        const participant = db.prepare(
          'SELECT * FROM voice_participants WHERE session_id = ? AND user_id = ?'
        ).get(sessionId, userId2);
        expect(participant).toBeDefined();
        expect(participant.left_at).toBeNull();
        
        done();
      });

      clientSocket1.emit('start_voice_call', { channelId });
    });

    it('should track active voice participants', (done) => {
      let sessionId;

      clientSocket1.on('voice_call_started', (data) => {
        sessionId = data.sessionId;
        clientSocket2.emit('join_voice_call', { sessionId });
      });

      clientSocket2.on('voice_participant_joined', () => {
        clientSocket1.emit('get_voice_participants', { sessionId });
      });

      clientSocket1.on('voice_participants_list', (data) => {
        expect(Array.isArray(data.participants)).toBe(true);
        expect(data.participants.length).toBe(2);
        
        const userIds = data.participants.map(p => p.userId);
        expect(userIds).toContain(userId1);
        expect(userIds).toContain(userId2);
        
        done();
      });

      clientSocket1.emit('start_voice_call', { channelId });
    });
  });

  describe('WebRTC Signaling', () => {
    beforeEach((done) => {
      let connectedCount = 0;
      
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: false
      });

      clientSocket2 = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: false
      });

      const checkAllConnected = () => {
        connectedCount++;
        if (connectedCount === 2) done();
      };

      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', authToken1);
      });

      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_workspace', workspaceId);
      });

      clientSocket1.on('joined_workspace', () => {
        clientSocket1.emit('join_channel', channelId);
      });

      clientSocket1.on('joined_channel', checkAllConnected);

      clientSocket2.on('connect', () => {
        clientSocket2.emit('authenticate', authToken2);
      });

      clientSocket2.on('authenticated', () => {
        clientSocket2.emit('join_workspace', workspaceId);
      });

      clientSocket2.on('joined_workspace', () => {
        clientSocket2.emit('join_channel', channelId);
      });

      clientSocket2.on('joined_channel', checkAllConnected);

      clientSocket1.connect();
      clientSocket2.connect();
    });

    afterEach(() => {
      if (clientSocket1.connected) clientSocket1.disconnect();
      if (clientSocket2.connected) clientSocket2.disconnect();
    });

    it('should exchange WebRTC offers', (done) => {
      const mockOffer = {
        type: 'offer',
        sdp: 'mock-sdp-offer'
      };

      clientSocket2.on('voice_offer', (data) => {
        expect(data.offer).toEqual(mockOffer);
        expect(data.fromUserId).toBe(userId1);
        done();
      });

      clientSocket1.emit('voice_offer', {
        offer: mockOffer,
        toUserId: userId2
      });
    });

    it('should exchange WebRTC answers', (done) => {
      const mockAnswer = {
        type: 'answer',
        sdp: 'mock-sdp-answer'
      };

      clientSocket1.on('voice_answer', (data) => {
        expect(data.answer).toEqual(mockAnswer);
        expect(data.fromUserId).toBe(userId2);
        done();
      });

      clientSocket2.emit('voice_answer', {
        answer: mockAnswer,
        toUserId: userId1
      });
    });

    it('should exchange ICE candidates', (done) => {
      const mockCandidate = {
        candidate: 'candidate:123456',
        sdpMLineIndex: 0,
        sdpMid: 'audio'
      };

      clientSocket2.on('voice_ice_candidate', (data) => {
        expect(data.candidate).toEqual(mockCandidate);
        expect(data.fromUserId).toBe(userId1);
        done();
      });

      clientSocket1.emit('voice_ice_candidate', {
        candidate: mockCandidate,
        toUserId: userId2
      });
    });
  });

  describe('Voice Call Management', () => {
    beforeEach((done) => {
      clientSocket1 = ioClient(`http://localhost:${port}`, {
        transports: ['websocket'],
        autoConnect: false
      });

      clientSocket1.on('connect', () => {
        clientSocket1.emit('authenticate', authToken1);
      });

      clientSocket1.on('authenticated', () => {
        clientSocket1.emit('join_workspace', workspaceId);
      });

      clientSocket1.on('joined_workspace', () => {
        clientSocket1.emit('join_channel', channelId);
      });

      clientSocket1.on('joined_channel', done);

      clientSocket1.connect();
    });

    afterEach(() => {
      if (clientSocket1.connected) clientSocket1.disconnect();
    });

    it('should leave voice call', (done) => {
      let sessionId;

      clientSocket1.on('voice_call_started', (data) => {
        sessionId = data.sessionId;
        clientSocket1.emit('leave_voice_call', { sessionId });
      });

      clientSocket1.on('voice_participant_left', (data) => {
        expect(data.userId).toBe(userId1);
        
        // Verify participant marked as left in database
        const participant = db.prepare(
          'SELECT * FROM voice_participants WHERE session_id = ? AND user_id = ?'
        ).get(sessionId, userId1);
        expect(participant.left_at).toBeTruthy();
        
        done();
      });

      clientSocket1.emit('start_voice_call', { channelId });
    });

    it('should end voice call when last participant leaves', (done) => {
      let sessionId;

      clientSocket1.on('voice_call_started', (data) => {
        sessionId = data.sessionId;
        clientSocket1.emit('leave_voice_call', { sessionId });
      });

      clientSocket1.on('voice_call_ended', (data) => {
        expect(data.sessionId).toBe(sessionId);
        
        // Verify session marked as ended in database
        const session = db.prepare('SELECT * FROM voice_sessions WHERE id = ?').get(sessionId);
        expect(session.ended_at).toBeTruthy();
        
        done();
      });

      clientSocket1.emit('start_voice_call', { channelId });
    });

    it('should prevent joining ended voice calls', (done) => {
      // Create an ended session
      const endedSessionId = 'ended-session-id';
      db.prepare(`
        INSERT INTO voice_sessions (id, channel_id, started_by, ended_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(endedSessionId, channelId, userId1);

      clientSocket1.on('voice_error', (data) => {
        expect(data.error).toContain('ended');
        done();
      });

      clientSocket1.emit('join_voice_call', { sessionId: endedSessionId });
    });

    it('should handle multiple concurrent voice calls in different channels', () => {
      // Create another channel
      const channelId2 = 'voice-channel-2';
      db.prepare('INSERT INTO channels (id, workspace_id, name, created_by) VALUES (?, ?, ?, ?)').run(
        channelId2, workspaceId, 'voice-meeting', userId1
      );

      // Create sessions in both channels
      const session1Id = 'session-1';
      const session2Id = 'session-2';
      
      db.prepare(`
        INSERT INTO voice_sessions (id, channel_id, started_by)
        VALUES (?, ?, ?)
      `).run(session1Id, channelId, userId1);
      
      db.prepare(`
        INSERT INTO voice_sessions (id, channel_id, started_by)
        VALUES (?, ?, ?)
      `).run(session2Id, channelId2, userId2);

      // Verify both sessions exist independently
      const sessions = db.prepare('SELECT * FROM voice_sessions WHERE ended_at IS NULL').all();
      expect(sessions.length).toBe(2);
      
      const channelIds = sessions.map(s => s.channel_id);
      expect(channelIds).toContain(channelId);
      expect(channelIds).toContain(channelId2);
    });
  });
});