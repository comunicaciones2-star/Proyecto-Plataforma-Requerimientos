const fs = require('fs');
const path = require('path');
const { uploadBackupFile } = require('../services/storage/drive.service');

async function run() {
  const inputPath = process.argv[2];

  if (!inputPath) {
    console.error('Uso: node scripts/export-backup-to-drive.js <ruta-backup>');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`Archivo no encontrado: ${resolvedPath}`);
    process.exit(1);
  }

  const fileBuffer = fs.readFileSync(resolvedPath);
  const extension = path.extname(resolvedPath).toLowerCase();
  const mimeByExtension = {
    '.gz': 'application/gzip',
    '.zip': 'application/zip',
    '.bak': 'application/octet-stream',
    '.sql': 'application/sql'
  };

  const uploaded = await uploadBackupFile(
    {
      buffer: fileBuffer,
      originalname: path.basename(resolvedPath),
      mimetype: mimeByExtension[extension] || 'application/octet-stream',
      size: fileBuffer.length
    },
    {
      fileName: path.basename(resolvedPath),
      folderId: process.env.GOOGLE_BACKUP_FOLDER_ID || process.env.GOOGLE_FOLDER_ID
    }
  );

  console.log('Backup exportado a Drive correctamente');
  console.log(`fileId: ${uploaded.fileId}`);
  console.log(`webViewLink: ${uploaded.webViewLink}`);
}

run().catch((error) => {
  console.error('Error exportando backup a Drive:', error.message);
  process.exit(1);
});
