# 🚀 GUÍA RÁPIDA DE INICIO - Fenalco Plataforma

## 1️⃣ Verificar Instalación
```bash
node --version  # Debe ser >= 16.0.0
npm --version   # Debe ser >= 8.0.0
```

## 2️⃣ Configurar MongoDB Local
```bash
# Windows - En PowerShell (ejecutar como admin)
# Si tienes MongoDB instalado:
mongod

# O con Docker:
docker run -d -p 27017:27017 --name mongodb mongo:latest
```

## 3️⃣ Configurar Variables de Entorno
El archivo `.env` ya está configurado con tus credenciales reales.
Si necesitas cambiar algo:
```bash
cp .env.example .env
# Edita .env con tus valores
```

## 4️⃣ Iniciar el Servidor

### Desarrollo (con auto-reload):
```bash
npm run dev
```

### Producción:
```bash
npm start
```

El servidor estará en: **http://localhost:5000**

## 5️⃣ Poblar BD con Datos de Prueba
```bash
npm run seed
```

## 📦 Dependencias Instaladas
✅ express (servidor web)
✅ mongoose (base de datos)
✅ jsonwebtoken (autenticación)
✅ bcryptjs (contraseñas)
✅ nodemailer (emails)
✅ cloudinary (imágenes)
✅ ws (websockets)
✅ cors (seguridad)

## ✅ Verificación Rápida

Después de `npm run dev`, abre en el navegador:
- **API Test**: http://localhost:5000/api/health
- **Frontend**: http://localhost:5000

## 🔐 Credenciales Actuales en .env
- **Email**: comunicaciones2@fenalcosantander.com.co
- **MongoDB**: Atlas (MongoDB+SRV)
- **Cloudinary**: Configurado
- **JWT**: Activo

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
rm -r node_modules package-lock.json
npm install --legacy-peer-deps
```

## 📞 Soporte
- Ver README.md para documentación completa
- Revisar logs en la consola
- Verificar .env está correcto

---
**Estado**: ✅ Proyecto limpio y listo para desarrollo
**Fecha**: 8 de enero de 2026
