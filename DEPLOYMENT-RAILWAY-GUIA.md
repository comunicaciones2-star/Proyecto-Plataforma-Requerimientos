# 🚀 DEPLOYMENT A RAILWAY - GUÍA COMPLETA

**Fecha**: 6 de Marzo de 2026  
**Status**: Listo para Deployment  
**Plataforma**: Railway.app

---

## 📋 Requisitos Previos

✅ Repositorio en GitHub: https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos  
✅ Cambios committeados y pusheados  
✅ railway.json configurado  
✅ Todas las variables de entorno disponibles  

---

## 🔑 Variables de Entorno Necesarias

Debes configurar estas variables en Railway:

```
PORT=5000
NODE_ENV=production

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database
JWT_SECRET=tu-super-secret-jwt-key-aqui
JWT_EXPIRE=7d

ALLOWED_ORIGINS=https://tu-app-railway.up.railway.app,https://www.fenalcosantander.com.co

EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password (16 caracteres de Gmail)

CLOUDINARY_NAME=tu-cloudinary-name
CLOUDINARY_API_KEY=tu-api-key
CLOUDINARY_API_SECRET=tu-api-secret
```

---

## 📖 Pasos para Desplegar en Railway

### **Paso 1: Crear Proyecto en Railway**

1. Ir a https://railway.app
2. Click en "Login" o "Sign Up"
3. Autenticarse con GitHub
4. Click en "Create New Project"
5. Seleccionar "Deploy from GitHub repo"
6. Buscar y seleccionar: `comunicaciones2-star/Proyecto-Plataforma-Requerimientos`

### **Paso 2: Configurar Variables de Entorno**

1. En el Dashboard de Railway, ir a la pestaña "Variables"
2. Click en "Add Variable"
3. Agregar cada variable:

| Variable | Valor | Notas |
|----------|-------|-------|
| NODE_ENV | production | No cambiar |
| PORT | 5000 | No cambiar |
| MONGODB_URI | mongodb+srv://... | De MongoDB Atlas |
| JWT_SECRET | [tu-secret-key] | Genera algo fuerte |
| JWT_EXPIRE | 7d | Validez del token |
| EMAIL_USER | tu@email.com | Cuenta Gmail |
| EMAIL_PASS | xxxxxxxxxxxxxx | Contraseña de app (16 chars) |
| CLOUDINARY_NAME | tu-cloud-name | De Cloudinary |
| CLOUDINARY_API_KEY | xxxxxxxxxxxxxxxx | Del panel de Cloudinary |
| CLOUDINARY_API_SECRET | xxxxxxxxxxxxxxxx | Del panel de Cloudinary |
| ALLOWED_ORIGINS | https://app-url,https://www.fenalco.com | URLs permitidas |

### **Paso 3: Configuración Automática**

Railway detectará automáticamente:
- ✅ Node.js (del package.json)
- ✅ Start command (del railway.json)
- ✅ Health check (del railway.json)

### **Paso 4: Desplegar**

1. Click en "Deploy"
2. Esperar a que se build (3-5 minutos)
3. Verificar logs en "Recent Deployments"
4. Buscar el mensaje: "✅ Servidor LISTO en puerto 5000"

---

## ✅ Validación Post-Deployment

Después de desplegar, verificar:

```bash
# 1. Health Check
GET https://tu-app.up.railway.app/api/health

# 2. API Welcome
GET https://tu-app.up.railway.app/api

# 3. Login
POST https://tu-app.up.railway.app/api/auth/login
Body: {
  "email": "comunicaciones@fenalcosantander.com.co",
  "password": "password123"
}

# 4. Create Request (CRUD Test)
POST https://tu-app.up.railway.app/api/requests
Body: {
  "title": "Prueba de Producción",
  "description": "Test desde Railway",
  "area": "comunicaciones",
  "type": "redes",
  "urgency": "normal",
  "deliveryDate": "2026-03-07"
}
```

---

## 🔗 Información del Proyecto

**Repositorio GitHub**:  
https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos

**URL después de desplegar**:  
`https://proyecto-plataforma-requerimientos.up.railway.app`

**Inicio de Sesión**:
- Email: `comunicaciones@fenalcosantander.com.co`
- Contraseña: `password123`

---

## 🐛 Troubleshooting

### Error: "Build Failed"
- Verificar que el repositorio es público
- Asegurar que package.json existe en root
- Revisar logs en "Recent Deployments"

### Error: "MongoDB Connection Failed"
- Verificar MONGODB_URI en variables
- Asegurar que IP de Railway está permitida en MongoDB Atlas
- Agregar "0.0.0.0/0" a whitelist en MongoDB Atlas

### Error: "Cannot find mailgun key"
- EMAIL_USER y EMAIL_PASS son requeridos
- Usar contraseña de aplicación de Gmail (16 chars)

### App arranca pero no responde
- Verificar que PORT=5000
- Revisar los logs: `railway logs`
- Comprobar health check: `/api/health`

---

## 📊 Monitoreo en Railway

Una vez deployado:

1. **Logs en Tiempo Real**: Pestaña "Logs"
2. **Environments**: Ver variables activas
3. **Metrics**: CPU, Memory, Network
4. **Recent Deployments**: Historial de despliegues

---

## 🎯 URLs Importantes

| Recurso | URL |
|---------|-----|
| **Dashboard Railway** | https://railway.app/dashboard |
| **GitHub Repo** | https://github.com/comunicaciones2-star/Proyecto-Plataforma-Requerimientos |
| **API Base** (después de deploy) | `https://tuapp.up.railway.app/api` |
| **Health Check** | `https://tuapp.up.railway.app/api/health` |

---

## 📝 Checklist Pre-Deployment

- [x] Commit realizado a GitHub
- [x] railway.json presente y correcto
- [x] Todas las variables de entorno documentadas
- [x] MongoDB Atlas accesible desde internet
- [x] Gmail app password generado
- [x] Cloudinary configurado (si necesario)
- [ ] Proyecto creado en Railway
- [ ] Variables de entorno configuradas en Railway
- [ ] Despliegue exitoso
- [ ] Validación en producción completada

---

## 🚀 Siguiente Paso

¿Necesitas ayuda para configurar algo específico o preferes que continúe con otro aspecto del deployment?

**Opciones**:
1. Configurar dominio personalizado en Railway
2. Configurar auto-deployments desde GitHub
3. Implementar SSL/TLS
4. Configurar monitoreo y alertas
5. Documentar rutas de API para equipo

---

*Generado: 6 de Marzo de 2026*  
*Estado: Listo para Producción 🎯*
