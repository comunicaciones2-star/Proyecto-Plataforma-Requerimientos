// server.js - SERVIDOR EXPRESS CON MONGODB Y WEBSOCKETS
require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./utils/logger');

// ==================== CONFIGURACIÓN ====================
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenalco-disenos';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:8888'];

const cspDirectives = {
  defaultSrc: ["'self'"],
  scriptSrc: [
    "'self'",
    "'unsafe-inline'",
    "'unsafe-eval'",
    'https://cdn.tailwindcss.com',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com'
  ],
  styleSrc: [
    "'self'",
    "'unsafe-inline'",
    'https://cdn.jsdelivr.net'
  ],
  fontSrc: [
    "'self'",
    'data:',
    'https://cdn.jsdelivr.net'
  ],
  imgSrc: [
    "'self'",
    'data:',
    'https://res.cloudinary.com',
    'https://*.cloudinary.com'
  ],
  connectSrc: [
    "'self'",
    'ws:',
    'wss:',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com'
  ],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  frameAncestors: ["'self'"],
  formAction: ["'self'"]
};

global.logger = logger;

logger.info('FENALCO - PLATAFORMA DE GESTIÓN DE DISEÑOS iniciando', {
  environment: process.env.NODE_ENV || 'development',
  port: PORT
});

// ==================== EXPRESS & HTTP ====================
const app = express();
const server = http.createServer(app);

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(mongoSanitize());
app.use(cookieParser());

app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: cspDirectives
    },
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
// Servir archivos estáticos solo desde carpeta segura
app.use('/public', express.static(path.join(__dirname, 'public')));
// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/admin/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));
app.use('/api/queue', require('./routes/queueRoutes'));
app.use('/api/files', require('./routes/fileRoutes'));

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

// Health check requerido por plataformas de despliegue
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Servir la app principal en raíz
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ==================== WEBSOCKET ====================
const { initializeWebSocket } = require('./utils/websocket');
const { startDeadlineAlertsMonitor, stopDeadlineAlertsMonitor } = require('./utils/deadlineAlerts');
initializeWebSocket(server);
startDeadlineAlertsMonitor();

// ==================== ERROR HANDLER ====================
app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Error interno del servidor';

  if (err.code === 'LIMIT_FILE_SIZE') {
    statusCode = 400;
    message = 'Cada archivo puede pesar máximo 10 MB.';
  }

  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    statusCode = 400;
    message = 'Máximo 5 archivos por solicitud.';
  }

  logger.error('Error no controlado en request', {
    message,
    originalMessage: err.message,
    code: err.code,
    stack: err.stack,
    path: req.path,
    method: req.method
  });
  res.status(statusCode).json({
    success: false,
    message
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

process.on('SIGINT', () => {
  stopDeadlineAlertsMonitor();
  process.exit(0);
});

process.on('SIGTERM', () => {
  stopDeadlineAlertsMonitor();
  process.exit(0);
});
