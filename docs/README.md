# Documentación — Inventario Judicial

Este directorio centraliza la documentación viva del proyecto. El objetivo es que la continuidad no dependa de conversaciones, memoria personal ni PRs históricos aislados.

## Fuente de verdad

Antes de modificar el proyecto, leer también `../AGENTS.md`. Ese archivo define la metodología obligatoria de trabajo: reconstrucción repo-first, apertura/cierre de bloques, pruebas, PR/CI, staging, documentación y superbloques.

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
- checklist previo a migración/deploy;
- enlace operativo a P9.1.

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

### 7. Rendimiento y escalabilidad

`PERFORMANCE.md`

Contiene:
- metodología reproducible de P8;
- dataset sintético de 6000 activos + 300 insumos;
- baseline API p50/p95/p99 y payloads;
- baseline de bundle frontend;
- presupuestos objetivo y techos duros;
- artifacts de Quality Gate;
- perfilado, paginación, payloads, frontend, carga y continuidad P8.

### 8. Cierre P8 y gate de piloto

`P8_CLOSURE.md`

Contiene:
- consolidación de P8.0–P8.6;
- evidencia de Railway staging y revisión desplegada;
- gate operativo P8.7 (`preflight`, estado de migraciones, backup verificado y smoke externo);
- desviación operativa registrada del orden de backup/deployment;
- criterios GO de piloto;
- umbrales SEV-1/SEV-2;
- observabilidad mínima y límites conocidos;
- condición exacta para habilitar P9.

Complemento específico de P8.6: `P8_6_CLOSURE.md`.

### 9. P9.1 — Soporte e incident response del piloto

`P9_1_INCIDENT_RESPONSE.md`

Contiene:
- roles operativos e Incident Commander;
- clasificación SEV-1/SEV-2/SEV-3;
- objetivos de reconocimiento y actualización;
- stop conditions;
- ciclo detectar → contener → evidenciar → diagnosticar → recuperar → validar → cerrar;
- guardas que impiden debilitar seguridad, permisos, MFA, locks o idempotencia;
- evidencia mínima y plantilla de incidente;
- MTTA/MTTR, RPO/RTO y métricas de soporte;
- tabletop exercise previo a ampliar el piloto;
- criterios de cierre de P9.1.

Plantilla operativa: `../.github/ISSUE_TEMPLATE/incident.md`.

### 10. P9.2 — Alta controlada + Depósito Central

`P9_2_CONTROLLED_ONBOARDING.md`

Contiene:
- selección y aprobación explícita de la primera ola;
- manifiesto privado excluido de Git;
- preflight y verificación read-only;
- prohibición de crear `ADMIN` desde el manifiesto;
- control de MFA de administradores en staging;
- alta real únicamente desde Gestión de Usuarios;
- rollback mediante desactivación y conservación de bitácora;
- **P9.2A: separación entre Área Contable y Depósito Central**;
- `Área Contable` como oficina normal con sus propios activos/insumos;
- `Depósito` como ubicación institucional independiente;
- capacidad explícita `gestiona_deposito` sin elevar al responsable a `ADMIN`;
- múltiples `RESPONSABLE` de Contable con cuentas individuales;
- trazabilidad por empleado mediante `usuario_id`;
- auditoría operativa limitada al Depósito Central;
- superficie `/api/deposito/*` y pantallas `/deposito-central/*`;
- ingreso, custodia y traslado de activos;
- stock central con entradas trazables y distribución transaccional;
- gestión de solicitudes y pedidos institucionales;
- primera ola funcional prevista `Área Contable + Área Informática`;
- tests negativos para impedir gestión de depósito desde una oficina común o un usuario sin rol suficiente.

Cierre formal de P9.2A: `P9_2A_CLOSURE.md`.

Cierre y evidencia de la primera ola P9.2B: `P9_2B_FIRST_WAVE.md`.

Ejemplo sintético de onboarding: `../pilot/wave.example.json`.

### 11. P9.3 — Procedimiento operativo de administración

