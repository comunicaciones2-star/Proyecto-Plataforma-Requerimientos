# ACTA DE SALIDA GO/NO-GO

**Proyecto:** Plataforma de Requerimientos de Diseño  
**Fecha:** 24 de febrero de 2026  
**Ambiente evaluado:** Desarrollo / Preproducción operativa  
**Responsable técnico:** Equipo Comunicaciones TI

## 1) Objetivo
Validar estado funcional y operativo de la plataforma para decisión de salida controlada.

## 2) Alcance validado
- Módulo **Solicitudes**
  - Creación, edición, visualización y eliminación.
  - Corrección aplicada: persistencia de campos esenciales por categoría en edición (incluye `Acabados` en `pieza_impresa`).
- Módulo **Asignación**
  - Flujo y nomenclatura UI ajustada a concepto funcional: `Nuevo Ejecutor`.
- Módulo **Calendario**
  - Vistas `Hoy`, `Semana`, `Mes`.
  - Navegación temporal y selección de día verificadas visualmente.
- Validaciones técnicas complementarias
  - Verificación API de persistencia post-edición (caso `Acabados`) satisfactoria.

## 3) Evidencia técnica relevante
- Commit funcional publicado en `main`: **5b2f418**.
- Cambios funcionales incluidos:
  - Persistencia de `categoryDetails` en edición de solicitudes.
  - Envío de campos extendidos desde frontend en `updateRequest`.
  - Renombre de UI: `Nueva Asignación` → `Nuevo Ejecutor`.

## 4) Resultado de pruebas
- **Solicitudes:** OK
- **Asignación:** OK
- **Calendario:** OK

## 5) Riesgos residuales (no bloqueantes para salida controlada)
- Existen documentos de informe/soporte fuera del commit funcional (administrativo, no funcional).
- Se recomienda continuar monitoreo de logs y smoke diario durante la primera semana post salida.

## 6) Decisión
## **GO (Salida controlada aprobada)**
Se autoriza avance operativo bajo monitoreo reforzado y checklist diario de salud.

## 7) Acciones post-salida recomendadas (24-72h)
1. Ejecutar `npm run smoke` al inicio y cierre de jornada.
2. Monitorear `/api/health` y logs de errores críticos.
3. Confirmar estabilidad de edición en solicitudes de tipo `pieza_impresa` con usuarios clave.
4. Registrar incidencias en bitácora única para priorización semanal.

---
**Estado final:** Aprobado para salida controlada.
