# Hoja de ruta técnica — Inventario Judicial

> **Fuente principal de continuidad del proyecto.**
>
> Actualizada al 13/09/2026 con el cierre técnico-operativo de **P8.7 — Cierre documental y criterios de piloto**. P8 queda completo a nivel de implementación y staging. **P9 — Operación de piloto** es el siguiente bloque, pero solo se considera habilitado después de Quality Gate verde sobre este cierre, merge a `main` y Quality Gate post-merge verde.

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
| P8.4 Rendimiento frontend | ✅ Completo | PR #28; Gate de implementación #206 |
| P8.5 Pruebas de carga | ✅ Completo | PR #29; Gate de implementación #211 |
| P8.6 Optimización + regresión | ✅ Completo | PR #30; Gate #218; `docs/P8_6_CLOSURE.md` |
| **P8.7 Cierre documental y criterios de piloto** | ✅ **Cierre técnico-operativo completo** | Gate operativo staging verde; `docs/P8_CLOSURE.md`; falta solo Gate/PR/merge/post-merge de este cierre |
| **P8 Rendimiento y escalabilidad** | ✅ **Completo** | Se formaliza después del Gate post-merge de P8.7 |
| P9 Piloto | ⏳ Próximo | Habilitar solo después del Gate post-merge P8.7 |

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

## P8 — Rendimiento y escalabilidad ✅ CIERRE TÉCNICO-OPERATIVO COMPLETO

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
- el listado global de activos entregaba ~3,33 MB por request a escala piloto;
- quedó marcado como `target=warn` por payload;
- P8.0 no cambió contratos ni aplicó optimizaciones.

Evidencia:
- PR #24 mergeado;
- merge `18e3bb9dafb2f07b03856ab863b3c9df4064641b`;
- Gate PR #173 verde;
- Gate post-merge #174 verde.

Detalle: `docs/PERFORMANCE.md`.

### P8.1 — Perfilado backend/MySQL ✅

Implementado en `performance/p8-backend-profile` / PR #25.

Hallazgos principales — Gate #175:
- no hay N+1 clásico en Activos;
- Dirección: 3 queries/request (2 auth + 1 activos), ~219,89 ms HTTP promedio antes de P8.2;
- principal costo: materializar/serializar 6000 filas + payload de 3,33 MB;
- RESPONSABLE usa índice `oficina_id`;
- auth usa consultas indexadas y de costo bajo;
- dashboard ejecutaba 16 queries/request y repetía counts por estado;
- no se justificaron índices por intuición sobre tablas pequeñas o baja selectividad.

Decisiones derivadas:
1. paginación + proyección + filtros server-side;
2. consolidación de counts redundantes;
3. minimización de atributos en auth sin debilitar seguridad;
4. índices solo con mejora demostrable.

Detalle completo: `docs/PERFORMANCE.md`.

### P8.2 — Índices, queries y paginación ✅

Implementado en `performance/p8-query-pagination` / PR #26.

Cambios principales:
- listado de Activos con paginación server-side;
- búsqueda/filtros server-side;
- proyección de columnas + detalle protegido por ID;
- resumen KPI mediante agregación SQL;
- UI 25/50/100 con debounce y paginación accesible;
- permisos y alcance por oficina preservados;
- Dashboard elimina counts redundantes.

Evidencia Gate #184:
- `activos_admin`: p95 224,09 → **11,35 ms**; payload 3331,35 → **9,16 KB**;
- `activos_responsable`: p95 13,11 → **7,81 ms**; payload 123,34 → **9,09 KB**;
- `dashboard_admin`: 16 → **13 queries/request**;
- 0 errores;
- frontend sin crecimiento material;
- Chromium E2E verde.

No se agregaron índices nuevos sin evidencia de beneficio.

### P8.3 — Payloads, uploads y reportes ✅

Implementado en `performance/p8-payloads-uploads-reports` / PR #27.

Cambios principales:
- `GET /api/activos/catalogo` con proyección mínima y búsqueda server-side;
- Solicitudes/Adjuntos dejan de consumir listado global;
- `ruta_archivo` no se expone en payloads;
- límites MIME/tamaño, compresión y autorización preservados;
- reportes comparten preparación de datos y paralelizan lecturas seguras.

Evidencia — Gate #201:
- catálogo admin: 8,89 ms p95 / 4,71 KB;
- catálogo responsable: 5,73 ms p95 / 4,73 KB;
- 0 errores;
- auth/MFA, P6, backup/restore y 10/10 Chromium E2E verdes.

### P8.4 — Rendimiento frontend ✅

Implementado en `performance/p8-frontend` / PR #28.

Cambios principales:
- 15 pantallas protegidas con `React.lazy` + `Suspense`;
- `PrivateRoute` preserva sesión/rol;
- Recharts queda fuera de la carga inicial;
- Inter limitado a Latin 400;
- contratos de rendimiento frontend versionados.

