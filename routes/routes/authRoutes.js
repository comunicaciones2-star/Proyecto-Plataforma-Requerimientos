// routes/authRoutes.js - AUTENTICACIÓN CON JWT
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

const router = express.Router();

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
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar que se proporcionen credenciales
    if (!email || !password) {
      console.warn('❌ Login fallido: Email o contraseña faltante');
      return res.status(400).json({
        success: false,
        message: 'Email y contraseña son obligatorios'
      });
    }

    console.log(`🔍 Buscando usuario: ${email}`);

    // Buscar usuario (incluir contraseña con .select('+password'))
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      console.warn(`❌ Usuario no encontrado: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar contraseña
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.warn(`❌ Contraseña incorrecta para: ${email}`);
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas'
      });
    }

    // Verificar que usuario esté activo
    if (!user.isActive) {
      console.warn(`❌ Usuario inactivo: ${email}`);
      return res.status(403).json({
        success: false,
        message: 'Usuario desactivado, contacte al administrador'
      });
    }

    // Generar token
    const token = generateToken(user);
    console.log(`✅ Login exitoso: ${email} (${user.role})`);

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
    console.error('❌ Error en login:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión: ' + error.message
    });
  }
});

// ==================== POST /api/auth/register ====================
router.post('/register', async (req, res) => {
  try {
    const { email, firstName, lastName, password, area, role } = req.body;

    // Validar campos obligatorios
    if (!email || !firstName || !lastName || !password) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios'
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
    console.log(`✅ Usuario registrado: ${email}`);

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
    console.error('❌ Error en register:', error.message);
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
