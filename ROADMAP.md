# Hoja de ruta técnica — Inventario Judicial

> **Fuente principal de continuidad del proyecto.**
>
> Actualizada al 20/09/2026. **P9.5 — Backup y recuperación durante el piloto** completó implementación, Quality Gate y validación real de staging en rama `ops/p9-5-pilot-backup-recovery`; está en cierre técnico pre-merge del PR #49. P9.6 permanece bloqueado hasta merge + Quality Gate post-merge y cierre formal desde `main`.

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
| P8.2 Índices, queries y paginación | ✅ Completo | PR #26; Gate #184 |
| P8.3 Payloads, uploads y reportes | ✅ Completo | PR #27; Gate #201 |
| P8.4 Rendimiento frontend | ✅ Completo | PR #28; Gate #206 |
| P8.5 Pruebas de carga | ✅ Completo | PR #29; Gate #211 |
| P8.6 Optimización + regresión | ✅ Completo | PR #30; Gate #218; `docs/P8_6_CLOSURE.md` |
| P8.7 Cierre documental y criterios de piloto | ✅ Completo | PR #31; merge `5defc447...`; Gate post-merge #225 |
| **P8 Rendimiento y escalabilidad** | ✅ **Completo** | `docs/P8_CLOSURE.md`; staging y Gate final verdes |
| **P9.1 Soporte e incident response** | ✅ **Completo** | PR #32; Gate #228; merge `67dd2526...`; Gate post-merge #229 |
| **P9.2 Alta controlada de oficinas/usuarios** | ✅ **Completo** | PR #43; Gate #299; merge `a8a6000f...`; Gate post-merge #300 |
| **P9.2A Depósito Central + Área Contable** | ✅ **Completo** | PR #33; Gate #267; merge `3fe4b3ae...`; Gate post-merge #268 |
| **P9.2B Primera ola Contable + Informática** | ✅ **Completo** | 12 escenarios + rollback + verify final 4/4; staging `e8256927...` |
| **P9.3 Procedimiento operativo de administración** | ✅ **Completo** | PR #44; Gate #304; merge `1ec716b8...`; Gate post-merge #305; staging validado |
| **P9.4 Indicadores reales del piloto** | ✅ **Completo** | PR #47; merge `d1aa207e...`; Gate #313/#314; captura real + staging `b6de2f78...` / `d95d1768...` SUCCESS |
| **P9.5 Backup/restore periódico del piloto** | 🟠 **Cierre pre-merge** | Gate #330 verde; backup real + bucket cifrado + restore PASS + cron diario; PR #49 pendiente de merge/post-merge |
| P9.6 Criterios de salida a producción institucional | ⏳ **Bloqueado** | Se habilita sólo tras cierre formal de P9.5 desde `main` |

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
- volumen backend `/data`;
- volumen MySQL `/var/lib/mysql`;
- MySQL 8;
- secretos exclusivos fuera de Git.

Validaciones reales:
- preflight verde;
- backup + SHA-256;
- migraciones 001–005;
- `/health/live` y `/health/ready` verdes;
- smoke externo verde;
- persistencia de volúmenes;
- rollback simulado read-only;
- observabilidad mínima.

Evidencia definitiva:
- PR #22 mergeado;
- Gate pre-merge #167 verde;
- merge `6872095e3f4e6d11bf097c6254e83104a2a5e394`;
- Gate post-merge #168 verde;
- detalle: `docs/P7_CLOSURE.md`;
- runbooks: `docs/STAGING.md`, `docs/RAILWAY_STAGING.md`, `docs/OPERATIONS.md`.

---

## P8 — Rendimiento y escalabilidad ✅ CERRADO

### P8.0 — Baseline y metodología ✅

PR #24.

- dataset 6000 activos + 300 insumos;
- métricas API p50/p95/p99, errores y payload;
- frontend raw/gzip;
- presupuestos objetivo + techo duro;
- artifacts y contratos CI.

Baseline inicial:
- `activos_admin`: 224,09 ms p95 / 3331,35 KB;
- `activos_responsable`: 13,11 ms / 123,34 KB;
- JS frontend: 266,50 KB gzip.

Detalle: `docs/PERFORMANCE.md`.

### P8.1 — Perfilado backend/MySQL ✅

PR #25 / Gate #175.

- sin N+1 clásico en Activos;
- costo dominante: materialización/serialización del listado global;
- auth indexada y de costo bajo;
- Dashboard con counts redundantes;
- sin índices especulativos.

### P8.2 — Índices, queries y paginación ✅

PR #26 / Gate #184.

