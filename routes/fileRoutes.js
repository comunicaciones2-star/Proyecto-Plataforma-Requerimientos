const express = require('express');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const Request = require('../models/Request');

const router = express.Router();

const EXECUTOR_AND_ADMIN_ROLES = new Set([
  'admin',
  'gerente',
  'diseñador',
  'practicante',
  'manager',
  'designer',
  'disenador_grafico',
  'gerente_comunicaciones'
]);

router.get('/:filename', authenticate, async (req, res) => {
  const userRole = String(req.user?.role || '').trim().toLowerCase();
  const isPrivilegedRole = EXECUTOR_AND_ADMIN_ROLES.has(userRole);
  const currentUserId = String(req.user?.id || req.user?._id || '').trim();

  const requestedName = String(req.params.filename || '').trim();
  const safeFilename = path.basename(requestedName);

  if (!safeFilename || safeFilename !== requestedName) {
    return res.status(400).json({
      success: false,
      message: 'Nombre de archivo inválido'
    });
  }

  const uploadsDir = path.join(__dirname, '..', 'uploads');
  const absoluteFilePath = path.join(uploadsDir, safeFilename);

  if (!fs.existsSync(absoluteFilePath)) {
    return res.status(404).json({
      success: false,
      message: 'Archivo no encontrado'
    });
  }

  let requestWithAttachment = null;
  let downloadName = safeFilename;
  try {
    requestWithAttachment = await Request.findOne(
      { 'attachments.filename': safeFilename },
      {
        requester: 1,
        assignedTo: 1,
        attachments: { $elemMatch: { filename: safeFilename } }
      }
    ).lean();

    const originalName = requestWithAttachment?.attachments?.[0]?.originalName;
    if (originalName) {
      downloadName = originalName;
    }
  } catch (error) {
    console.warn('No se pudo resolver nombre original para descarga:', error.message);
  }

  const requesterId = String(requestWithAttachment?.requester || '').trim();
  const assignedToId = String(requestWithAttachment?.assignedTo || '').trim();
  const isOwnerOrAssignee = Boolean(
    currentUserId &&
    (currentUserId === requesterId || currentUserId === assignedToId)
  );

  if (!isPrivilegedRole && !isOwnerOrAssignee) {
    return res.status(403).json({
      success: false,
      message: 'No tiene permisos para acceder a este archivo'
    });
  }

  // Forzamos attachment para que el navegador descargue el archivo protegido.
  res.attachment(downloadName);

  return res.sendFile(absoluteFilePath);
});

module.exports = router;
