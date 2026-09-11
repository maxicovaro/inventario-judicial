# Hoja de ruta técnica — Inventario Judicial

> **Fuente principal de continuidad del proyecto.**
>
> Actualizada al 11/09/2026 para registrar P7.2 validado sobre staging real en Railway y dejar su integración a `main` como único paso pendiente antes de abrir P8.

Cada bloque se trabaja en rama propia, con commits lógicos, PR, revisión completa, Quality Gate y validación local cuando involucra base de datos o entorno de ejecución. Los PR documentan la evidencia de cada cambio, pero este archivo define **el estado consolidado y el próximo punto de continuidad**.

## Estado ejecutivo

| Frente | Estado | Continuidad |
| --- | --- | --- |
| Integridad funcional P0 | ✅ Completo | Mantener regresiones |
| Base técnica/calidad P1 | ✅ Completo | Mantener Quality Gate |
| Autorización/historial P2 | ✅ Completo | Mantener controles negativos |
| Resiliencia/recuperación P3 | ✅ Completo | Mantener restore drills |
| Integración MySQL P4 | ✅ Completo | Se ejecuta en CI |
| E2E/regresiones P5 | ✅ Completo | Se ejecuta en CI |
| Concurrencia/idempotencia P6 | ✅ Completo | Se ejecuta en CI |
| Frontend Bloques A–E | ✅ Integrado a `main` | Merge `0cb1f528...` |
| P6.1 seguridad pre-staging | ✅ Integrado y cerrado | PR #13; merge `3ec6492...`; Gate #151/#153 verde |
| P7.1 contrato/guardas staging | ✅ Integrado y cerrado | PR #20; squash `eaad8dae...`; Gate #158/#159 verde |
| P7.2 staging real | ✅ Validado, integración pendiente | PR #22 draft; Railway real + Gate #165 verde |
| P8 rendimiento/escalabilidad | ⏳ Pendiente | Abrir solo después de integrar P7.2 y validar `main` |
| P9 piloto | ⏳ Pendiente | Después de P7/P8 |

## Backend, calidad y seguridad

### P0 — Integridad funcional crítica ✅
- P0.1 Integridad de asignación de stock.
- P0.2 Restricciones únicas en base de datos.
- P0.3 Flujo consistente de pedidos.
- P0.4 Seguridad crítica inicial.

### P1 — Base técnica y calidad ✅
- P1.1 Configuración por ambientes.
- P1.2 Respuestas de error seguras.
- P1.3 Migraciones versionadas y arranque sin `sequelize.sync()`.
- P1.4 Baseline de calidad y lint estricto.
- P1.5 CI obligatorio mediante Quality Gate.
- P1.6 Auditoría y actualización segura de dependencias.

### P2 — Autorización por alcance e historial de activos ✅
- P2.1 Administrador General definido por `oficina.es_central`.
- P2.2 `RESPONSABLE` limitado a la gestión de su propia oficina.
- P2.3 Historial transaccional de altas, traslados, cambios de estado y bajas.

### P3 — Resiliencia operativa y recuperación ✅
- P3.0 Documentación formal de hoja de ruta.
- P3.1 Backup, checksum y restauración segura MySQL con restore drill en CI.
- P3.2 Health checks, Request ID, logging estructurado y apagado controlado.
- P3.3 Runbook de recuperación, rollback e incidentes (`docs/OPERATIONS.md`).

### P4 — Integración con MySQL real de test ✅
- Flujos completos con base MySQL descartable.
- Usuarios, activos, stock, pedidos y movimientos.
- Casos negativos de autorización por rol/oficina.
- Fixtures reproducibles y aislados.
- Migraciones aplicadas y reejecutadas de forma segura en CI.

### P5 — Protección contra regresiones y E2E ✅
- Playwright/Chromium para recorridos críticos.
- Login, activos, solicitudes, provisión, reportes y adjuntos.
- Validación de permisos por rol.
- Regresión específica de navegación/sidebar.
- Los recorridos críticos forman parte del Quality Gate.

