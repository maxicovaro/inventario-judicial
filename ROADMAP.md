# Hoja de ruta técnica — Inventario Judicial

> **Fuente principal de continuidad del proyecto.**
>
> Actualizada al 13/09/2026 después del cierre técnico de **P8.3 — Payloads, uploads y reportes**. El bloque activo pasa a ser **P8.4 — Rendimiento frontend**.

Cada bloque se trabaja en rama propia, con commits identificables, PR, Quality Gate, evidencia técnica y actualización documental antes de considerarse cerrado.

## Estado ejecutivo

| Frente | Estado | Evidencia / continuidad |
| --- | --- | --- |
| P0 Integridad funcional crítica | ✅ Completo | Mantener regresiones |
| P1 Base técnica y calidad | ✅ Completo | Quality Gate obligatorio |
| P2 Autorización e historial | ✅ Completo | Mantener tests negativos |
| P3 Resiliencia y recuperación | ✅ Completo | Backup/restore + runbooks |
| P4 Integración MySQL | ✅ Completo | Se ejecuta en CI |
| P5 E2E y regresiones | ✅ Completo | Chromium en Quality Gate |
| P6 Concurrencia/idempotencia | ✅ Completo | Suite P6 en Quality Gate |
| P6.1 Seguridad pre-staging | ✅ Completo | PR #13; Gate post-merge #151/#153 |
| Frontend Bloques A–E | ✅ Completo | PR #11; merge `0cb1f528...` |
| P7.1 Contrato/guardas staging | ✅ Completo | PR #20; Gate #158/#159 |
| P7.2 Staging real | ✅ Completo | PR #22; merge `6872095e...`; Gate #168 |
| P8.0 Baseline y metodología | ✅ Completo | PR #24; Gate #172/#174 |
| P8.1 Perfilado backend/MySQL | ✅ Completo | PR #25; perfil inicial Gate #175 |
| P8.2 Índices, queries y paginación | ✅ Completo | PR #26; Gate de implementación #184 |
| P8.3 Payloads, uploads y reportes | ✅ Completo | PR #27; Gate de implementación #201 |
| **P8.4 Rendimiento frontend** | 🟡 **Activo** | Siguiente bloque autorizado |
| P8.5–P8.7 | ⏳ Pendiente | Después de P8.4 |
| P9 Piloto | ⏳ Pendiente | Después de P8 completo |

---

## P0 — Integridad funcional crítica ✅

- integridad de asignación de stock;
- restricciones únicas en base de datos;
- consistencia del flujo de pedidos;
- controles de seguridad críticos iniciales.

## P1 — Base técnica y calidad ✅

- configuración por ambientes;
- respuestas de error seguras;
- migraciones versionadas sin `sequelize.sync()` como mecanismo de despliegue;
- baseline de calidad;
- lint estricto;
- CI obligatorio mediante Quality Gate;
- auditoría de dependencias.

## P2 — Autorización e historial ✅

- administrador general definido por oficina central;
- `RESPONSABLE` restringido a su oficina;
- permisos sensibles validados en backend;
- historial transaccional de altas, traslados, cambios de estado y bajas.

## P3 — Resiliencia operativa y recuperación ✅

- backup MySQL con checksum;
- restore drill en CI;
- health checks;
- Request ID;
- logging estructurado;
- shutdown controlado;
- runbook de recuperación, rollback e incidentes en `docs/OPERATIONS.md`.

## P4 — Integración MySQL real ✅

- flujos completos sobre MySQL descartable de test;
- usuarios, activos, stock, pedidos y movimientos;
- autorización por rol/oficina;
- fixtures reproducibles;
- migraciones reejecutables y verificadas.

## P5 — Protección contra regresiones y E2E ✅

- Playwright/Chromium para recorridos críticos;
- login, activos, solicitudes, provisión, reportes y adjuntos;
- validación de permisos por rol;
- regresión de navegación/sidebar;
- E2E incluido en Quality Gate.

## P6 — Consistencia, concurrencia e idempotencia ✅