- paginación/filtros server-side;
- proyección reducida;
- aislamiento por oficina preservado;
- Dashboard elimina counts redundantes;
- `activos_admin`: 224,09 → 11,35 ms p95;
- payload: 3331,35 → 9,16 KB;
- sin índices nuevos sin evidencia.

### P8.3 — Payloads, uploads y reportes ✅

PR #27 / Gate #201.

- catálogo ligero de activos;
- Solicitudes/Adjuntos dejan de consumir listado global;
- `ruta_archivo` no se expone;
- límites/seguridad de uploads preservados;
- reportes optimizados sin alterar reglas.

### P8.4 — Rendimiento frontend ✅

PR #28 / Gate #206.

- 15 pantallas protegidas con lazy loading;
- seguridad de `PrivateRoute` preservada;
- Recharts fuera de carga inicial;
- JS inicial: 265,15 → 129,79 KB gzip;
- carga inicial JS+CSS: 281,56 → 139,57 KB gzip;
- fuentes 52,98 KB gzip.

### P8.5 — Pruebas de carga ✅

PR #29 / Gate #211.

- lecturas c1/5/10/20;
- 0 errores HTTP;
- `auth_me_admin` c20 68,90 ms p95;
- Dashboard c20 92,56 ms;
- Activos c20 80,91 ms;
- Pedidos c20 59,82 ms;
- Stock lectura c20 49,24 ms;
- mix c20 76,65 ms;
- Stock unique c20 275,71 ms con invariantes correctas;
- replay idempotente exacto.

Conclusión: primera zona sensible = serialización de Stock; integridad P6 intacta.

### P8.6 — Optimización + regresión ✅

PR #30 / Gate #218.

- perfil c1/c20 de contención;
- lock central `Insumo ... FOR UPDATE` = 68,28 % del tiempo SQL medido en c20;
- c20 270,17 ms p95, 0 errores, invariantes true;
- `production_change_required=false`;
- decisión `preserve_consistency_locks_and_regression_guards`;
- sin cambios productivos especulativos.

Detalle: `docs/P8_6_CLOSURE.md`.

### P8.7 — Cierre documental y criterios de piloto ✅

Cierre técnico-operativo verificado el 13/09/2026:
- staging en `cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044` durante el gate operativo;
- backend/frontend Railway sobre `main`;
- `deploy:preflight` ✅;
- migraciones 001–005 al día ✅;
- backup `/data/backups/pre-pilot.sql` verificado ✅;
- SHA-256 `604f27ccf2b954cd363e77276bf16911047c9515c1d73b77c458ab455beeb18d`;
- 23746 bytes;
- `/health/live` y `/health/ready` 200 ✅;
- frontend 200 ✅;
- `/api/auth/me` anónimo 401 esperado;
- CORS exacto con credenciales ✅;
- smoke externo ✅;
- volúmenes persistentes ✅.

Desviación registrada:
- deployment realizado antes del nuevo backup específico;
- no hubo migraciones P8 nuevas;
- luego se confirmó schema al día y backup pre-piloto verificado;
- próximos deploys deben volver al orden del runbook.

Integración definitiva:
- PR #31 ✅;
- merge `5defc4472105f0da777d5053183f4c352ddfc8d4` ✅;
- Quality Gate de HEAD final #224 ✅;
- Quality Gate post-merge #225 sobre el SHA de `main` ✅;
- `ROADMAP.md` releído desde `main` antes de abrir P9 ✅.

Detalle: `docs/P8_CLOSURE.md`.

---

## P9 — Operación de piloto

### P9.1 — Soporte e incident response ✅ CERRADO

Implementación:
- Incident Commander y responsabilidades operativas;
- severidad SEV-1/SEV-2/SEV-3;
- objetivos de reconocimiento y actualización;
- stop conditions;
- evidencia mínima y timeline;
- rollback/restore seguro;
- plantilla `.github/ISSUE_TEMPLATE/incident.md`;
- métricas MTTA/MTTR/RPO/RTO;
- tabletop exercise;
- contrato `test:p9-incident-response-contracts` incluido en `npm test`.

Evidencia definitiva:
- PR #32 ✅;
- Quality Gate final #228 sobre `d8277fa6a644fb9d7aff14e2ade7bd0175eead3e` ✅;
- merge `67dd2526a796cba03b7edfcfd1c047d4ca5045ab` ✅;
- Quality Gate post-merge #229 sobre ese SHA ✅;
- `ROADMAP.md` releído desde `main` antes de abrir P9.2 ✅.

Detalle: `docs/P9_1_INCIDENT_RESPONSE.md`.

