import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';

const router = express.Router();

router.use(authenticateToken);

router.post('/workspaces/:workspaceId/links', (req, res) => {
  const { workspaceId } = req.params;
  const { url, title, topic, description, short_description } = req.body;
  const userId = req.user.id;

  if (!url || !title) {
    return res.status(400).json({ error: 'URL and title required' });
  }

  try {
    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
    }

    const linkId = uuidv4();
    db.prepare('INSERT INTO links (id, workspace_id, url, title, topic, description, short_description, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(
      linkId, workspaceId, url, title, topic || null, description || null, short_description || null, userId
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

router.get('/workspaces/:workspaceId/links', (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
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
      WHERE l.workspace_id = ?
      GROUP BY l.id
      ORDER BY l.created_at DESC
    `).all(userId, workspaceId);

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
    const link = db.prepare('SELECT workspace_id FROM links WHERE id = ?').get(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(link.workspace_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
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

  if (!content || content.trim().length === 0) {
    return res.status(400).json({ error: 'Comment content required' });
  }

  try {
    const link = db.prepare('SELECT workspace_id FROM links WHERE id = ?').get(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(link.workspace_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
    }

    const commentId = uuidv4();
    db.prepare('INSERT INTO link_comments (id, link_id, user_id, content) VALUES (?, ?, ?, ?)').run(
      commentId, linkId, userId, content
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
    const link = db.prepare('SELECT workspace_id FROM links WHERE id = ?').get(linkId);
    if (!link) {
      return res.status(404).json({ error: 'Link not found' });
    }

    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(link.workspace_id, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
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

router.get('/workspaces/:workspaceId/links/greatest', (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const member = db.prepare('SELECT * FROM workspace_members WHERE workspace_id = ? AND user_id = ?').get(workspaceId, userId);
    if (!member) {
      return res.status(403).json({ error: 'Not a workspace member' });
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
      WHERE l.workspace_id = ?
      GROUP BY l.id
      HAVING COUNT(DISTINCT lr.user_id) >= 25
      ORDER BY AVG(lr.rating) DESC
    `).all(userId, workspaceId);

    res.json(links);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch greatest links' });
  }
});

export default router;