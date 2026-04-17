// routes/requestRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const { authenticate } = require('../middleware/auth');
const Request = require('../models/Request');
const User = require('../models/User');
const { sendNewRequestEmail, sendStatusChangeEmail } = require('../config/email');
const { notifyNewRequest, notifyStatusChange, notifyNewComment, notifyRequestUpdated } = require('../utils/websocket');
const { autoAssignRequest } = require('../utils/autoAssign');
const { ACTIVE_QUEUE_STATUSES, attachQueueInfoToRequests, getQueueInfoForRequest, isQueueActiveStatus } = require('../utils/queue');

const router = express.Router();
const MAX_FILES_PER_UPLOAD = 5;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_UPLOAD_EXTENSIONS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif',
  '.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'
]);
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
]);
const REQUEST_ALLOWED_STATUSES = ['pending', 'in-process', 'review', 'completed', 'rejected'];
const EXECUTOR_ROLES = ['diseñador', 'practicante', 'designer', 'disenador_grafico'];
const MANAGER_ROLES = ['manager', 'gerente', 'gerente_comunicaciones'];
const EXECUTOR_TYPES = new Set(['gerente', 'diseñador', 'practicante', 'manager', 'designer']);
const WORKFLOW_TRANSITIONS = {
  pending: ['in-process', 'rejected'],
  'in-process': ['review', 'rejected'],
  review: ['completed', 'rejected']
};

function normalizeRoleValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function buildUserIdentityValues(userId) {
  const values = [String(userId || '').trim()].filter(Boolean);

  if (mongoose.Types.ObjectId.isValid(userId)) {
    values.push(new mongoose.Types.ObjectId(userId));
  }

  return values;
}

function isManagerialPosition(positionValue = '') {
  const normalizedPosition = normalizeRoleValue(positionValue);
  if (!normalizedPosition) return false;

  return ['gerente', 'manager', 'director', 'coordinador', 'jefe', 'lider'].some((keyword) =>
    normalizedPosition.includes(keyword)
  );
}

async function buildRequestVisibilityFilter(authUser = {}) {
  const userId = String(authUser.id || '').trim();
  if (!userId) return { _id: null };

  const normalizedTokenRole = normalizeRoleValue(authUser.role);
  if (normalizedTokenRole === 'admin') {
    return {};
  }

  const userDoc = await User.findById(userId).select('role executorProfile position').lean();
  const normalizedDbRole = normalizeRoleValue(userDoc?.role);
  const normalizedExecutorType = normalizeRoleValue(userDoc?.executorProfile?.executorType);
  const hasManagerialCargo = isManagerialPosition(authUser?.position) || isManagerialPosition(userDoc?.position);
  const identityValues = buildUserIdentityValues(userId);

  const requesterMatchers = [
    { requester: { $in: identityValues } },
    { requestedBy: { $in: identityValues } },
    { requesterId: userId },
    { requestedById: userId }
  ];

  const isManagerRole = MANAGER_ROLES.includes(normalizedTokenRole) || MANAGER_ROLES.includes(normalizedDbRole);
  const isExecutor = EXECUTOR_TYPES.has(normalizedExecutorType) || EXECUTOR_TYPES.has(normalizedDbRole);

  // Roles de gestión/ejecución y cargos gerenciales pueden consultar todas las solicitudes.
  if (isManagerRole || isExecutor || hasManagerialCargo) {
    return {};
  }

  return { $or: requesterMatchers };
}

