# 🔧 GUÍA DE SOLUCIÓN DE PROBLEMAS - FENALCO

## 🆘 Problemas Comunes y Soluciones

---

## 1. Error: "Cannot find module './plugins/layouts'"

### ❌ Síntoma
```
Error: Cannot find module './plugins/layouts'
```

### ✅ Solución
En `tailwind.config.js`, actualizar las rutas de plugins:

**De:**
```javascript
require('./plugins/layouts')
require('./plugins/sidebar')
```

**A:**
```javascript
require('./plugins/layouts/layouts')
require('./plugins/layouts/sidebar')
```

### 📍 Ubicación
[tailwind.config.js](./tailwind.config.js#L70-L71)

---

## 2. Modales No Se Muestran

### ❌ Síntoma
- Click en botón pero modal no aparece
- Modal aparece pero está oculto

### ✅ Solución

**Opción A:** Verificar estado Alpine
```javascript
// En la consola del navegador:
console.log(document.$data); // Ver estado de Alpine
```

**Opción B:** Usar `x-show` en lugar de `x-if`
```html
<!-- Mejor para modales (siempre en DOM) -->
<div x-show="showNewRequestModal">...</div>

<!-- En lugar de -->
<template x-if="showNewRequestModal">...</template>
```

**Opción C:** Inicializar estado
```javascript
showNewRequestModal: false,  // Asegurarse de estar en init()
```

### 📍 Archivos relevantes
- [solicitudes.html](./src/pages/solicitudes.html#L175-L180)
- [modals.html](./src/components/modals.html)

---

## 3. API Calls No Funcionan

### ❌ Síntoma
- Error en red (404, 500)
- Response vacía
- CORS error

### ✅ Solución

**Verificar URL Base:**
```javascript
// En .env
VITE_API_BASE=http://localhost:5000/api

// En código
const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:5000/api';
```

**Verificar Token JWT:**
```javascript
// En localStorage
const token = localStorage.getItem('token');
console.log('Token:', token); // Debe ser string no-vacío

// En headers
headers: {
  'Authorization': `Bearer ${token}`
}
```

**Verificar CORS:**
```javascript
// server.js debe tener:
app.use(cors({
  origin: 'http://localhost:3000',
  credentials: true
}));
```

**Test del endpoint:**
```bash
# Desde terminal
curl -X GET http://localhost:5000/api/requests \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### 📍 Archivos relevantes
- [server.js](./server.js)
- [.env](./.env)

---

## 4. Colores Fenalco No Se Aplican

### ❌ Síntoma
- Botones muestran color por defecto
- Clases como `bg-fenalco-green` no funcionan
- Console sin errores

### ✅ Solución

**1. Regenerar CSS:**
```bash
npm run dev
# O manually rebuild Tailwind
npx tailwindcss -i ./src/input.css -o ./dist/output.css
```

**2. Verificar Tailwind config:**
```javascript
// tailwind.config.js debe tener:
theme: {
  extend: {
    colors: {
      'fenalco-green': '#00CE7C',
      'fenalco-blue': '#280071',
      // ... más colores
    }
  }
}
```

**3. Usar clases correctamente:**
```html
<!-- Correcto -->
<button class="bg-fenalco-green text-white">Guardar</button>

<!-- Incorrecto -->
<button style="background: fenalco-green">Guardar</button>
<button class="bg-[#00CE7C]">Guardar</button>
```

**4. Verificar en DevTools:**
```html
<!-- Inspeccionar elemento y ver estilos aplicados -->
<!-- Los colores deben definirse en :root -->
```

### 📍 Archivos relevantes
- [tailwind.config.js](./tailwind.config.js#L15-L45)
- [vite.config.js](./vite.config.js)

---

## 5. DataTable No Filtra

### ❌ Síntoma
- Búsqueda sin resultados
- Ordenamiento no funciona
- Paginación error

### ✅ Solución

**Verificar estructura de datos:**
```javascript
// Los datos deben tener estructura correcta
[
  { 
    id: 1, 
    name: 'Item', 
    email: 'test@example.com' 
  }
]

// Y headers coincidir:
headers: ['ID', 'Name', 'Email']
```

**Verificar Alpine binding:**
```html
<div x-data="dataTable()">
  <!-- x-model vinculado -->
  <input x-model="searchTerm" @input="filterData()">
</div>
```

**Inicializar datos:**
```javascript
async init() {
  await this.loadData(); // Cargar antes de filtrar
}
```

### 📍 Archivos relevantes
- [datatable.html](./src/components/datatable.html#L120-L160)

---

## 6. Formularios No Se Envían

### ❌ Síntoma
- Click en botón Guardar sin efecto
- Datos no se envían a API
- Modal no se cierra

### ✅ Solución

**Verificar tipo de botón:**
```html
<!-- Correcto: type="submit" en formularios -->
<form @submit.prevent="handleSubmit">
  <input type="text" x-model="formData.name">
  <button type="submit">Guardar</button>
</form>

<!-- O usar @click directamente -->
<button @click="handleSubmit()">Guardar</button>
```

**Validar datos antes de enviar:**
```javascript
handleSubmit() {
  if (!this.formData.name) {
    alert('El nombre es requerido');
    return;
  }
  // Enviar a API
}
```

**Verificar que el modal cierre:**
```javascript
async addNewRequest() {
  // ... API call ...
  this.showNewRequestModal = false; // Cerrar modal
}
```

### 📍 Archivos relevantes
- [modals.html](./src/components/modals.html#L15-L50)
- [forms.html](./src/components/forms.html)

---

## 7. Notificaciones (Toast) No Aparecen

### ❌ Síntoma
- No aparecen mensajes de éxito/error
- `showToast()` devuelve error

### ✅ Solución

**1. Toast está en el DOM:**
```html
<!-- En app.html o página principal -->
{{> toast }}
<!-- O incluir componente directamente -->
```

**2. Función disponible global:**
```javascript
// En toast.html, init() debe exponer:
window.showToast = (message, type, title) => {
  this.toast(message, type, title);
};
```

**3. Usar correctamente:**
```javascript
// Correcto
showToast('Solicitud creada', 'success', '✅ Éxito');

// Con tipos: 'success', 'error', 'warning', 'info'
showToast('Error al guardar', 'error', '❌ Error');
```

**4. Test en consola:**
```javascript
// Abrir DevTools Console y ejecutar:
window.showToast('Test', 'info', 'Prueba');
```

### 📍 Archivos relevantes
- [toast.html](./src/components/toast.html#L100-L130)

---

## 8. Responsive Design Roto

### ❌ Síntoma
- Diseño se ve mal en mobile
- Elementos solapados
- Scrollbars excesivos

### ✅ Solución

**1. Verificar meta tags:**
```html
<!-- En <head> debe existir: -->
<meta name="viewport" content="width=device-width, initial-scale=1.0">
```

**2. Usar clases Tailwind correctas:**
```html
<!-- Correcto: mobile-first -->
<div class="w-full md:w-1/2 lg:w-1/3">
  Contenido responsive
</div>

<!-- Incorrecto: tamaño fijo -->
<div style="width: 800px">...</div>
```

**3. Probar en DevTools:**
```
F12 → Toggle device toolbar (Ctrl+Shift+M)
```

### 📍 Archivos relevantes
- [app.html](./app.html#L1-L10)
- [vite.config.js](./vite.config.js)

---

## 9. Base de Datos Desconectada

### ❌ Síntoma
- Error: "MongoDB connection failed"
- Usuarios no cargan
- API retorna 500

### ✅ Solución

**1. Verificar URI MongoDB:**
```env
# En .env
MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/dbname
```

**2. Probar conexión:**
```bash
node test-mongo.js
```

**3. Verificar credenciales:**
- Usuario correcto
- Contraseña correcta (sin caracteres especiales sin encoding)
- IP whitelist en MongoDB Atlas (agregar 0.0.0.0/0 para desarrollo)

**4. Reiniciar servidor:**
```bash
npm run dev
```

### 📍 Archivos relevantes
- [.env](./.env)
- [server.js](./server.js#L20-L35)

---

## 10. Vite Dev Server No Inicia

### ❌ Síntoma
- Error al ejecutar `npm run dev-frontend`
- Puerto 3000 en uso
- "Module not found" errors

### ✅ Solución

**1. Limpiar e reinstalar:**
```bash
rm -r node_modules package-lock.json
npm install
npm run dev-frontend
```

**2. Cambiar puerto:**
```bash
# Terminal
npm run dev-frontend -- --port 3001

# O en vite.config.js:
export default {
  server: {
    port: 3001
  }
}
```

**3. Verificar proceso activo:**
```bash
# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue

# Matar proceso si existe:
Stop-Process -Id PID -Force
```

### 📍 Archivos relevantes
- [vite.config.js](./vite.config.js)
- [package.json](./package.json#L10-L15)

---

## 🛠️ Herramientas de Debug

### Verificar Integración
```bash
node verify-integration.js
```

### Test API
```bash
node test-all-endpoints.js
```

### Test MongoDB
```bash
node test-mongo.js
```

### Poblar Datos de Prueba
```bash
npm run seed
```

---

## 📞 Contacto y Soporte

### Si ninguna solución funciona:

1. **Revisar logs:**
  - Terminal Backend: `npm run dev`
   - Terminal Frontend: `npm run dev-frontend`
   - DevTools Console: F12 → Console

2. **Verificar archivos:**
  - `README.md` - Guía general
  - `QUICK-START.md` - Inicio rápido
  - `DEPLOYMENT.md` - Proceso de despliegue

3. **Revisar estado:**
   ```bash
   node verify-integration.js
   ```

---

**Última actualización:** 2025  
**Versión:** 3.0.0

