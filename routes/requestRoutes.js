// routes/requestRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const Request = require('../models/Request');
const { sendNewRequestEmail, sendStatusChangeEmail } = require('../config/email');
const { notifyNewRequest, notifyStatusChange, notifyNewComment } = require('../utils/websocket');
const { autoAssignRequest } = require('../utils/autoAssign');

const router = express.Router();

// Configuración de Multer para almacenamiento local
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, '..', 'uploads');
    // Crear directorio si no existe
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generar nombre único: timestamp + random + extensión original
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    // Tipos de archivo permitidos
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|ppt|pptx|xls|xlsx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido'));
    }
  }
});

// Todas las rutas requieren usuario logueado
router.use(authenticate);

/**
 * POST /api/requests
 * Crear nueva solicitud (con archivos opcionales)
 */
router.post('/', upload.array('files'), async (req, res) => {
  try {
    const {
      area,
      type,
      title,
      description,
      urgency,
      deliveryDate,
      targetAudience,
      referenceLinks
    } = req.body;

    if (!area || !type || !title || !description || !deliveryDate) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos obligatorios'
      });
    }

    const attachments = [];

    // Guardar archivos localmente
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        attachments.push({
          originalName: file.originalname,
          filename: file.filename,
          path: file.path,
          url: `/uploads/${file.filename}`,
          size: file.size,
          mimetype: file.mimetype
        });
      }
      console.log(`✅ ${req.files.length} archivo(s) guardado(s) localmente`);
    }

    const request = new Request({
      area,
      type,
      title,
      description,
      urgency: urgency || 'normal',
      deliveryDate,
      targetAudience,
      referenceLinks,
      requester: req.user.id,
      attachments,
      queuedAt: new Date()
    });

    await request.save();

    // ASIGNACIÓN AUTOMÁTICA
    const assignedUser = await autoAssignRequest(request);
    if (assignedUser) {
      request.assignedTo = assignedUser._id;
      request.status = 'in-process';
      await request.save();
      console.log(`✅ Solicitud ${request.requestNumber} asignada automáticamente a ${assignedUser.firstName} ${assignedUser.lastName}`);
      
      // Notificar al usuario asignado
      try {
        if (assignedUser.email && assignedUser.notificationPreferences?.email) {
          await sendNewRequestEmail(assignedUser.email, request);
        }
      } catch (e) {
        console.warn('No se pudo enviar email de asignación:', e.message);
      }
    } else {
      // Si no se pudo asignar, queda en cola
      request.queuePosition = 1;
      await request.save();
      console.log(`⏳ Solicitud ${request.requestNumber} en cola`);
    }

    // Notificar via WebSocket
    try {
      notifyNewRequest(request);
    } catch (e) {
      console.warn('Error notifying new request via WS:', e.message || e);
    }

    // Notificación al solicitante
    try {
      if (req.user.email) {
        const message = assignedUser 
          ? `Tu solicitud ${request.requestNumber} ha sido asignada a ${assignedUser.firstName} ${assignedUser.lastName}`
          : `Tu solicitud ${request.requestNumber} está en cola de atención`;
        // Aquí puedes enviar el email
      }
    } catch (e) {
      console.warn('No se pudo enviar email de confirmación:', e.message);
    }

    res.status(201).json({
      success: true,
      request,
      assigned: assignedUser ? true : false,
      assignedTo: assignedUser ? `${assignedUser.firstName} ${assignedUser.lastName}` : null,
      queuePosition: request.queuePosition || null
    });
  } catch (error) {
    console.error('❌ ERROR al crear solicitud:', error.message);
    console.error('Stack:', error.stack);
    console.error('Body recibido:', req.body);
    res.status(500).json({
      success: false,
      message: 'Error al crear solicitud',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * GET /api/requests
 * - Si es colaborador: ve solo sus solicitudes
 * - Si es diseñador/manager/admin: ve todas
 * - Soporta paginación: ?page=1&limit=20
 */
router.get('/', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const filter = {};
    if (req.user.role === 'collaborator') {
      filter.requester = req.user.id;
    }

    // Obtener total de documentos para paginación
    const total = await Request.countDocuments(filter);

    const requests = await Request.find(filter)
      .populate('requester', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      success: true,
      requests,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrev: page > 1
      }
    });
  } catch (error) {
    logger.error('Error al obtener solicitudes:', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes'
    });
  }
});

