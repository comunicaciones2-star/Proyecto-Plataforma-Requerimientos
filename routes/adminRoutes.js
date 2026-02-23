// routes/adminRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const User = require('../models/User');
const Request = require('../models/Request');
const { POSITION_CATALOG } = require('../config/positionCatalog');

const EXECUTOR_TYPES = ['gerente', 'diseñador', 'practicante'];

function normalizeAppRole(role) {
  return role === 'admin' ? 'admin' : 'usuario';
}

function normalizeExecutorType(value) {
  const typeMap = {
    manager: 'gerente',
    designer: 'diseñador',
    disenador: 'diseñador'
  };

  const rawValue = String(value || '').trim().toLowerCase();
  const normalized = typeMap[rawValue] || rawValue;
  return EXECUTOR_TYPES.includes(normalized) ? normalized : '';
}

function resolveExecutorType(user) {
  const profileType = user?.executorProfile?.executorType;
  if (EXECUTOR_TYPES.includes(profileType)) {
    return profileType;
  }

  return EXECUTOR_TYPES.includes(user?.role) ? user.role : '';
}

function isInvalidCargo(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  return ['usuario', 'user', 'colaborador', 'solicitante', ''].includes(normalized);
}

function normalizeCargo(position, role) {
  const rawPosition = (position || '').toString().trim();
  if (rawPosition && !isInvalidCargo(rawPosition)) return rawPosition;

  const cargoByLegacyRole = {
    gerente: 'Gerente',
    manager: 'Gerente',
    'diseñador': 'Diseñador gráfico',
    designer: 'Diseñador gráfico',
    practicante: 'Practicante',
    collaborator: ''
  };

  return cargoByLegacyRole[role] || '';
}

function normalizeUserForApp(userDoc) {
  const user = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  const originalRole = user.role;
  user.role = normalizeAppRole(originalRole);
  user.position = normalizeCargo(user.position, originalRole);
  return user;
}

// Todas las rutas de este archivo requieren ser ADMIN
router.use(authenticate, authorize(['admin']));

/**
 * GET /api/admin/catalogs/positions
 * Catálogo de cargos permitido/sugerido en la plataforma
 */
router.get('/catalogs/positions', async (req, res) => {
  res.json({
    success: true,
    positions: POSITION_CATALOG
  });
});

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

    const normalizedUsers = users.map((user) => normalizeUserForApp(user));
      
    res.json({
      success: true,
      users: normalizedUsers,
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
    const { email, firstName, lastName, password, role, area, phone, department, position, cargo } = req.body;

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
      role: normalizeAppRole(role),
      position: normalizeCargo(position || cargo, role),
      area,
      phone,
      department
    });

    await user.save();

    const userSafe = normalizeUserForApp(user);
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
    const { firstName, lastName, role, area, phone, department, isActive, position, cargo, email } = req.body;

    const updateData = {
      firstName,
      lastName,
      area,
      phone,
      department,
      isActive
    };

    if (typeof email !== 'undefined') {
      const normalizedEmail = String(email || '').trim().toLowerCase();
      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: 'El email es obligatorio'
        });
      }

      const emailExists = await User.findOne({ email: normalizedEmail, _id: { $ne: req.params.id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese email'
        });
      }

      updateData.email = normalizedEmail;
    }

    if (typeof role !== 'undefined') {
      updateData.role = normalizeAppRole(role);
    }

    if (typeof position !== 'undefined' || typeof cargo !== 'undefined') {
      const roleForCargo = typeof role !== 'undefined' ? role : undefined;
      updateData.position = normalizeCargo(position || cargo, roleForCargo);
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      updateData,
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
      user: normalizeUserForApp(user)
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);

    if (error.name === 'ValidationError') {
      const details = Object.values(error.errors || {})
        .map((item) => item.message)
        .join(', ');

      return res.status(400).json({
        success: false,
        message: details || 'Datos inválidos para actualizar usuario'
      });
    }

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

    const header = 'email,firstName,lastName,role,cargo,area,isActive,createdAt\n';
    const rows = users
      .map(u =>
        [
          u.email,
          u.firstName,
          u.lastName,
          normalizeAppRole(u.role),
          normalizeCargo(u.position, u.role),
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

// =============================================================================
// GESTIÓN DE EJECUTORES (GERENTES, DISEÑADORES, PRACTICANTES)
// =============================================================================

/**
 * GET /api/admin/executors
 * Listar todos los ejecutores con estadísticas en tiempo real
 */
router.get('/executors', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const { role, executorType, available } = req.query;
    const requestedType = normalizeExecutorType(executorType || role);
    
    // Construir filtro
    const filter = {
      $or: [
        { 'executorProfile.executorType': { $in: EXECUTOR_TYPES } },
        { role: { $in: EXECUTOR_TYPES } }
      ],
      isActive: true
    };
    
    if (requestedType) {
      filter.$or = [
        { 'executorProfile.executorType': requestedType },
        { role: requestedType }
      ];
    }
    if (available !== undefined) filter['executorProfile.available'] = available === 'true';
    
    // Obtener ejecutores
    const executors = await User.find(filter)
      .select('-password')
      .sort({ 'executorProfile.priority': 1, firstName: 1 });
    
    // Enriquecer con estadísticas en tiempo real
    const executorsWithStats = await Promise.all(executors.map(async (executor) => {
      const currentLoad = await executor.getCurrentLoad();
      const loadPercentage = (currentLoad / executor.executorProfile.capacity) * 100;
      const normalizedExecutorType = resolveExecutorType(executor);
      
      return {
        ...executor.toObject(),
        executorType: normalizedExecutorType,
        currentLoad,
        loadPercentage: Math.round(loadPercentage),
        hasCapacity: await executor.hasCapacity()
      };
    }));
    
    res.json({
      success: true,
      executors: executorsWithStats,
      total: executorsWithStats.length
    });
  } catch (error) {
    logger.error('Error al obtener ejecutores:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener ejecutores'
    });
  }
});

