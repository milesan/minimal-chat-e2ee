import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { config } from './config.js';
import { initializeDatabase } from './db/index.js';
import { runMigrations } from './db/migrations.js';
import { fixProductionMigration } from './db/fix-production-migration.js';
import authRoutes from './api/auth.js';
import channelRoutes from './api/channels.js';
import linkRoutes from './api/links.js';
import dmRoutes from './api/dms.js';
import serverRoutes from './api/servers.js';
import healthRoutes from './health.js';
import { handleSocketConnection } from './websocket/index.js';

const app = express();

// Disable X-Powered-By header
app.disable('x-powered-by');

// Trust proxy in production (Railway runs behind a proxy)
if (config.NODE_ENV === 'production') {
  app.set('trust proxy', true);
}

// CORS configuration
const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) return callback(null, true);
    
    // In production, check against allowed origins
    if (config.NODE_ENV === 'production') {
      // If no CLIENT_URL is set, temporarily allow all (with warning)
      if (!process.env.CLIENT_URL) {
        console.warn('CLIENT_URL not set in production - allowing all origins. This is insecure!');
        return callback(null, true);
      }
      
      // Check if origin matches allowed origins
      const allowedOrigins = config.ALLOWED_ORIGINS || [config.CLIENT_URL];
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log(`CORS blocked origin: ${origin}, allowed: ${allowedOrigins.join(', ')}`);
        callback(new Error('Not allowed by CORS'));
      }
    } else {
      // In development, allow all origins
      callback(null, true);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length', 'Content-Type'],
  maxAge: 86400 // Cache preflight for 24 hours
};

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
  allowEIO3: false // Only allow current Socket.IO protocol
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Increased from 100 to 500 requests per window
  message: 'Too many requests from this IP',
  standardHeaders: true, // Return rate limit info in headers
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json({ error: 'Too many requests, please try again later.' });
  }
});

// HTTPS enforcement in production
if (config.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.header('x-forwarded-proto') !== 'https') {
      return res.redirect(`https://${req.header('host')}${req.url}`);
    }
    next();
  });
}

// Security headers configuration
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // React needs inline styles
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
      upgradeInsecureRequests: config.NODE_ENV === 'production' ? [] : null
    }
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'same-origin' }
}));
app.use(cors(corsOptions));
app.use(compression());
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use('/api/', limiter);

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/servers', serverRoutes);
app.use('/api', dmRoutes);
app.use('/api', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS policy violation' });
  }
  res.status(500).json({ error: 'Internal server error' });
});

io.on('connection', (socket) => handleSocketConnection(io, socket));

const PORT = config.PORT;

// Add startup logging
console.log('Starting server with configuration:', {
  NODE_ENV: config.NODE_ENV,
  PORT: config.PORT,
  CLIENT_URL: config.CLIENT_URL,
  ALLOWED_ORIGINS: config.ALLOWED_ORIGINS,
  JWT_SECRET_LENGTH: config.JWT_SECRET ? config.JWT_SECRET.length : 0
});

// Don't start server automatically in test environment
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  initializeDatabase().then(() => {
    console.log('Database initialized successfully');
    
    // Fix production migration issues first
    try {
      fixProductionMigration();
    } catch (error) {
      console.error('Failed to fix production migration:', error);
    }
    
    runMigrations();
    console.log('Migrations completed');
    httpServer.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at: http://0.0.0.0:${PORT}/health`);
    });
  }).catch(err => {
    // Log error internally but don't expose details
    console.error('Failed to initialize database:', err.message);
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
      console.error('Error details:', err);
    }
    process.exit(1);
  });
}

export default app;