/**
 * GET /api/requests/:id
 * Obtener detalles de una solicitud
 */
router.get('/:id', async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const request = await Request.findById(req.params.id)
      .populate('requester', 'firstName lastName email avatar department')
      .populate('assignedTo', 'firstName lastName email avatar')
      .populate('comments.author', 'firstName lastName email avatar');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    // Validar acceso: solo el solicitante, diseñador asignado, o admin pueden ver
    const isRequester = request.requester._id.toString() === req.user.id;
    const isAssigned = request.assignedTo && request.assignedTo._id.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    if (!isRequester && !isAssigned && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver esta solicitud'
      });
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error('Error al obtener solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitud'
    });
  }
});

/**
 * GET /api/requests/queue/list
 * Obtener la cola de atención ordenada por urgencia y fecha
 */
router.get('/queue/list', async (req, res) => {
  try {
    const urgencyOrder = { express: 1, urgent: 2, normal: 3 };
    
    // Obtener solicitudes pendientes sin asignar
    const pendingRequests = await Request.find({ 
      status: 'pending'
    })
    .populate('requester', 'firstName lastName email department')
    .sort({ queuedAt: 1 });

    // Ordenar por urgencia primero, luego por fecha
    pendingRequests.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(a.queuedAt) - new Date(b.queuedAt);
    });

    // Agregar posición y tiempo de espera
    const now = new Date();
    const queueWithDetails = pendingRequests.map((req, index) => {
      const waitTime = Math.floor((now - new Date(req.queuedAt)) / (1000 * 60)); // minutos
      const queuedDate = new Date(req.queuedAt);
      const formattedTime = queuedDate.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true });
      return {
        ...req.toObject(),
        queuePosition: index + 1,
        waitTimeMinutes: waitTime,
        queuedAtFormatted: formattedTime
      };
    });

    res.json({
      success: true,
      total: queueWithDetails.length,
      queue: queueWithDetails
    });
  } catch (error) {
    console.error('Error al obtener cola:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener cola'
    });
  }
});

/**
 * PATCH /api/requests/:id
 * Actualizar estado y/o asignación (principalmente para diseñadores/managers)
 */
router.patch('/:id', async (req, res) => {
  const logger = global.logger || console;
  const { authorize } = require('../middleware/auth');
  
  try {
    const { status, comment, assignedTo } = req.body;

    const request = await Request.findById(req.params.id).populate(
      'requester',
      'email firstName lastName'
    );

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    if (status) {
      // Validación de roles para cambio de estado
      const allowedRoles = ['designer', 'manager', 'admin', 'gerente_comunicaciones', 'disenador_grafico'];
      if (!allowedRoles.includes(req.user.role)) {
        logger.warn(`⚠️ Usuario ${req.user.email} intentó cambiar estado sin permisos`);
        return res.status(403).json({ 
          success: false, 
          message: 'Acceso denegado: no puede cambiar el estado' 
        });
      }

      // Solo admin y manager pueden marcar como completado
      if (status === 'completed' && !['admin', 'manager', 'gerente_comunicaciones'].includes(req.user.role)) {
        logger.warn(`⚠️ Usuario ${req.user.email} intentó completar solicitud sin permisos`);
        return res.status(403).json({
          success: false,
          message: 'Solo administradores y gerentes pueden marcar solicitudes como completadas'
        });
      }

      request.status = status;

      if (status === 'completed') {
        request.completedDate = new Date();
      }

      // Comentario opcional al cambiar estado
      if (comment) {
        request.comments.push({
          author: req.user.id,
          authorName: `${req.user.firstName} ${req.user.lastName}`,
          text: comment
        });
      }

      // Notificación por email (opcional)
      try {
        if (request.requester && request.requester.email) {
          await sendStatusChangeEmail(
            request.requester.email,
            request,
            status
          );
        }
      } catch (e) {
        console.warn('No se pudo enviar email de cambio de estado:', e.message);
      }
      // Notificar por WebSocket
      try {
        notifyStatusChange(request);
      } catch (e) {
        console.warn('Error notifying status change via WS:', e.message || e);
      }
    }

    if (assignedTo) {
      // Solo roles autorizados pueden asignar
      if (!['designer', 'manager', 'admin'].includes(req.user.role)) {
        return res.status(403).json({ success: false, message: 'Acceso denegado: no puede asignar solicitudes' });
      }
      request.assignedTo = assignedTo;
    }

    await request.save();

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error('Error al actualizar solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar solicitud'
    });
  }
});