async function getActiveQueueRequests() {
  return Request.find({ status: { $in: ACTIVE_QUEUE_STATUSES } })
    .select('requestNumber title area preferredExecutorRole urgency status deliveryDate requestDate queuedAt assignedAt assignedTo requester createdAt updatedAt')
    .lean();
}

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
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: MAX_FILES_PER_UPLOAD
  },
  fileFilter: (req, file, cb) => {
    const extension = path.extname(String(file.originalname || '')).toLowerCase();
    const mimeType = String(file.mimetype || '').toLowerCase();

    const hasAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.has(extension);
    const isImageMime = mimeType.startsWith('image/');
    const hasAllowedMime = isImageMime || ALLOWED_UPLOAD_MIME_TYPES.has(mimeType);
    const isGenericMime = mimeType === 'application/octet-stream';

    // Algunos navegadores/OS envían octet-stream para Office: permitimos por extensión.
    if (hasAllowedExtension && (hasAllowedMime || isGenericMime)) {
      return cb(null, true);
    }

    const validationError = new Error(
      `Tipo de archivo no permitido (${file.originalname || 'archivo'}). ` +
      'Formatos válidos: imágenes, PDF, Word, PowerPoint y Excel.'
    );
    validationError.statusCode = 400;
    return cb(validationError);
  }
});

// Todas las rutas requieren usuario logueado
router.use(authenticate);

/**
 * POST /api/requests
 * Crear nueva solicitud (con archivos opcionales)
 */