### P9.2 — Alta controlada de oficinas y usuarios ✅ CERRADO

Objetivo: incorporar una primera ola pequeña, explícitamente aprobada y reversible sin bypass de las protecciones del módulo de usuarios.

Base de onboarding implementada:
- manifiesto sintético `pilot/wave.example.json`;
- manifiestos reales/privados excluidos de Git;
- `pilot:onboarding:check` en modos `plan` y `verify`, read-only;
- validación de oficinas y roles;
- bloqueo de `ADMIN` en manifiestos de ola;
- chequeo de `ADMIN` activo en oficina central;
- MFA obligatorio de administradores en staging;
- detección de usuarios existentes con emails enmascarados;
- alta real únicamente desde Gestión de Usuarios;
- rollback mediante desactivación y revocación de sesiones;
- contrato `test:p9-onboarding-contracts` en `npm test`.

Documento técnico: `docs/P9_2_CONTROLLED_ONBOARDING.md`.

#### P9.2A — Modelo Depósito Central + Área Contable ✅ CERRADO

Regla institucional consolidada:
- `Área Contable` es una oficina ordinaria con activos e insumos propios;
- `Depósito` es una ubicación institucional separada;
- Contable administra el depósito sin absorber sus existencias como propias;
- una entrega a Contable se registra como `Depósito -> Área Contable` igual que para cualquier otra dependencia.

Modelo de permisos:
- `oficinas.gestiona_deposito` identifica a la oficina gestora;
- `oficinas.es_deposito_central` identifica la ubicación depósito;
- el permiso efectivo exige `RESPONSABLE` de oficina gestora o Administrador General;
- no depende del nombre visible de la oficina;
- un `USUARIO` común de Contable no administra depósito;
- Contable no recibe administración global ni rol `ADMIN`.

Operación multiusuario:
- puede haber varios `RESPONSABLE` en Área Contable;
- cada responsable usa su propia cuenta;
- recepción, carga, ajuste, entrega, traslado, respuesta y provisión conservan el `usuario_id` del empleado interviniente;
- distintos responsables pueden ejecutar etapas distintas del mismo circuito;
- existe Auditoría operativa del Depósito Central visible para responsables autorizados sin exponer la Bitácora global de Dirección.

Superficies separadas:
- `Mi oficina`: activos/stock/solicitudes/consumos propios de Contable;
- `Depósito Central`: activos, insumos, solicitudes, pedidos y auditoría bajo `/api/deposito/*` y rutas frontend dedicadas.

Integridad:
- insumos nuevos nacen con stock 0;
- la entrada física exige movimiento trazable;
- distribución reutiliza locks, transacciones e idempotencia P6;
- activos de depósito se entregan mediante `TRASLADO` con origen/destino;
- pedidos solo mueven stock desde estados permitidos.

Pruebas incorporadas:
- `test:p9-deposito-contracts`;
- `test:p9-deposito-integration` sobre MySQL real descartable;
- dos responsables distintos de Contable;
- usuario común de Contable bloqueado;
- responsable de Informática bloqueado;
- Contable sin acceso a administración de usuarios;
- autor individual verificado en movimientos de activos, stock, solicitudes y pedidos.

Evidencia definitiva:
- PR #33 ✅;
- HEAD pre-merge `f09d8883f6eb529162416297ea04b5da92267649`;
- Quality Gate final #267 ✅;
- merge squash `3fe4b3ae487d0dfb53f44e7654e4c18dcc39bd29` ✅;
- Quality Gate post-merge #268 sobre ese SHA ✅;
- staging y usuarios reales no modificados durante P9.2A.

Detalle de cierre: `docs/P9_2A_CLOSURE.md`.

No abrir P9.2B hasta integrar este cierre documental, obtener Gate post-merge verde y releer `ROADMAP.md` desde `main`.

#### P9.2B — Primera ola Contable + Informática ✅ CERRADO

Evidencia técnico-operativa:
- staging final sobre `e82569270a60674fd9fd02444dfebcfbd35fe9eb`;
- migraciones 001–007 al día;
- backups verificados antes de migraciones 006 y 007;
- manifiesto privado aprobado fuera de Git;
- cuatro cuentas piloto verificadas con rol/oficina exactos;
- 12 escenarios funcionales mínimos completados;
- pedidos complementarios y concurrencia corregidos;
- provisión cero bloqueada;
- trazabilidad MENSUAL/COMPLEMENTARIO preservada;
- traslado `Depósito -> Área Informática` validado;
- separación de stock `Depósito -> Área Contable` validada;
- negativos de permisos y privilegios globales validados;
- rollback por desactivación y revocación de sesión validado;
- reactivación y conservación de historial/bitácora validadas;
- `verify` final posterior al rollback: 4/4 `VERIFICADO`, sin modificar la base;
- sin condiciones de stop abiertas.

