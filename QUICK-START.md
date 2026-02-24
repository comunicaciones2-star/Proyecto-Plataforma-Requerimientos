# 🚀 GUÍA RÁPIDA DE INICIO - Fenalco Plataforma

## ⚡ INICIO RÁPIDO DIARIO (3 pasos)

**Cada vez que abras el proyecto, ejecuta estos comandos:**

```powershell
# Opción recomendada (todo en uno):
npm run morning
```

El script `npm run morning` hace automáticamente:
1. Verifica MongoDB (local o Atlas según `MONGODB_URI`).
2. Inicia servidor si no está arriba.
3. Espera health check en `http://localhost:5000/api/health`.
4. Ejecuta smoke test.
5. Deja URLs listas para abrir.

Opcionalmente puedes ejecutar el script con parámetros:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/morning-start.ps1 -SkipSmoke
```

**Listo:** Abre http://localhost:5000 en tu navegador

---

## 📖 CONFIGURACIÓN INICIAL (Solo primera vez)

## 1️⃣ Verificar Instalación
```bash
node --version  # Debe ser >= 16.0.0
npm --version   # Debe ser >= 8.0.0
```

## 2️⃣ Iniciar MongoDB Local (solo si `MONGODB_URI` apunta a local)

La conexión depende de `MONGODB_URI` en `.env`:
- Si usa `mongodb://localhost:27017/...`, necesitas MongoDB local.
- Si usa `mongodb+srv://...`, usa MongoDB Atlas y puedes omitir este paso.

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
Crear `.env` a partir de `.env.example` y completar credenciales seguras:
```bash
# PowerShell
Copy-Item .env.example .env

# Git Bash
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
- Admins: `comunicaciones2@fenalcosantander.com.co`
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
npm run smoke:queue # Smoke test de cola dinámica
npm run morning    # Arranque matutino automático (Mongo + servidor + smoke)
npm run migrate:roles-cargo # Migración de perfiles/cargos
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
# PowerShell
$env:TEST_BASE_URL="https://tu-dominio.com"
$env:TEST_LOGIN_EMAIL="usuario@dominio.com"
$env:TEST_LOGIN_PASSWORD="tu_clave"
npm run smoke

# (Opcional) Limpiar variables luego de la prueba
Remove-Item Env:TEST_BASE_URL, Env:TEST_LOGIN_EMAIL, Env:TEST_LOGIN_PASSWORD -ErrorAction SilentlyContinue
```

## ✅ Verificación Rápida

Después de `npm run dev`, abre en el navegador:
- **API Test**: http://localhost:5000/api/health
- **Frontend**: http://localhost:5000

## 🔐 Configuración en .env
- **MongoDB**: Configurar MONGODB_URI
- **Cloudinary**: CLOUDINARY_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- **Email**: EMAIL_USER, EMAIL_PASS
- **JWT**: JWT_SECRET (clave secreta para tokens)
- **Puerto**: PORT=5000 (por defecto)

## 🔒 Recomendación de Seguridad
- No guardes credenciales reales en documentación ni en commits.
- Después de cualquier exposición de secretos, rota credenciales y valida con `npm run smoke`.

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
**Fecha**: 24 de febrero de 2026