### P6 — Consistencia, concurrencia e idempotencia ✅
- Operaciones simultáneas de stock/pedidos protegidas.
- Suite de concurrencia/idempotencia incluida en Quality Gate.
- Migración 003 validada de forma idempotente.
- Operaciones sensibles preparadas para claves de idempotencia donde corresponde.

### P6.1 — Cierre de seguridad pre-staging ✅

PR de cierre: #13 (`security/prestaging-hardening`).

Implementado y validado:
- transporte de sesión mediante cookie `HttpOnly`;
- `SameSite=Strict` y `Secure` en production;
- prefijo `__Host-` para la cookie de producción;
- production fuerza transporte por cookie y no expone el JWT al navegador;
- `/api/auth/me` como autoridad de sesión;
- JWT fuera de `localStorage` en el frontend final;
- Axios con credenciales y `AuthProvider`/`PrivateRoute` gobernados por backend;
- validación de `Origin` y CORS con credenciales para sesión por cookie;
- rate limiting de login/MFA;
- `trust proxy`, CSP y HSTS configurables de forma explícita;
- MFA/TOTP obligatorio para `ADMIN` en producción;
- secretos MFA cifrados con AES-256-GCM y códigos de recuperación almacenados como hashes;
- migración 005 para MFA administrativo;
- E2E de setup y segundo acceso MFA, cookie HttpOnly, ausencia de JWT local y logout real;
- revalidación integral con MySQL, auth hardening, P6, health, backup/restore y Chromium.

Evidencia de cierre definitivo:
- base reconciliada antes del merge con `main` `45ae8ad48d050390aa87ea9ad646bb79410f6ceb`;
- HEAD final de PR #13: `541c44c122ded5926f32810bcb95c3e3e4317fcd`;
- Quality Gate pre-merge #150: **verde**;
- PR #13 mergeado mediante merge commit `3ec6492a9a1c257c232fafef1e64d1ae5920dc9a`;
- Quality Gate post-merge #151 sobre `main`: **verde**, incluido Chromium E2E;
- cierre documental PR #19 integrado en `0cbfcd0e83f9cae95e5a6a8e3859202ac366d6b9`;
- Quality Gate post-cierre #153 sobre ese `main`: **verde**, incluido Chromium E2E;
- PR #16 fue únicamente evidencia de integración temporal y quedó **cerrado sin merge**.

El detalle contractual queda en `docs/backend-security-architecture.md` y `docs/frontend-design-system.md`.

## Frontend / UX/UI

### Bloque A — Design System e infraestructura UI ✅
- Design tokens y kit reusable.
- Login, AppShell, Dashboard y Activos.
- Navegación por rol y accesibilidad base.

### Bloque B — Operación de inventario ✅
- Insumos.
- Stock por oficina.
- Consumo de oficina.
- Movimientos de stock.
- Adjuntos.

### Bloque C — Flujos administrativos ✅
- Solicitudes.
- Pedido mensual.
- Historial/provisión.
- Notificaciones.
- Reportes.

### Bloque D — Administración y cierre UX ✅
- Usuarios.
- Bitácora.
- Diálogos reutilizables.
- Estados loading/error/empty/retry.
- Responsive y revisión de accesibilidad.
- Paneles de adjuntos alineados al Design System.
- Persistencia visual del sidebar y E2E específico.

### Bloque E — Refresh visual completo ✅
- Lenguaje visual inspirado en Admina, implementado con CSS propio.
- Sin incorporar Tailwind ni copiar código de la plantilla.
- Sidebar/topbar, cards, KPI, inputs, botones, badges y tablas refinados.
- Propagación a todos los módulos autenticados.
- `prefers-reduced-motion`.
- Contraste WCAG 2.2 AA reforzado.
- Aislamiento de colisiones CSS entre flujos administrativos.

