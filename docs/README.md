# Documentación — Inventario Judicial

Este directorio centraliza la documentación viva del proyecto. El objetivo es que la continuidad no dependa de conversaciones, memoria personal ni PRs históricos aislados.

## Fuente de verdad

### 1. Estado y próximos pasos

`../ROADMAP.md`

Contiene:
- estado ejecutivo de P0–P9;
- estado del frontend A–E;
- bloque activo;
- orden de integración;
- deuda técnica diferida;
- regla exacta de continuidad.

Si alguien necesita saber **“qué está terminado y qué sigue”**, debe empezar por `ROADMAP.md`.

### 2. Frontend / UX / Design System

`frontend-design-system.md`

Contiene:
- principios visuales;
- arquitectura CSS/UI;
- componentes reutilizables;
- accesibilidad;
- responsive;
- AppShell/sidebar;
- cobertura de Bloques A–E;
- decisiones del refresh inspirado en Admina;
- deuda visual deliberadamente diferida.

### 3. Backend / seguridad

`backend-security-architecture.md`

Contiene:
- roles y autorización;
- sesiones/JWT;
- P6 concurrencia/idempotencia;
- P6.1 cookie HttpOnly + `/auth/me`;
- CORS/origin/rate limiting;
- MFA/TOTP y recuperación;
- migraciones de seguridad;
- requisitos de validación antes de staging.

### 4. Operación, backup y recuperación

`OPERATIONS.md`

Contiene:
- RPO/RTO;
- backup/checksum;
- restore seguro;
- health checks;
- Request ID/logging;
- shutdown;
- clasificación de incidentes;
- recuperación y rollback;
- checklist previo a migración/deploy.

### 5. Staging y despliegue

`STAGING.md`

Contiene:
- contrato production-like de staging;
- separación de MySQL y secretos;
- HTTPS/CORS/cookie y topología de proxy;
- preflight bloqueante;
- migración protegida por backup verificado;
- smoke tests post-deploy;
- procedimiento de rollback;
- evidencia requerida para cerrar P7.

### 6. Railway staging — implementación P7.2

`RAILWAY_STAGING.md`

Contiene:
- topología concreta `frontend` / `backend` / `mysql`;
- backend y MySQL privados;
- frontend público con Caddy y proxy same-origin;
- Reference Variables Railway;
- Volume `/data` para uploads/backups;
- variables exactas de staging;
- comandos `railway ssh` para preflight, backup, migración y smoke;
- persistencia de adjuntos;
- rollback y evidencia de cierre de P7.2.

## Evidencia técnica

La documentación anterior define el estado consolidado. La evidencia detallada de que un cambio fue implementado/validado vive en:
- commits;
- Pull Requests;
- GitHub Actions / Quality Gate;
- pruebas E2E e integración del repositorio.

Los PRs no sustituyen la hoja de ruta: una vez cerrado un bloque, `ROADMAP.md` debe reflejarlo.

## Orden recomendado de lectura

Para retomar el proyecto después de una pausa:

1. `ROADMAP.md`.
2. Revisar el PR activo indicado allí.
3. Leer el documento técnico del frente afectado.
4. Consultar `OPERATIONS.md` si hay base de datos, despliegue o incidente involucrado.
5. Para P7/staging, consultar `STAGING.md`.
6. Si el proveedor activo es Railway, leer también `RAILWAY_STAGING.md`.
7. Verificar último Quality Gate antes de modificar/integrar.

## Regla de actualización

Actualizar documentación cuando ocurra cualquiera de estos eventos:
- se cierra o abre un bloque de roadmap;
- se mergea una iniciativa grande;
- cambia un contrato global de autenticación/autorización;
- cambia la arquitectura UI global;
- se agrega una migración relevante;
- cambia staging/producción/infraestructura;
- un incidente genera una acción preventiva;
- se toma una decisión técnica que afectará futuros módulos.

No documentar secretos, credenciales, tokens, dumps ni datos personales reales.