/**
 * POST /api/requests/:id/comment
 * Agregar comentario a una solicitud
 */
router.post('/:id/comment', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        message: 'El comentario no puede estar vacío'
      });
    }

    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    request.comments.push({
      author: req.user.id,
      authorName: `${req.user.firstName} ${req.user.lastName}`,
      text
    });

    await request.save();

    // Notificar nuevo comentario por WebSocket
    try {
      const lastComment = request.comments[request.comments.length - 1];
      notifyNewComment(request, lastComment);
    } catch (e) {
      console.warn('Error notifying new comment via WS:', e.message || e);
    }

    res.json({
      success: true,
      request
    });
  } catch (error) {
    console.error('Error al agregar comentario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al agregar comentario'
    });
  }
});

/**
 * PUT /api/requests/:id/edit
 * Editar una solicitud existente (solo el solicitante)
 */
router.put('/:id/edit', async (req, res) => {
  try {
    const request = await Request.findById(req.params.id).populate('assignedTo', 'firstName lastName email notificationPreferences');

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    // Solo el creador puede editar
    if (request.requester.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Solo el creador puede editar esta solicitud'
      });
    }

    const { title, description, urgency, deliveryDate, type } = req.body;
    
    // Guardar cambios para historial
    const changes = [];
    if (title && title !== request.title) changes.push(`Título: "${request.title}" → "${title}"`);
    if (description && description !== request.description) changes.push('Descripción modificada');
    if (urgency && urgency !== request.urgency) changes.push(`Urgencia: ${request.urgency} → ${urgency}`);
    if (deliveryDate && deliveryDate !== request.deliveryDate) changes.push(`Fecha entrega modificada`);
    if (type && type !== request.type) changes.push(`Tipo: ${request.type} → ${type}`);

    // Actualizar campos
    if (title) request.title = title;
    if (description) request.description = description;
    if (urgency) request.urgency = urgency;
    if (deliveryDate) request.deliveryDate = deliveryDate;
    if (type) request.type = type;

    // Agregar al historial
    request.editHistory.push({
      editedBy: req.user.id,
      editedAt: new Date(),
      changes: changes.join(', ')
    });

    await request.save();

    // Notificar al usuario asignado si hay cambios
    if (request.assignedTo && changes.length > 0) {
      try {
        if (request.assignedTo.email && request.assignedTo.notificationPreferences?.email) {
          // Aquí enviarías el email de notificación
          console.log(`📧 Notificando edición a ${request.assignedTo.firstName}: ${changes.join(', ')}`);
        }
      } catch (e) {
        console.warn('No se pudo enviar notificación de edición:', e.message);
      }
    }

    res.json({
      success: true,
      message: 'Solicitud actualizada exitosamente',
      request,
      changes
    });
  } catch (error) {
    console.error('Error al editar solicitud:', error);
    res.status(500).json({
      success: false,
      message: 'Error al editar solicitud'
    });
  }
});

/**
 * DELETE /api/requests/:id
 * Eliminar una solicitud
 */
router.delete('/:id', async (req, res) => {
  try {
    const request = await Request.findById(req.params.id);

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Solicitud no encontrada'
      });
    }

    // Validar permisos: solo puede eliminar el creador o admin
    if (request.requester.toString() !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'No tiene permisos para eliminar esta solicitud'
      });
    }

    await Request.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Solicitud eliminada exitosamente'
    });
  } catch (error) {
    console.error('❌ ERROR al eliminar solicitud:', error.message);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar solicitud',
      error: error.message
    });
  }
});

module.exports = router;
