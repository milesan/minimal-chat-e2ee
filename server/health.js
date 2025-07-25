// Health check endpoint for debugging
import express from 'express';

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    environment: {
      PORT: process.env.PORT,
      CLIENT_URL: process.env.CLIENT_URL,
      JWT_SECRET: process.env.JWT_SECRET ? 'SET' : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV
    },
    timestamp: new Date().toISOString()
  });
});

export default router;