# 🚀 GUÍA DE DEPLOYMENT - FENALCO PLATAFORMA

**Fecha:** 23 de Enero de 2026  
**Versión:** 3.1.0  
**Ambiente:** Producción

---

## 📋 CHECKLIST PRE-DEPLOYMENT

Antes de deployar, verifica que TODO esté completo:

### ✅ Seguridad
- [ ] Todas las credenciales rotadas (ver [ROTACION-CREDENCIALES.md](ROTACION-CREDENCIALES.md))
- [ ] Archivo .env NO está en Git (`git status` no debe mostrar .env)
- [ ] JWT_SECRET tiene 64 bytes (128 caracteres hex)
- [ ] Rate limiting configurado (login: 5/15min, register: 3/hora)
- [ ] Helmet habilitado con CSP
- [ ] MongoDB sanitization activo
- [ ] Winston logger configurado

### ✅ Testing
- [ ] Tests unitarios pasan: `npm run test:unit`
- [ ] Tests integración pasan: `npm run test:integration`
- [ ] Coverage > 50%: `npm test`
- [ ] ESLint sin errores: `npm run lint`
- [ ] Prettier formateado: `npm run format:check`

### ✅ Base de Datos
- [ ] MongoDB indexes creados (9 indexes totales)
- [ ] Usuario seed ejecutado: `npm run seed`
- [ ] Backup de datos actual creado
- [ ] Connection string con retryWrites=true

### ✅ Documentación
- [ ] [SECURITY.md](SECURITY.md) revisado
- [ ] [MEJORAS-IMPLEMENTADAS.md](MEJORAS-IMPLEMENTADAS.md) actualizado
- [ ] [README.md](README.md) actualizado con versión 3.1.0
- [ ] Esta guía de deployment completada

---

## 🎯 OPCIONES DE DEPLOYMENT

### Opción 1: Railway (Recomendado)
**Pros:** Fácil, automático, free tier generoso  
**Cons:** Cold starts en free tier

### Opción 2: Render
**Pros:** Free tier, buen performance  
**Cons:** Cold starts después de 15min inactividad

### Opción 3: DigitalOcean App Platform
**Pros:** Escalable, buen soporte  
**Cons:** No tiene free tier

### Opción 4: Servidor VPS (DigitalOcean, AWS, Azure)
**Pros:** Control total, performance consistente  
**Cons:** Requiere configuración manual

---

## 🚂 OPCIÓN 1: DEPLOYMENT EN RAILWAY

### Paso 1: Preparar el proyecto

1. **Crear archivo `railway.json`:**
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS"
  },
  "deploy": {
    "startCommand": "node server.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 3
  }
}
```

2. **Verificar `package.json`:**
```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}
```

### Paso 2: Crear proyecto en Railway

1. **Acceder a Railway:**
   - URL: https://railway.app/
   - Login con GitHub

2. **Crear nuevo proyecto:**
   - Click "+ New Project"
   - Select "Deploy from GitHub repo"
   - Autorizar Railway a acceder a tu repo

3. **Seleccionar repositorio:**
   - Buscar: `fenalco-plataforma`
   - Click para seleccionar

### Paso 3: Configurar variables de entorno

En Railway Dashboard → Variables:

```bash
NODE_ENV=production
PORT=5000

# MongoDB
MONGODB_URI=mongodb+srv://your_db_user:your_password@cluster0.xxxxx.mongodb.net/your_database?retryWrites=true&w=majority

# JWT
JWT_SECRET=generate_your_own_secure_random_jwt_secret_here_minimum_32_characters
JWT_EXPIRE=7d

# Email
EMAIL_USER=comunicaciones2@fenalcosantander.com.co
EMAIL_PASS=TU_APP_PASSWORD

# Cloudinary
CLOUDINARY_NAME=dey3dq8ak
CLOUDINARY_API_KEY=TU_API_KEY
CLOUDINARY_API_SECRET=TU_API_SECRET

# CORS
ALLOWED_ORIGINS=https://fenalcosantander.com.co,https://tu-dominio.railway.app
```

### Paso 4: Deploy

1. Railway detectará cambios automáticamente
2. Click "Deploy Now" si es manual
3. Ver logs en tiempo real
4. Una vez completado, obtendrás una URL: `https://fenalco-plataforma-production.up.railway.app`

### Paso 5: Configurar dominio personalizado (Opcional)

1. **En Railway:**
   - Settings → Domains
   - Click "+ Custom Domain"
   - Ingresar: `plataforma.fenalcosantander.com.co`

2. **En tu proveedor DNS:**
   - Agregar CNAME record:
   - Name: `plataforma`
   - Value: `fenalco-plataforma-production.up.railway.app`

---

## 🎨 OPCIÓN 2: DEPLOYMENT EN RENDER

### Paso 1: Crear `render.yaml`

