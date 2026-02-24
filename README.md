# 🎨 Fenalco - Plataforma de Gestión de Requerimientos de Diseño

[![Node.js](https://img.shields.io/badge/Node.js-16+-green.svg)](https://nodejs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Local%20%7C%20Atlas-green.svg)](https://www.mongodb.com/)
[![License](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)

Plataforma web para gestionar solicitudes de diseño gráfico del equipo de Comunicaciones de Fenalco Santander.

## 🚀 Inicio Rápido

### Requisitos Previos
- Node.js >= 16.0.0
- MongoDB (local o Atlas)
- npm >= 8.0.0

### Instalación

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tus credenciales

# 3. Poblar base de datos con datos de prueba
npm run seed

# 4. Iniciar servidor
npm run dev
```

El servidor estará disponible en: **http://localhost:5000**

### Credenciales de Prueba

| Rol | Email | Contraseña |
|-----|-------|-----------|
| **Admin** | comunicaciones2@fenalcosantander.com.co | password123 |
| **Diseñador** | comunicaciones@fenalcosantander.com.co | password123 |
| **Colaborador** | coordinadoracomercial3@fenalcosantander.com.co | password123 |

## 📁 Estructura del Proyecto

```
fenalco-plataforma/
├── config/                 # Configuración de servicios
│   ├── cloudinary.js      # CDN de imágenes
│   └── email.js           # Nodemailer (Gmail)
├── middleware/             # Middleware Express
│   └── auth.js            # Autenticación JWT
├── models/                 # Modelos MongoDB
│   ├── User.js            # Usuarios
│   ├── Request.js         # Solicitudes
│   └── Department.js      # Departamentos
├── routes/                 # Rutas API REST
│   ├── authRoutes.js      # Autenticación
│   ├── userRoutes.js      # Gestión de usuarios
│   ├── requestRoutes.js   # Gestión de solicitudes
│   ├── reportRoutes.js    # Reportes y estadísticas
│   ├── adminRoutes.js     # Administración
│   └── departmentRoutes.js # Departamentos
├── scripts/                # Scripts de utilidad
│   └── seed.js            # Poblado de datos
├── utils/                  # Utilidades
│   ├── websocket.js       # WebSockets (tiempo real)
│   └── autoAssign.js      # Auto-asignación de diseñadores
├── src/                    # Frontend
│   ├── pages/             # Páginas HTML
│   ├── components/        # Componentes reutilizables
│   ├── partials/          # Fragmentos HTML
│   └── assets/            # CSS, JS, imágenes
├── index.html             # Aplicación principal
├── server.js              # Servidor Express
├── package.json           # Dependencias
└── .env                   # Variables de entorno
```

## 🔧 Tecnologías

### Backend
- **Express.js** - Framework web
- **MongoDB + Mongoose** - Base de datos
- **JWT** - Autenticación
- **Bcrypt** - Encriptación
- **WebSockets** - Tiempo real
- **Nodemailer** - Emails
- **Cloudinary** - Gestión de imágenes
- **Multer** - Upload de archivos

### Frontend
- **Alpine.js** - Interactividad
- **Tailwind CSS** - Estilos
- **ApexCharts** - Gráficos
- **HTML5** - Markup

## 📚 API Endpoints

### Autenticación
```
POST   /api/auth/login          # Iniciar sesión
POST   /api/auth/register       # Registrar usuario
GET    /api/auth/logout         # Cerrar sesión
```

### Usuarios
```
GET    /api/users/profile       # Ver perfil
PUT    /api/users/profile       # Actualizar perfil
PUT    /api/users/password      # Cambiar contraseña
```

### Solicitudes
```
GET    /api/requests            # Listar solicitudes
POST   /api/requests            # Crear solicitud
GET    /api/requests/:id        # Ver detalles
PUT    /api/requests/:id/edit   # Editar solicitud (campos completos)
PATCH  /api/requests/:id        # Actualizar estado/asignación
DELETE /api/requests/:id        # Eliminar solicitud
POST   /api/requests/:id/comment # Agregar comentario
```

### Cola de Tickets
```
GET    /api/queue/tickets/:id/position # Posición de un ticket en cola
GET    /api/queue/my                   # Cola asociada al usuario autenticado
GET    /api/queue/scope                # Cola por alcance (solo admin)
```

### Administración (Solo Admin)
```
GET    /api/admin/users         # Listar usuarios
POST   /api/admin/users         # Crear usuario
PATCH  /api/admin/users/:id     # Actualizar usuario
DELETE /api/admin/users/:id     # Desactivar usuario
GET    /api/admin/requests/stats # Estadísticas
GET    /api/admin/export/users  # Exportar usuarios CSV
GET    /api/admin/export/requests # Exportar solicitudes CSV
```

### Reportes
```
GET    /api/reports/stats       # Estadísticas generales
GET    /api/reports/designer/:id # Estadísticas por diseñador
GET    /api/reports/area        # Estadísticas por área
```

## 🎨 Paleta de Colores Fenalco

| Color | Código | Uso |
|-------|--------|-----|
| Verde Corporativo | `#00CE7C` | Principal |
| Azul Oscuro | `#280071` | Secundario |
| Coral | `#F05A5B` | Alertas |
| Turquesa | `#16DCE7` | Info |

## 🔐 Seguridad

- ✅ Contraseñas hasheadas con bcryptjs
- ✅ Autenticación JWT (tokens de 7 días)
- ✅ Helmet + cabeceras seguras
- ✅ Sanitización anti NoSQL injection (express-mongo-sanitize)
- ✅ Rate limiting en endpoints sensibles
- ✅ Logging estructurado con Winston
- ✅ CORS configurado por variables de entorno
- ✅ Variables sensibles en `.env`
- ✅ Middleware de autenticación en rutas protegidas
- ✅ Validación de inputs

## 🧪 Testing

```bash
# Ejecutar tests completos de API
node test-all-endpoints.js

# Smoke test rápido post-deploy
npm run smoke

# Smoke test de cola
npm run smoke:queue

# Test rápido de API
node test-api.js

# Poblar base de datos
npm run seed
```

## 📝 Scripts Disponibles

```json
{
  "start": "node server.js",              // Producción
  "dev": "nodemon server.js",             // Desarrollo con auto-reload
  "seed": "node scripts/seed.js",         // Poblar BD
  "migrate:roles-cargo": "node scripts/migrate-roles-to-cargo.js", // Migración de perfiles
  "smoke": "node scripts/smoke-test.js",  // Smoke test post-deploy
  "smoke:queue": "node scripts/smoke-queue.js", // Smoke de cola
  "morning": "powershell -ExecutionPolicy Bypass -File scripts/morning-start.ps1", // Arranque diario
  "build": "vite build",                  // Build frontend
  "preview": "vite preview",              // Preview build
  "dev-frontend": "vite"                  // Dev frontend solo
}
```

## 🚢 Deployment

- Configuración Railway lista en [railway.json](railway.json)
- Configuración Render lista en [render.yaml](render.yaml)
- Guía completa de despliegue en [DEPLOYMENT.md](DEPLOYMENT.md)

## 🌐 Variables de Entorno

```env
# Servidor
PORT=5000
NODE_ENV=development

# Base de Datos
MONGODB_URI=mongodb://localhost:27017/fenalco-disenos

# JWT
JWT_SECRET=tu_secret_key_segura
JWT_EXPIRE=7d

# Email (Gmail)
EMAIL_USER=tu_email@gmail.com
EMAIL_PASS=tu_app_password

# Cloudinary
CLOUDINARY_NAME=tu_cloud_name
CLOUDINARY_API_KEY=tu_api_key
CLOUDINARY_API_SECRET=tu_api_secret

# CORS
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:8888
```

## 🐛 Solución de Problemas

Ver [TROUBLESHOOTING.md](TROUBLESHOOTING.md) para problemas comunes y soluciones.

### Problemas Comunes

**Error de conexión a MongoDB:**
```bash
# Verificar que MongoDB esté corriendo
mongod --version

# O usar MongoDB Atlas (actualizar MONGODB_URI en .env)
```

**Puerto 5000 en uso:**
```bash
# Cambiar puerto en .env
PORT=3000
```

**Error de autenticación:**
```bash
# Verificar que JWT_SECRET esté configurado en .env
# Regenerar datos de prueba
npm run seed
```

## 📖 Documentación Adicional

- [Guía de Inicio Rápido](QUICK-START.md)
- [Solución de Problemas](TROUBLESHOOTING.md)
- [Deployment](DEPLOYMENT.md)
- [Acta Go/No-Go](ACTA-SALIDA-GO-NO-GO-2026-02-24.md)
- [Checklist post-purga de secretos](CHECKLIST-POST-PURGA-SECRETOS-2026-02-24.md)

## 👥 Equipo

**Fenalco Santander - Equipo de Comunicaciones**

## 📄 Licencia

ISC © 2026 Fenalco Santander

---

**Versión:** 1.1.0  
**Última actualización:** 24 febrero 2026  
**Estado:** ✅ Release final publicado
