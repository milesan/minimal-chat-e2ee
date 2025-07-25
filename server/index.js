import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import compression from 'compression';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/index.js';
import { runMigrations } from './db/migrations.js';
import authRoutes from './api/auth.js';
import channelRoutes from './api/channels.js';
import linkRoutes from './api/links.js';
import dmRoutes from './api/dms.js';
import workspaceRoutes from './api/workspaces.js';
import { handleSocketConnection } from './websocket/index.js';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3033',
    credentials: true,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Authorization']
  },
  transports: ['websocket', 'polling']
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP'
});

app.use(helmet());
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3033',
  credentials: true
}));
app.use(compression());
app.use(express.json());
app.use('/api/', limiter);

app.use('/api/auth', authRoutes);
app.use('/api/channels', channelRoutes);
app.use('/api/links', linkRoutes);
app.use('/api/workspaces', workspaceRoutes);
app.use('/api', dmRoutes);

io.on('connection', (socket) => handleSocketConnection(io, socket));

const PORT = process.env.PORT || 3035;

initializeDatabase().then(() => {
  runMigrations();
  httpServer.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});