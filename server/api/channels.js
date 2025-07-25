import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';
import { validateName } from '../utils/validation.js';
import { handleDatabaseError, logError } from '../utils/errorHandler.js';
import { generateServerKey, hashServerKey, generateSalt, verifyServerKey } from '../utils/serverEncryption.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/servers', async (req, res) => {
  const { name, description, visibility = 'private', encrypted = false, encryptionKey } = req.body;
  const userId = req.user.id;

  // Validate server name
  const nameValidation = validateName(name, 'Server name');
  if (!nameValidation.valid) {
    return res.status(400).json({ error: nameValidation.error });
  }

  if (visibility && !['public', 'private'].includes(visibility)) {
    return res.status(400).json({ error: 'Invalid visibility setting' });
  }

  try {
    const serverId = uuidv4();
    const validName = nameValidation.value;
    
    let serverKey = null;
    let keyHash = null;
    let salt = null;
    
    if (encrypted) {
      // If encryption key provided, use it; otherwise generate new one
      serverKey = encryptionKey || generateServerKey();
      salt = generateSalt();
      keyHash = await hashServerKey(serverKey);
    }
    
    db.prepare('INSERT INTO servers (id, name, created_by, description, visibility, encrypted, encryption_key_hash, encryption_salt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      serverId, validName, userId, description || null, visibility, encrypted ? 1 : 0, keyHash, salt
    );
    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(serverId, userId, 'owner');
    
    const generalChannelId = uuidv4();
    // Channels in encrypted servers are unencrypted by default
    db.prepare('INSERT INTO channels (id, server_id, name, created_by, is_encrypted) VALUES (?, ?, ?, ?, ?)').run(
      generalChannelId, serverId, 'general', userId, 0
    );

    const response = { id: serverId, name: validName, description, visibility, encrypted };
    
    // If we generated a new key, return it (only on creation)
    if (encrypted && !encryptionKey) {
      response.encryptionKey = serverKey;
    }
    
    res.json(response);
  } catch (error) {
    logError('channels.createServer', error);
    res.status(500).json({ error: 'Failed to create server' });
  }
});