```yaml
services:
  - type: web
    name: fenalco-plataforma
    env: node
    plan: free
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 5000
      - key: MONGODB_URI
        sync: false
      - key: JWT_SECRET
        sync: false
      - key: EMAIL_USER
        sync: false
      - key: EMAIL_PASS
        sync: false
      - key: CLOUDINARY_NAME
        sync: false
      - key: CLOUDINARY_API_KEY
        sync: false
      - key: CLOUDINARY_API_SECRET
        sync: false
    healthCheckPath: /api/health
```

### Paso 2: Crear cuenta en Render

1. URL: https://render.com/
2. Login con GitHub
3. Click "+ New" → Web Service
4. Conectar repositorio de GitHub

### Paso 3: Configurar servicio

- **Name:** fenalco-plataforma
- **Environment:** Node
- **Build Command:** `npm install`
- **Start Command:** `node server.js`
- **Plan:** Free

### Paso 4: Agregar variables de entorno

Environment → Add Environment Variable (agregar todas las del .env)

### Paso 5: Deploy

- Click "Create Web Service"
- Render construirá y desplegará automáticamente
- URL: `https://fenalco-plataforma.onrender.com`

---

## 💧 OPCIÓN 3: DEPLOYMENT EN DIGITALOCEAN

### Paso 1: Crear App Platform App

1. **Acceder a DigitalOcean:**
   - URL: https://cloud.digitalocean.com/
   - Login

2. **Crear nueva App:**
   - Apps → Create App
   - Source: GitHub
   - Conectar repo

### Paso 2: Configurar build

- **Name:** fenalco-plataforma
- **Region:** New York (más cercano)
- **Branch:** main
- **Build Command:** `npm install && npm run build`
- **Run Command:** `node server.js`

### Paso 3: Configurar recursos

- **Plan:** Basic ($5/month)
- **Instance Size:** 512MB RAM / 1 vCPU
- **HTTP Routes:** / (root)

### Paso 4: Variables de entorno

Environment Variables → Bulk Editor:

```
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
JWT_SECRET=...
EMAIL_USER=...
EMAIL_PASS=...
CLOUDINARY_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
```

### Paso 5: Deploy

- Review → Create Resources
- DigitalOcean construirá y desplegará
- URL: `https://fenalco-plataforma-xxxxx.ondigitalocean.app`

---

## 🖥️ OPCIÓN 4: DEPLOYMENT EN VPS (Ubuntu 22.04)

### Paso 1: Preparar servidor

```bash
# SSH al servidor
ssh root@tu_servidor_ip

# Actualizar sistema
apt update && apt upgrade -y

# Instalar Node.js 18 LTS
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Verificar instalación
node --version  # Debe ser v18.x
npm --version   # Debe ser 9.x o superior

# Instalar PM2 (process manager)
npm install -g pm2

# Instalar Nginx (reverse proxy)
apt install -y nginx

# Configurar firewall
ufw allow 'Nginx Full'
ufw allow OpenSSH
ufw enable
```

### Paso 2: Clonar proyecto

```bash
# Crear directorio para apps
mkdir -p /var/www/fenalco
cd /var/www/fenalco

# Clonar repositorio (necesitas configurar SSH key)
git clone git@github.com:tu-usuario/fenalco-plataforma.git
cd fenalco-plataforma

# Instalar dependencias
npm install --production
```

### Paso 3: Configurar variables de entorno

```bash
# Crear archivo .env
nano .env

# Pegar contenido de .env con credenciales de producción
# Guardar: Ctrl+X → Y → Enter

# Proteger archivo .env
chmod 600 .env
```

### Paso 4: Configurar PM2

```bash
# Iniciar aplicación con PM2
pm2 start server.js --name fenalco-plataforma

# Configurar auto-restart
pm2 startup systemd
pm2 save

# Verificar estado
pm2 status
pm2 logs fenalco-plataforma

# Ver métricas
pm2 monit
```

### Paso 5: Configurar Nginx

```bash
# Crear configuración
nano /etc/nginx/sites-available/fenalco

# Pegar configuración:
```

```nginx
server {
    listen 80;
    server_name plataforma.fenalcosantander.com.co;

    # Logs
    access_log /var/log/nginx/fenalco-access.log;
    error_log /var/log/nginx/fenalco-error.log;

    # Proxy to Node.js
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Static files caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg)$ {
        expires 30d;
        add_header Cache-Control "public, immutable";
    }
}
```

```bash
# Habilitar sitio
ln -s /etc/nginx/sites-available/fenalco /etc/nginx/sites-enabled/

# Testear configuración
nginx -t

# Recargar Nginx
systemctl reload nginx
```

### Paso 6: Configurar SSL con Let's Encrypt

```bash
# Instalar Certbot
apt install -y certbot python3-certbot-nginx

# Obtener certificado
certbot --nginx -d plataforma.fenalcosantander.com.co

# Verificar auto-renovación
certbot renew --dry-run

# Certbot agregará automáticamente redirect HTTP → HTTPS
```