Evidencia — Gate #206:
- JS inicial: **265,15 → 129,79 KB gzip**;
- carga inicial JS+CSS: **281,56 → 139,57 KB gzip**;
- total `dist`: **499,56 → 358,43 KB gzip**;
- fuentes: **52,98 KB gzip**;
- seguridad y Chromium E2E verdes.

### P8.5 — Pruebas de carga ✅

Implementado en `performance/p8-load-tests` / PR #29.

Metodología:
- dataset 6000 activos + 300 insumos;
- lecturas c1/5/10/20;
- login c1/3/5;
- Stock con escrituras únicas e idempotentes;
- métricas p50/p95/p99, throughput, errores e invariantes P6.

Evidencia — Gate #211:
- 0 errores HTTP;
- `auth_me_admin` c20: 68,90 ms p95;
- Dashboard c20: 92,56 ms;
- Activos c20: 80,91 ms;
- Pedidos c20: 59,82 ms;
- Stock lectura c20: 49,24 ms;
- mix c20: 76,65 ms;
- login c5: 34,31 ms;
- Stock unique c20: 275,71 ms, invariantes correctas;
- Stock idempotente: 20 HTTP / 10 operaciones lógicas, 10 replays y exactamente 10 escrituras.

Interpretación:
- lecturas holgadas hasta c20;
- primera zona sensible: serialización de escrituras de Stock;
- integridad P6 preservada;
- sin justificación para caches, índices o relajación de locks.

### P8.6 — Optimización + regresión ✅

Implementado en `performance/p8-optimization-regression` / PR #30.

Evidencia — Gate #218:
- c1: 26,03 ms p95, 0 errores, invariantes `true`;
- c20: 270,17 ms p95, 0 errores, invariantes `true`;
- lock central `Insumo ... FOR UPDATE`: 68,28 % del tiempo SQL;
- espera promedio lock central: 40,25 ms;
- lock `StockOficina`: 0,5 ms promedio;
- `central_stock_lock_is_dominant_candidate=true`;
- `production_change_required=false`.

Decisión versionada:
- `preserve_consistency_locks_and_regression_guards`;
- no se eliminan/reordenan locks;
- no se agregan índices/caches/complejidad sin evidencia material.

Detalle: `docs/P8_6_CLOSURE.md`.

### P8.7 — Cierre documental y criterios de piloto ✅

Rama: `performance/p8-closure-pilot-criteria`.

Cierre técnico-operativo verificado el 13/09/2026:
- revisión staging: `cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`;
- backend y frontend Railway sobre `main` y esa revisión;
- `deploy:preflight` ✅ (`staging`, DB correcta, `trust proxy hops=1`);
- migraciones 001–005 aplicadas; `db:status` al día ✅;
- backup `/data/backups/pre-pilot.sql` creado y verificado ✅;
- SHA-256 `604f27ccf2b954cd363e77276bf16911047c9515c1d73b77c458ab455beeb18d`;
- tamaño 23746 bytes;
- `/health/live` y `/health/ready` 200 con revisión esperada ✅;
- frontend 200 y raíz React presente ✅;
- `/api/auth/me` sin sesión devuelve 401 esperado;
- CORS/origin con credenciales coincide exactamente con frontend de staging ✅;
- smoke externo completo ✅;
- volúmenes backend/MySQL persistentes ✅.

Desviación registrada:
- el deployment fue aplicado antes del nuevo backup específico de P8.7;
- no hubo migraciones P8 nuevas;
- después se confirmó schema al día y se creó/verificó backup pre-piloto;
- próximos deploys deben respetar nuevamente el orden del runbook.

Criterios de piloto definidos:
- GO de seguridad, integridad, recuperación y rendimiento;
- hard limits de `performance/budgets.json` como techo técnico, no SLA;
- SEV-1 para corrupción, stock negativo/doble gasto, idempotencia rota, acceso no autorizado, secreto comprometido o recuperación inconsistente;
- SEV-2 para readiness persistente, auth/MFA repetidamente fallido, flujo crítico indisponible, 5xx repetidos o degradación sostenida;
- observabilidad mínima de health, revisión, 5xx, auth/MFA, latencias, incidentes, capacidad, backups y escrituras de Stock.

Detalle completo: `docs/P8_CLOSURE.md`.

### Cierre formal pendiente exclusivamente de integración

Antes de iniciar P9 todavía deben ocurrir, en este orden:
1. Quality Gate completo sobre el HEAD final de esta rama;
2. revisión del diff;
3. PR y merge a `main`;
4. Quality Gate post-merge verde sobre el SHA final de `main`;
5. releer este `ROADMAP.md` desde `main`.

No iniciar P9 antes de esos pasos.

## P9 — Operación de piloto ⏳ PRÓXIMO BLOQUE

Abrir únicamente después del cierre formal de integración P8.7.

Alcance previsto:
- soporte e incident response;
- alta controlada de oficinas/usuarios;
- procedimiento operativo de administración;
- indicadores de uso, errores y tiempos de respuesta;
- revisión periódica de backups y restore drill;
- criterios de salida del piloto y paso a producción institucional.

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
