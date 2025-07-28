import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

// Get all DM conversations
router.get('/dms', (req, res) => {
  const userId = req.user.id;

  try {
    const conversations = db.prepare(`
      SELECT DISTINCT
        CASE 
          WHEN dm.sender_id = ? THEN dm.receiver_id
          ELSE dm.sender_id
        END as other_user_id,
        u.username as other_username,
        MAX(dm.created_at) as last_message_at,
        (
          SELECT content FROM direct_messages 
          WHERE (sender_id = ? AND receiver_id = u.id) 
             OR (sender_id = u.id AND receiver_id = ?)
          ORDER BY created_at DESC 
          LIMIT 1
        ) as last_message
      FROM direct_messages dm
      JOIN users u ON u.id = CASE 
        WHEN dm.sender_id = ? THEN dm.receiver_id 
        ELSE dm.sender_id 
      END
      WHERE dm.sender_id = ? OR dm.receiver_id = ?
      GROUP BY other_user_id
      ORDER BY last_message_at DESC
    `).all(userId, userId, userId, userId, userId, userId);

    res.json(conversations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get messages with a specific user
router.get('/dms/:otherUserId', (req, res) => {
  const userId = req.user.id;
  const { otherUserId } = req.params;

  try {
    const messages = db.prepare(`
      SELECT 
        dm.*,
        s.username as sender_username,
        r.username as receiver_username
      FROM direct_messages dm
      JOIN users s ON dm.sender_id = s.id
      JOIN users r ON dm.receiver_id = r.id
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?)
         OR (dm.sender_id = ? AND dm.receiver_id = ?)
      ORDER BY dm.created_at ASC
    `).all(userId, otherUserId, otherUserId, userId);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// Send a DM
router.post('/dms/:receiverId', (req, res) => {
  const senderId = req.user.id;
  const { receiverId } = req.params;
  const { content } = req.body;

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content required' });
  }

  try {
    // Check if receiver exists
    const receiver = db.prepare('SELECT id, username FROM users WHERE id = ?').get(receiverId);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    const messageId = uuidv4();
    const createdAt = Math.floor(Date.now() / 1000);

    db.prepare(`
      INSERT INTO direct_messages (id, sender_id, receiver_id, content, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(messageId, senderId, receiverId, content, createdAt);

    const message = db.prepare(`
      SELECT 
        dm.*,
        s.username as sender_username,
        r.username as receiver_username
      FROM direct_messages dm
      JOIN users s ON dm.sender_id = s.id
      JOIN users r ON dm.receiver_id = r.id
      WHERE dm.id = ?
    `).get(messageId);

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get all users for DM search
router.get('/users', (req, res) => {
  const userId = req.user.id;

  try {
    const users = db.prepare(`
      SELECT id, username 
      FROM users 
      WHERE id != ?
      ORDER BY username ASC
    `).all(userId);

    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

export default router;