// server.js - SERVIDOR EXPRESS CON MONGODB Y WEBSOCKETS
require('dotenv').config();

const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

// ==================== CONFIGURACIÓN ====================
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenalco-disenos';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
  : ['http://localhost:5000', 'http://localhost:8888'];

console.log('\n╔══════════════════════════════════════════════════════╗');
console.log('║    FENALCO - PLATAFORMA DE GESTIÓN DE DISEÑOS        ║');
console.log('╚══════════════════════════════════════════════════════╝\n');

// ==================== EXPRESS & HTTP ====================
const app = express();
const server = http.createServer(app);

// ==================== MIDDLEWARE ====================
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
  });
}

// ==================== MONGODB ====================
mongoose.connect(MONGODB_URI)
.then(() => {
  console.log('✅ MongoDB conectado exitosamente');
})
.catch((err) => {
  console.error('❌ Error conectando a MongoDB:', err.message);
  process.exit(1);
});

// Manejo de eventos de MongoDB
mongoose.connection.on('error', (err) => {
  console.error('❌ Error de MongoDB:', err.message);
});

mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB desconectado');
});

// ==================== RUTAS ====================
// Servir archivos estáticos
app.use(express.static(path.join(__dirname, '.')));

// API Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/requests', require('./routes/requestRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/departments', require('./routes/departmentRoutes'));

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
  console.error('Error:', err.message);
  res.status(err.statusCode || 500).json({
    success: false,
    message: err.message || 'Error interno del servidor'
  });
});

// ==================== INICIAR SERVIDOR ====================
server.listen(PORT, () => {
  console.log('📋 CONFIGURACIÓN:');
  console.log(`   Puerto: ${PORT}`);
  console.log(`   Entorno: ${process.env.NODE_ENV || 'development'}`);
  console.log(`   CORS Origins: ${ALLOWED_ORIGINS.join(', ')}`);
  console.log(`   MongoDB: ${MONGODB_URI.includes('mongodb+srv') ? 'MongoDB Atlas' : 'Local'}\n`);
  
  console.log('✅ SERVIDOR LISTO:');
  console.log(`   URL: http://localhost:${PORT}`);
  console.log(`   API: http://localhost:${PORT}/api`);
  console.log(`   Health: http://localhost:${PORT}/api/health`);
  console.log(`   WebSocket: ws://localhost:${PORT}\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Puerto ${PORT} ya está en uso.`);
    console.error('Intenta con otro puerto usando: $env:PORT="NUMERO"; node server.js\n');
    process.exit(1);
  } else {
    console.error('❌ Error del servidor:', err);
  }
});

// Manejo de excepciones no capturadas
process.on('uncaughtException', (err) => {
  console.error('❌ Excepción no capturada:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('❌ Rechazo no manejado:', reason);
  process.exit(1);
});
