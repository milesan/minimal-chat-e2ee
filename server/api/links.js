import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';
import { validateUrl, validateName, validateText, validateMessage } from '../utils/validation.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/servers/:serverId/links', (req, res) => {
  const { serverId } = req.params;
  const { url, title, topic, description, short_description } = req.body;
  const userId = req.user.id;

  // Validate URL
  const urlValidation = validateUrl(url);
  if (!urlValidation.valid) {
    return res.status(400).json({ error: urlValidation.error });
  }

  // Validate title
  const titleValidation = validateName(title, 'Title');
  if (!titleValidation.valid) {
    return res.status(400).json({ error: titleValidation.error });
  }

  // Validate optional fields
  const topicValidation = validateText(topic, 'Topic', 50);
  if (!topicValidation.valid) {
    return res.status(400).json({ error: topicValidation.error });
  }

  const descValidation = validateText(description, 'Description', 500);
  if (!descValidation.valid) {
    return res.status(400).json({ error: descValidation.error });
  }

  const shortDescValidation = validateText(short_description, 'Short description', 200);
  if (!shortDescValidation.valid) {
    return res.status(400).json({ error: shortDescValidation.error });
  }

  try {
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const linkId = uuidv4();
    db.prepare('INSERT INTO links (id, server_id, url, title, topic, description, short_description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      linkId, serverId, urlValidation.value, titleValidation.value, 
      topicValidation.value || null, descValidation.value || null, 
      shortDescValidation.value || null, userId
    );

    const link = db.prepare(`
      SELECT l.*, u.username as creator_username,
      0 as rating_count,
      0 as avg_rating,
      0 as comment_count
      FROM links l
      JOIN users u ON l.created_by = u.id
      WHERE l.id = ?
    `).get(linkId);

    res.json(link);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create link' });
  }
});

router.get('/servers/:serverId/links', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;

  try {
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const links = db.prepare(`
      SELECT 
        l.*,
        u.username as creator_username,
        COUNT(DISTINCT lr.user_id) as rating_count,
        COALESCE(AVG(lr.rating), 0) as avg_rating,
        COUNT(DISTINCT lc.id) as comment_count,
        ur.rating as user_rating
      FROM links l
      JOIN users u ON l.created_by = u.id
      LEFT JOIN link_ratings lr ON l.id = lr.link_id
      LEFT JOIN link_comments lc ON l.id = lc.link_id
      LEFT JOIN link_ratings ur ON l.id = ur.link_id AND ur.user_id = ?
      WHERE l.server_id = ?
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `).all(userId, serverId);

    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch links' });
  }
});

router.post('/links/:linkId/rate', (req, res) => {
  const { linkId } = req.params;
  const { rating } = req.body;
  const userId = req.user.id;

  if (rating === undefined || rating < 0 || rating > 10) {
    return res.status(400).json({ error: 'Rating must be between 0 and 10' });
  }

  try {
    const link = db.prepare('SELECT server_id FROM links WHERE id = ?').get(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(link.server_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    db.prepare('INSERT OR REPLACE INTO link_ratings (link_id, user_id, rating) VALUES (?, ?, ?)').run(linkId, userId, rating);

    const stats = db.prepare(`
      SELECT 
        COUNT(*) as rating_count,
        AVG(rating) as avg_rating
      FROM link_ratings
      WHERE link_id = ?
    `).get(linkId);

    res.json({ rating, ...stats });
  } catch (error) {
    res.status(500).json({ error: 'Failed to rate link' });
  }
});

router.post('/links/:linkId/comments', (req, res) => {
  const { linkId } = req.params;
  const { content } = req.body;
  const userId = req.user.id;

  // Validate comment content
  const contentValidation = validateMessage(content);
  if (!contentValidation.valid) {
    return res.status(400).json({ error: contentValidation.error });
  }

  try {
    const link = db.prepare('SELECT server_id FROM links WHERE id = ?').get(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(link.server_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const commentId = uuidv4();
    const validContent = contentValidation.value;
    db.prepare('INSERT INTO link_comments (id, link_id, user_id, content) VALUES (?, ?, ?, ?)').run(
      commentId, linkId, userId, validContent
    );

    const comment = db.prepare(`
      SELECT c.*, u.username
      FROM link_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `).get(commentId);

    res.json(comment);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

router.get('/links/:linkId/comments', (req, res) => {
  const { linkId } = req.params;
  const userId = req.user.id;

  try {
    const link = db.prepare('SELECT server_id FROM links WHERE id = ?').get(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(link.server_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const comments = db.prepare(`
      SELECT c.*, u.username
      FROM link_comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.link_id = ?
      ORDER BY c.created_at DESC
    `).all(linkId);

    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
});

router.get('/servers/:serverId/links/greatest', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;

  try {
    const member = db.prepare('SELECT * FROM server_members WHERE server_id = ? AND user_id = ?').get(serverId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a server member' });
    }

    const links = db.prepare(`
      SELECT 
        l.*,
        u.username as creator_username,
        COUNT(DISTINCT lr.user_id) as rating_count,
        AVG(lr.rating) as avg_rating,
        COUNT(DISTINCT lc.id) as comment_count,
        ur.rating as user_rating
      FROM links l
      JOIN users u ON l.created_by = u.id
      LEFT JOIN link_ratings lr ON l.id = lr.link_id
      LEFT JOIN link_comments lc ON l.id = lc.link_id
      LEFT JOIN link_ratings ur ON l.id = ur.link_id AND ur.user_id = ?
      WHERE l.server_id = ?
      GROUP BY l.id
      HAVING COUNT(DISTINCT lr.user_id) >= 25
      ORDER BY AVG(lr.rating) DESC
    `).all(userId, serverId);

    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch greatest links' });
  }
});

export default router;