/**
 * POST /api/admin/executors
 * Crear nuevo ejecutor
 */
router.post('/executors', async (req, res) => {
  const logger = global.logger || console;
  const { generateSecurePassword, createLog } = require('../utils/helpers');
  
  try {
    const {
      email,
      firstName,
      lastName,
      cedula,
      role,
      executorType,
      position,
      department,
      phone,
      capacity,
      priority,
      allowedDesignTypes,
      specialties
    } = req.body;
    const selectedExecutorType = normalizeExecutorType(executorType || role);
    
    // Validar que sea un rol de ejecutor
    if (!selectedExecutorType) {
      return res.status(400).json({
        success: false,
        message: 'El rol debe ser gerente, diseñador o practicante'
      });
    }
    
    // Verificar que no exista el email
    const exists = await User.findOne({ email });
    if (exists) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un usuario con ese email'
      });
    }
    
    // Generar contraseña segura
    const password = generateSecurePassword(12);

    const normalizedCedula = String(cedula || '').trim();
    
    // Crear usuario ejecutor
    const executorData = {
      email,
      firstName,
      lastName,
      role: 'usuario',
      position: normalizeCargo(position, selectedExecutorType),
      department: department || 'Comunicaciones',
      phone,
      password,
      executorProfile: {
        executorType: selectedExecutorType,
        capacity: capacity || (selectedExecutorType === 'gerente' ? 15 : selectedExecutorType === 'diseñador' ? 8 : 5),
        priority: priority || (selectedExecutorType === 'gerente' ? 1 : selectedExecutorType === 'diseñador' ? 2 : 3),
        allowedDesignTypes: allowedDesignTypes || (selectedExecutorType === 'gerente' ? ['all'] : []),
        specialties: specialties || [],
        available: true
      }
    };

    if (normalizedCedula) {
      executorData.cedula = normalizedCedula;
    }

    const executor = new User(executorData);
    
    await executor.save();
    
    // Log de auditoría
    await createLog({
      level: 'info',
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      action: 'executor_created',
      details: {
        executorId: executor._id,
        executorEmail: executor.email,
        executorType: selectedExecutorType
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    // TODO: Enviar email con credenciales
    // await sendEmail(email, password);
    
    const executorSafe = executor.toObject();
    delete executorSafe.password;
    
    res.status(201).json({
      success: true,
      executor: executorSafe,
      temporaryPassword: password, // Solo para mostrar una vez
      message: 'Ejecutor creado exitosamente'
    });
  } catch (error) {
    logger.error('Error al crear ejecutor:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al crear ejecutor'
    });
  }
});

