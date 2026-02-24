# CHECKLIST POST-PURGA DE SECRETOS

**Fecha:** 24 de febrero de 2026  
**Repositorio:** Proyecto-Plataforma-Requerimientos  
**Motivo:** Se reescribió historial con `git filter-repo` y se publicó con `force push`.

---

## 1) Acciones inmediatas para todo el equipo

### Opción A (recomendada): clonar de nuevo
1. Respaldar cambios locales no publicados.
2. Eliminar copia local anterior.
3. Clonar nuevamente el repositorio desde GitHub.

### Opción B (avanzada): resincronizar copia actual
> Solo si no hay trabajo local pendiente.

```bash
git fetch origin --prune
git checkout main
git reset --hard origin/main
git clean -fd
```

### Verificación
```bash
git status
git log --oneline -n 5
```

---

## 2) Rotación obligatoria de credenciales

> La purga de historial reduce exposición pública, pero **no reemplaza** la rotación de secretos.

### 2.1 MongoDB Atlas
- Crear nuevo usuario técnico con contraseña fuerte.
- Revocar/eliminar usuario anterior comprometido.
- Actualizar `MONGODB_URI` en el `.env` del servidor.

### 2.2 Cloudinary
- Regenerar API Secret desde panel de seguridad.
- Actualizar variables de entorno asociadas.
- Revocar credenciales anteriores.

### 2.3 Correo (cuenta de envío)
- Revocar App Password anterior.
- Generar App Password nuevo.
- Actualizar `EMAIL_PASS` en variables seguras.

### 2.4 JWT
- Generar nuevo `JWT_SECRET` (mínimo 64 bytes aleatorios).
- Actualizar entorno productivo y reiniciar servicio.
- Comunicar invalidación de sesiones activas.

---

## 3) Endurecimiento de acceso

- Activar/validar 2FA en cuentas de infraestructura.
- Restringir IPs permitidas en servicios administrados.
- Revisar permisos mínimos (principio de menor privilegio).
- Confirmar que no existan secretos hardcodeados en código.

---

## 4) Validación técnica post-rotación

```bash
npm run smoke
```

Comprobar además:
- `/api/health` en estado OK.
- Login funcional con credenciales vigentes.
- Flujos críticos: Solicitudes, Asignación, Calendario.

---

## 5) Comunicación interna recomendada

Mensaje breve al equipo:
- Se reescribió historial y se forzó actualización remota.
- Nadie debe seguir trabajando sobre clones antiguos sin resincronizar.
- Fecha/hora de corte para alinear todas las ramas locales.

---

## 6) Cierre

Marcar este checklist como completado solo cuando:
- [ ] Todo el equipo resincronizó su repositorio.
- [ ] Todas las credenciales fueron rotadas y validadas.
- [ ] Smoke y verificación funcional resultaron OK.
