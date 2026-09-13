# P8 — Cierre de rendimiento y gate de entrada al piloto

## Estado

**P8.7 tiene completo el cierre técnico-operativo y está en integración final.**

**Entrada a P9/piloto: GO técnico condicionado a Quality Gate verde sobre el HEAD final de PR #31, merge a `main`, Quality Gate post-merge verde y relectura de `ROADMAP.md`.**

P8.0–P8.6 están integrados en `main@cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`; su Quality Gate post-merge #221 quedó verde completo. Railway staging fue promovido a esa misma revisión y backend/frontend quedaron `SUCCESS`.

El gate operativo P8.7 se ejecutó el 13/09/2026 mediante Railway SSH y desde un cliente externo: `deploy:preflight`, `db:status`, backup + verificación SHA-256 y `deploy:smoke` quedaron verdes.

PR #31 contiene únicamente documentación de cierre. Quality Gate #222 quedó verde completo sobre el primer HEAD documental revisado, incluyendo Chromium E2E. La sincronización final de estado de este documento y `ROADMAP.md` modifica el HEAD; por regla del proyecto, ese HEAD final también debe pasar el Quality Gate antes del merge.

Existe una desviación operativa real: el deployment de la revisión de staging se realizó antes de generar el nuevo backup `pre-pilot.sql`. No se oculta ni se reescribe como backup pre-deploy. No hubo migraciones P8 nuevas durante esa promoción; posteriormente se verificó el schema y se generó/verificó el backup pre-piloto.

---

## Evidencia consolidada P8

### P8.0 — Baseline y metodología

- dataset sintético reproducible: 6000 activos + 300 insumos;
- presupuestos API/frontend/carga versionados;
- artifacts de CI;
- hallazgo inicial: listado global de Activos con payload ~3,33 MB.

### P8.1 — Perfilado backend/MySQL

- Activos sin N+1 clásico;
- costo principal localizado en materialización/payload global;
- Dashboard con agregaciones redundantes;
- autorización indexada y de costo bajo;
- sin índices especulativos.

### P8.2 — Queries, paginación y proyección

- Activos Dirección: ~224 ms → ~11 ms p95 en la medición de referencia;
- payload ~3,33 MB → ~9 KB;
- paginación/filtros server-side;
- proyección reducida;
- Dashboard reduce consultas redundantes;
- permisos y alcance por oficina preservados.

### P8.3 — Payloads, uploads y reportes

- catálogo ligero de activos;
- Solicitudes/Adjuntos dejan de consumir listado global;
- `ruta_archivo` no se expone en respuestas;
- límites MIME/tamaño/compresión y autorización preservados;
- reportes optimizados sin cambiar reglas funcionales.

### P8.4 — Rendimiento frontend

- pantallas protegidas con lazy loading;
- JS inicial gzip ~265 KB → ~130 KB;
- carga inicial JS+CSS reducida aproximadamente a la mitad;
- Recharts fuera de la carga inicial;
- Inter Latin 400;
- accesibilidad/permiso/navegación preservados.

### P8.5 — Carga

- lecturas hasta concurrencia 20 sin saturación crítica;
- 0 errores HTTP en escenarios de referencia;
- Stock identificado como primera zona sensible;
- invariantes P6 e idempotencia correctas.

### P8.6 — Optimización + regresión

- perfil SQL c1/c20 de contención;
- lock central `Insumo ... FOR UPDATE` concentra la espera al competir por el mismo insumo;
- el lock evita doble gasto;
- no existe mejora productiva segura/material demostrada que justifique relajar locks;
- decisión: `preserve_consistency_locks_and_regression_guards`;
- sin cambios de lógica productiva.

---

## Evidencia CI

### Base desplegada

`main@cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`

Quality Gate post-merge **#221: SUCCESS**.

Incluyó:
- auditorías de dependencias;
- lint/build frontend;
- sintaxis backend y tests;
- migraciones idempotentes;
- integración MySQL;
- auth hardening;
- MFA;
- P6 concurrencia/idempotencia;
- health;
- backup/restore drill;
- P8.0 baseline;
- P8.1 profiler;
- P8.5 load profile;
- P8.6 contention profile;
- Chromium E2E.