### Paso 7: Configurar MongoDB indexes

```bash
# Conectar a MongoDB desde servidor
npm run seed  # Esto creará los indexes automáticamente
```

---

## 🔍 HEALTH CHECKS

Agregar endpoint de health check en `server.js`:

```javascript
// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: '3.1.0'
  });
});
```

---

## 📊 MONITOREO POST-DEPLOYMENT

### 1. Verificar servidor está corriendo

```bash
curl https://tu-dominio.com/api/health

# Debe retornar:
# {"status":"OK","uptime":123,"timestamp":"2026-01-23...","environment":"production","version":"3.1.0"}
```

### 2. Verificar logs

**Railway/Render:** Ver logs en dashboard

**VPS con PM2:**
```bash
pm2 logs fenalco-plataforma
tail -f error.log
tail -f combined.log
```

### 3. Verificar WebSocket

```bash
# Probar conexión WebSocket
wscat -c wss://tu-dominio.com

# Debe conectar exitosamente
```

### 4. Verificar rate limiting

```bash
# Intentar 6 logins fallidos seguidos
for i in {1..6}; do
  curl -X POST https://tu-dominio.com/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"wrong"}'
done

# El 6to debe retornar 429 Too Many Requests
```

### 5. Verificar security headers

```bash
curl -I https://tu-dominio.com

# Debe incluir headers de Helmet:
# X-Content-Type-Options: nosniff
# X-Frame-Options: SAMEORIGIN
# X-XSS-Protection: 0
# Strict-Transport-Security: max-age=15552000; includeSubDomains
```

---

## 🔄 ROLLBACK PROCEDURE

Si algo falla en producción:

### Railway/Render:
1. Dashboard → Deployments
2. Seleccionar deployment anterior funcional
3. Click "Rollback to this version"

### VPS:
```bash
# Detener aplicación
pm2 stop fenalco-plataforma

# Revertir a commit anterior
cd /var/www/fenalco/fenalco-plataforma
git log --oneline  # Ver commits
git reset --hard COMMIT_HASH

# Reinstalar dependencias
npm install --production

# Reiniciar
pm2 restart fenalco-plataforma
```

---

## 📈 ESCALABILIDAD

### Para escalar horizontalmente:

1. **Load Balancer:** Nginx upstream con múltiples instancias

```nginx
upstream fenalco_backend {
    server localhost:5000;
    server localhost:5001;
    server localhost:5002;
}

server {
    location / {
        proxy_pass http://fenalco_backend;
    }
}
```

2. **Clustering:** Usar PM2 cluster mode

```bash
pm2 start server.js -i max --name fenalco-plataforma
```

3. **Redis:** Para sesiones compartidas entre instancias

```bash
npm install express-session connect-redis redis
```

---

## 🆘 TROUBLESHOOTING

### Problema: "Cannot connect to MongoDB"

**Solución:**
1. Verificar MONGODB_URI en variables de entorno
2. Verificar IP Whitelist en MongoDB Atlas (agregar 0.0.0.0/0 para permitir todo)
3. Verificar que retryWrites=true esté en connection string

### Problema: "Rate limit not working"

**Solución:**
1. Verificar que express-rate-limit esté instalado
2. Verificar que rate limiters estén aplicados correctamente en routes
3. Reiniciar servidor

### Problema: "WebSocket connection failed"

**Solución:**
1. En Nginx, verificar headers de WebSocket (Upgrade, Connection)
2. En Cloudflare, habilitar WebSocket
3. Verificar que puerto esté abierto en firewall

### Problema: "Memory leak"

**Solución:**
1. Monitorear con PM2: `pm2 monit`
2. Configurar max memory restart:
```bash
pm2 start server.js --max-memory-restart 300M
```

---

## ✅ POST-DEPLOYMENT CHECKLIST

- [ ] Servidor responde en /api/health
- [ ] Login funciona correctamente
- [ ] Crear solicitud funciona
- [ ] Upload de archivos funciona (Cloudinary)
- [ ] Notificaciones por email funcionan
- [ ] WebSocket funciona (notificaciones en tiempo real)
- [ ] Rate limiting funciona (probar 6 logins fallidos)
- [ ] Security headers presentes (curl -I)
- [ ] SSL funcionando (https://)
- [ ] Logs generándose correctamente
- [ ] Backup de MongoDB configurado
- [ ] Monitoreo configurado
- [ ] Dominio personalizado configurado
- [ ] Documentación actualizada

---

## 📞 CONTACTO

**Problemas críticos en producción:**
- Email: comunicaciones2@fenalcosantander.com.co
- Revisar logs inmediatamente
- Considerar rollback si es crítico

---

**Estado:** ⏳ PRE-DEPLOYMENT → 🚀 DEPLOYED → ✅ VERIFIED

**Última actualización:** 23 de Enero de 2026
