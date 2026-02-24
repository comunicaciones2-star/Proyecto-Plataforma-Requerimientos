# Informe Técnico de Hardening y Puesta a Punto

**Proyecto:** Plataforma de Gestión de Requerimientos de Diseño (Fenalco)  
**Fecha:** 24-02-2026  
**Objetivo:** dejar la base técnica en estado "verde" mínimo para operación controlada, aplicando seguridad esencial, logging centralizado, actualización de dependencias críticas y smoke tests consistentes.

---

## 1) Alcance realizado

Se implementó un paquete mínimo de hardening técnico con estos frentes:

1. **Seguridad HTTP y sanitización global** en servidor.
2. **Logger central** con Winston (archivo + consola en desarrollo).
3. **Actualización de dependencias críticas** con vulnerabilidades altas.
4. **Normalización de smoke tests** para evitar falsos negativos.
5. **Revalidación técnica integral** (build + smoke general + smoke de cola + audit runtime).

---

## 2) Cambios de código aplicados

## 2.1 Seguridad global del servidor

**Archivo:** `server.js`

Se agregaron y activaron middlewares de seguridad:

- `helmet` para headers de seguridad.
- `express-mongo-sanitize` para mitigación de inyección NoSQL.

Configuración aplicada:

- `contentSecurityPolicy: false` (en este paso mínimo, para evitar ruptura inmediata con scripts/estáticos existentes).
- `crossOriginEmbedderPolicy: false`.

Además:

- Se reemplazaron `console.*` por logger central en:
  - arranque,
  - conexión de MongoDB,
  - errores de servidor,
  - errores no capturados (`uncaughtException`, `unhandledRejection`),
  - request logging en desarrollo.

---

## 2.2 Logger centralizado

**Archivo nuevo:** `utils/logger.js`

Se creó logger con Winston con estas características:

- Formato JSON con `timestamp` + `errors({ stack: true })`.
- Transportes a archivo:
  - `logs/error.log` (nivel `error`)
  - `logs/combined.log` (todos los niveles)
- Transporte de consola en desarrollo con formato legible.
- Exposición global vía `global.logger` desde `server.js` para compatibilidad con rutas existentes.

---

## 2.3 Dependencias críticas actualizadas

**Archivo:** `package.json`

### Dependencias agregadas

- `helmet`
- `express-mongo-sanitize`
- `winston`

### Dependencias actualizadas (seguridad)

- `cloudinary` → `^2.9.0`
- `jsonwebtoken` → `^9.0.3`
- `nodemailer` → `^8.0.1`

> Nota: en intento inicial se probó `nodemailer@^7.0.14`, pero esa versión no existe en npm; se corrigió a `^8.0.1`.

---

## 2.4 Ajuste de defaults de smoke test

**Archivo:** `scripts/smoke-test.js`

Se actualizaron credenciales por defecto para alinear con cuentas activas del entorno:

- Email default: `comunicaciones2@fenalcosantander.com.co`
- Password default: `password123`

Objetivo: evitar falsos fallos por defaults antiguos (`admin@...`, `admin123456`).

---

## 2.5 Robustez del smoke de cola

**Archivo:** `scripts/smoke-queue.js`

Se corrigió la selección del ticket a validar en `queue/tickets/:id/position`:

- Antes: tomaba primer ticket de `/requests` (podía no pertenecer al usuario y devolver 403 válido).
- Ahora: prioriza ticket de `asRequester` obtenido desde `/queue/my`.

Resultado: elimina falsos negativos y mantiene validación real de permisos.

---

## 3) Validaciones ejecutadas

Se ejecutaron pruebas técnicas posteriores a cambios:

1. `npm run build`  
   **Resultado:** OK

2. `npm run smoke`  
   **Resultado:** OK (7/7)

3. `npm run smoke:queue`  
   **Resultado final:** OK (8/8)

4. `npm audit --omit=dev --json`  
   **Resultado:** sin vulnerabilidades `high/critical`; queda **1 low** transitoria (`qs`).

5. Verificación sintáctica/diagnóstico de archivos cambiados  
   **Resultado:** sin errores nuevos en backend.

---

## 4) Estado de riesgo técnico tras intervención

## 4.1 Mejoras logradas

- Hardening mínimo activado en runtime.
- Trazabilidad operativa centralizada por logs.
- Reducción sustancial de riesgo de dependencias críticas.
- Pruebas automáticas funcionales estables para core y cola.

## 4.2 Riesgo residual actual

- 1 vulnerabilidad **low** en dependencia transitiva (`qs`) pendiente de remediación posterior.
- `NODE_ENV` del entorno local sigue en `development` (normal en local; para producción debe ir `production`).
- CSP está desactivada en este paso mínimo para evitar disrupciones; conviene endurecerla en una fase siguiente.

---

## 5) Recomendación operativa

Con este paquete mínimo, la plataforma queda en condiciones de:

- **Piloto controlado interno:** ✅ recomendable.
- **Go-live masivo externo inmediato:** ⚠️ recomendable solo tras hardening de segunda capa (CSP estricta, revisión de headers finos, cierre total de pendientes de seguridad y runbook operativo completo).

---

## 6) Archivos afectados en este ciclo

- `server.js`
- `package.json`
- `scripts/smoke-test.js`
- `scripts/smoke-queue.js`
- `utils/logger.js` *(nuevo)*

---

## 7) Próximos pasos sugeridos (fase 2)

1. Activar CSP estricta por rutas/recursos permitidos.
2. Enforzar `NODE_ENV=production` en ambiente productivo.
3. Resolver vulnerabilidad low restante (`qs`) en ventana de mantenimiento.
4. Documentar runbook de incidentes y monitoreo con alertas.
5. Ejecutar UAT final por perfiles (solicitante, ejecutor, admin).

---

**Fin del informe.**
