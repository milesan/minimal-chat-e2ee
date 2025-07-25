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
import authRoutes from './api/auth.js';
import channelRoutes from './api/channels.js';
import linkRoutes from './api/links.js';
import dmRoutes from './api/dms.js';
import workspaceRoutes from './api/workspaces.js';
import { handleSocketConnection } from './websocket/index.js';

const app = express();

// Disable X-Powered-By header
app.disable('x-powered-by');

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: config.CLIENT_URL,
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization'],
    maxAge: 86400
  },
  transports: ['websocket', 'polling'],
  pingTimeout: 30000,
  pingInterval: 25000,
  allowEIO3: false // Only allow current Socket.IO protocol
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
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
app.use(cors({
  origin: config.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  maxAge: 86400 // Cache preflight for 24 hours
}));
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
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', dmRoutes);

io.on('connection', (socket) => handleSocketConnection(io, socket));

const PORT = config.PORT;

initializeDatabase().then(() => {
  runMigrations();
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  // Log error internally but don't expose details
  console.error('Failed to initialize database');
  if (process.env.NODE_ENV === 'development') {
    console.error('Error details:', err);
  }
  process.exit(1);
});