`P9_3_ADMIN_PROCEDURE.md`

Contiene:
- matriz operativa por rol/capacidad;
- gestión segura de usuarios;
- altas, edición, traslados y bajas patrimoniales;
- stock central y stock por oficina;
- movimientos y ajustes;
- solicitudes y pedidos mensuales/complementarios;
- adjuntos y límites de carga;
- backups y tareas rutinarias;
- checklist diario/semanal;
- condiciones de stop;
- evidencia de revisión operativa real en staging y criterios de cierre P9.3.

### 12. P9.4 — Indicadores reales del piloto

`P9_4_PILOT_INDICATORS.md`

Contiene:
- fuentes reales de indicadores del piloto;
- snapshot read-only de MySQL y `/data`;
- uso por oficina y flujo;
- auth/MFA/permisos;
- errores y latencia desde Railway;
- recursos backend/MySQL;
- crecimiento de almacenamiento;
- observabilidad de idempotencia;
- relación con P8 y P9.1;
- criterios de cierre P9.4.

### 13. P9.5 — Backup y recuperación periódica del piloto

`P9_5_PILOT_BACKUP_RECOVERY.md`

Contiene:
- backup lógico periódico con checksum;
- retención del piloto;
- segunda capa de backup fuera del runtime primario;
- restore drill sobre base alternativa;
- comparación exacta de tablas/conteos;
- medición de RPO/RTO;
- programación prevista en Railway;
- stop conditions y criterios de cierre P9.5.

### 14. P9.6 — Criterios de salida del piloto

`P9_6_EXIT_CRITERIA.md`

Contiene:
- gate técnico de salida reproducible;
- estabilidad, seguridad, integridad, adopción, capacidad operativa y rendimiento;
- umbrales bloqueantes;
- separación entre elegibilidad técnica y aprobación institucional;
- evidencia real requerida;
- guardas que impiden desplegar producción desde el gate;
- criterios de cierre P9.6.

## Evidencia técnica

La documentación anterior define el estado consolidado. La evidencia detallada de que un cambio fue implementado/validado vive en:
- commits;
- Pull Requests;
- GitHub Actions / Quality Gate;
- artifacts de rendimiento;
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
7. Para P8, leer `PERFORMANCE.md`, `P8_6_CLOSURE.md` y `P8_CLOSURE.md`.
8. Para P9.1/incidentes, leer `P9_1_INCIDENT_RESPONSE.md` y la plantilla versionada.
9. Para P9.2/onboarding y Depósito Central, leer `P9_2_CONTROLLED_ONBOARDING.md`; para la primera ola y su cierre, leer `P9_2B_FIRST_WAVE.md`.
10. Para P9.3/operación administrativa, leer `P9_3_ADMIN_PROCEDURE.md` y `OPERATIONS.md`.
11. Para P9.4/indicadores del piloto, leer `P9_4_PILOT_INDICATORS.md`, `PERFORMANCE.md` y `P9_1_INCIDENT_RESPONSE.md`.
12. Para P9.5/backup periódico y recovery, leer `P9_5_PILOT_BACKUP_RECOVERY.md`, `OPERATIONS.md` y `RAILWAY_STAGING.md`.
13. Para P9.6/gate de salida, leer `P9_6_EXIT_CRITERIA.md`, P9.1, P9.4, P9.5 y P8.
14. Verificar el último Quality Gate antes de modificar/integrar.

## Regla de actualización

Actualizar documentación cuando ocurra cualquiera de estos eventos:
- se cierra o abre un bloque de roadmap;
- se mergea una iniciativa grande;
- cambia un contrato global de autenticación/autorización;
- cambia la arquitectura UI global;
- se agrega una migración relevante;
- cambia staging/producción/infraestructura;
- cambia un presupuesto o metodología de rendimiento;
- un incidente genera una acción preventiva;
- se toma una decisión técnica que afectará futuros módulos.

No documentar secretos, credenciales, tokens, dumps ni datos personales reales.