router.get('/servers', (req, res) => {
  const userId = req.user.id;

  try {
    const servers = db.prepare(`
      SELECT w.*, wm.role
      FROM servers w
      JOIN server_members wm ON w.id = wm.server_id
      WHERE wm.user_id = ?
    `).all(userId);

    res.json(servers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch servers' });
  }
});

router.post('/servers/:serverId/channels', (req, res) => {
  const { serverId } = req.params;
  const { name, encrypted } = req.body;
  const userId = req.user.id;

  // Validate channel name
  const nameValidation = validateName(name, 'Channel name');
  if (!nameValidation.valid) {
    return res.status(400).json({ error: nameValidation.error });
  }

  try {
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const channelId = uuidv4();
    const validName = nameValidation.value;
    const encryptedValue = encrypted ? 1 : 0;
    const encryptedAt = encrypted ? Math.floor(Date.now() / 1000) : null;
    
    db.prepare('INSERT INTO channels (id, server_id, name, created_by, encrypted, encrypted_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      channelId, serverId, validName, userId, encryptedValue, encryptedAt
    );

    res.json({ id: channelId, name: validName, server_id: serverId, encrypted: encryptedValue });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Channel name already exists' });
    } else {
      logError('channels.createChannel', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  }
});

router.get('/servers/:serverId/channels', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;

  try {
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const channels = db.prepare('SELECT * FROM channels WHERE server_id = ? ORDER BY created_at').all(serverId);
    res.json(channels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch channels' });
  }
});

router.get('/channels/:channelId/messages', (req, res) => {
  const { channelId } = req.params;
  const { limit = 50, before } = req.query;
  const userId = req.user.id;

  try {
    const channel = db.prepare('SELECT server_id FROM channels WHERE id = ?').get(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(channel.server_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    let query = `
      SELECT 
        m.*, 
        u.username,
        (SELECT COUNT(*) FROM messages WHERE thread_id = m.id) as thread_count,
        (SELECT MAX(created_at) FROM messages WHERE thread_id = m.id) as thread_last_message
      FROM messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.channel_id = ? AND m.thread_id IS NULL
    `;
    const params = [channelId];

    if (before) {
      query += ' AND m.created_at < ?';
      params.push(before);
    }

    query += ' ORDER BY m.created_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const messages = db.prepare(query).all(...params);
    res.json(messages.reverse());
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Get public servers
router.get('/servers/public', (req, res) => {
  try {
    const publicServers = db.prepare(`
      SELECT w.*, 
        (SELECT COUNT(*) FROM server_members WHERE server_id = w.id) as member_count
      FROM servers w
      WHERE w.visibility = 'public'
      ORDER BY w.created_at DESC
    `).all();

    res.json(publicServers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch public servers' });
  }
});

// Join a public server
router.post('/servers/:serverId/join', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;

  try {
    // Check if server exists and is public
    const server = db.prepare('SELECT * FROM servers WHERE id = ? AND visibility = ?').get(serverId, 'public');
    if (!server) {
      return res.status(404).json({ error: 'Public server not found' });
    }

    // Check if user is already a member
    const existingMember = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this server' });
    }

    // Add user as member
    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(serverId, userId, 'member');
    
    res.json({ success: true, server });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// Create invitation for a server
router.post('/servers/:serverId/invitations', async (req, res) => {
  const { serverId } = req.params;
  const { maxUses, expiresIn, encryptionKeyPassword } = req.body; // expiresIn in hours
  const userId = req.user.id;

  try {
    // Check if user is owner or admin
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member || member.role === 'member') {
      return res.status(403).json({ error: 'Only server owners and admins can create invitations' });
    }

    // Check 6-month minting limit
    const sixMonthsAgo = Math.floor(Date.now() / 1000) - (6 * 30 * 24 * 60 * 60); // Approximate 6 months
    const recentMint = db.prepare(`
      SELECT * FROM invite_minting 
      WHERE user_id = ? AND server_id = ? AND minted_at > ?
      ORDER BY minted_at DESC
      LIMIT 1
    `).get(userId, serverId, sixMonthsAgo);

    if (recentMint) {
      const nextMintTime = recentMint.minted_at + (6 * 30 * 24 * 60 * 60);
      const nextMintDate = new Date(nextMintTime * 1000).toISOString();
      return res.status(429).json({ 
        error: 'You can only create one invitation every 6 months', 
        nextAvailable: nextMintDate 
      });
    }

    // Check if server is encrypted
    const server = db.prepare('SELECT encrypted, encryption_key_hash FROM servers WHERE id = ?').get(serverId);
    
    if (server.encrypted && !encryptionKeyPassword) {
      return res.status(400).json({ error: 'Encryption key password required for encrypted servers' });
    }

    const invitationId = uuidv4();
    const code = uuidv4().substring(0, 8); // Short code for easier sharing
    const expiresAt = expiresIn ? Math.floor(Date.now() / 1000) + (expiresIn * 3600) : null;

    // Record the minting
    db.prepare('INSERT INTO invite_minting (user_id, server_id) VALUES (?, ?)').run(userId, serverId);

    db.prepare('INSERT INTO server_invitations (id, server_id, code, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      invitationId, serverId, code, userId, maxUses || null, expiresAt
    );

    const response = { 
      id: invitationId, 
      code, 
      maxUses: maxUses || null,
      expiresAt,
      inviteUrl: `/invite/${code}`
    };

    // For encrypted servers, include encrypted key info
    if (server.encrypted && encryptionKeyPassword) {
      response.requiresEncryptionKey = true;
      response.encryptionHint = 'Share the encryption key password securely with the invitee';
    }

    res.json(response);
  } catch (error) {
    console.error('Failed to create invitation:', error);
    res.status(500).json({ error: 'Failed to create invitation' });
  }
});

// Join server via invitation code
router.post('/servers/join-by-code', async (req, res) => {
  const { code, encryptionKey } = req.body;
  const userId = req.user.id;

  try {
    // Find invitation
    const invitation = db.prepare(`
      SELECT i.*, s.name as server_name, s.encrypted, s.encryption_key_hash
      FROM server_invitations i
      JOIN servers s ON i.server_id = s.id
      WHERE i.code = ?
    `).get(code);

    if (!invitation) {
      return res.status(404).json({ error: 'Invalid invitation code' });
    }

    // Check if server is encrypted and verify encryption key
    if (invitation.encrypted) {
      if (!encryptionKey) {
        return res.status(400).json({ error: 'This server requires an encryption key' });
      }
      
      // Verify the encryption key
      const validKey = await verifyServerKey(encryptionKey, invitation.encryption_key_hash);
      if (!validKey) {
        return res.status(401).json({ error: 'Invalid encryption key' });
      }
    }

    // Check if invitation is expired
    if (invitation.expires_at && invitation.expires_at < Math.floor(Date.now() / 1000)) {
      return res.status(400).json({ error: 'Invitation has expired' });
    }

    // Check if invitation has reached max uses
    if (invitation.max_uses && invitation.uses_count >= invitation.max_uses) {
      return res.status(400).json({ error: 'Invitation has reached maximum uses' });
    }

    // Check if user is already a member
    const existingMember = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(invitation.server_id, userId);
    if (existingMember) {
      return res.status(400).json({ error: 'Already a member of this server' });
    }

    // Add user as member
    db.prepare('INSERT INTO server_members (server_id, user_id, role) VALUES (?, ?, ?)').run(invitation.server_id, userId, 'member');
    
    // Track invitation use
    db.prepare('INSERT INTO invitation_uses (invitation_id, user_id) VALUES (?, ?)').run(invitation.id, userId);
    db.prepare('UPDATE server_invitations SET uses_count = uses_count + 1 WHERE id = ?').run(invitation.id);

    res.json({ 
      success: true, 
      server: {
        id: invitation.server_id,
        name: invitation.server_name
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to join server' });
  }
});

// Get server invitations (for owners/admins)
router.get('/servers/:serverId/invitations', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;

  try {
    // Check if user is owner or admin
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member || member.role === 'member') {
      return res.status(403).json({ error: 'Only server owners and admins can view invitations' });
    }

    const invitations = db.prepare(`
      SELECT i.*, u.username as created_by_username
      FROM server_invitations i
      JOIN users u ON i.created_by = u.id
      WHERE i.server_id = ?
      ORDER BY i.created_at DESC
    `).all(serverId);

    res.json(invitations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch invitations' });
  }
});

export default router;