Integración UX final:
- PR #11: mergeado.
- HEAD UX final previo al merge: `fa6941b830fbcb621b6342ce878c6f2e7a89dd54`.
- Merge commit en `main`: `0cb1f5285ca150b41bc17859eb10f607c784f6cc`.
- Quality Gate pre-merge: #140, verde.
- P6.1 preserva esta base y agrega el contrato de autenticación seguro sin reemplazar el refresh A–E.

Detalles de frontend: `docs/frontend-design-system.md`.

## Bloque activo

### P7 — Staging y despliegue controlado 🟡 integración final pendiente

**Rama de continuidad:** `ops/p7-staging-real`.

P7.1 quedó integrado en `main`. P7.2 ya fue validado sobre infraestructura real; P7 completo se cerrará formalmente cuando PR #22 se integre y el Quality Gate post-merge sobre `main` quede verde.

#### P7.1 — contrato y guardas reproducibles ✅

Implementado:
- staging mantiene `NODE_ENV=production` y usa `DEPLOY_ENV=staging` como etiqueta operativa;
- plantillas de variables separadas para backend/frontend;
- secretos y MySQL exclusivos por ambiente;
- preflight que rechaza configuraciones inseguras o ambiguas;
- `TRUST_PROXY_HOPS` explícito;
- identidad `environment`/`revision` en health;
- migraciones protegidas por backup verificado y asociado a la DB correcta;
- smoke post-deploy para frontend, health, sesión sin autenticar y CORS;
- smoke valida además el `DEPLOY_ENV` y `DEPLOY_REVISION` exactos para impedir falsos verdes contra otro entorno o revisión;
- archivos `.env.*` reales excluidos de Git, preservando solo plantillas `*.example`;
- runbook reproducible y rollback documentado;
- pruebas automáticas de los contratos de staging.

Evidencia de P7.1:
- PR #20: **integrado** mediante squash;
- HEAD validado previo al merge: `5860d4e85a0a64514bdfa8ede052dcdfff9f56ba`;
- Quality Gate pre-merge #158: **verde**, incluido Chromium E2E;
- squash en `main`: `eaad8daeb101f988e00310c408554e66affde1d4`;
- Quality Gate post-merge #159: **verde**, incluido Chromium E2E.

#### P7.2 — staging real ✅ validado; integración pendiente

Rama: `ops/p7-staging-real`. PR: #22.

Infraestructura validada el 11/09/2026:
- proyecto Railway privado `inventario-judicial-staging`;
- servicios permanentes: `frontend`, `backend`, `mysql`;
- `frontend` como único servicio público mediante HTTPS Railway;
- `backend` y `mysql` únicamente en red privada;
- MySQL 8 de staging sin datos judiciales reales;
- volumen `backend-data` de 500 MB montado en `/data`;
- volumen `mysql-data` de 500 MB montado en `/var/lib/mysql`;
- `UPLOAD_DIR=/data/uploads`;
- same-origin `/api` y `/health` mediante Caddy;
- `TRUST_PROXY_HOPS=1` validado por preflight sobre la topología real;
- secretos exclusivos de staging cargados fuera de Git.

Evidencia técnica:
- revisión de código validada: `d5933555d99d8f7dece3d9fc915e2e8704a710d0`;
- Quality Gate #165: **verde completo**, incluido Chromium E2E, MySQL, auth hardening, MFA, P6, health y backup/restore;
- cliente de runtime corregido a `mysql-community-client` 8.0.46 para compatibilidad con `caching_sha2_password`, sin degradar autenticación MySQL;
- `deploy:preflight`: verde;
- backup real `/data/backups/pre-migrate-p7.sql` creado y verificado por SHA-256;
- migraciones 001–005 aplicadas mediante `deploy:migrate` únicamente después del backup verificado;
- `db:status`: todas las migraciones `[x]`;
- `/health/live` y `/health/ready`: verdes con identidad exacta `staging@d5933555...`;
- smoke post-deploy ejecutado desde runner externo temporal: verde para frontend, health, `/api/auth/me` sin sesión y CORS con credenciales;
- runner temporal eliminado después de la validación;
- backup y metadata permanecieron en `/data/backups` después de redeploys posteriores, demostrando persistencia física del volumen;
- contrato de adjuntos apunta al mismo volumen mediante `UPLOAD_DIR=/data/uploads` y está protegido por `test:upload-storage` en Quality Gate;
- logs/build/deploy accesibles y utilizados durante diagnóstico real;
- rollback inspeccionado/simulado en modo read-only: volúmenes preservados, migraciones no se revierten automáticamente y cualquier incompatibilidad de esquema exige restore seguro o corrección hacia adelante según `docs/OPERATIONS.md`.