- operaciones simultáneas de stock/pedidos protegidas;
- suite de concurrencia/idempotencia en Quality Gate;
- migración 003 validada de forma idempotente;
- soporte de `Idempotency-Key` preparado en backend donde corresponde.

## P6.1 — Seguridad pre-staging ✅

Cierre principal: PR #13.

Incluye:
- sesión mediante cookie `HttpOnly`;
- `SameSite=Strict` y `Secure` en production;
- prefijo `__Host-`;
- JWT fuera de `localStorage` en el frontend final;
- `/api/auth/me` como autoridad de sesión;
- validación de `Origin` y CORS con credenciales;
- rate limiting de login/MFA;
- `trust proxy`, CSP y HSTS configurables;
- MFA/TOTP obligatorio para `ADMIN` en producción;
- secretos MFA cifrados con AES-256-GCM;
- migración 005;
- E2E de MFA, cookie HttpOnly y logout real.

Evidencia:
- merge PR #13: `3ec6492a9a1c257c232fafef1e64d1ae5920dc9a`;
- Gate post-merge #151: verde;
- cierre documental posterior: `0cbfcd0e83f9cae95e5a6a8e3859202ac366d6b9`;
- Gate #153: verde.

Detalle: `docs/backend-security-architecture.md`.

---

## Frontend / UX/UI A–E ✅

### A — Design System
- tokens y kit reusable;
- Login, AppShell, Dashboard y Activos;
- navegación por rol y accesibilidad base.

### B — Operación de inventario
- Insumos;
- Stock por oficina;
- Consumo;
- Movimientos;
- Adjuntos.

### C — Flujos administrativos
- Solicitudes;
- Pedido mensual;
- Historial/provisión;
- Notificaciones;
- Reportes.

### D — Administración y cierre UX
- Usuarios;
- Bitácora;
- diálogos reutilizables;
- loading/error/empty/retry;
- responsive y accesibilidad;
- persistencia visual del sidebar.

### E — Refresh visual completo
- lenguaje visual inspirado en Admina con CSS propio;
- sin Tailwind ni copia de código del template;
- sidebar/topbar/cards/KPI/inputs/botones/badges/tablas refinados;
- `prefers-reduced-motion`;
- contraste WCAG 2.2 AA;
- aislamiento de colisiones CSS administrativas.

Evidencia:
- PR #11 mergeado;
- HEAD UX final: `fa6941b830fbcb621b6342ce878c6f2e7a89dd54`;
- merge `0cb1f5285ca150b41bc17859eb10f607c784f6cc`;
- Gate #140 verde.

Detalle: `docs/frontend-design-system.md`.

---

## P7 — Staging y despliegue controlado ✅ CERRADO

P7 quedó formalmente cerrado el 11/09/2026.

### P7.1 — Contrato y guardas de staging ✅

- `NODE_ENV=production` + `DEPLOY_ENV=staging`;
- secretos separados;
- `TRUST_PROXY_HOPS` explícito;
- identidad environment/revision en health;
- preflight obligatorio;
- backup verificado antes de migrar;
- `deploy:migrate` protegido;
- smoke post-deploy;
- exclusión de `.env.*` reales de Git.

Evidencia:
- PR #20 integrado;
- HEAD validado `5860d4e85a0a64514bdfa8ede052dcdfff9f56ba`;
- Gate #158 verde;
- squash `eaad8daeb101f988e00310c408554e66affde1d4`;
- Gate post-merge #159 verde.

### P7.2 — Staging real Railway ✅

Arquitectura validada:
- proyecto Railway privado `inventario-judicial-staging`;
- `frontend` público por HTTPS;
- `backend` privado;
- `mysql` privado;
- Caddy same-origin para `/api/*` y `/health/*`;
- volumen `backend-data` de 500 MB en `/data`;
- volumen `mysql-data` de 500 MB en `/var/lib/mysql`;
- `UPLOAD_DIR=/data/uploads`;
- MySQL 8 con `caching_sha2_password`;
- cliente runtime `mysql-community-client` 8.0;
- secretos exclusivos fuera de Git.