/**
 * PUT /api/admin/executors/:id
 * Actualizar perfil de ejecutor
 */
router.put('/executors/:id', async (req, res) => {
  const logger = global.logger || console;
  const { createLog } = require('../utils/helpers');
  
  try {
    const { id } = req.params;
    const {
      firstName,
      lastName,
      cedula,
      email,
      role,
      executorType,
      position,
      phone,
      capacity,
      priority,
      allowedDesignTypes,
      specialties,
      available,
      unavailableReason,
      unavailableUntil
    } = req.body;
    
    const executor = await User.findById(id);
    if (!executor) {
      return res.status(404).json({
        success: false,
        message: 'Ejecutor no encontrado'
      });
    }
    
    // Verificar que es un ejecutor
    if (!executor.isExecutor()) {
      return res.status(400).json({
        success: false,
        message: 'Este usuario no es un ejecutor'
      });
    }
    
    // Si cambia el email, verificar que no exista
    if (email && email !== executor.email) {
      const emailExists = await User.findOne({ email, _id: { $ne: id } });
      if (emailExists) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe un usuario con ese email'
        });
      }
      executor.email = email;
    }
    
    // Actualizar campos básicos
    if (firstName) executor.firstName = firstName;
    if (lastName) executor.lastName = lastName;
    if (typeof cedula !== 'undefined') {
      const normalizedCedula = String(cedula || '').trim();
      executor.cedula = normalizedCedula || undefined;
    }
    const nextExecutorType = normalizeExecutorType(executorType || role);
    if (nextExecutorType) {
      executor.executorProfile.executorType = nextExecutorType;
    }
    if (typeof position !== 'undefined') {
      executor.position = normalizeCargo(position, nextExecutorType || resolveExecutorType(executor));
    }
    if (phone) executor.phone = phone;
    
    // Actualizar perfil de ejecutor
    if (capacity !== undefined) executor.executorProfile.capacity = capacity;
    if (priority !== undefined) executor.executorProfile.priority = priority;
    if (allowedDesignTypes) executor.executorProfile.allowedDesignTypes = allowedDesignTypes;
    if (specialties) executor.executorProfile.specialties = specialties;
    if (available !== undefined) executor.executorProfile.available = available;
    if (unavailableReason) executor.executorProfile.unavailableReason = unavailableReason;
    if (unavailableUntil) executor.executorProfile.unavailableUntil = unavailableUntil;
    
    await executor.save();
    
    // Log de auditoría
    await createLog({
      level: 'info',
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      action: 'executor_updated',
      details: {
        executorId: executor._id,
        executorEmail: executor.email,
        changes: req.body
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    const executorSafe = executor.toObject();
    delete executorSafe.password;
    
    res.json({
      success: true,
      executor: executorSafe,
      message: 'Ejecutor actualizado exitosamente'
    });
  } catch (error) {
    logger.error('Error al actualizar ejecutor:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al actualizar ejecutor'
    });
  }
});

/**
 * PUT /api/admin/executors/:id/toggle-availability
 * Cambiar disponibilidad de ejecutor rápidamente
 */
router.put('/executors/:id/toggle-availability', async (req, res) => {
  const logger = global.logger || console;
  const { createLog } = require('../utils/helpers');
  
  try {
    const { id } = req.params;
    const { available, unavailableReason, unavailableUntil } = req.body;
    
    const executor = await User.findById(id);
    if (!executor) {
      return res.status(404).json({
        success: false,
        message: 'Ejecutor no encontrado'
      });
    }
    
    if (!executor.isExecutor()) {
      return res.status(400).json({
        success: false,
        message: 'Este usuario no es un ejecutor'
      });
    }
    
    executor.executorProfile.available = available;
    
    if (!available) {
      executor.executorProfile.unavailableReason = unavailableReason || 'otra';
      executor.executorProfile.unavailableUntil = unavailableUntil || null;
    } else {
      executor.executorProfile.unavailableReason = null;
      executor.executorProfile.unavailableUntil = null;
    }
    
    await executor.save();
    
    // Log de auditoría
    await createLog({
      level: 'info',
      userId: req.user.id,
      userName: `${req.user.firstName} ${req.user.lastName}`,
      action: available ? 'executor_enabled' : 'executor_disabled',
      details: {
        executorId: executor._id,
        executorEmail: executor.email,
        unavailableReason,
        unavailableUntil
      },
      ip: req.ip,
      userAgent: req.headers['user-agent']
    });
    
    const executorSafe = executor.toObject();
    delete executorSafe.password;
    
    res.json({
      success: true,
      executor: executorSafe,
      message: available ? 'Ejecutor habilitado' : 'Ejecutor deshabilitado'
    });
  } catch (error) {
    logger.error('Error al cambiar disponibilidad:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al cambiar disponibilidad'
    });
  }
});

