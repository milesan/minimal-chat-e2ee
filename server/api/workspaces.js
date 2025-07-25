import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import db from '../db/index.js';
import { authenticateToken } from './auth.js';
import { validateName, validateImageData } from '../utils/validation.js';

const router = express.Router();

router.use(authenticateToken);

// Get workspace settings
router.get('/:workspaceId/settings', (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;

  try {
    const workspace = db.prepare(`
      SELECT w.*, 
        CASE WHEN w.created_by = ? THEN 1 ELSE 0 END as is_owner
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE w.id = ? AND wm.user_id = ?
    `).get(userId, workspaceId, userId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    res.json(workspace);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch workspace settings' });
  }
});

// Update workspace settings (owner only)
router.put('/:workspaceId/settings', (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;
  const { name, images_enabled } = req.body;

  try {
    // Check if user is owner
    const workspace = db.prepare('SELECT * FROM workspaces WHERE id = ? AND created_by = ?').get(workspaceId, userId);
    if (!workspace) {
      return res.status(403).json({ error: 'Only workspace owner can update settings' });
    }

    // Update settings
    const updates = [];
    const params = [];

    if (name !== undefined) {
      // Validate workspace name
      const nameValidation = validateName(name, 'Workspace name');
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
      if (images_enabled && !workspace.images_enabled) {
        updates.push('images_enabled_at = ?');
        params.push(Math.floor(Date.now() / 1000));
      }
    }

    if (updates.length > 0) {
      params.push(workspaceId);
      db.prepare(`UPDATE workspaces SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    }

    const updated = db.prepare('SELECT * FROM workspaces WHERE id = ?').get(workspaceId);
    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update workspace settings' });
  }
});

// Upload image (if workspace has images enabled)
router.post('/:workspaceId/upload', (req, res) => {
  const { workspaceId } = req.params;
  const userId = req.user.id;
  const { image_data, filename } = req.body;

  // Validate image data
  const imageValidation = validateImageData(image_data, filename);
  if (!imageValidation.valid) {
    return res.status(400).json({ error: imageValidation.error });
  }

  try {
    // Check if workspace has images enabled
    const workspace = db.prepare(`
      SELECT w.images_enabled 
      FROM workspaces w
      JOIN workspace_members wm ON w.id = wm.workspace_id
      WHERE w.id = ? AND wm.user_id = ?
    `).get(workspaceId, userId);

    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    if (!workspace.images_enabled) {
      return res.status(403).json({ error: 'Images not enabled for this workspace' });
    }

    // In production, you'd upload to S3/Cloudinary/etc
    // For now, we'll store base64 in a simple images table
    const imageId = uuidv4();
    
    // Create images table if needed
    db.exec(`
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        workspace_id TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        filename TEXT,
        data TEXT NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()),
        FOREIGN KEY (workspace_id) REFERENCES workspaces(id),
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      )
    `);

    db.prepare('INSERT INTO images (id, workspace_id, uploaded_by, filename, data) VALUES (?, ?, ?, ?, ?)').run(
      imageId, workspaceId, userId, imageValidation.filename, imageValidation.value
    );

    res.json({ 
      id: imageId, 
      url: `/api/workspaces/${workspaceId}/images/${imageId}`
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Get image
router.get('/:workspaceId/images/:imageId', (req, res) => {
  const { workspaceId, imageId } = req.params;

  try {
    const image = db.prepare('SELECT data FROM images WHERE id = ? AND workspace_id = ?').get(imageId, workspaceId);
    
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

export default router;