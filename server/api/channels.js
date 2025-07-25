import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';
import { validateName } from '../utils/validation.js';
import { handleDatabaseError, logError } from '../utils/errorHandler.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/workspaces', (req, res) => {
  const { name } = req.body;
  const userId = req.user.id;

  // Validate workspace name
  const nameValidation = validateName(name, 'Workspace name');
  if (!nameValidation.valid) {
    return res.status(400).json({ error: nameValidation.error });
  }

  try {
    const workspaceId = uuidv4();
    const validName = nameValidation.value;
    
    db.prepare('INSERT INTO workspaces (id, name, created_by) VALUES (?, ?, ?)').run(workspaceId, validName, userId);
    db.prepare('INSERT INTO workspace_members (workspace_id, user_id, role) VALUES (?, ?, ?)').run(workspaceId, userId, 'owner');
    
    const generalChannelId = uuidv4();
    db.prepare('INSERT INTO channels (id, workspace_id, name, created_by) VALUES (?, ?, ?, ?)').run(generalChannelId, workspaceId, 'general', userId);

    res.json({ id: workspaceId, name: validName });
  } catch (error) {
    logError('channels.createWorkspace', error);
    res.status(500).json({ error: 'Failed to create workspace' });
  }
});

router.get('/workspaces', (req, res) => {
  const userId = req.user.id;

  try {
    const workspaces = db.prepare(`
      SELECT w.*, wm.role
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE wm.user_id = ?
    `).all(userId);

    res.json(workspaces);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workspaces' });
  }
});

router.post('/workspaces/:workspaceId/channels', (req, res) => {
  const { workspaceId } = req.params;
  const { name, encrypted } = req.body;
  const userId = req.user.id;

  // Validate channel name
  const nameValidation = validateName(name, 'Channel name');
  if (!nameValidation.valid) {
    return res.status(400).json({ error: nameValidation.error });
  }

  try {
    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
    }

    const channelId = uuidv4();
    const validName = nameValidation.value;
    const encryptedValue = encrypted ? 1 : 0;
    const encryptedAt = encrypted ? Math.floor(Date.now() / 1000) : null;
    
    db.prepare('INSERT INTO channels (id, workspace_id, name, created_by, encrypted, encrypted_at) VALUES (?, ?, ?, ?, ?, ?)').run(
      channelId, workspaceId, validName, userId, encryptedValue, encryptedAt
    );

    res.json({ id: channelId, name: validName, workspace_id: workspaceId, encrypted: encryptedValue });
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(409).json({ error: 'Channel name already exists' });
    } else {
      logError('channels.createChannel', error);
      res.status(500).json({ error: 'Failed to create channel' });
    }
  }
});

router.get('/workspaces/:workspaceId/channels', (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
    }

    const channels = db.prepare('SELECT * FROM channels WHERE workspace_id = ? ORDER BY created_at').all(workspaceId);
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
    const channel = db.prepare('SELECT workspace_id FROM channels WHERE id = ?').get(channelId);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(channel.workspace_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
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

export default router;