### Cierre documental P8.7

PR #31 — `P8.7: cierre documental y gate de entrada al piloto`.

Quality Gate **#222: SUCCESS** sobre el HEAD documental `84794777549008646c830bff7d9db8d67cc99ad0`:
- Frontend lint + build ✅;
- backend + MySQL ✅;
- migraciones ✅;
- integración MySQL ✅;
- auth hardening ✅;
- MFA ✅;
- P6 ✅;
- health ✅;
- backup/restore ✅;
- P8.0/P8.1/P8.5/P8.6 ✅;
- Chromium E2E ✅.

Como este documento y `ROADMAP.md` se sincronizan después de #222 para reflejar el estado real de PR/Gate, **el HEAD resultante debe volver a pasar el Quality Gate completo antes del merge**.

---

## Railway staging promovido

Proyecto: `inventario-judicial-staging`.

El environment interno de Railway se llama `production`, pero el proyecto completo continúa siendo staging aislado.

Promoción del 13/09/2026:
- backend source branch: `main`;
- frontend source branch: `main`;
- `DEPLOY_REVISION=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`;
- backend deployment `27006a54-098c-440b-bb56-1117455e728d`: `SUCCESS`;
- frontend deployment `e1f9f77f-c8bd-4998-a064-aa3fe64123ab`: `SUCCESS`;
- MySQL continuó `SUCCESS` sin redeploy.

Logs/health confirmaron:

```text
branch=main
revision=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
environment=staging
database=inventario_judicial_staging
database_connected
backend /health/ready -> 200
frontend / -> 200
```

Persistencia verificada después del redeploy:
- `/data`;
- `/data/uploads`;
- `/data/backups`;
- `/var/lib/mysql`;
- archivos físicos MySQL.

---

## Gate operativo final P8.7 — EJECUTADO ✅

### Preflight

```text
✓ Preflight de despliegue aprobado.
Entorno: staging
Revisión: cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
Base: inventario_judicial_staging
trust proxy hops: 1
```

Resultado: **PASS**.

### Migraciones

`db:status` confirmó:

```text
[x] 20260909_001_baseline_schema.js
[x] 20260909_002_oficina_central.js
[x] 20260910_003_operaciones_idempotentes.js
[x] 20260910_004_auth_sessions.js
[x] 20260911_005_admin_mfa.js
✓ Base de datos al día.
```

No se ejecutó ninguna migración durante P8.7.

### Backup pre-piloto

```text
/data/backups/pre-pilot.sql
SHA-256: 604f27ccf2b954cd363e77276bf16911047c9515c1d73b77c458ab455beeb18d
Bytes: 23746
```

`db:backup:verify` confirmó el mismo SHA-256 y tamaño.

Resultado: **PASS**.

Es un backup **pre-piloto**, no pre-deploy. La desviación de orden queda registrada. Al no existir migraciones P8 nuevas y estar el schema 001–005 al día, no existe una migración P8 pendiente que deba revertirse.

La copia fuera del host debe estar resuelta antes de depender de información institucional irremplazable. Staging sigue siendo un entorno de validación y no sustituye una política institucional de backup.

### Smoke externo

Esperado explícitamente:

```text
DEPLOY_ENV=staging
DEPLOY_REVISION=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
```

Resultado:

```text
✓ /health/live confirma staging@cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044.
✓ /health/ready confirma revisión esperada y acceso a MySQL.
✓ Frontend accesible y con raíz de aplicación.
✓ CORS/origin permite exactamente el frontend configurado con credenciales.
✓ Smoke test post-deploy completado.
```

El probe `/api/auth/me` sin sesión devolvió el 401 esperado. Login, MFA, roles y aislamiento por oficina permanecen protegidos por las suites de seguridad/integración/E2E; P8 no modificó esos contratos después de su validación.

---

## Desviación operativa

El runbook exige backup verificado antes de un deployment/migración que pueda requerir recuperación.

En esta promoción:
- deployment primero;
- no hubo migraciones P8 nuevas;
- startup/DB/readiness quedaron verdes;
- después se ejecutó preflight;
- `db:status` confirmó schema 001–005;
- se generó/verificó backup pre-piloto;
- smoke externo quedó verde.