Validaciones reales:
- preflight verde;
- backup + SHA-256 en `/data/backups`;
- migraciones 001–005 aplicadas con backup verificado;
- `/health/live` y `/health/ready` verdes;
- smoke externo verde;
- persistencia del volumen comprobada entre redeploys;
- rollback simulado read-only;
- logs y observabilidad mínima disponibles;
- runner temporal de smoke eliminado.

Evidencia definitiva:
- PR #22: **mergeado**;
- HEAD pre-merge: `3836cd828359fc0500453e2bfb4bdeb729a9c95d`;
- Gate pre-merge #167: verde completo;
- merge commit en `main`: `6872095e3f4e6d11bf097c6254e83104a2a5e394`;
- Gate post-merge #168: **verde completo**, incluido Chromium E2E;
- detalle de cierre: `docs/P7_CLOSURE.md`;
- runbooks: `docs/STAGING.md`, `docs/RAILWAY_STAGING.md`, `docs/OPERATIONS.md`.

---

## P8 — Rendimiento y escalabilidad 🟡

### P8.0 — Baseline y metodología ✅

Implementado en `performance/p8-baseline` / PR #24.

Base reproducible:
- 6000 activos sintéticos;
- 300 insumos sintéticos;
- métricas API p50/p95/p99, errores y payload;
- métricas de bundle frontend raw/gzip;
- presupuestos objetivo + techo duro versionados;
- artifacts `performance-backend-baseline` y `performance-frontend-baseline` en CI;
- `test:performance-contracts` protege la metodología.

Baseline inicial — Gate #172:
- 0 errores HTTP en todos los escenarios medidos;
- `activos_admin`: p95 224,09 ms y payload 3331,35 KB;
- `activos_responsable`: p95 13,11 ms y payload 123,34 KB;
- bundle frontend: 266,50 KB JS gzip, 16,41 KB CSS gzip, 500,91 KB gzip total.

Hallazgo prioritario:
- el listado global de activos entrega ~3,33 MB por request a escala piloto;
- queda marcado como `target=warn` por payload;
- P8.0 no cambia contratos ni aplica optimizaciones.

Evidencia:
- PR #24 mergeado;
- merge `18e3bb9dafb2f07b03856ab863b3c9df4064641b`;
- Gate PR #173 verde;
- Gate post-merge #174 verde.

Detalle: `docs/PERFORMANCE.md`.

### P8.1 — Perfilado backend/MySQL ✅

Implementado en `performance/p8-backend-profile` / PR #25.

Instrumentación:
- benchmark Sequelize activado solo dentro del profiler de test;
- SQL normalizado sin persistir literales;
- conteo/duración de queries por escenario;
- detección de firmas repetidas;
- `EXPLAIN` de consultas dominantes;
- revisión de tablas/índices con `information_schema`;
- artifact `performance-backend-profile`;
- prueba unitaria y contratos CI.

Hallazgos — Gate #175:
- **no hay N+1 clásico en Activos**;
- Dirección: 3 queries/request (2 auth + 1 activos), ~219,89 ms HTTP promedio;
- la query global de activos promedia ~35 ms SQL, usa `PRIMARY` con backward index scan y recorre ~5686 filas estimadas;
- el principal costo restante es materializar/serializar 6000 filas + payload de 3,33 MB;
- RESPONSABLE usa índice `oficina_id`, ~223 filas estimadas y ~12,75 ms HTTP;
- auth agrega 2 queries indexadas por request y su costo es bajo/esperado;
- dashboard ejecuta 16 queries/request y repite 3 veces el mismo patrón `COUNT(pedidos_insumos) WHERE estado=?` además de una agregación agrupada;
- varios full scans del dashboard ocurren sobre 300 insumos o tablas transaccionales casi vacías; no justifican índices por intuición;
- la cardinalidad de `information_schema.STATISTICS` quedó desactualizada tras la carga masiva, por lo que no se usa sola para decidir índices.