El entorno real y los detalles de operación están documentados en `docs/STAGING.md` y `docs/RAILWAY_STAGING.md`.

**Paso pendiente para cerrar P7 completo:** integrar PR #22 a `main`, ejecutar/verificar Quality Gate post-merge y actualizar esta continuidad únicamente si el estado real de `main` difiere de lo documentado.

No iniciar P8 antes de ese cierre.

### P8 — Escalabilidad y rendimiento ⏳
- Medición de consultas y endpoints críticos.
- Índices y paginación.
- Límites de carga, uploads y reportes.
- Revisión de queries N+1 y payloads excesivos.
- Pruebas de carga apropiadas al volumen del piloto.
- Presupuestos de rendimiento frontend y backend.

### P9 — Operación de piloto ⏳
- Soporte e incident response.
- Alta controlada de oficinas/usuarios.
- Procedimiento de moderación/administración operativa.
- Indicadores de uso, errores y tiempos de respuesta.
- Revisión periódica de backups y restore drill.
- Criterios de salida del piloto y paso a producción institucional.

## Deuda técnica / decisiones diferidas

No abrir estos puntos como bloques paralelos mientras P7 esté en curso, salvo que bloqueen seguridad o despliegue:

- reemplazar diálogos nativos restantes de asignación de stock, consumo y provisión por el componente accesible definitivo;
- decidir adopción frontend explícita de `Idempotency-Key` en operaciones críticas después de estabilizar el contrato de despliegue;
- evaluar primitivas especializadas (por ejemplo Radix) solo cuando exista una necesidad concreta;
- no introducir Tailwind únicamente por motivos estéticos: el Design System actual es CSS propio.

## Fuente de verdad documental

- **Estado y próximos pasos:** `ROADMAP.md`.
- **Mapa de documentos:** `docs/README.md`.
- **Frontend / UX / Design System / contrato auth cliente:** `docs/frontend-design-system.md`.
- **Backend / autenticación / autorización / P6.1:** `docs/backend-security-architecture.md`.
- **Operación, backup, restore e incidentes:** `docs/OPERATIONS.md`.
- **Staging, preflight, deploy, smoke y rollback:** `docs/STAGING.md`.
- **Staging Railway real:** `docs/RAILWAY_STAGING.md`.
- **Evidencia de implementación:** commits, PRs y Quality Gates.

Si existe contradicción entre un PR histórico y esta hoja de ruta, debe verificarse el estado real de `main` y actualizarse este documento en el siguiente PR de continuidad.

## Reglas de trabajo

1. No desarrollar directamente sobre `main`.
2. Un bloque lógico = un commit identificable, salvo correcciones absorbidas antes del merge.
3. No mergear con Quality Gate fallando.
4. Revisar el diff completo del PR antes del merge.
5. No ejecutar cambios destructivos de base sin preflight y respaldo verificado.
6. No usar `npm audit fix --force` de manera automática.
7. No introducir permisos basados en nombres visibles o decisiones del frontend.
8. Toda autorización sensible se valida en backend.
9. Toda migración debe ser versionada e idempotente o fallar de forma segura.
10. Los PR de integración/validación no se mergean si están marcados explícitamente como temporales.
11. **Antes de abrir un bloque nuevo, releer este `ROADMAP.md` y confirmar el punto exacto de continuidad.**
12. **Un bloque no se considera cerrado hasta que `ROADMAP.md`, el documento técnico correspondiente, CI y estado de Git estén alineados.**
