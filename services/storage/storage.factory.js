const path = require('path');
const cloudinaryService = require('./cloudinary.service');
const driveService = require('./drive.service');

const FILE_TYPE = {
  IMAGE: 'image',
  DOCUMENT: 'document',
  VIDEO: 'video',
  BACKUP: 'backup'
};

const STORAGE_PROVIDER = {
  CLOUDINARY: 'cloudinary',
  DRIVE: 'drive'
};

const FILE_SIZE_LIMITS = {
  [FILE_TYPE.IMAGE]: 10 * 1024 * 1024,
  [FILE_TYPE.DOCUMENT]: 30 * 1024 * 1024,
  [FILE_TYPE.VIDEO]: 200 * 1024 * 1024,
  [FILE_TYPE.BACKUP]: 1024 * 1024 * 1024
};

const ALLOWED_EXTENSIONS = {
  [FILE_TYPE.IMAGE]: new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif']),
  [FILE_TYPE.DOCUMENT]: new Set(['.pdf', '.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx']),
  [FILE_TYPE.VIDEO]: new Set(['.mp4', '.mov', '.avi', '.mkv', '.webm']),
  [FILE_TYPE.BACKUP]: new Set(['.gz', '.zip', '.bak', '.sql'])
};

function detectFileTypeFromMime(mimeType = '', fileName = '') {
  const mime = String(mimeType || '').toLowerCase();
  const extension = path.extname(String(fileName || '')).toLowerCase();

  if (mime.startsWith('image/')) return FILE_TYPE.IMAGE;
  if (mime.startsWith('video/')) return FILE_TYPE.VIDEO;

  if (ALLOWED_EXTENSIONS[FILE_TYPE.IMAGE].has(extension)) return FILE_TYPE.IMAGE;
  if (ALLOWED_EXTENSIONS[FILE_TYPE.VIDEO].has(extension)) return FILE_TYPE.VIDEO;
  if (ALLOWED_EXTENSIONS[FILE_TYPE.BACKUP].has(extension)) return FILE_TYPE.BACKUP;

  return FILE_TYPE.DOCUMENT;
}

function sanitizeIncomingFileName(fileName = '') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const base = path.basename(String(fileName || ''), ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);

  return `${base || 'file'}${ext}`;
}

function getAllowedExtensionsByType(type) {
  if (type === FILE_TYPE.BACKUP) {
    return new Set([...ALLOWED_EXTENSIONS[FILE_TYPE.DOCUMENT], ...ALLOWED_EXTENSIONS[FILE_TYPE.BACKUP]]);
  }

  return ALLOWED_EXTENSIONS[type] || ALLOWED_EXTENSIONS[FILE_TYPE.DOCUMENT];
}

function validateFileForStorage(file, type) {
  if (!file) {
    const error = new Error('Archivo inválido');
    error.statusCode = 400;
    throw error;
  }

  const detectedType = type || detectFileTypeFromMime(file.mimetype, file.originalname);
  const allowedExt = getAllowedExtensionsByType(detectedType);
  const extension = path.extname(String(file.originalname || '')).toLowerCase();
  const limitBytes = FILE_SIZE_LIMITS[detectedType] || FILE_SIZE_LIMITS[FILE_TYPE.DOCUMENT];

  if (!allowedExt.has(extension)) {
    const error = new Error(`Tipo de archivo no permitido para ${detectedType}.`);
    error.statusCode = 400;
    throw error;
  }

  if (Number(file.size) > limitBytes) {
    const maxMb = Math.round(limitBytes / (1024 * 1024));
    const error = new Error(`El archivo ${file.originalname} supera el límite de ${maxMb} MB para ${detectedType}.`);
    error.statusCode = 400;
    throw error;
  }

  return {
    type: detectedType,
    safeName: sanitizeIncomingFileName(file.originalname)
  };
}

async function uploadFile(file, type, context = {}) {
  const validated = validateFileForStorage(file, type);
  const detectedType = validated.type;
  const safeName = validated.safeName;

  if (detectedType === FILE_TYPE.IMAGE) {
    const uploaded = await cloudinaryService.uploadImage(
      { ...file, originalname: safeName },
      { folder: process.env.CLOUDINARY_IMAGE_FOLDER }
    );

    return {
      fileName: safeName,
      type: FILE_TYPE.IMAGE,
      storageProvider: STORAGE_PROVIDER.CLOUDINARY,
      url: `/api/files/${encodeURIComponent(uploaded.public_id)}`,
      referenceId: uploaded.public_id,
      cloudinaryUrl: uploaded.secure_url,
      publicId: uploaded.public_id,
      driveFileId: null,
      driveUrl: null,
      uploadedBy: context.uploadedBy || null,
      createdAt: new Date()
    };
  }

  const driveUploaded = await driveService.uploadFile(
    { ...file, originalname: safeName },
    {
      fileName: safeName,
      folderId: process.env.GOOGLE_FOLDER_ID,
      mimeType: file.mimetype
    }
  );

  return {
    fileName: safeName,
    type: detectedType,
    storageProvider: STORAGE_PROVIDER.DRIVE,
    url: `/api/files/${encodeURIComponent(driveUploaded.fileId)}`,
    referenceId: driveUploaded.fileId,
    cloudinaryUrl: null,
    publicId: null,
    driveFileId: driveUploaded.fileId,
    driveUrl: driveUploaded.webViewLink || driveUploaded.webContentLink || '',
    uploadedBy: context.uploadedBy || null,
    createdAt: new Date()
  };
}

module.exports = {
  FILE_TYPE,
  STORAGE_PROVIDER,
  FILE_SIZE_LIMITS,
  detectFileTypeFromMime,
  validateFileForStorage,
  uploadFile
};
