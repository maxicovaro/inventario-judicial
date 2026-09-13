---
name: Incidente del piloto
description: Registrar un incidente operativo, de seguridad, datos o disponibilidad del piloto
title: "[INCIDENTE] "
labels: []
assignees: []
---

> No incluir contraseñas, tokens, secretos, dumps, datos personales innecesarios ni cuerpos completos de requests.

## Severidad

- [ ] SEV-1
- [ ] SEV-2
- [ ] SEV-3

## Estado

- [ ] Detectado
- [ ] Contenido
- [ ] En diagnóstico
- [ ] En recuperación
- [ ] Recuperado
- [ ] Cerrado

## Detección

- Fecha/hora:
- Detectado por:
- Entorno:
- Oficina(s) afectada(s), a nivel agregado:
- Síntoma observable:
- Impacto conocido:

## Revisión y evidencia

- `DEPLOY_REVISION` / SHA desplegado:
- `/health/live`:
- `/health/ready`:
- Request ID(s) relevantes:
- Estado MySQL / migraciones, si corresponde:
- Último backup verificado relevante, si corresponde:

## Stop condition

- [ ] No aplica
- [ ] Flujo afectado detenido
- [ ] Escrituras detenidas
- [ ] Aplicación fuera de tráfico
- Motivo:

## Timeline

| Hora | Evento / decisión |
| --- | --- |
| | |

## Contención

Describir las medidas aplicadas y si son reversibles.

## Diagnóstico

- Causa raíz confirmada:
- Causa probable si todavía no está confirmada:
- Evidencia que sustenta la conclusión:

## Recuperación

- Acción ejecutada:
- Rollback / forward fix / restore:
- Backup/checksum usado, si corresponde:
- Autorización registrada, si corresponde:

## Validación antes de reabrir

- [ ] `/health/live` = 200
- [ ] `/health/ready` = 200
- [ ] Revisión esperada confirmada
- [ ] Login válido
- [ ] Permisos por rol/oficina validados
- [ ] Flujo afectado validado
- [ ] Invariantes de stock validadas, si corresponde
- [ ] `db:status` al día, si corresponde
- [ ] Backup/restore verificado, si corresponde

## Resultado

- Hora de recuperación:
- RPO real:
- RTO real:
- Impacto final:
- Restricciones que continúan vigentes:

## Acciones preventivas

- [ ] Acción convertida en issue/roadmap cuando corresponda
- Detalle:

## Cierre

- Fecha/hora de cierre:
- Incident Commander:
- Postmortem requerido: sí / no
- Enlace al postmortem o evidencia de cierre:
