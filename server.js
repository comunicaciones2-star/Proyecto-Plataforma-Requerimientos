// server.js - SERVIDOR EXPRESS CON MONGODB Y WEBSOCKETS
require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const path = require('path');
const logger = require('./utils/logger');

// ==================== CONFIGURACIÓN ====================
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenalco-disenos';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:8888'];

global.logger = logger;

logger.info('FENALCO - PLATAFORMA DE GESTIÓN DE DISEÑOS iniciando', {
  environment: process.env.NODE_ENV || 'development',
  port: PORT
});

// ==================== EXPRESS & HTTP ====================
const app = express();
const server = http.createServer(app);

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(mongoSanitize());

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);

// CORS mejorado
app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Preflight para CORS
app.options('*', cors());

// Logging de requests (solo en desarrollo)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    logger.info('HTTP request', {
      method: req.method,
      path: req.path,
      ip: req.ip
    });
    next();
  });
}

// ==================== MONGODB ====================
mongoose.connect(MONGODB_URI)
.then(() => {
  logger.info('MongoDB conectado exitosamente');
})
.catch((err) => {
  logger.error('Error conectando a MongoDB', { error: err.message });
  process.exit(1);
});

// Manejo de eventos de MongoDB
mongoose.connection.on('error', (err) => {
  logger.error('Error de MongoDB', { error: err.message });
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB desconectado');
});

// ==================== RUTAS ====================
// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '.')));
// Servir archivos subidos (uploads)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/queue', require('./routes/queueRoutes'));

// API Welcome
app.get('/api', (req, res) => {
  res.json({
    message: '✅ API Fenalco Plataforma de Gestión de Diseños',
    version: '3.0.0',
    status: 'operativo',
    endpoints: {
      auth: '/api/auth',
      requests: '/api/requests',
      users: '/api/users',
      reports: '/api/reports',
      admin: '/api/admin',
      health: '/api/health'
    }
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK',
    timestamp: new Date().toISOString(),
    port: PORT,
    environment: process.env.NODE_ENV || 'development'
  });
});

// Servir la app principal en raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== WEBSOCKET ====================
const { initializeWebSocket } = require('./utils/websocket');
initializeWebSocket(server);

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  logger.error('Error no controlado en request', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor'
  });
});

// ==================== INICIAR SERVIDOR ====================
server.listen(PORT, () => {
  logger.info('Servidor listo', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    corsOrigins: ALLOWED_ORIGINS,
    mongo: MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local',
    apiUrl: `http://localhost:${PORT}/api`,
    healthUrl: `http://localhost:${PORT}/api/health`
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error('Puerto ya está en uso', {
      port: PORT,
      hint: 'Intenta con otro puerto usando: $env:PORT="NUMERO"; node server.js'
    });
    process.exit(1);
  } else {
    logger.error('Error del servidor', { error: err.message, stack: err.stack });
  }
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (err) => {
  logger.error('Excepción no capturada', { error: err.message, stack: err.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  logger.error('Rechazo no manejado', {
    reason: reason instanceof Error ? reason.message : String(reason)
  });
  process.exit(1);
});