Correcciones relevantes integradas durante la ola:
- PR #37: hidratación de capacidades de sesión;
- PR #38: pedidos complementarios;
- PR #39: migración 007 segura frente a FK;
- PR #40: refresh de fuente frontend de staging;
- PR #41: bloqueo de `ENTREGADO` con provisión cero;
- PR #42: tipo real de pedido en movimientos/notificaciones/bitácora.

Detalle: `docs/P9_2B_FIRST_WAVE.md`.

Con el merge de este cierre documental y Gate post-merge verde, P9.2 queda formalmente cerrado.

### P9.3 — Procedimiento operativo de administración ✅ CERRADO

Alcance consolidado:
- runbook único para usuarios, bienes, stock, movimientos, solicitudes/pedidos, bajas, adjuntos, backups y tareas rutinarias;
- matriz efectiva ADMIN / RESPONSABLE / gestor de Depósito / USUARIO;
- fronteras explícitas entre Dirección, oficinas y Depósito Central;
- integración con P9.1, `OPERATIONS.md` y `STAGING.md`;
- contrato `test:p9-admin-procedure-contracts` incorporado a `npm test`.

Validación real:
- Usuarios ✅;
- Bitácora ✅;
- Activos y baja formal para ADMIN ✅;
- Stock por oficina ✅;
- Movimientos ✅;
- Adjuntos ✅;
- sin acciones destructivas ni condiciones de stop.

Evidencia definitiva:
- PR #44 ✅;
- HEAD pre-merge `bfb2ec547994ca18f17c909710891c6ff457cf36`;
- Quality Gate #304 ✅;
- merge `1ec716b8bd11b4f31ef5953ab1f1578ff1d32e8a` ✅;
- Quality Gate post-merge #305 ✅;
- metodología repo-first aplicada antes del cierre.

Documento: `docs/P9_3_ADMIN_PROCEDURE.md`.

El estado CERRADO pasa a ser formal una vez integrado este cierre documental y con su Gate post-merge verde. Después se debe releer `ROADMAP.md` desde `main` antes de abrir P9.4.

### P9.4 — Indicadores reales del piloto ✅ CERRADO

Alcance consolidado:
- snapshot read-only de MySQL y almacenamiento;
- uso por oficina/flujo;
- auth/MFA;
- pedidos, solicitudes y movimientos;
- tamaño de MySQL, uploads, backups y adjuntos;
- observabilidad de idempotencia;
- logs runtime y latencia real;
- recursos Railway backend/MySQL;
- estado de incidentes P9.1;
- contrato P9.4 dentro de `npm test`;
- smoke real del snapshot contra MySQL CI con timeout.

Evidencia funcional y operativa:
- HEAD funcional validado `b6de2f789ad76545203c4e1e2cf6286559af1776`;
- Quality Gate funcional #311 verde;
- primera captura real de staging completada;
- deployment final estable `d95d1768-748d-4ce6-a82c-0135e9b7619d` SUCCESS;
- runtime `staging@b6de2f78...`;
- `/ready=200`, DB conectada y `server_started`;
- 562 requests de aplicación en muestra no truncada;
- 0 respuestas 5xx;
- p95 65,31 ms;
- 5 usuarios piloto activos con matriz prevista y ADMIN 1/1 con MFA;
- MySQL ~0,84 MiB, 12 backups, sin uploads/adjuntos nuevos;
- 0 issues P9.1 `SEV`/`incident` registrados; MTTA/MTTR N/A;
- sin stop conditions P9.1.

Cierre Git:
- PR #47 integrado;
- merge `d1aa207e170e8a5c919f387ca9ea19b217a5529d`;
- Quality Gate pre-merge #313 ✅;
- Quality Gate post-merge #314 ✅.

Hallazgo resuelto:
- no ejecutar la captura alterando el `startCommand` de Railway;
- usar shell/CLI/tarea puntual y mantener arranque/healthcheck independientes;
- staging quedó restaurado con `npm start`.

Documento: `docs/P9_4_PILOT_INDICATORS.md`.

Regla de transición aplicada: **P9.5 permanece bloqueado** hasta el cierre formal de P9.4. P9.5 sólo se abre después de integrar este cierre documental, confirmar su Gate post-merge verde y releer `ROADMAP.md` desde `main`.

### P9.5 — Backup y recuperación durante el piloto 🟠 CIERRE PRE-MERGE