/**
 * GET /api/admin/executors/:id/details
 * Obtener detalles completos de un ejecutor incluyendo solicitudes activas
 */
router.get('/executors/:id/details', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const { id } = req.params;
    
    const executor = await User.findById(id).select('-password');
    if (!executor) {
      return res.status(404).json({
        success: false,
        message: 'Ejecutor no encontrado'
      });
    }
    
    if (!executor.isExecutor()) {
      return res.status(400).json({
        success: false,
        message: 'Este usuario no es un ejecutor'
      });
    }
    
    // Obtener solicitudes activas
    const activeRequests = await Request.find({
      assignedTo: id,
      status: { $in: ['pending', 'in-process', 'review'] }
    })
    .populate('requestedBy', 'firstName lastName email department')
    .sort({ createdAt: -1 });
    
    // Obtener últimas solicitudes completadas
    const completedRequests = await Request.find({
      assignedTo: id,
      status: 'completed'
    })
    .populate('requestedBy', 'firstName lastName email department')
    .sort({ completedAt: -1 })
    .limit(10);
    
    // Calcular estadísticas en tiempo real
    const currentLoad = await executor.getCurrentLoad();
    const loadPercentage = (currentLoad / executor.executorProfile.capacity) * 100;
    const hasCapacity = await executor.hasCapacity();
    
    res.json({
      success: true,
      executor: executor.toObject(),
      statistics: {
        currentLoad,
        loadPercentage: Math.round(loadPercentage),
        hasCapacity,
        activeRequestsCount: activeRequests.length,
        completedRequestsCount: executor.executorProfile.stats.totalCompleted
      },
      activeRequests,
      recentCompletedRequests: completedRequests
    });
  } catch (error) {
    logger.error('Error al obtener detalles de ejecutor:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener detalles de ejecutor'
    });
  }
});

/**
 * GET /api/admin/stats/dashboard
 * Obtener todas las estadísticas del dashboard
 */
router.get('/stats/dashboard', async (req, res) => {
  try {
    const now = new Date();
    
    // Total de solicitudes
    const totalRequests = await Request.countDocuments();
    
    // Solicitudes completadas
    const completedRequests = await Request.countDocuments({ status: 'completada' });
    
    // Solicitudes en proceso
    const inProcessRequests = await Request.countDocuments({ status: 'en_proceso' });
    
    // Solicitudes pendientes
    const pendingRequests = await Request.countDocuments({ status: 'pendiente' });
    
    // Solicitudes urgentes (urgente + express)
    const urgentRequests = await Request.countDocuments({ 
      urgency: { $in: ['urgente', 'express'] } 
    });
    
    // Porcentaje de solicitudes urgentes
    const urgentPercentage = totalRequests > 0 ? Math.round((urgentRequests / totalRequests) * 100) : 0;
    
    // Porcentaje de cumplimiento (completadas)
    const completionPercentage = totalRequests > 0 ? Math.round((completedRequests / totalRequests) * 100) : 0;
    
    // Tiempo promedio (solo de las completadas)
    const completedWithDates = await Request.find({
      status: 'completada',
      createdAt: { $exists: true },
      completedAt: { $exists: true }
    }).select('createdAt completedAt');
    
    let averageTime = 0;
    if (completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((sum, req) => {
        const days = (new Date(req.completedAt) - new Date(req.createdAt)) / (1000 * 60 * 60 * 24);
        return sum + days;
      }, 0);
      averageTime = totalDays / completedWithDates.length;
    }
    
    // Satisfacción (simulada - en producción vendría de encuestas)
    const satisfaction = 92;
    
    res.json({
      totalRequests,
      completedRequests,
      inProcessRequests,
      pendingRequests,
      urgentRequests,
      urgentPercentage,
      completionPercentage,
      averageTime: parseFloat(averageTime.toFixed(1)),
      satisfaction
    });
  } catch (error) {
    console.error('Error obteniendo estadísticas del dashboard:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos' });
  }
});