router.post('/', upload.array('files', MAX_FILES_PER_UPLOAD), async (req, res) => {
  try {
    const {
      area,
      type,
      title,
      description,
      urgency,
      preferredExecutorRole,
      deliveryDate,
      targetAudience,
      referenceLinks,
      categoryDetails
    } = req.body;

    let parsedCategoryDetails = {};
    if (categoryDetails) {
      try {
        parsedCategoryDetails = typeof categoryDetails === 'string'
          ? JSON.parse(categoryDetails)
          : categoryDetails;
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'Los campos por categoría tienen un formato inválido'
        });
      }
    }

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
          url: `/api/files/${encodeURIComponent(file.filename)}`,
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
      preferredExecutorRole: preferredExecutorRole || 'diseñador',
      deliveryDate,
      targetAudience,
      referenceLinks,
      categoryDetails: parsedCategoryDetails,
      requester: req.user.id,
      attachments,
      queuedAt: new Date()
    });

    await request.save();

    // ASIGNACIÓN AUTOMÁTICA
    const assignedUser = await autoAssignRequest(request);
    if (assignedUser) {
      request.assignedTo = assignedUser._id;
      request.assignedAt = new Date();
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
    if (error?.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Datos de solicitud inválidos',
        error: error.message,
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }

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

    const filter = await buildRequestVisibilityFilter(req.user);

    // Obtener total de documentos para paginación
    const total = await Request.countDocuments(filter);

    const requests = await Request.find(filter)
      .populate('requester', 'firstName lastName email avatar')
      .populate('assignedTo', 'firstName lastName email avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const activeQueueRequests = await getActiveQueueRequests();
    const requestsWithQueueInfo = attachQueueInfoToRequests(
      requests.map((request) => request.toObject()),
      activeQueueRequests
    );

    res.json({
      success: true,
      requests: requestsWithQueueInfo,
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

    const requestObject = request.toObject();
    let queueInfo = null;

    if (isQueueActiveStatus(requestObject.status)) {
      const activeQueueRequests = await getActiveQueueRequests();
      queueInfo = getQueueInfoForRequest(requestObject, activeQueueRequests);
    }

    res.json({
      success: true,
      request: {
        ...requestObject,
        queueInfo,
        queuePosition: queueInfo?.position || null
      }
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
router.patch('/:id', upload.array('files', MAX_FILES_PER_UPLOAD), async (req, res) => {
  const logger = global.logger || console;
  
  try {
    const { status, comment, assignedTo, deliveryUrl } = req.body;
    const normalizedStatus = typeof status === 'string' ? status.trim() : '';
    const hasStatusUpdate = normalizedStatus.length > 0;

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

    const requesterId = request.requester?._id?.toString() || request.requester?.toString();
    const assignedUserId = request.assignedTo?._id?.toString() || request.assignedTo?.toString();
  const isOwner = requesterId === req.user.id;
    const isAdmin = req.user.role === 'admin';
    const normalizedRole = String(req.user.role || '').trim().toLowerCase();
  const isManagerRole = MANAGER_ROLES.includes(normalizedRole);
  const isExecutorRole = EXECUTOR_ROLES.includes(normalizedRole);
    const isAssignedExecutor = Boolean(assignedUserId) && assignedUserId === req.user.id && (isExecutorRole || isManagerRole);
    const canManageAssignedRequest = isAdmin || isManagerRole || isAssignedExecutor;
  const currentStatus = String(request.status || '').trim();

    if (req.files && req.files.length > 0) {
      if (!canManageAssignedRequest) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para adjuntar entregables en esta solicitud'
        });
      }

      const newAttachments = req.files.map((file) => ({
        originalName: file.originalname,
        filename: file.filename,
        path: file.path,
        url: `/api/files/${encodeURIComponent(file.filename)}`,
        size: file.size,
        mimetype: file.mimetype
      }));

      request.attachments = [...(request.attachments || []), ...newAttachments];
    }

    const normalizedDeliveryUrl = String(deliveryUrl || '').trim();
    if (normalizedDeliveryUrl) {
      if (!canManageAssignedRequest) {
        return res.status(403).json({
          success: false,
          message: 'No tiene permisos para agregar links de entregables en esta solicitud'
        });
      }

      let parsedUrl;
      try {
        parsedUrl = new URL(normalizedDeliveryUrl);
      } catch (error) {
        return res.status(400).json({
          success: false,
          message: 'El link de entregable no es una URL válida'
        });
      }

      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({
          success: false,
          message: 'El link debe iniciar con http:// o https://'
        });
      }

      const alreadyExists = Array.isArray(request.deliveryLinks)
        && request.deliveryLinks.some((link) => String(link?.url || '').trim() === normalizedDeliveryUrl);

      if (!alreadyExists) {
        request.deliveryLinks = [
          ...(request.deliveryLinks || []),
          {
            url: normalizedDeliveryUrl,
            addedBy: req.user.id,
            addedByName: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
            addedAt: new Date()
          }
        ];
      }
    }

    if (hasStatusUpdate) {
      if (!REQUEST_ALLOWED_STATUSES.includes(normalizedStatus)) {
        return res.status(400).json({
          success: false,
          message: `Estado inválido. Estados permitidos: ${REQUEST_ALLOWED_STATUSES.join(', ')}`
        });
      }

      if (normalizedStatus !== currentStatus) {
        const isWorkflowTransition = Array.isArray(WORKFLOW_TRANSITIONS[currentStatus])
          && WORKFLOW_TRANSITIONS[currentStatus].includes(normalizedStatus);

        if (!isAdmin) {
          if (!isWorkflowTransition) {
            return res.status(400).json({
              success: false,
              message: `Transición no permitida: ${currentStatus} -> ${normalizedStatus}.`
            });
          }

          if (currentStatus === 'review' && ['completed', 'rejected'].includes(normalizedStatus)) {
            if (!isOwner) {
              return res.status(403).json({
                success: false,
                message: 'Solo el solicitante o el administrador pueden cerrar o rechazar una solicitud en revisión.'
              });
            }
          } else {
            if (!canManageAssignedRequest) {
              logger.warn(`⚠️ Usuario ${req.user.email} intentó cambiar estado sin permisos`);
              return res.status(403).json({
                success: false,
                message: 'Acceso denegado: no puede cambiar el estado'
              });
            }
          }
        } else if (!isWorkflowTransition) {
          logger.warn('⚠️ Admin aplicó transición fuera del workflow estándar', {
            requestId: request._id?.toString(),
            from: currentStatus,
            to: normalizedStatus,
            actor: req.user.email || req.user.id
          });
        }

        // Ya no se exige entregable obligatorio para pasar a revisión.
      }

      request.status = normalizedStatus;

      if (normalizedStatus === 'completed') {
        request.completedDate = new Date();
      }

      // Comentario opcional al cambiar estado
      if (comment) {
        request.comments = Array.isArray(request.comments) ? request.comments : [];
        request.comments.push({
          author: req.user.id,
          authorName: `${req.user.firstName} ${req.user.lastName}`,
          text: comment
        });
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
      const canAssign = ['designer', 'diseñador', 'manager', 'gerente', 'admin', 'gerente_comunicaciones', 'disenador_grafico'].includes(normalizedRole);
      if (!canAssign) {
        return res.status(403).json({ success: false, message: 'Acceso denegado: no puede asignar solicitudes' });
      }
      const previousAssignedTo = request.assignedTo ? request.assignedTo.toString() : '';
      request.assignedTo = assignedTo;
      if (assignedTo.toString() !== previousAssignedTo) {
        request.assignedAt = new Date();
      }
    }

    await request.save();

    if (hasStatusUpdate && request.requester && request.requester.email) {
      sendStatusChangeEmail(
        request.requester.email,
        request,
        normalizedStatus
      ).catch((e) => {
        console.warn('No se pudo enviar email de cambio de estado:', e.message);
      });
    }

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

    const isRequester = request.requester.toString() === req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Solo el creador o admin pueden editar
    if (!isRequester && !isAdmin) {
      return res.status(403).json({
        success: false,
        message: 'Solo el creador o el administrador pueden editar esta solicitud'
      });
    }

    const {
      title,
      description,
      urgency,
      deliveryDate,
      type,
      preferredExecutorRole,
      targetAudience,
      referenceLinks,
      categoryDetails
    } = req.body;
    
    // Guardar cambios para historial
    const changes = [];
    if (typeof title !== 'undefined' && title !== request.title) changes.push(`Título: "${request.title}" → "${title}"`);
    if (typeof description !== 'undefined' && description !== request.description) changes.push('Descripción modificada');
    if (typeof urgency !== 'undefined' && urgency !== request.urgency) changes.push(`Urgencia: ${request.urgency} → ${urgency}`);
    if (typeof deliveryDate !== 'undefined' && deliveryDate !== request.deliveryDate) changes.push('Fecha entrega modificada');
    if (typeof type !== 'undefined' && type !== request.type) changes.push(`Tipo: ${request.type} → ${type}`);
    if (typeof preferredExecutorRole !== 'undefined' && preferredExecutorRole !== request.preferredExecutorRole) changes.push(`Perfil asignación: ${request.preferredExecutorRole || 'sin definir'} → ${preferredExecutorRole}`);
    if (typeof targetAudience !== 'undefined' && targetAudience !== request.targetAudience) changes.push('Público objetivo modificado');
    if (typeof referenceLinks !== 'undefined' && referenceLinks !== request.referenceLinks) changes.push('Enlaces de referencia modificados');
    if (typeof categoryDetails !== 'undefined') changes.push('Campos esenciales por categoría actualizados');

    // Actualizar campos
    if (typeof title !== 'undefined') request.title = title;
    if (typeof description !== 'undefined') request.description = description;
    if (typeof urgency !== 'undefined') request.urgency = urgency;
    if (typeof deliveryDate !== 'undefined') request.deliveryDate = deliveryDate;
    if (typeof type !== 'undefined') request.type = type;
    if (typeof preferredExecutorRole !== 'undefined') request.preferredExecutorRole = preferredExecutorRole;
    if (typeof targetAudience !== 'undefined') request.targetAudience = targetAudience;
    if (typeof referenceLinks !== 'undefined') request.referenceLinks = referenceLinks;
    if (typeof categoryDetails !== 'undefined') {
      request.categoryDetails = categoryDetails;
      request.markModified('categoryDetails');
    }

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

    try {
      notifyRequestUpdated('edited', request, {
        id: req.user.id,
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        role: req.user.role
      });
    } catch (e) {
      console.warn('Error notifying request edited via WS:', e.message || e);
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

    try {
      notifyRequestUpdated('deleted', request, {
        id: req.user.id,
        name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim(),
        role: req.user.role
      });
    } catch (e) {
      console.warn('Error notifying request deleted via WS:', e.message || e);
    }

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
