const path = require('path');
const { Readable } = require('stream');
const { google } = require('googleapis');

let cachedDriveClient = null;

function sanitizeFileName(fileName = '') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const base = path.basename(String(fileName || ''), ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 120);

  return `${base || 'file'}${ext}`;
}

function createOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    const error = new Error('Google Drive no configurado: faltan GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN');
    error.code = 'DRIVE_NOT_CONFIGURED';
    error.statusCode = 500;
    throw error;
  }

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  return oauth2Client;
}

function getDriveClient() {
  if (cachedDriveClient) {
    return cachedDriveClient;
  }

  const auth = createOAuthClient();
  cachedDriveClient = google.drive({ version: 'v3', auth });
  return cachedDriveClient;
}

async function applyOptionalPublicPermission(drive, fileId) {
  if (String(process.env.DRIVE_PUBLIC_READ || '').toLowerCase() !== 'true') {
    return;
  }

  await drive.permissions.create({
    fileId,
    requestBody: {
      role: 'reader',
      type: 'anyone'
    }
  });
}

async function uploadFile(file, options = {}) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('Archivo inválido para Google Drive');
    error.statusCode = 400;
    throw error;
  }

  const drive = getDriveClient();
  const folderId = options.folderId || process.env.GOOGLE_FOLDER_ID;
  const safeName = sanitizeFileName(options.fileName || file.originalname || 'document');
  const mimeType = options.mimeType || file.mimetype || 'application/octet-stream';

  const requestBody = {
    name: `${Date.now()}-${safeName}`
  };

  if (folderId) {
    requestBody.parents = [folderId];
  }

  try {
    const createResponse = await drive.files.create({
      requestBody,
      media: {
        mimeType,
        body: Readable.from(file.buffer)
      },
      fields: 'id, webViewLink, webContentLink, mimeType, size'
    });

    const fileId = createResponse.data.id;
    await applyOptionalPublicPermission(drive, fileId);

    // Re-consulta para asegurar links después de permisos.
    const metadata = await drive.files.get({
      fileId,
      fields: 'id, webViewLink, webContentLink'
    });

    return {
      fileId: metadata.data.id,
      webViewLink: metadata.data.webViewLink || '',
      webContentLink: metadata.data.webContentLink || ''
    };
  } catch (error) {
    const wrapped = new Error('Error subiendo archivo a Google Drive');
    wrapped.code = 'DRIVE_UPLOAD_FAILED';
    wrapped.statusCode = 502;
    wrapped.cause = error;
    throw wrapped;
  }
}

async function uploadBackupFile(file, options = {}) {
  return uploadFile(file, options);
}

module.exports = {
  uploadFile,
  uploadBackupFile,
  sanitizeFileName
};
