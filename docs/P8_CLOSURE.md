# P8 — Cierre de rendimiento y gate de entrada al piloto

## Estado

**P8.7 listo para cierre formal.**

**Estado de entrada a P9/piloto: GO técnico, condicionado al Quality Gate final de esta rama, merge y Quality Gate post-merge.**

P8.0–P8.6 están integrados en `main@cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044` y el Quality Gate post-merge #221 quedó verde completo. Railway staging fue promovido a esa misma revisión y backend/frontend quedaron `SUCCESS`.

El gate operativo final de P8.7 fue ejecutado el 13/09/2026 desde Railway SSH y desde un cliente externo. Quedaron verdes `deploy:preflight`, `db:status`, backup + verificación SHA-256 y `deploy:smoke`.

Existe una desviación operativa real: el deployment de esta revisión se realizó antes de generar el nuevo backup `pre-pilot.sql`. No se oculta ni se reescribe como backup pre-deploy. No hubo migraciones P8 nuevas durante esa promoción; posteriormente se verificó que el schema estaba al día y se generó/verificó el backup pre-piloto.

P9 no se considera iniciado hasta que el commit documental final pase Quality Gate, sea integrado a `main`, el Quality Gate post-merge quede verde y se relea `ROADMAP.md`.

---

## Evidencia consolidada P8

### P8.0 — Baseline y metodología

- dataset sintético reproducible: 6000 activos + 300 insumos;
- presupuestos de API, frontend y carga versionados;
- artifacts de CI;
- hallazgo inicial: listado global de Activos con payload de ~3,33 MB.

### P8.1 — Perfilado backend/MySQL

- Activos sin N+1 clásico;
- costo principal localizado en materialización/payload global;
- Dashboard con agregaciones redundantes;
- autorización indexada y de costo bajo;
- sin índices especulativos.

### P8.2 — Queries, paginación y proyección

- Activos Dirección: ~224 ms → ~11 ms p95 en la medición de referencia;
- payload ~3,33 MB → ~9 KB;
- paginación y filtros server-side;
- proyección reducida;
- Dashboard reduce consultas redundantes;
- permisos y alcance por oficina preservados.

### P8.3 — Payloads, uploads y reportes

- catálogo ligero de activos;
- Solicitudes/Adjuntos dejan de consumir listado global;
- `ruta_archivo` no se expone en respuestas;
- límites MIME/tamaño/compresión y autorización preservados;
- preparación de reportes optimizada sin cambiar reglas funcionales.

### P8.4 — Rendimiento frontend

- pantallas protegidas con lazy loading;
- JS inicial gzip ~265 KB → ~130 KB;
- carga inicial JS+CSS reducida aproximadamente a la mitad;
- Recharts aislado fuera de la carga inicial;
- Inter reducido a Latin 400;
- accesibilidad/permiso/navegación preservados.

### P8.5 — Carga

- lecturas hasta concurrencia 20 sin saturación crítica;
- 0 errores HTTP en escenarios de referencia;
- escrituras Stock identificadas como primera zona sensible;
- invariantes P6 e idempotencia correctas.

### P8.6 — Optimización + regresión

- perfil SQL c1/c20 de contención;
- lock central `Insumo ... FOR UPDATE` concentra la espera bajo competencia por el mismo insumo;
- ese lock evita doble gasto;
- no existe mejora productiva segura/material demostrada que justifique relajar o rediseñar locks;
- decisión: `preserve_consistency_locks_and_regression_guards`;
- sin cambios de lógica productiva.

---

## Evidencia de CI previa al cierre P8.7

Revisión desplegada y previamente validada:

`main@cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`

Quality Gate post-merge **#221: SUCCESS**.

Incluye:

- auditorías de dependencias;
- lint/build frontend;
- sintaxis backend y `npm test`;
- migraciones idempotentes en MySQL descartable;
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
- Chromium E2E crítico.

El cierre definitivo de P8 exige además Quality Gate completo sobre el HEAD documental de P8.7 y un Gate post-merge sobre el SHA final de `main`.

---

## Railway staging promovido

Proyecto Railway: `inventario-judicial-staging`.

