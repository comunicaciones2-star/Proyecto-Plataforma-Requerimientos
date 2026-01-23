# 🔄 GUÍA DE ROTACIÓN DE CREDENCIALES
**Fecha:** 23 de Enero de 2026  
**Prioridad:** 🔴 CRÍTICA - Ejecutar INMEDIATAMENTE

---

## ⚠️ CREDENCIALES COMPROMETIDAS

Las siguientes credenciales están en el historial de Git y deben rotarse AHORA:

### 1. 🗄️ MongoDB Atlas

**Credenciales actuales comprometidas:**
```
Usuario: comunicaciones2_db_user
Contraseña: 0h0TrLEeUj2jjGMz
Connection String: mongodb+srv://comunicaciones2_db_user:0h0TrLEeUj2jjGMz@cluster0.nf12e8s.mongodb.net/
```

**Pasos para rotar:**

1. **Acceder a MongoDB Atlas**
   - URL: https://cloud.mongodb.com/
   - Login con cuenta de Fenalco

2. **Eliminar usuario comprometido**
   - Database Access → Encuentra `comunicaciones2_db_user`
   - Click en "Delete" → Confirmar

3. **Crear nuevo usuario**
   - Database Access → "+ Add New Database User"
   - Authentication Method: Password
   - Username: `fenalco_prod_user_2026`
   - Password: Generar fuerte (usar generador)
   - Database User Privileges: "Read and write to any database"
   - Click "Add User"

4. **Actualizar .env**
   ```bash
   MONGODB_URI=mongodb+srv://fenalco_prod_user_2026:NUEVA_PASSWORD@cluster0.nf12e8s.mongodb.net/fenalco-disenos?retryWrites=true&w=majority
   ```

5. **Configurar IP Whitelist** (Seguridad adicional)
   - Network Access → Add IP Address
   - Para desarrollo: Tu IP actual
   - Para producción: IP del servidor

---

### 2. 📦 Cloudinary

**Credenciales actuales comprometidas:**
```
Cloud Name: dey3dq8ak
API Key: 649871449998545
API Secret: A1CQJ0jmNb5FlPWkEWWgO72r13I
```

**Pasos para rotar:**

1. **Acceder a Cloudinary Dashboard**
   - URL: https://cloudinary.com/console
   - Login con cuenta de Fenalco

2. **Resetear API Secret**
   - Settings → Security
   - API Keys → Click "Reset API Secret"
   - Confirmar acción
   - **IMPORTANTE:** Copia el nuevo secret inmediatamente (no se mostrará de nuevo)

3. **Opcional: Crear nuevo API Key**
   - Si prefieres cambiar también el API Key:
   - Settings → Security → API Keys
   - "+ Generate New Key Pair"

4. **Actualizar .env**
   ```bash
   CLOUDINARY_NAME=dey3dq8ak
   CLOUDINARY_API_KEY=NUEVO_API_KEY
   CLOUDINARY_API_SECRET=NUEVO_API_SECRET
   ```

5. **Configurar restricciones** (Opcional pero recomendado)
   - Settings → Security → Allowed domains
   - Agregar dominios permitidos: `fenalcosantander.com.co`

---

### 3. 📧 Gmail App Password

**Credenciales actuales comprometidas:**
```
Email: comunicaciones2@fenalcosantander.com.co
App Password: comercio122024
```

**Pasos para rotar:**

1. **Acceder a Google Account**
   - URL: https://myaccount.google.com/
   - Login con `comunicaciones2@fenalcosantander.com.co`

2. **Revocar App Password actual**
   - Security → 2-Step Verification
   - App passwords
   - Buscar "Node Mailer" o app password actual
   - Click en "X" para revocar

3. **Generar nuevo App Password**
   - App passwords → Select app: "Mail"
   - Select device: "Other (Custom name)"
   - Nombre: "Fenalco Platform 2026"
   - Click "Generate"
   - **Copia el password de 16 caracteres**

4. **Actualizar .env**
   ```bash
   EMAIL_USER=comunicaciones2@fenalcosantander.com.co
   EMAIL_PASS=NUEVO_APP_PASSWORD_16_CHARS
   ```

---

### 4. 🔑 JWT Secret

**Secret actual comprometido:**
```
JWT_SECRET=F3n4lc0_S4nt4nd3r_Pl4tf0rm4_2026_JWT_SECURE_KEY
```

**Nuevo JWT_SECRET generado (64 bytes):**
```
JWT_SECRET=0ea6038de92cf8e1774a21be326075515bad1196d213f80ea14975b4701bdc2b80c10149d06f075875798cc48b942156282667b23960b5a69878220209d8a1fb
```

**Pasos para rotar:**

1. **Actualizar .env**
   ```bash
   JWT_SECRET=0ea6038de92cf8e1774a21be326075515bad1196d213f80ea14975b4701bdc2b80c10149d06f075875798cc48b942156282667b23960b5a69878220209d8a1fb
   ```

2. **⚠️ IMPORTANTE: Esto invalidará todas las sesiones activas**
   - Los usuarios tendrán que volver a hacer login
   - Coordinar con el equipo para evitar interrupciones

3. **Para generar nuevo secret en el futuro:**
   ```bash
   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
   ```

---

## 📋 CHECKLIST DE ROTACIÓN

Marca cada paso cuando lo completes:

