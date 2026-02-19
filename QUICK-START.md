# 🚀 GUÍA RÁPIDA DE INICIO - Fenalco Plataforma

## ⚡ INICIO RÁPIDO DIARIO (3 pasos)

**Cada vez que abras el proyecto, ejecuta estos comandos:**

```powershell
# 1. Verificar que MongoDB esté corriendo
Get-Service MongoDB

# 2. Si MongoDB no está corriendo, iniciarlo:
net start MongoDB

# 3. Iniciar el servidor
npm run dev
```

**Listo:** Abre http://localhost:5000 en tu navegador

---

## 📖 CONFIGURACIÓN INICIAL (Solo primera vez)

## 1️⃣ Verificar Instalación
```bash
node --version  # Debe ser >= 16.0.0
npm --version   # Debe ser >= 8.0.0
```

## 2️⃣ Iniciar MongoDB Local

**El proyecto está configurado para usar MongoDB LOCAL** en `localhost:27017`

### Opción A: MongoDB instalado en Windows
```bash
# Iniciar el servicio de MongoDB (PowerShell como admin):
net start MongoDB

# O ejecutar mongod directamente:
mongod
```

### Opción B: Con Docker
```bash
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

### Verificar que MongoDB está corriendo:
```bash
# PowerShell:
Get-Process mongod

# O intentar conectarse:
mongosh
```

## 3️⃣ Instalar Dependencias
```bash
npm install
```

## 4️⃣ Configurar Variables de Entorno
El archivo `.env` ya está configurado con tus credenciales reales.
Si necesitas cambiar algo:
```bash
cp .env.example .env
# Edita .env con tus valores
```

## 5️⃣ Poblar BD con Datos de Prueba
```bash
npm run seed
```

**Usuarios de prueba creados (contraseña: password123):**
- Diseñadores: `comunicaciones@fenalcosantander.com.co`
- Gerentes: `ejecutivaformacion1@fenalcosantander.com.co`
- Admins: `asistentedireccion@fenalcosantander.com.co`
- Usuarios: `coordinadoracomercial3@fenalcosantander.com.co`

## 6️⃣ Iniciar el Servidor

### Desarrollo (con auto-reload):
```bash
npm run dev
```

### Producción:
```bash
npm start
```

El servidor estará en: **http://localhost:5000**

## 📦 Dependencias Principales
✅ express (servidor web)
✅ mongoose (base de datos)
✅ jsonwebtoken (autenticación)
✅ bcryptjs (contraseñas)
✅ nodemailer (emails)
✅ cloudinary (imágenes)
✅ ws (websockets)
✅ cors (seguridad)
✅ multer (upload archivos)
✅ alpinejs (interactividad frontend)

## 📜 Scripts Disponibles
```bash
npm start          # Iniciar servidor producción
npm run dev        # Iniciar servidor desarrollo (nodemon)
npm run seed       # Poblar BD con datos de prueba
npm run smoke      # Smoke test post-deploy (health/login/stats/create/delete)
npm run build      # Compilar frontend (Vite)
npm run preview    # Vista previa build
npm run dev-frontend  # Servidor desarrollo frontend (Vite)
```

## 🧪 Smoke Test Post-Deploy

Con el servidor levantado, ejecuta:

```bash
npm run smoke
```

Opcionalmente puedes apuntar a otro ambiente y credenciales:

```bash
TEST_BASE_URL=https://tu-dominio.com TEST_LOGIN_EMAIL=usuario@dominio.com TEST_LOGIN_PASSWORD=tu_clave npm run smoke
```

## ✅ Verificación Rápida

Después de `npm run dev`, abre en el navegador:
- **API Test**: http://localhost:5000/api/health
- **Frontend**: http://localhost:5000

## 🔐 Configuración en .env
- **MongoDB**: Configurar MONGODB_URI
- **Cloudinary**: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- **Email**: EMAIL_USER, EMAIL_PASS
- **JWT**: JWT_SECRET (clave secreta para tokens)
- **Puerto**: PORT=5000 (por defecto)

## ❌ Solución de Problemas

### Puerto 5000 en uso:
```bash
netstat -ano | findstr :5000
# Cambiar PORT en .env
```

### MongoDB no conecta:
```bash
# Verifica que mongod esté corriendo:
mongod
# O usa la conexión remota en .env
```

### Error de módulos:
```bash
# PowerShell:
Remove-Item -Recurse -Force node_modules, package-lock.json
npm install

# Git Bash:
rm -rf node_modules package-lock.json
npm install
```

## 📞 Soporte
- Ver README.md para documentación completa
- Revisar logs en la consola
- Verificar .env está correcto

---
**Estado**: ✅ Proyecto configurado y listo para desarrollo
**Fecha**: 24 de enero de 2026