El environment de Railway se llama internamente `production`, pero el proyecto y sus recursos continúan siendo el entorno aislado de staging.

Promoción aplicada el 13/09/2026:

- backend source branch: `main`;
- frontend source branch: `main`;
- backend `DEPLOY_REVISION=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`;
- backend deployment `27006a54-098c-440b-bb56-1117455e728d`: `SUCCESS`;
- frontend deployment `e1f9f77f-c8bd-4998-a064-aa3fe64123ab`: `SUCCESS`;
- MySQL continuó `SUCCESS` y sin redeploy.

Railway confirmó en deployments y logs:

```text
branch=main
revision=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
environment=staging
database=inventario_judicial_staging
database_connected
```

Healthcheck Railway:

```text
backend /health/ready -> 200
frontend / -> 200
```

### Persistencia

Después del redeploy siguieron presentes:

- volumen backend `/data`;
- `/data/uploads`;
- `/data/backups`;
- volumen MySQL `/var/lib/mysql`;
- archivos físicos de MySQL.

No se detectó pérdida de volúmenes durante la promoción.

---

## Gate operativo final P8.7 — EJECUTADO ✅

### 1. Preflight de despliegue

Ejecutado por Railway SSH sobre el servicio `backend`:

```text
✓ Preflight de despliegue aprobado.
Entorno: staging
Revisión: cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
Base: inventario_judicial_staging
trust proxy hops: 1
```

Resultado: **PASS**.

### 2. Estado de migraciones

`npm run db:status` confirmó como aplicadas:

```text
[x] 20260909_001_baseline_schema.js
[x] 20260909_002_oficina_central.js
[x] 20260910_003_operaciones_idempotentes.js
[x] 20260910_004_auth_sessions.js
[x] 20260911_005_admin_mfa.js
```

Resultado:

```text
✓ Base de datos al día.
```

No se ejecutó ninguna migración durante P8.7.

### 3. Backup pre-piloto

Creado después del deployment, antes de habilitar piloto:

```text
/data/backups/pre-pilot.sql
```

Evidencia:

```text
SHA-256: 604f27ccf2b954cd363e77276bf16911047c9515c1d73b77c458ab455beeb18d
Bytes: 23746
```

`db:backup:verify` confirmó exactamente el mismo SHA-256 y tamaño.

Resultado: **PASS**.

Este backup es **pre-piloto**, no pre-deploy. La desviación de orden queda registrada. Al no existir migraciones P8 nuevas y estar el schema 001–005 al día, no existe una migración pendiente que deba revertirse por este cierre.

La obligación de mantener copia fuera del host se activa antes de conservar información institucional que no pueda reconstruirse. El staging actual se mantiene como entorno de validación y no reemplaza una estrategia de backup institucional.

### 4. Smoke externo

Ejecutado desde fuera del contenedor contra el origen público de staging, esperando explícitamente:

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

Resultado: **PASS**.

El probe `/api/auth/me` sin sesión devolvió el 401 esperado y el contrato CORS con credenciales coincidió con el frontend de staging. Login, MFA, roles y aislamiento por oficina permanecen cubiertos por las suites de seguridad/integración/E2E del Quality Gate; P8 no introdujo cambios de contrato de autenticación después de esa validación.

---

## Desviación operativa registrada

El runbook exige backup verificado antes de un deployment/migración que pueda requerir recuperación.

En la promoción P8.7:

- el deployment fue autorizado y aplicado antes de generar un nuevo backup específico de esa promoción;
- no hubo migraciones P8 nuevas;
- el backend arrancó conectado a `inventario_judicial_staging` y `/health/ready` permaneció verde;
- después se ejecutó `deploy:preflight` y se confirmó la revisión esperada;
- `db:status` confirmó schema 001–005 completamente aplicado;
- se creó y verificó `/data/backups/pre-pilot.sql` con SHA-256 estable;
- el smoke externo quedó verde.

Conclusión: la desviación de orden queda documentada como lección operativa, pero no constituye un bloqueo técnico para el piloto. En próximos deploys se debe volver al orden del runbook: **preflight → backup verificado → migración/deploy cuando corresponda → smoke**.

---

## Criterios GO de piloto

### Seguridad

GO solo si:

- MFA ADMIN obligatorio;
- cookie HttpOnly/SameSite/Secure según contrato;
- CORS/origin limitado al frontend esperado;
- backend y MySQL sin exposición pública normal;
- secretos fuera de Git;
- auth/MFA/roles/alcance por oficina verdes;
- no existen incidentes SEV-1/SEV-2 abiertos.

### Integridad

GO solo si:

- P6 verde;
- stock central nunca negativo;
- stock de oficina exacto;
- una escritura física por operación lógica idempotente;
- historial/movimientos exactos;
- locks críticos preservados;
- no hay migraciones pendientes.

### Recuperación

GO solo si:

- backup reciente verificado;
- copia fuera del host antes de depender de datos institucionales irremplazables;
- restore drill CI verde;
- RPO objetivo: hasta 24 h;
- RTO objetivo: hasta 4 h;
- rollback de aplicación identificado y compatible con el schema actual.

### Rendimiento

Se usan como referencia los presupuestos de `performance/budgets.json`.

Hard limits de carga actuales:

- `auth_me_admin`: 500 ms p95;
- Dashboard: 750 ms;
- Activos: 600 ms;
- Pedidos: 500 ms;
- Stock lectura: 500 ms;
- mix operativo: 750 ms;
- login: 600 ms;
- Stock escritura única: 800 ms;
- Stock idempotente: 1000 ms;
- error rate admitido en los escenarios de carga: **0 %**.

Los targets son alerta temprana, no SLA contractual.

### Frontend

- JS inicial gzip target 180 KB / hard 300 KB;
- fuentes target 60 KB / hard 80 KB;
- no revertir lazy loading ni volver a carga inicial monolítica sin medición.

---

## Reglas de detención/escalamiento durante piloto

### Detener inmediatamente / SEV-1

- pérdida o corrupción confirmada de datos;
- stock negativo o doble gasto;
- duplicación física de una operación idempotente;
- acceso no autorizado;
- secreto comprometido;
- restore/backup inconsistente cuando sea necesario recuperar.

### Escalar como SEV-2

- `/health/ready=503` persistente;
- fallas repetitivas de login/MFA/permiso;
- función crítica indisponible para una oficina;
- errores 5xx repetitivos;
- degradación sostenida por encima de hard limits del escenario comparable.

No detener por un único pico de latencia aislado en runner/infraestructura; exigir repetición o impacto real salvo que exista corrupción/integridad comprometida.

---

## Observabilidad mínima de piloto

Registrar y revisar:

- disponibilidad de `/health/live` y `/health/ready`;
- revisión desplegada;
- errores 5xx;
- errores de auth/MFA;
- duración de requests por endpoint crítico;
- incidentes por oficina;
- crecimiento de MySQL y `/data`;
- backup más reciente y fecha de verificación;
- restore drill mensual;
- escrituras de Stock con errores/conflictos/replays;
- uso CPU/RAM/disco Railway.

Línea base de recursos observada antes del piloto, con ambiente prácticamente ocioso:

- backend ~73 MB RAM;
- frontend ~23 MB RAM;
- MySQL ~397 MB RAM;
- backend disk ~0,033 GB;
- MySQL disk ~0,158 GB.

Estos valores son baseline ocioso, no capacidad máxima ni SLA.

---

## Criterio de cierre P8.7

Checks operativos pre-piloto:

- `deploy:preflight` ✅;
- `db:status` ✅;
- backup `pre-pilot.sql` + SHA-256 verificado ✅;
- smoke externo ✅;
- revisión desplegada exacta ✅;
- staging/MySQL/volúmenes saludables ✅;
- criterios GO/SEV/observabilidad documentados ✅.

Faltan únicamente los controles de integración documental de esta rama:

1. actualizar `ROADMAP.md` y el índice documental;
2. ejecutar Quality Gate completo sobre el HEAD final de P8.7;
3. revisar diff y abrir/integrar PR;
4. confirmar Quality Gate post-merge sobre el SHA final de `main`;
5. releer `ROADMAP.md` antes de abrir P9.

Hasta completar esos cinco pasos, **P8.7 no se considera formalmente cerrado y P9 no se considera iniciado**.
