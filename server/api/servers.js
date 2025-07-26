import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';
import { validateName, validateImageData } from '../utils/validation.js';

const router = express.Router();

// Get image - no auth required for viewing images
router.get('/:serverId/images/:imageId', (req, res) => {
  const { serverId, imageId } = req.params;

  try {
    const image = db.prepare('SELECT data FROM images WHERE id = ? AND server_id = ?').get(imageId, serverId);
    
    if (!image) {
      return res.status(404).json({ error: 'Image not found' });
    }

    // Convert base64 to buffer and send
    const matches = image.data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const contentType = matches[1];
      const data = matches[2];
      const img = Buffer.from(data, 'base64');
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': img.length
      });
      res.end(img);
    } else {
      res.status(400).json({ error: 'Invalid image data' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch image' });
  }
});

// Apply authentication to all other routes
router.use(authenticateToken);

// Get server settings
router.get('/:serverId/settings', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;

  try {
    const server = db.prepare(`
      SELECT w.*, 
        CASE WHEN w.created_by = ? THEN 1 ELSE 0 END as is_owner
      FROM servers w
      JOIN server_members wm ON w.id = wm.server_id
      WHERE w.id = ? AND wm.user_id = ?
    `).get(userId, serverId, userId);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(server);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch server settings' });
  }
});

// Update server settings (owner only)
router.put('/:serverId/settings', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;
  const { name, images_enabled } = req.body;

  try {
    // Check if user is owner
    const server = db.prepare('SELECT * FROM servers WHERE id = ? AND created_by = ?').get(serverId, userId);
    if (!server) {
      return res.status(403).json({ error: 'Only server owner can update settings' });
    }

    // Update settings
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // Validate server name
      const nameValidation = validateName(name, 'Server name');
      if (!nameValidation.valid) {
        return res.status(400).json({ error: nameValidation.error });
      }
      updates.push('name = ?');
      params.push(nameValidation.value);
    }

    if (images_enabled !== undefined) {
      updates.push('images_enabled = ?');
      params.push(images_enabled ? 1 : 0);
      
      // Track when images were enabled/disabled
      if (images_enabled && !server.images_enabled) {
        updates.push('images_enabled_at = ?');
        params.push(Math.floor(Date.now() / 1000));
      }
    }

    if (updates.length > 0) {
      params.push(serverId);
      db.prepare(`UPDATE servers SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM servers WHERE id = ?').get(serverId);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update server settings' });
  }
});

// Upload image (if server has images enabled)
router.post('/:serverId/upload', (req, res) => {
  const { serverId } = req.params;
  const userId = req.user.id;
  const { image_data, filename } = req.body;

  // Validate image data
  const imageValidation = validateImageData(image_data, filename);
  if (!imageValidation.valid) {
    return res.status(400).json({ error: imageValidation.error });
  }

  try {
    // Check if server has images enabled
    const server = db.prepare(`
      SELECT w.images_enabled 
      FROM servers w
      JOIN server_members wm ON w.id = wm.server_id
      WHERE w.id = ? AND wm.user_id = ?
    `).get(serverId, userId);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    if (!server.images_enabled) {
      return res.status(403).json({ error: 'Images not enabled for this server' });
    }

    // In production, you'd upload to S3/Cloudinary/etc
    // For now, we'll store base64 in a simple images table
    const imageId = uuidv4();
    
    // Create images table if needed
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

    db.prepare('INSERT INTO images (id, server_id, uploaded_by, filename, data) VALUES (?, ?, ?, ?, ?)').run(
      imageId, serverId, userId, imageValidation.filename, imageValidation.value
    );

    res.json({ 
      id: imageId, 
      url: `/api/servers/${serverId}/images/${imageId}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

export default router;