### MongoDB Atlas
- [ ] Eliminar usuario `comunicaciones2_db_user`
- [ ] Crear nuevo usuario `fenalco_prod_user_2026`
- [ ] Generar contraseña fuerte (20+ caracteres)
- [ ] Actualizar MONGODB_URI en .env
- [ ] Configurar IP Whitelist
- [ ] Probar conexión: `npm run dev`

### Cloudinary
- [ ] Resetear API Secret
- [ ] Copiar nuevo secret
- [ ] Actualizar CLOUDINARY_API_SECRET en .env
- [ ] (Opcional) Generar nuevo API Key
- [ ] Configurar dominios permitidos
- [ ] Probar upload de archivo

### Gmail
- [ ] Revocar App Password actual
- [ ] Generar nuevo App Password
- [ ] Copiar password de 16 caracteres
- [ ] Actualizar EMAIL_PASS en .env
- [ ] Probar envío de email

### JWT Secret
- [ ] Copiar nuevo JWT_SECRET generado
- [ ] Actualizar JWT_SECRET en .env
- [ ] Notificar al equipo sobre invalidación de sesiones
- [ ] Reiniciar servidor: `npm run dev`
- [ ] Probar login

---

## 🔐 ARCHIVO .env ACTUALIZADO

Después de rotar todas las credenciales, tu `.env` debe verse así:

```bash
# SERVER
PORT=5000
NODE_ENV=production

# DATABASE - NUEVAS CREDENCIALES
MONGODB_URI=mongodb+srv://fenalco_prod_user_2026:TU_NUEVA_PASSWORD@cluster0.nf12e8s.mongodb.net/fenalco-disenos?retryWrites=true&w=majority

# JWT - NUEVO SECRET
JWT_SECRET=0ea6038de92cf8e1774a21be326075515bad1196d213f80ea14975b4701bdc2b80c10149d06f075875798cc48b942156282667b23960b5a69878220209d8a1fb
JWT_EXPIRE=7d

# EMAIL - NUEVO APP PASSWORD
EMAIL_USER=comunicaciones2@fenalcosantander.com.co
EMAIL_PASS=TU_NUEVO_APP_PASSWORD_16_CHARS

# CLOUDINARY - NUEVAS CREDENCIALES
CLOUDINARY_NAME=dey3dq8ak
CLOUDINARY_API_KEY=TU_NUEVO_API_KEY
CLOUDINARY_API_SECRET=TU_NUEVO_API_SECRET

# CORS
ALLOWED_ORIGINS=http://localhost:5000,http://localhost:8888,https://fenalcosantander.com.co

# API
API_VERSION=3.1.0
```

---

## 🧪 VERIFICACIÓN POST-ROTACIÓN

Después de rotar todas las credenciales, ejecuta estas pruebas:

### 1. Verificar MongoDB
```bash
npm run dev
# Debe mostrar: ✅ MongoDB conectado exitosamente
```

### 2. Verificar JWT (Login)
```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"asistentedireccion@fenalcosantander.com.co","password":"password123"}'

# Debe retornar token válido
```

### 3. Verificar Cloudinary
- Crear una solicitud con archivo adjunto
- Verificar que se suba correctamente

### 4. Verificar Email
- Probar endpoint de notificación
- Verificar que llegue email

---

## 📝 DOCUMENTACIÓN DEL CAMBIO

Una vez completada la rotación:

1. **Registrar en bitácora**
   - Fecha: 23 de Enero de 2026
   - Acción: Rotación de credenciales comprometidas
   - Responsable: [Tu nombre]
   - Razón: Credenciales expuestas en historial Git

2. **Actualizar documentación interna**
   - Registrar nuevas credenciales en gestor de passwords seguro (1Password, LastPass, etc.)
   - NO versionar el archivo .env

3. **Notificar al equipo**
   - Informar que las sesiones fueron invalidadas
   - Pedir que hagan login nuevamente

---

## ⏰ TIEMPO ESTIMADO

- MongoDB Atlas: 5 minutos
- Cloudinary: 3 minutos
- Gmail: 5 minutos
- JWT Secret: 2 minutos
- Testing: 10 minutos

**Total: ~25 minutos**

---

## 🆘 SOPORTE

Si encuentras problemas durante la rotación:

1. **MongoDB no conecta:**
   - Verificar IP Whitelist en Atlas
   - Verificar formato del connection string
   - Verificar credenciales copiadas correctamente

2. **Cloudinary no sube archivos:**
   - Verificar que copiaste el nuevo API Secret completo
   - Revisar logs en Cloudinary Console

3. **Email no envía:**
   - Verificar que el App Password tenga 16 caracteres sin espacios
   - Verificar que 2FA esté habilitado en Gmail

4. **JWT tokens no funcionan:**
   - Reiniciar servidor después de cambiar JWT_SECRET
   - Limpiar localStorage en navegador (sesiones antiguas)

---

## ✅ CONFIRMACIÓN FINAL

Una vez completado TODO el checklist:

```bash
# Ejecutar verificación completa
npm run deploy:check

# Debe mostrar:
# ✅ Lint passed
# ✅ Tests passed
# ✅ Ready for deployment
```

---

**🔒 RECUERDA:** 
- NUNCA versionar archivo .env con Git
- Usar gestor de contraseñas para compartir credenciales con equipo
- Rotar credenciales periódicamente (cada 3-6 meses)
- Habilitar 2FA en todos los servicios

**Estado:** 🔴 PENDIENTE → ✅ COMPLETADO (después de checklist)