Conclusión: no bloquea el piloto, pero los próximos despliegues deben volver al orden del runbook:

**preflight → backup verificado → migración/deploy cuando corresponda → smoke**.

---

## Criterios GO del piloto

### Seguridad

GO solo si:
- MFA ADMIN obligatorio;
- cookie HttpOnly/SameSite/Secure según contrato;
- CORS/origin limitado al frontend esperado;
- backend/MySQL sin exposición pública normal;
- secretos fuera de Git;
- auth/MFA/roles/alcance por oficina verdes;
- sin incidentes SEV-1/SEV-2 abiertos.

### Integridad

GO solo si:
- P6 verde;
- stock central nunca negativo;
- stock de oficina exacto;
- una escritura física por operación lógica idempotente;
- historial/movimientos exactos;
- locks críticos preservados;
- sin migraciones pendientes.

### Recuperación

GO solo si:
- backup reciente verificado;
- copia fuera del host antes de depender de datos institucionales irremplazables;
- restore drill CI verde;
- RPO objetivo hasta 24 h;
- RTO objetivo hasta 4 h;
- rollback compatible con schema actual.

### Rendimiento

Referencia: `performance/budgets.json`.

Hard limits actuales:
- `auth_me_admin`: 500 ms p95;
- Dashboard: 750 ms;
- Activos: 600 ms;
- Pedidos: 500 ms;
- Stock lectura: 500 ms;
- mix operativo: 750 ms;
- login: 600 ms;
- Stock escritura única: 800 ms;
- Stock idempotente: 1000 ms;
- error rate permitido en los escenarios de carga: **0 %**.

Son techos técnicos del escenario reproducible, no SLA contractual.

### Frontend

- JS inicial gzip target 180 KB / hard 300 KB;
- fuentes target 60 KB / hard 80 KB;
- no revertir lazy loading sin medición.

---

## Reglas de detención/escalamiento

### SEV-1 — detener inmediatamente

- pérdida/corrupción confirmada de datos;
- stock negativo o doble gasto;
- duplicación física de una operación idempotente;
- acceso no autorizado;
- secreto comprometido;
- restore/backup inconsistente cuando sea necesario recuperar.

### SEV-2 — escalar

- `/health/ready=503` persistente;
- fallas repetitivas de login/MFA/permiso;
- flujo crítico indisponible para una oficina;
- 5xx repetidos;
- degradación sostenida por encima del hard limit comparable.

Un pico aislado de latencia no detiene por sí solo el piloto salvo impacto en seguridad/integridad.

---

## Observabilidad mínima del piloto

Registrar/revisar:
- `/health/live` y `/health/ready`;
- revisión desplegada;
- 5xx;
- errores auth/MFA;
- duración por endpoint crítico;
- incidentes por oficina;
- crecimiento MySQL y `/data`;
- backup más reciente y verificación;
- restore drill mensual;
- Stock: errores/conflictos/replays;
- CPU/RAM/disco Railway.

Baseline ocioso observado antes del piloto:
- backend ~73 MB RAM;
- frontend ~23 MB RAM;
- MySQL ~397 MB RAM;
- backend disk ~0,033 GB;
- MySQL disk ~0,158 GB.

No son capacidad máxima ni SLA.

---

## Criterio de cierre P8.7

Completado:
- gate operativo staging ✅;
- preflight ✅;
- schema al día ✅;
- backup verificado ✅;
- smoke externo ✅;
- revisión desplegada exacta ✅;
- criterios GO/SEV/observabilidad ✅;
- `ROADMAP.md` actualizado ✅;
- `docs/README.md` actualizado ✅;
- PR #31 abierto ✅;
- diff limitado a documentación y revisado ✅;
- Quality Gate completo #222 verde sobre el HEAD documental previo ✅.

Pendiente exclusivamente para el cierre formal:
1. Quality Gate completo verde sobre el **HEAD final** posterior a esta sincronización documental;
2. merge de PR #31 a `main`;
3. Quality Gate post-merge verde sobre el SHA resultante de `main`;
4. relectura de `ROADMAP.md` desde `main` antes de abrir P9.

Hasta completar esos cuatro pasos, **P8.7 está en integración final y P9 no se considera iniciado**.