Regla de transición cumplida: P9.4 fue cerrado formalmente antes de abrir P9.5.

Implementación consolidada:
- `scripts/pilot-backup-run.js`;
- `scripts/pilot-backup-s3.js`;
- `scripts/pilot-restore-drill.js`;
- `npm run pilot:backup:run`;
- `npm run pilot:restore:drill`;
- checksum SHA-256 + snapshot estable de tablas/conteos;
- retención primaria de 7 dumps;
- segunda copia cifrada AES-256-GCM en Storage Bucket S3 compatible;
- descarga, descifrado en memoria y reverificación SHA-256;
- contrato `test:p9-backup-recovery-contracts`;
- Quality Gate con backup+restore real sobre MySQL descartable;
- documento `docs/P9_5_PILOT_BACKUP_RECOVERY.md`.

Evidencia técnica:
- PR #49;
- HEAD pre-cierre `7bdeeec815be4d4e78320063891fb73e1bcb92ee`;
- Quality Gate #330 ✅;
- backup real staging: deployment `66bd32ef-5f88-4b6b-82ba-7e428a7150db` ✅;
- dump 44.533 bytes;
- SHA-256 `1887757832441ad96f46ddec8f7b057c3313e9a700c98196a2fe64df11682e92`;
- `bucket_copy_verified=true`;
- `secondary_copy_verified=true`;
- restore drill real: deployment `3f4d5547-7284-478d-b4d5-00c42f399047` ✅;
- resultado `PASS`;
- 19 tablas / 168 filas;
- RPO 0,2203 h <= 24 h;
- RTO 0,0373 min <= 240 min;
- `target_cleanup_ok=true`;
- cron final: `0 6 * * *` UTC = 03:00 Argentina;
- deployment final de configuración `cf9ef12f-fe83-4d00-9eb7-10d7d0781cd3` ✅;
- objetivo de costo de bolsillo $0 preservado: backups/PITR nativos Pro sustituidos por bucket privado con cifrado cliente.

Guardas preservadas:
- sólo `staging/test`;
- no restore sobre DB activa;
- identidad de restore separada y temporal;
- credenciales administrativas retiradas tras el drill;
- usuario normal de aplicación sin privilegios ampliados;
- dumps/resultados reales fuera de Git;
- P9.1 prevalece ante checksum inválido, restore inconsistente o incumplimiento material de RPO/RTO.

Pendiente exclusivamente para cierre formal:
- Gate del commit documental final;
- merge PR #49;
- Quality Gate post-merge;
- registrar desde `main` el cierre formal y habilitar P9.6.

P9.6 permanece bloqueado hasta completar esos puntos.

### P9.6 — Criterios de salida del piloto ⏳

Previsto:
- estabilidad;
- seguridad;
- integridad;
- adopción;
- capacidad operativa;
- rendimiento;
- decisión documentada de paso a producción institucional.

---

## Deuda técnica / decisiones diferidas

No abrir como frentes paralelos salvo que bloqueen P9:
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
- cierre P8.6: `docs/P8_6_CLOSURE.md`;
- cierre P8 y gate piloto: `docs/P8_CLOSURE.md`;
- P9.1 incident response: `docs/P9_1_INCIDENT_RESPONSE.md`;
- P9.2 onboarding y Depósito Central: `docs/P9_2_CONTROLLED_ONBOARDING.md`;
- cierre P9.2A: `docs/P9_2A_CLOSURE.md`;
- cierre P9.2B / primera ola: `docs/P9_2B_FIRST_WAVE.md`;
- P9.3 procedimiento operativo: `docs/P9_3_ADMIN_PROCEDURE.md`;
- P9.4 indicadores del piloto: `docs/P9_4_PILOT_INDICATORS.md`;
- evidencia ejecutable: commits, PRs, Quality Gates y artifacts.

## Reglas de trabajo

La metodología completa y obligatoria está versionada en `AGENTS.md`. Estas reglas son su resumen operativo.

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
12. Antes de modificar, reconstruir el estado desde repo/Git, `ROADMAP.md`, `AGENTS.md`, documentación, tests, CI y staging cuando aplique.
13. Corregir causa raíz antes que parche y agregar regresión cuando un defecto real haya escapado a CI.
14. Ejecutar autónomamente todas las pruebas posibles; pedir intervención manual sólo cuando sea inevitable.
15. Evaluar superbloques sólo cuando compartan contexto y no comprometan seguridad, rollback, pruebas ni trazabilidad.
16. No dejar deuda implícita: resolverla o registrarla explícitamente en la hoja de ruta.