/**
 * GET /api/admin/stats/daily-trend
 * Obtener tendencia diaria de los últimos 7 días
 */
router.get('/stats/daily-trend', async (req, res) => {
  try {
    const dailyData = [];
    const now = new Date();
    
    // Obtener datos de los últimos 7 días
    for (let i = 6; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(0, 0, 0, 0);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);
      
      const count = await Request.countDocuments({
        createdAt: {
          $gte: date,
          $lt: nextDate
        }
      });
      
      dailyData.push(count);
    }
    
    res.json(dailyData);
  } catch (error) {
    console.error('Error obteniendo tendencia diaria:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos' });
  }
});

/**
 * GET /api/admin/stats/monthly-performance
 * Obtener rendimiento mensual (solicitudes completadas por mes)
 */
router.get('/stats/monthly-performance', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const monthlyData = [];
    
    // Obtener datos de los últimos 12 meses
    for (let month = 0; month < 12; month++) {
      const count = await Request.countDocuments({
        status: 'completada',
        completedAt: {
          $gte: new Date(currentYear, month, 1),
          $lt: new Date(currentYear, month + 1, 1)
        }
      });
      monthlyData.push(count);
    }
    
    res.json(monthlyData);
  } catch (error) {
    console.error('Error obteniendo performance mensual:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos' });
  }
});

/**
 * GET /api/admin/stats/urgency-distribution
 * Obtener distribución por nivel de urgencia
 */
router.get('/stats/urgency-distribution', async (req, res) => {
  try {
    const [normal, urgent, express] = await Promise.all([
      Request.countDocuments({ urgency: 'normal' }),
      Request.countDocuments({ urgency: 'urgente' }),
      Request.countDocuments({ urgency: 'express' })
    ]);
    
    res.json({ normal, urgent, express });
  } catch (error) {
    console.error('Error obteniendo distribución de urgencia:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos' });
  }
});

/**
 * GET /api/admin/stats/status-distribution
 * Obtener distribución por estado de solicitudes
 */
router.get('/stats/status-distribution', async (req, res) => {
  try {
    const [pending, inProcess, review, completed, rejected] = await Promise.all([
      Request.countDocuments({ status: 'pendiente' }),
      Request.countDocuments({ status: 'en_proceso' }),
      Request.countDocuments({ status: 'revision' }),
      Request.countDocuments({ status: 'completada' }),
      Request.countDocuments({ status: 'rechazada' })
    ]);
    
    res.json({ pending, inProcess, review, completed, rejected });
  } catch (error) {
    console.error('Error obteniendo distribución de estado:', error);
    res.status(500).json({ success: false, message: 'Error al obtener datos' });
  }
});

/**
 * GET /api/admin/stats/executors
 * Obtener estadísticas agregadas de todos los ejecutores
 */
