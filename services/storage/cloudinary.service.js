const path = require('path');
const streamifier = require('streamifier');
const cloudinary = require('../../config/cloudinary');

function sanitizeFileName(fileName = '') {
  const ext = path.extname(String(fileName || '')).toLowerCase();
  const base = path.basename(String(fileName || ''), ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);

  return `${base || 'file'}${ext}`;
}

function uploadStream(buffer, options = {}) {
  return new Promise((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(options, (error, result) => {
      if (error) {
        const quotaLikeError = [420, 429].includes(error?.http_code);
        if (quotaLikeError) {
          const wrapped = new Error('Cloudinary quota alcanzada o rate limit excedido');
          wrapped.code = 'CLOUDINARY_QUOTA';
          wrapped.statusCode = 503;
          wrapped.cause = error;
          return reject(wrapped);
        }

        const wrapped = new Error('Error subiendo imagen a Cloudinary');
        wrapped.code = 'CLOUDINARY_UPLOAD_FAILED';
        wrapped.statusCode = 502;
        wrapped.cause = error;
        return reject(wrapped);
      }

      return resolve(result);
    });

    streamifier.createReadStream(buffer).pipe(upload);
  });
}

async function uploadImage(file, options = {}) {
  if (!file || !Buffer.isBuffer(file.buffer)) {
    const error = new Error('Archivo de imagen inválido');
    error.statusCode = 400;
    throw error;
  }

  const safeName = sanitizeFileName(file.originalname || 'image');
  const folder = options.folder || process.env.CLOUDINARY_IMAGE_FOLDER || 'fenalco/images';

  const result = await uploadStream(file.buffer, {
    folder,
    resource_type: 'image',
    public_id: `${Date.now()}-${safeName.replace(/\.[^.]+$/, '')}`,
    use_filename: false,
    unique_filename: true,
    overwrite: false,
    quality: 'auto',
    fetch_format: 'auto'
  });

  return {
    secure_url: result.secure_url,
    public_id: result.public_id,
    bytes: Number(result.bytes) || 0,
    format: result.format || ''
  };
}

module.exports = {
  uploadImage,
  sanitizeFileName
};
