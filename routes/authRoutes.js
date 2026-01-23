// routes/authRoutes.js - AUTENTICACIÓN CON JWT
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');

const router = express.Router();

// Rate limiting para prevenir ataques de fuerza bruta
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por ventana
  message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const logger = global.logger || console;
    logger.warn('⚠️  Rate limit excedido para login', {
      ip: req.ip,
      email: req.body.email
    });
    res.status(429).json({
      success: false,
      message: 'Demasiados intentos de inicio de sesión. Intenta de nuevo en 15 minutos.'
    });
  }
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 3, // 3 registros por hora
  message: 'Demasiados registros desde esta IP. Intenta de nuevo en 1 hora.'
});

// Función para generar tokens JWT
function generateToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      firstName: user.firstName,
      lastName: user.lastName
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
}

// ==================== POST /api/auth/login ====================
router.post('/login', loginLimiter, async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const { email, password } = req.body;

    // Validar que se proporcionen credenciales
    if (!email || !password) {
      logger.warn('❌ Login fallido: Email o contraseña faltante');
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios'
      });
    }

    logger.info(`🔍 Buscando usuario: ${email}`);

    // Buscar usuario (incluir contraseña con .select('+password'))
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      logger.warn(`❌ Usuario no encontrado: ${email}`, { ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña usando el método del modelo
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      logger.warn(`❌ Contraseña incorrecta para: ${email}`, { ip: req.ip });
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar que usuario esté activo
    if (!user.isActive) {
      logger.warn(`❌ Usuario inactivo: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado, contacte al administrador'
      });
    }

    // Generar token
    const token = generateToken(user);
    logger.info(`✅ Login exitoso: ${email} (${user.role})`);

    // Preparar usuario sin contraseña
    const userSafe = user.toObject();
    delete userSafe.password;

    res.json({
      success: true,
      token,
      user: userSafe,
      message: 'Sesión iniciada correctamente'
    });

  } catch (error) {
    logger.error('❌ Error en login:', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión: ' + error.message
    });
  }
});

// ==================== POST /api/auth/register ====================
router.post('/register', registerLimiter, async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const { email, firstName, lastName, password, area, role } = req.body;

    // Validar campos obligatorios
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios'
      });
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'La contraseña debe tener al menos 6 caracteres'
      });
    }

    // Verificar si usuario ya existe
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con ese email'
      });
    }

    // Crear nuevo usuario
    const user = new User({
      email,
      firstName,
      lastName,
      password,
      area,
      role: role || 'collaborator'
    });

    await user.save();
    logger.info(`✅ Usuario registrado: ${email}`, { role: user.role });

    const token = generateToken(user);

    const userSafe = user.toObject();
    delete userSafe.password;

    res.status(201).json({
      success: true,
      token,
      user: userSafe,
      message: 'Usuario registrado correctamente'
    });

  } catch (error) {
    logger.error('❌ Error en register:', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: 'Error al registrar usuario: ' + error.message
    });
  }
});

// ==================== GET /api/auth/me ====================
// Obtener información del usuario actual (requiere autenticación)
router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const userSafe = user.toObject();
    delete userSafe.password;

    res.json({
      success: true,
      user: userSafe
    });

  } catch (error) {
    console.error('Error en GET /me:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener información del usuario'
    });
  }
});

module.exports = router;
