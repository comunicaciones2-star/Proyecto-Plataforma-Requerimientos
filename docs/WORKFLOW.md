# Workflow de estados y ownership

## Estados válidos
- pending
- in-process
- review
- completed
- rejected

## Reglas implementadas en `PATCH /api/requests/:id`
- Ejecutores asignados / manager / admin:
  - pending -> in-process
  - in-process -> review
- Owner (solicitante) o admin:
  - review -> completed
  - review -> rejected
- Admin puede forzar cualquier transición (se deja nota en logs).
- Para `in-process -> review` se exige al menos 1 entregable en `deliveryLinks`.

## Pruebas manuales (6 casos)
1. executor: pending->in-process OK
2. executor: in-process->review sin entregable => 400
3. executor: in-process->review con entregable => OK
4. solicitante: review->completed OK
5. no-owner: review->completed => 403
6. solicitante: pending->completed => 400
