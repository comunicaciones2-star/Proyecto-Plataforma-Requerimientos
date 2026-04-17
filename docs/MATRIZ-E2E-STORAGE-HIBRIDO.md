# Matriz de Pruebas E2E - Storage Hibrido

## Objetivo
Validar de extremo a extremo la arquitectura de almacenamiento hibrida por tipo de archivo:
- Imagenes -> Cloudinary
- Documentos -> Google Drive
- Videos/archivos pesados -> Google Drive
- Backups -> Export opcional a Google Drive

## Alcance
- Endpoint creacion de solicitudes: POST /api/requests
- Endpoint actualizacion con entregables: PATCH /api/requests/:id
- Endpoint descarga segura: GET /api/files/:filename
- Script backup: npm run backup:drive -- <ruta-archivo>

## Precondiciones
1. Variables de entorno configuradas:
   - CLOUDINARY_URL o CLOUDINARY_NAME/CLOUDINARY_API_KEY/CLOUDINARY_API_SECRET
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - GOOGLE_REFRESH_TOKEN
   - GOOGLE_FOLDER_ID
   - Opcional: GOOGLE_BACKUP_FOLDER_ID
2. Usuario autenticado con token valido.
3. Usuario de prueba con permisos para crear solicitud.
4. Usuario ejecutor/admin para pruebas de PATCH y descarga.
5. Archivos de prueba preparados por tipo.

## Criterios de aceptacion global
1. Se registra en DB para cada adjunto:
   - type
   - storageProvider
   - url
   - referenceId
   - driveFileId/driveUrl o publicId/cloudinaryUrl segun proveedor
2. No se guardan documentos ni videos en Cloudinary.
3. Las imagenes no se guardan en Drive.
4. Los errores de validacion devuelven 4xx con mensaje claro.
5. El endpoint de descarga valida permisos antes de redirigir/descargar.

## Matriz E2E

| ID | Flujo | Tipo | Caso | Entrada | Esperado API | Esperado Storage | Esperado DB |
|---|---|---|---|---|---|---|---|
| IMG-01 | POST /api/requests | image | Imagen valida JPG 2MB | .jpg 2MB | 201 success | Upload en Cloudinary | type=image, storageProvider=cloudinary, publicId y cloudinaryUrl con valor |
| IMG-02 | POST /api/requests | image | Imagen valida PNG 9.5MB | .png 9.5MB | 201 success | Cloudinary | Metadatos cloudinary completos |
| IMG-03 | POST /api/requests | image | Imagen excede limite | .jpg 12MB | 400 validacion | No se sube | No crea adjunto |
| IMG-04 | POST /api/requests | image | Imagen extension invalida | .svg | 400 validacion | No se sube | No crea adjunto |
| IMG-05 | POST /api/requests | image | Cuota/rate limit Cloudinary | Forzar 420/429 | 503 o error controlado | Error CLOUDINARY_QUOTA | No crea adjunto o transaccion abortada |
| DOC-01 | POST /api/requests | document | PDF valido 5MB | .pdf 5MB | 201 success | Upload en Drive | type=document, storageProvider=drive, driveFileId y driveUrl con valor |
| DOC-02 | POST /api/requests | document | DOCX valido 20MB | .docx 20MB | 201 success | Drive | Metadatos drive completos |
| DOC-03 | POST /api/requests | document | XLSX valido 29MB | .xlsx 29MB | 201 success | Drive | type=document |
| DOC-04 | POST /api/requests | document | PDF excede limite | .pdf 40MB | 400 validacion | No se sube | No crea adjunto |
| DOC-05 | POST /api/requests | document | Tipo no permitido | .exe | 400 validacion | No se sube | No crea adjunto |
| DOC-06 | POST /api/requests | document | Falla Drive API | token revocado | 502 controlado | Error DRIVE_UPLOAD_FAILED | Sin adjunto persistido |
| VID-01 | POST /api/requests | video | MP4 valido 120MB | .mp4 120MB | 201 success | Drive | type=video, storageProvider=drive |
| VID-02 | POST /api/requests | video | MOV valido 190MB | .mov 190MB | 201 success | Drive | type=video |
| VID-03 | POST /api/requests | video | Video excede limite | .mp4 240MB | 400 validacion | No se sube | Sin adjunto |
| VID-04 | PATCH /api/requests/:id | video | Entregable de video | .mp4 100MB | 200 success | Drive | Nuevo adjunto agregado en request.attachments |
| MIX-01 | POST /api/requests | mixto | 1 imagen + 1 PDF + 1 video | jpg+pdf+mp4 | 201 success | Imagen Cloudinary, resto Drive | Cada adjunto con provider correcto |
| MIX-02 | POST /api/requests | mixto | 6 archivos | 6 archivos validos | 400 limite archivos | No procesa upload | Sin cambios |
| MIX-03 | POST /api/requests | mixto | 5 archivos validos | 5 archivos | 201 success | Segun tipo | 5 adjuntos persistidos |
| SEC-01 | GET /api/files/:id | descarga | Usuario sin permiso | id adjunto ajeno | 403 | No redirecciona | Sin fuga de URL |
| SEC-02 | GET /api/files/:id | descarga | Usuario propietario | id adjunto propio | 302 cloud/drive o 200 local | Descarga correcta | N/A |
| SEC-03 | GET /api/files/:id | descarga | Path traversal | ../../etc/passwd | 400 | Bloqueado | N/A |
| SEC-04 | POST /api/requests | seguridad | Nombre con caracteres peligrosos | archivo con nombre raro | 201 o 400 segun extension | Sanitizado | fileName/reference saneados |
| BAK-01 | npm run backup:drive -- dump.sql | backup | Export backup SQL | .sql 50MB | Exit 0 | Upload Drive | fileId/webViewLink en consola |
| BAK-02 | npm run backup:drive -- dump.zip | backup | Export backup ZIP | .zip 300MB | Exit 0 | Upload Drive | fileId/webViewLink |
| BAK-03 | npm run backup:drive -- inexists.bak | backup | Archivo no existe | ruta invalida | Exit 1 | No upload | Error controlado |
| BAK-04 | npm run backup:drive -- dump.sql | backup | Drive no configurado | faltan envs | Exit 1 | No upload | Error DRIVE_NOT_CONFIGURED |

## Casos de regresion obligatorios
1. Crear solicitud sin archivos debe seguir funcionando.
2. Edicion de solicitud sin archivos debe seguir funcionando.
3. Descarga de adjuntos legacy locales debe seguir funcionando.
4. Adjuntos anteriores sin storageProvider no deben romper visualizacion.

## Evidencia esperada por caso
1. Captura de request/response (status y body).
2. Registro de proveedor destino (Cloudinary o Drive).
3. Documento en DB con metadatos de storage.
4. Verificacion de permisos en descarga.

## Priorizacion de ejecucion
1. Critico: IMG-01, DOC-01, VID-01, MIX-01, SEC-01, BAK-01
2. Alto: IMG-03, DOC-04, VID-03, MIX-02, SEC-03
3. Medio: resto de casos

## Checklist de salida (Go/No-Go)
- [ ] Todos los casos criticos aprobados
- [ ] Cero almacenamiento de documentos/videos en Cloudinary
- [ ] Cero imagenes en Drive
- [ ] Errores 4xx/5xx con mensajes claros y accionables
- [ ] Descarga segura validada por permisos
- [ ] Export de backup a Drive verificado
