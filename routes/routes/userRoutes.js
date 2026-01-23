// routes/userRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * GET /api/users/me
 * Devuelve la información del usuario autenticado
 */
router.get('/me', async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error en /users/me:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuario actual'
    });
  }
});

/**
 * PATCH /api/users/me
 * Actualizar perfil del usuario autenticado (sin contraseña)
 */
router.patch('/me', async (req, res) => {
  try {
    const { firstName, lastName, phone, department, area } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { firstName, lastName, phone, department, area },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      user
    });
  } catch (error) {
    console.error('Error al actualizar perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar perfil'
    });
  }
});

/**
 * GET /api/users
 * Listar usuarios (solo para admin y manager, por ejemplo)
 */
router.get('/', authorize(['admin', 'manager']), async (req, res) => {
  try {
    const users = await User.find().select('-password');

    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar usuarios'
    });
  }
});

module.exports = router;
