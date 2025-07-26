import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app from '../server/index.js';
import db, { initializeDatabase } from '../server/db/index.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcrypt';

describe('Servers API', () => {
  let server;
  let user1Token, user2Token;
  let userId1, userId2;
  let serverId, encryptedServerId;
  let channelId;

  beforeAll(async () => {
    await initializeDatabase();
    server = app.listen(0);
  });

  afterAll(async () => {
    await new Promise(resolve => server.close(resolve));
  });

  beforeEach(() => {
    // Create test users
    userId1 = uuidv4();
    userId2 = uuidv4();
    const passwordHash = bcrypt.hashSync('password123', 10);
    
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId1, 'owner', passwordHash);
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId2, 'member', passwordHash);

    // Create test server
    serverId = uuidv4();
    db.prepare('INSERT INTO servers (id, name, created_by, visibility, images_enabled) VALUES (?, ?, ?, ?, ?)')
      .run(serverId, 'Test Server', userId1, 'public', 0);
    
    // Add users to server
    db.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)').run(serverId, userId1, Date.now());
    db.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)').run(serverId, userId2, Date.now());
    
    // Create a channel
    channelId = uuidv4();
    db.prepare('INSERT INTO channels (id, server_id, name, created_by) VALUES (?, ?, ?, ?)')
      .run(channelId, serverId, 'general', userId1);

    // Create encrypted server
    encryptedServerId = uuidv4();
    db.prepare('INSERT INTO servers (id, name, created_by, encrypted, encryption_key_hash) VALUES (?, ?, ?, ?, ?)')
      .run(encryptedServerId, 'Encrypted Server', userId1, 1, 'fake-hash');
    db.prepare('INSERT INTO server_members (server_id, user_id, joined_at) VALUES (?, ?, ?)')
      .run(encryptedServerId, userId1, Date.now());
  });

  afterEach(() => {
    // Clean up - use DROP IF EXISTS to avoid errors
    db.exec(`
      DROP TABLE IF EXISTS images;
      DELETE FROM server_members;
      DELETE FROM channels;
      DELETE FROM servers;
      DELETE FROM users;
    `);
  });

  async function getAuthToken(username, password) {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password });
    return res.body.token;
  }

  beforeEach(async () => {
    user1Token = await getAuthToken('owner', 'password123');
    user2Token = await getAuthToken('member', 'password123');
  });

  describe('GET /:serverId/settings', () => {
    it('should get server settings for member', async () => {
      const response = await request(app)
        .get(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user2Token}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        id: serverId,
        name: 'Test Server',
        is_owner: 0,
        images_enabled: 0
      });
    });

    it('should identify owner correctly', async () => {
      const response = await request(app)
        .get(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(200);
      expect(response.body.is_owner).toBe(1);
    });

    it('should return 404 for non-existent server', async () => {
      const fakeId = uuidv4();
      const response = await request(app)
        .get(`/api/servers/${fakeId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Server not found');
    });

    it('should return 404 for non-member', async () => {
      const nonMemberToken = await createUserAndGetToken('nonmember');
      
      const response = await request(app)
        .get(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${nonMemberToken}`);

      expect(response.status).toBe(404);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get(`/api/servers/${serverId}/settings`);

      expect(response.status).toBe(401);
    });
  });

  describe('PUT /:serverId/settings', () => {
    it('should update server name as owner', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ name: 'Updated Server Name' });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('Updated Server Name');

      // Verify in database
      const server = db.prepare('SELECT name FROM servers WHERE id = ?').get(serverId);
      expect(server.name).toBe('Updated Server Name');
    });

    it('should update images_enabled setting', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ images_enabled: true });

      expect(response.status).toBe(200);
      expect(response.body.images_enabled).toBe(1);
      expect(response.body.images_enabled_at).toBeDefined();
    });

    it('should update multiple settings at once', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ 
          name: 'New Name',
          images_enabled: true 
        });

      expect(response.status).toBe(200);
      expect(response.body.name).toBe('New Name');
      expect(response.body.images_enabled).toBe(1);
    });

    it('should reject update from non-owner', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user2Token}`)
        .send({ name: 'Unauthorized Update' });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Only server owner can update settings');
    });

    it('should validate server name', async () => {
      const invalidNames = [
        { name: '', expectedError: 'Server name cannot be empty' },
        { name: '   ', expectedError: 'Server name cannot be empty' },
        { name: 'a'.repeat(51), expectedError: 'Server name must be less than 50 characters' },
        { name: '<script>alert("xss")</script>', expectedError: 'Server name cannot contain HTML tags' }
      ];

      for (const { name, expectedError } of invalidNames) {
        const response = await request(app)
          .put(`/api/servers/${serverId}/settings`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ name });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(expectedError);
      }
    });

    it('should handle empty update request', async () => {
      const response = await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({});

      expect(response.status).toBe(200);
    });

    it('should not update images_enabled_at when already enabled', async () => {
      // First enable images
      await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ images_enabled: true });

      const server1 = db.prepare('SELECT images_enabled_at FROM servers WHERE id = ?').get(serverId);
      
      // Wait a bit then enable again
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await request(app)
        .put(`/api/servers/${serverId}/settings`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ images_enabled: true });

      const server2 = db.prepare('SELECT images_enabled_at FROM servers WHERE id = ?').get(serverId);
      expect(server2.images_enabled_at).toBe(server1.images_enabled_at);
    });
  });

  describe('POST /:serverId/upload', () => {
    beforeEach(async () => {
      // Enable images for test server
      db.prepare('UPDATE servers SET images_enabled = 1 WHERE id = ?').run(serverId);
    });

    it('should upload valid image', async () => {
      const validImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
      
      const response = await request(app)
        .post(`/api/servers/${serverId}/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          image_data: validImageData,
          filename: 'test.png'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('url');
      expect(response.body.url).toContain(`/api/servers/${serverId}/images/`);

      // Verify in database
      const image = db.prepare('SELECT * FROM images WHERE id = ?').get(response.body.id);
      expect(image).toBeDefined();
      expect(image.filename).toBe('test.png');
      expect(image.uploaded_by).toBe(userId1);
    });

    it('should reject upload when images disabled', async () => {
      db.prepare('UPDATE servers SET images_enabled = 0 WHERE id = ?').run(serverId);
      
      const response = await request(app)
        .post(`/api/servers/${serverId}/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          image_data: 'data:image/png;base64,iVBORw0KGgo=',
          filename: 'test.png'
        });

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Images not enabled for this server');
    });

    it('should validate image data', async () => {
      const invalidCases = [
        { 
          image_data: 'not-a-data-url', 
          filename: 'test.png',
          expectedError: 'Invalid image format. Must be JPEG, PNG, GIF, or WebP'
        },
        {
          image_data: 'data:text/plain;base64,dGV4dA==',
          filename: 'test.txt',
          expectedError: 'Invalid image format. Must be JPEG, PNG, GIF, or WebP'
        },
        {
          image_data: 'data:image/png;base64,',
          filename: 'test.png',
          expectedError: 'Invalid image data'
        },
        {
          image_data: 'data:image/png;base64,' + 'A'.repeat(7 * 1024 * 1024),
          filename: 'test.png',
          expectedError: 'Image size must be less than 5MB'
        }
      ];

      for (const { image_data, filename, expectedError } of invalidCases) {
        const response = await request(app)
          .post(`/api/servers/${serverId}/upload`)
          .set('Authorization', `Bearer ${user1Token}`)
          .send({ image_data, filename });

        expect(response.status).toBe(400);
        expect(response.body.error).toBe(expectedError);
      }
    });

    it('should handle upload without filename', async () => {
      const validImageData = 'data:image/png;base64,iVBORw0KGgo=';
      
      const response = await request(app)
        .post(`/api/servers/${serverId}/upload`)
        .set('Authorization', `Bearer ${user1Token}`)
        .send({ image_data: validImageData });

      expect(response.status).toBe(200);
      
      const image = db.prepare('SELECT filename FROM images WHERE id = ?').get(response.body.id);
      expect(image.filename).toBeNull();
    });

    it('should return 404 for non-member upload', async () => {
      const nonMemberToken = await createUserAndGetToken('uploader');
      
      const response = await request(app)
        .post(`/api/servers/${serverId}/upload`)
        .set('Authorization', `Bearer ${nonMemberToken}`)
        .send({
          image_data: 'data:image/png;base64,iVBORw0KGgo=',
          filename: 'test.png'
        });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Server not found');
    });
  });

  describe('GET /:serverId/images/:imageId', () => {
    let imageId;
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    beforeEach(() => {
      // Create images table
      db.exec(`
        CREATE TABLE IF NOT EXISTS images (
          id TEXT PRIMARY KEY,
          server_id TEXT NOT NULL,
          uploaded_by TEXT NOT NULL,
          filename TEXT,
          data TEXT NOT NULL,
          created_at INTEGER DEFAULT (unixepoch()),
          FOREIGN KEY (server_id) REFERENCES servers(id),
          FOREIGN KEY (uploaded_by) REFERENCES users(id)
        )
      `);

      // Insert test image
      imageId = uuidv4();
      db.prepare('INSERT INTO images (id, server_id, uploaded_by, data) VALUES (?, ?, ?, ?)')
        .run(imageId, serverId, userId1, testImageData);
    });

    it('should retrieve image successfully', async () => {
      const response = await request(app)
        .get(`/api/servers/${serverId}/images/${imageId}`);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toBe('image/png');
      expect(response.body).toBeInstanceOf(Buffer);
    });

    it('should return 404 for non-existent image', async () => {
      const fakeImageId = uuidv4();
      const response = await request(app)
        .get(`/api/servers/${serverId}/images/${fakeImageId}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Image not found');
    });

    it('should return 404 for wrong server ID', async () => {
      const wrongServerId = uuidv4();
      const response = await request(app)
        .get(`/api/servers/${wrongServerId}/images/${imageId}`);

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Image not found');
    });

    it('should handle corrupted image data', async () => {
      const corruptedId = uuidv4();
      db.prepare('INSERT INTO images (id, server_id, uploaded_by, data) VALUES (?, ?, ?, ?)')
        .run(corruptedId, serverId, userId1, 'corrupted-data');

      const response = await request(app)
        .get(`/api/servers/${serverId}/images/${corruptedId}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid image data');
    });

    it('should not require authentication to view images', async () => {
      // This is intentional - images can be viewed without auth
      // In production, you might want signed URLs or other access control
      const response = await request(app)
        .get(`/api/servers/${serverId}/images/${imageId}`);

      expect(response.status).toBe(200);
    });
  });

  // Helper function to create user and get token
  async function createUserAndGetToken(username) {
    const userId = uuidv4();
    const passwordHash = bcrypt.hashSync('password123', 10);
    db.prepare('INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)').run(userId, username, passwordHash);
    
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username, password: 'password123' });
    
    return res.body.token;
  }
});