Decisiones para P8.2:
1. paginación + proyección + filtros server-side en Activos Dirección;
2. consolidar counts redundantes del dashboard;
3. reducir atributos cargados por auth middleware sin tocar seguridad;
4. agregar/ajustar índices solo con mejora demostrable por `EXPLAIN` y baseline antes/después;
5. no indexar tablas pequeñas/vacías únicamente porque aparezca `ALL`.

Detalle completo: `docs/PERFORMANCE.md`.

### P8.2 — Índices, queries y paginación ✅

Implementado en `performance/p8-query-pagination` / PR #26.

Cambios principales:
- listado de Activos con paginación server-side (25 por defecto, máximo 100);
- búsqueda y filtros server-side por texto, estado y oficina;
- proyección de columnas del listado + detalle protegido por ID para edición;
- resumen KPI mediante agregación SQL independiente de la página;
- UI React con debounce, selector 25/50/100 y paginación accesible;
- permisos y alcance por oficina preservados;
- atributos de usuario minimizados en auth middleware sin alterar MFA/sesión;
- Dashboard reutiliza agregación por estado y elimina tres counts redundantes;
- baseline/profile P8 apuntan al contrato paginado explícito;
- prueba dinámica de paginación y aislamiento ejecutada sobre MySQL real.

Evidencia Gate #184:
- `activos_admin`: p95 224,09 → **11,35 ms**; payload 3331,35 → **9,16 KB**;
- `activos_responsable`: p95 13,11 → **7,81 ms**; payload 123,34 → **9,09 KB**;
- `dashboard_admin`: 16 → **13 queries/request**;
- 0 errores en baseline;
- frontend sin crecimiento: 264,85 KB JS gzip y 499,26 KB gzip total;
- Quality Gate completo verde, incluido Chromium E2E.

Decisión de índices:
- no se agregan índices nuevos porque `oficina_id` ya sirve el alcance de oficina;
- auth usa índices/PK;
- `activo=true` tiene baja selectividad;
- scans restantes ocurren sobre tablas pequeñas/no representativas;
- no existe mejora demostrada que compense costo de escritura/mantenimiento de un índice nuevo.

Presupuestos protegidos después de la mejora:
- Activos p95 objetivo 150 ms / techo duro 1000 ms;
- payload objetivo 100 KB / techo duro 500 KB.

Compatibilidad transitoria:
- `/api/activos` sin query params conserva temporalmente la respuesta legacy para Solicitudes y Adjuntos;
- nuevas pantallas y mediciones no deben usar ese modo;
- **P8.3 debe migrar esos consumidores a un catálogo ligero/búsqueda específica y retirar o acotar la carga completa**.

Detalle completo: `docs/PERFORMANCE.md`.

### P8.3 — Payloads, uploads y reportes ✅

Implementado en `performance/p8-payloads-uploads-reports` / PR #27.

Cambios principales:
- `GET /api/activos/catalogo` con proyección mínima y búsqueda server-side;
- Solicitudes deja de consumir el listado global de activos y acota el catálogo por oficina;
- Adjuntos usa búsqueda server-side con debounce y máximo 50 coincidencias;
- `ruta_archivo` deja de exponerse en payloads de listado/subida de adjuntos;
- límites MIME/tamaño, compresión y autorización de uploads se preservan;
- reporte general de pedidos comparte preparación de datos JSON/PDF y paraleliza agregaciones independientes;
- PDF continúa transmitiéndose por stream;
- reporte mensual por oficina reduce columnas y paraleliza lecturas independientes;
- catálogo ligero se incorpora al baseline oficial con presupuestos propios;
- pruebas estáticas + MySQL real protegen payloads, permisos y reportes.

Evidencia — Gate #201:
- `activos_catalogo_admin`: **8,89 ms p95**, **4,71 KB**, 0 errores;
- `activos_catalogo_responsable`: **5,73 ms p95**, **4,73 KB**, 0 errores;
- `insumos_admin`: 13,97 ms p95, 111,53 KB, 0 errores; sin evidencia para cambiar contrato en P8.3;
- presupuesto de catálogo: p95 150/1000 ms objetivo/techo; payload 25/100 KB objetivo/techo;
- auth/MFA, P6, backup/restore, baseline, profiler y **10/10 Chromium E2E** verdes.

