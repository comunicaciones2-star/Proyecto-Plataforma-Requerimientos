// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Request = require('../models/Request');

// Todas las rutas de este archivo requieren ser ADMIN
router.use(authenticate, authorize(['admin']));

/**
 * GET /api/admin/users
 * Listar todos los usuarios (sin contraseña) con paginación
 */
router.get('/users', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const total = await User.countDocuments();
    
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
      
    res.json({
      success: true,
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error al obtener usuarios:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener usuarios'
    });
  }
});

/**
 * POST /api/admin/users
 * Crear nuevo usuario
 */
router.post('/users', async (req, res) => {
  try {
    const { email, firstName, lastName, password, role, area, phone, department } = req.body;

    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con ese email'
      });
    }

    const user = new User({
      email,
      firstName,
      lastName,
      password,
      role,
      area,
      phone,
      department
    });

    await user.save();

    const userSafe = user.toObject();
    delete userSafe.password;

    res.status(201).json({
      success: true,
      user: userSafe
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario'
    });
  }
});

/**
 * PATCH /api/admin/users/:id
 * Actualizar datos básicos de usuario (sin contraseña)
 */
router.patch('/users/:id', async (req, res) => {
  try {
    const { firstName, lastName, role, area, phone, department, isActive } = req.body;

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { firstName, lastName, role, area, phone, department, isActive },
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
    console.error('Error al actualizar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario'
    });
  }
});

/**
 * DELETE (soft) /api/admin/users/:id
 * Desactivar usuario (soft delete)
 */
router.delete('/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Usuario desactivado',
      user
    });
  } catch (error) {
    console.error('Error al desactivar usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al desactivar usuario'
    });
  }
});

/**
 * PATCH /api/admin/users/:id/reset-password
 * Resetear contraseña a un valor por defecto
 */
router.patch('/users/:id/reset-password', async (req, res) => {
  try {
    const DEFAULT_PASSWORD = 'password123';

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    user.password = DEFAULT_PASSWORD;
    await user.save();

    res.json({
      success: true,
      message: 'Contraseña reseteada a password123'
    });
  } catch (error) {
    console.error('Error al resetear contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al resetear contraseña'
    });
  }
});

/**
 * GET /api/admin/requests
 * Listar todas las solicitudes
 */
router.get('/requests', async (req, res) => {
  try {
    const requests = await Request.find()
      .populate('requester', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      requests
    });
  } catch (error) {
    console.error('Error al obtener solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes'
    });
  }
});

/**
 * GET /api/admin/requests/stats
 * Estadísticas generales para panel admin
 */
router.get('/requests/stats', async (req, res) => {
  try {
    const total = await Request.countDocuments();
    const completed = await Request.countDocuments({ status: 'completed' });
    const inProcess = await Request.countDocuments({ status: 'in-process' });
    const pending = await Request.countDocuments({ status: 'pending' });

    res.json({
      success: true,
      stats: {
        total,
        completed,
        inProcess,
        pending
      }
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

/**
 * DELETE /api/admin/requests/:id
 * Eliminar solicitud definitivamente (uso excepcional)
 */
router.delete('/requests/:id', async (req, res) => {
  try {
    const deleted = await Request.findByIdAndDelete(req.params.id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    res.json({
      success: true,
      message: 'Solicitud eliminada definitivamente'
    });
  } catch (error) {
    console.error('Error al eliminar solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar solicitud'
    });
  }
});

/**
 * GET /api/admin/export/users
 * Exportar usuarios en CSV sencillo
 */
router.get('/export/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').lean();

    const header = 'email,firstName,lastName,role,area,isActive,createdAt\n';
    const rows = users
      .map(u =>
        [
          u.email,
          u.firstName,
          u.lastName,
          u.role,
          u.area,
          u.isActive,
          u.createdAt.toISOString()
        ].join(',')
      )
      .join('\n');

    const csv = header + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="usuarios.csv"');
    res.send(csv);
  } catch (error) {
    console.error('Error al exportar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar usuarios'
    });
  }
});

/**
 * GET /api/admin/export/requests
 * Exportar solicitudes en CSV sencillo
 */
router.get('/export/requests', async (req, res) => {
  try {
    const requests = await Request.find().lean();

    const header =
      'requestNumber,title,area,type,urgency,status,requestDate,deliveryDate,completedDate\n';

    const rows = requests
      .map(r =>
        [
          r.requestNumber,
          (r.title || '').replace(/,/g, ' '),
          r.area,
          r.type,
          r.urgency,
          r.status,
          r.requestDate ? r.requestDate.toISOString() : '',
          r.deliveryDate ? r.deliveryDate.toISOString() : '',
          r.completedDate ? r.completedDate.toISOString() : ''
        ].join(',')
      )
      .join('\n');

    const csv = header + rows;

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="solicitudes.csv"'
    );
    res.send(csv);
  } catch (error) {
    console.error('Error al exportar solicitudes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al exportar solicitudes'
    });
  }
});

module.exports = router;
