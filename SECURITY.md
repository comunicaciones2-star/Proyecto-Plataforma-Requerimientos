# 🔒 GUÍA DE SEGURIDAD - FENALCO PLATAFORMA

## ⚠️ URGENTE: ANTES DE DEPLOYMENT

### 1. Rotar Credenciales Expuestas

**CRÍTICO:** Las siguientes credenciales están comprometidas en el historial de Git y deben rotarse:

#### MongoDB Atlas
```bash
Usuario actual: comunicaciones2_db_user
Contraseña actual: 0h0TrLEeUj2jjGMz
```
**Acción:** 
- Ir a MongoDB Atlas → Database Access
- Eliminar usuario actual
- Crear nuevo usuario con contraseña fuerte
- Actualizar MONGODB_URI en .env

#### Cloudinary
```bash
Cloud Name: dey3dq8ak
API Key: 649871449998545
API Secret: A1CQJ0jmNb5FlPWkEWWgO72r13I
```
**Acción:**
- Ir a Cloudinary Dashboard → Settings → Security
- Reset API Secret
- Actualizar credenciales en .env

#### Email (Gmail)
```bash
Email: comunicaciones2@fenalcosantander.com.co
App Password: comercio122024
```
**Acción:**
- Revocar App Password actual en Google Account
- Generar nuevo App Password
- Actualizar EMAIL_PASS en .env

#### JWT Secret
```bash
JWT_SECRET actual: F3n4lc0_S4nt4nd3r_Pl4tf0rm4_2026_JWT_SECURE_KEY
```
**Acción:**
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```
- Copiar resultado y actualizar JWT_SECRET en .env
- **NOTA:** Esto invalidará todas las sesiones activas

---

## ✅ MEJORAS DE SEGURIDAD IMPLEMENTADAS

### 1. Headers HTTP Seguros (Helmet)
✅ Content Security Policy (CSP)
✅ X-Frame-Options (clickjacking protection)
✅ X-Content-Type-Options
✅ Strict-Transport-Security (HSTS)

### 2. Rate Limiting
✅ Login: 5 intentos por 15 minutos
✅ Registro: 3 intentos por hora
✅ Prevención de fuerza bruta

### 3. Sanitización de Inputs
✅ express-mongo-sanitize contra NoSQL injection
✅ Validación de longitud de contraseña (mínimo 6)
✅ Validación de campos obligatorios

### 4. Logging Seguro
✅ Winston para logging estructurado
✅ No logs de contraseñas
✅ Logs de intentos fallidos de login
✅ Separación de logs (error.log, combined.log)

### 5. Autorización Granular
✅ Validación de roles en endpoints
✅ Colaboradores solo ven sus solicitudes
✅ Solo admin/manager pueden completar tareas
✅ Middleware authorize() con roles específicos

### 6. Base de Datos
✅ Índices para optimizar queries
✅ Contraseñas hasheadas con bcrypt (salt 10)
✅ Campo password con select: false por defecto
✅ Método comparePassword() en modelo User

---

## 📋 CHECKLIST PRE-PRODUCCIÓN

### Seguridad
- [ ] Rotar TODAS las credenciales comprometidas
- [ ] Generar JWT_SECRET fuerte de 64 bytes
- [ ] Habilitar 2FA en MongoDB Atlas
- [ ] Configurar IP Whitelist en MongoDB Atlas
- [ ] Revocar acceso público de Cloudinary si no es necesario
- [ ] Configurar CORS solo para dominios de producción

### Configuración
- [ ] `NODE_ENV=production` en servidor
- [ ] Deshabilitar stack traces en producción
- [ ] Configurar SSL/TLS (HTTPS)
- [ ] Configurar subdomain para API (api.fenalco.com)

### Monitoring
- [ ] Configurar alertas de MongoDB Atlas
- [ ] Monitorear logs de error.log
- [ ] Configurar backup automático de MongoDB
- [ ] Implementar health checks

---

## 🔐 MEJORES PRÁCTICAS IMPLEMENTADAS

### Variables de Entorno
```bash
# ✅ CORRECTO
.env está en .gitignore
.env.example sin credenciales reales

# ❌ EVITAR
Hardcodear credenciales en código
Versionar archivo .env con Git
```

### Contraseñas
```javascript
// ✅ CORRECTO
await bcrypt.hash(password, 10);
await user.comparePassword(candidatePassword);

// ❌ EVITAR
Comparar contraseñas en texto plano
Usar salt rounds < 10
```

### Tokens JWT
```javascript
// ✅ CORRECTO
jwt.sign(payload, secret, { expiresIn: '7d' });
jwt.verify(token, secret);

// ❌ EVITAR
Tokens sin expiración
Secrets débiles o predecibles
```

### Logging
```javascript
// ✅ CORRECTO
logger.info('Login exitoso', { email, role });
logger.error('Error', { message: err.message });

// ❌ EVITAR
console.log('Password:', password);
Logs con información sensible
```

---

## 🚨 VULNERABILIDADES COMUNES A EVITAR

### SQL/NoSQL Injection
```javascript
// ✅ CORRECTO (mongoose + sanitize)
User.findOne({ email: req.body.email });

// ❌ VULNERABLE
db.collection.find({ $where: req.body.query });
```

### XSS (Cross-Site Scripting)
```javascript
// ✅ CORRECTO
// Usar frameworks con escape automático (AlpineJS, React)
// Validar y sanitizar inputs

// ❌ VULNERABLE
element.innerHTML = userInput;
```

### CSRF (Cross-Site Request Forgery)
```javascript
// ✅ CORRECTO
// Usar tokens JWT en headers
// Verificar origin en CORS

// ❌ VULNERABLE
// Autenticación solo con cookies
// CORS con origin: '*'
```

---

## 📞 CONTACTO EN CASO DE INCIDENTE

**Responsable de Seguridad:** [Nombre]
**Email:** seguridad@fenalcosantander.com.co
**Teléfono:** [Número]

### Proceso de Respuesta a Incidentes

1. **Detectar:** Monitorear logs y alertas
2. **Contener:** Revocar credenciales comprometidas
3. **Erradicar:** Rotar secrets y actualizar código
4. **Recuperar:** Restaurar desde backup si es necesario
5. **Lecciones:** Documentar y prevenir recurrencia

---

## 📚 RECURSOS ADICIONALES

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [MongoDB Security Checklist](https://docs.mongodb.com/manual/administration/security-checklist/)

---

**Última actualización:** 23 de enero de 2026
**Versión:** 1.0