router.get('/stats/executors', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    // Obtener todos los ejecutores activos
    const executors = await User.find({
      $or: [
        { 'executorProfile.executorType': { $in: EXECUTOR_TYPES } },
        { role: { $in: EXECUTOR_TYPES } }
      ],
      isActive: true
    });
    
    // Calcular estadísticas por rol
    const statsByRole = {};
    
    for (const role of EXECUTOR_TYPES) {
      const roleExecutors = executors.filter((e) => resolveExecutorType(e) === role);
      
      if (roleExecutors.length === 0) {
        statsByRole[role] = {
          count: 0,
          available: 0,
          totalCapacity: 0,
          currentLoad: 0,
          utilizationRate: 0
        };
        continue;
      }
      
      const available = roleExecutors.filter(e => e.executorProfile.available).length;
      const totalCapacity = roleExecutors.reduce((sum, e) => sum + e.executorProfile.capacity, 0);
      
      let currentLoad = 0;
      for (const executor of roleExecutors) {
        currentLoad += await executor.getCurrentLoad();
      }
      
      const utilizationRate = totalCapacity > 0 ? (currentLoad / totalCapacity) * 100 : 0;
      
      statsByRole[role] = {
        count: roleExecutors.length,
        available,
        totalCapacity,
        currentLoad,
        utilizationRate: Math.round(utilizationRate)
      };
    }
    
    // Estadísticas globales
    const totalExecutors = executors.length;
    const totalAvailable = executors.filter(e => e.executorProfile.available).length;
    const totalCapacity = executors.reduce((sum, e) => sum + e.executorProfile.capacity, 0);
    
    let totalCurrentLoad = 0;
    for (const executor of executors) {
      totalCurrentLoad += await executor.getCurrentLoad();
    }
    
    const globalUtilizationRate = totalCapacity > 0 ? (totalCurrentLoad / totalCapacity) * 100 : 0;
    
    // Top performers
    const topPerformers = executors
      .filter(e => e.executorProfile.stats.totalCompleted > 0)
      .sort((a, b) => b.executorProfile.stats.onTimeDeliveryRate - a.executorProfile.stats.onTimeDeliveryRate)
      .slice(0, 5)
      .map(e => ({
        id: e._id,
        name: `${e.firstName} ${e.lastName}`,
        role: resolveExecutorType(e),
        totalCompleted: e.executorProfile.stats.totalCompleted,
        onTimeDeliveryRate: Math.round(e.executorProfile.stats.onTimeDeliveryRate),
        averageCompletionTime: Math.round(e.executorProfile.stats.averageCompletionTime * 10) / 10
      }));
    
    res.json({
      success: true,
      global: {
        totalExecutors,
        totalAvailable,
        totalCapacity,
        totalCurrentLoad,
        utilizationRate: Math.round(globalUtilizationRate)
      },
      byRole: statsByRole,
      topPerformers
    });
  } catch (error) {
    logger.error('Error al obtener estadísticas de ejecutores:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas'
    });
  }
});

/**
 * GET /api/admin/stats/monthly-performance
 * Estadísticas de performance mensual (solicitudes completadas por mes)
 */
router.get('/stats/monthly-performance', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const currentYear = new Date().getFullYear();
    const monthlyData = [];
    
    // Iterar por cada mes del año
    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 0, 23, 59, 59);
      
      const completed = await Request.countDocuments({
        status: 'completed',
        completedDate: {
          $gte: startDate,
          $lte: endDate
        }
      });
      
      monthlyData.push(completed);
    }
    
    res.json({
      success: true,
      data: monthlyData,
      year: currentYear
    });
  } catch (error) {
    logger.error('Error al obtener performance mensual:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener performance mensual'
    });
  }
});

/**
 * GET /api/admin/stats/urgency-distribution
 * Distribución de solicitudes por urgencia
 */
router.get('/stats/urgency-distribution', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const normal = await Request.countDocuments({ urgency: 'normal' });
    const urgent = await Request.countDocuments({ urgency: 'urgent' });
    const express = await Request.countDocuments({ urgency: 'express' });
    
    res.json({
      success: true,
      data: {
        normal,
        urgent,
        express
      }
    });
  } catch (error) {
    logger.error('Error al obtener distribución por urgencia:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por urgencia'
    });
  }
});

/**
 * GET /api/admin/stats/status-distribution
 * Distribución de solicitudes por estado
 */
router.get('/stats/status-distribution', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const pending = await Request.countDocuments({ status: 'pending' });
    const inProcess = await Request.countDocuments({ status: 'in-process' });
    const review = await Request.countDocuments({ status: 'review' });
    const completed = await Request.countDocuments({ status: 'completed' });
    const rejected = await Request.countDocuments({ status: 'rejected' });
    
    res.json({
      success: true,
      data: {
        pending,
        inProcess,
        review,
        completed,
        rejected
      }
    });
  } catch (error) {
    logger.error('Error al obtener distribución por estado:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por estado'
    });
  }
});

module.exports = router;
