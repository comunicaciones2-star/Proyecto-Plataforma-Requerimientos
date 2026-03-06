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
  if (!EXECUTOR_AND_ADMIN_ROLES.has(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'No tiene permisos para acceder a este archivo'
    });
  }

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

  let downloadName = safeFilename;
  try {
    const requestWithAttachment = await Request.findOne(
      { 'attachments.filename': safeFilename },
      { attachments: { $elemMatch: { filename: safeFilename } } }
    ).lean();

    const originalName = requestWithAttachment?.attachments?.[0]?.originalName;
    if (originalName) {
      downloadName = originalName;
    }
  } catch (error) {
    console.warn('No se pudo resolver nombre original para descarga:', error.message);
  }

  // Forzamos attachment para que el navegador descargue el archivo protegido.
  res.attachment(downloadName);

  return res.sendFile(absoluteFilePath);
});

module.exports = router;
