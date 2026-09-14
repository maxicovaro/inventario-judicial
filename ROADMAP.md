# Hoja de ruta técnica — Inventario Judicial

> **Fuente principal de continuidad del proyecto.**
>
> Actualizada al 13/09/2026. **P9.1 — Soporte e incident response quedó formalmente cerrado** con PR #32, Quality Gate final #228, merge `67dd2526a796cba03b7edfcfd1c047d4ca5045ab`, Quality Gate post-merge #229 verde y relectura de este archivo desde `main`. **P9.2 — Alta controlada de oficinas y usuarios** es el bloque activo. Dentro de P9.2, **P9.2A — Modelo Depósito Central + Área Contable** está en integración final mediante PR #33; P9.2B — primera ola real Contable + Informática no se abre hasta merge, Gate post-merge verde y relectura de este archivo desde `main`. P9.3 permanece bloqueado hasta el cierre formal de P9.2 completo.

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
| **P9.2 Alta controlada de oficinas/usuarios** | 🟡 **Activo** | P9.2A en integración final; P9.2B pendiente |
| **P9.2A Depósito Central + Área Contable** | 🟢 **Integración final** | PR #33; contratos + integración MySQL multiusuario; revalidar HEAD final |
| P9.2B Primera ola Contable + Informática | ⏳ Bloqueado | Después del cierre formal post-merge de P9.2A |
| P9.3 Procedimiento operativo de administración | ⏳ Bloqueado | Después del cierre formal de P9.2 |
| P9.4 Indicadores reales del piloto | ⏳ Pendiente | Después de P9.3 |
| P9.5 Backup/restore periódico del piloto | ⏳ Pendiente | Después de P9.4 |
| P9.6 Criterios de salida a producción institucional | ⏳ Pendiente | Después de P9.5 |

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

### P9.2 — Alta controlada de oficinas y usuarios 🟡 ACTIVO

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

#### P9.2A — Modelo Depósito Central + Área Contable 🟢 INTEGRACIÓN FINAL

Rama/PR: `ops/p9-controlled-onboarding` / PR #33.

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

Cierre formal restante de P9.2A:
1. Quality Gate completo verde sobre el HEAD final del PR #33;
2. revisar diff final;
3. marcar PR #33 Ready for review;
4. merge a `main`;
5. Quality Gate post-merge verde sobre el SHA resultante;
6. releer `ROADMAP.md` desde `main`.

No abrir P9.2B antes de esos pasos.

#### P9.2B — Primera ola Contable + Informática ⏳ BLOQUEADO

Después del cierre formal de P9.2A:
1. seleccionar personas reales de Área Contable y Área Informática;
2. permitir más de un `RESPONSABLE` de Contable cuando corresponda;
3. definir roles mínimos en manifiesto privado;
4. registrar aprobación institucional;
5. ejecutar `plan` sobre staging;
6. realizar altas reales únicamente desde Gestión de Usuarios;
7. ejecutar `verify`;
8. validar login, rol, scope, gestión de depósito y auditoría;
9. probar rollback controlado por desactivación;
10. cerrar P9.2 con documentación, PR, merge y Gate post-merge.

P9.3 no se inicia hasta completar P9.2B y cerrar P9.2.

### P9.3 — Procedimiento operativo de administración ⏳

Previsto:
- usuarios;
- bienes;
- stock;
- movimientos;
- solicitudes/pedidos;
- bajas;
- adjuntos;
- backups y tareas rutinarias.

### P9.4 — Indicadores reales del piloto ⏳

Previsto:
- uso por oficina y flujo;
- errores/5xx;
- tiempos de respuesta;
- health;
- auth/MFA/permisos;
- crecimiento MySQL y `/data`;
- conflictos/replays de stock;
- MTTA/MTTR e incidentes por severidad.

### P9.5 — Backup y recuperación durante el piloto ⏳

Previsto:
- backup periódico;
- checksum;
- copia fuera del host cuando corresponda;
- restore drill periódico;
- seguimiento de RPO/RTO.

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