Decisiones:
- no se relajan límites ni tipos de upload para obtener rendimiento aparente;
- no se agregan paginaciones a Insumos/Pedidos/Solicitudes sin evidencia;
- el crecimiento concurrente/cardinalidad transaccional se medirá en P8.5 antes de cambiar contratos.

Detalle completo: `docs/PERFORMANCE.md`.

### BLOQUE ACTIVO — P8.4 Rendimiento frontend 🟡

Objetivos autorizados:
1. releer el baseline frontend vigente y medir el costo real del bundle/rutas antes de optimizar;
2. identificar dependencias, módulos o pantallas que justifiquen separación de código o carga diferida;
3. revisar renders/re-renders y trabajo innecesario del navegador en recorridos críticos con evidencia reproducible;
4. evaluar lazy loading/code splitting por rutas o componentes pesados sin degradar navegación, permisos ni estados de carga/error;
5. revisar imágenes, fuentes y assets estáticos por peso y estrategia de carga;
6. mantener accesibilidad, UX y comportamiento responsive ya validados;
7. ampliar scripts/presupuestos del baseline frontend cuando la métrica sea estable y accionable;
8. mantener `npm test`, MySQL, auth/MFA, P6, backup/restore y Chromium E2E completamente verdes.

### Continuidad P8

- **P8.0 Baseline y metodología ✅**
- **P8.1 Perfilado backend/MySQL ✅**
- **P8.2 Índices, queries y paginación ✅**
- **P8.3 Payloads, uploads y reportes ✅**
- **P8.4 Rendimiento frontend 🟡 ACTIVO**
- **P8.5 Pruebas de carga ⏳**
- **P8.6 Optimización + regresión ⏳**
- **P8.7 Cierre documental y criterios de piloto ⏳**

No iniciar P9 hasta completar P8 y su Quality Gate final.

## P9 — Operación de piloto ⏳

- soporte e incident response;
- alta controlada de oficinas/usuarios;
- procedimiento operativo de administración;
- indicadores de uso, errores y tiempos de respuesta;
- revisión periódica de backups y restore drill;
- criterios de salida del piloto y paso a producción institucional.

---

## Deuda técnica / decisiones diferidas

No abrir como frentes paralelos salvo que bloqueen P8/P9:

- reemplazar diálogos nativos restantes por componente accesible definitivo;
- decidir adopción frontend explícita de `Idempotency-Key` en operaciones críticas;
- evaluar primitivas especializadas solo por necesidad concreta;
- no introducir Tailwind únicamente por motivos estéticos.

## Fuente de verdad documental

- estado/próximo paso: `ROADMAP.md`;
- mapa documental: `docs/README.md`;
- frontend: `docs/frontend-design-system.md`;
- backend/seguridad: `docs/backend-security-architecture.md`;
- operación/restore/incidentes: `docs/OPERATIONS.md`;
- staging general: `docs/STAGING.md`;
- Railway staging: `docs/RAILWAY_STAGING.md`;
- cierre P7: `docs/P7_CLOSURE.md`;
- rendimiento/escalabilidad: `docs/PERFORMANCE.md`;
- evidencia ejecutable: commits, PRs, Quality Gates y artifacts.

## Reglas de trabajo

1. No desarrollar directamente sobre `main`.
2. Cada bloque trabaja en rama propia.
3. No mergear con Quality Gate fallando.
4. Revisar diff completo antes de mergear.
5. No ejecutar cambios destructivos de base sin preflight y respaldo verificado.
6. No usar `npm audit fix --force` automáticamente.
7. Toda autorización sensible se valida en backend.
8. Toda migración debe ser versionada e idempotente o fallar de forma segura.
9. No abrir bloques posteriores mientras el bloque activo permanezca sin cerrar.
10. Antes de abrir un bloque nuevo, releer este `ROADMAP.md`.
11. Un bloque no está cerrado hasta alinear código, CI, documentación y estado real del entorno.
