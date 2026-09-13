# P8 — Cierre de rendimiento y gate de entrada al piloto

## Estado

**P8.7 cerrado documental y técnicamente el 13/09/2026.**

**Estado de entrada a P9/piloto: NO-GO operativo temporal.**

P8.0–P8.6 están integrados en `main@cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044` y el Quality Gate post-merge #221 quedó verde completo. Railway staging fue promovido a esa misma revisión y backend/frontend quedaron `SUCCESS`.

El NO-GO no se debe a un defecto de código ni a una regresión de rendimiento. Se debe a que, con las herramientas disponibles en esta sesión, no fue posible ejecutar dentro del contenedor los comandos operativos del runbook que deben preceder/acompañar la promoción (`deploy:preflight`, `db:status`, backup+verify y smoke externo). Además, el deployment ya había sido aplicado antes de crear un nuevo backup pre-deploy; esta desviación queda registrada y no se reescribe como si hubiera ocurrido de otra manera.

P9 no debe iniciarse hasta completar manualmente el checklist operativo final de este documento.

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

## Evidencia final de CI

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

---

## Promoción de Railway staging

Proyecto Railway: `inventario-judicial-staging`.

El environment de Railway se llama internamente `production`, pero continúa siendo el entorno aislado de staging del proyecto.

Promoción aplicada el 13/09/2026:

- backend source branch: `main`;
- frontend source branch: `main`;
- backend `DEPLOY_REVISION=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`;
- backend deployment `27006a54-098c-440b-bb56-1117455e728d`: `SUCCESS`;
- frontend deployment `e1f9f77f-c8bd-4998-a064-aa3fe64123ab`: `SUCCESS`;
- MySQL continuó `SUCCESS` y sin redeploy.

Railway confirmó que ambos deployments provienen de:

```text
branch: main
commit: cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
```

### Health y revisión

Logs del backend al arrancar:

```text
environment=staging
revision=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044
database=inventario_judicial_staging
event=database_connected
```

Railway healthcheck del backend:

```text
GET /ready -> 200
```

con la misma revisión y `environment=staging` en el log estructurado.

Frontend healthcheck Railway:

```text
GET / -> 200
```

### Persistencia

Después del redeploy siguen presentes:

- volumen backend `/data`;
- `/data/uploads`;
- `/data/backups`;
- volumen MySQL `/var/lib/mysql`;
- archivos físicos de MySQL.

No se detectó pérdida de volúmenes durante la promoción.

---

## Desviación operativa registrada

El runbook exige backup verificado antes de despliegue/migración.

En esta promoción P8.7:

- el deployment fue autorizado y aplicado antes de generar un nuevo backup pre-deploy;
- la integración Railway disponible no permite ejecutar comandos arbitrarios dentro del contenedor en ejecución;
- por lo tanto no se pudo ejecutar desde esta sesión `deploy:preflight`, `db:status`, `db:backup`, `db:backup:verify` ni `deploy:smoke`;
- no hubo migraciones P8 nuevas aplicadas por esta promoción;
- Railway sí validó startup, conexión a MySQL y healthcheck `/ready=200`.

Esta desviación **no debe ocultarse**. El siguiente paso operativo antes de P9 es ejecutar manualmente el checklist de abajo mediante Railway CLI/SSH autenticado u otro mecanismo institucional aprobado.

---

## Gate obligatorio antes de P9

Ejecutar sobre staging y conservar evidencia sin secretos:

```bash
railway ssh --service backend -- npm run deploy:preflight
railway ssh --service backend -- npm run db:status
railway ssh --service backend -- npm run db:backup -- --output /data/backups/pre-pilot.sql
railway ssh --service backend -- npm run db:backup:verify -- /data/backups/pre-pilot.sql
```

Después ejecutar desde contexto externo al backend:

```bash
npm run deploy:smoke
```

con los origins de staging ya configurados.

### Resultado exigido

- preflight: verde;
- `db:status`: sin migraciones pendientes;
- backup creado;
- SHA-256 verificado;
- copia fuera del host cuando staging contenga información que deba conservarse;
- `/health/live=200`;
- `/health/ready=200`;
- `environment=staging`;
- `revision=cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044` o SHA posterior aprobado;
- smoke externo verde;
- login/MFA y permisos básicos verificados si el smoke no los cubre.

Hasta entonces: **NO-GO para P9**.

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
- copia fuera del host cuando corresponda;
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

P8.7 se considera cerrado porque:

- P8.0–P8.6 fueron consolidados;
- Quality Gate final de código está verde;
- staging fue promovido a `main@cb7b9fc...`;
- deployments backend/frontend quedaron `SUCCESS`;
- Railway confirmó `environment=staging`, revisión esperada, conexión MySQL y `/ready=200`;
- persistencia de volúmenes se mantuvo;
- criterios GO/NO-GO, observabilidad y reglas de escalamiento quedaron documentados;
- la desviación de backup/preflight/smoke queda registrada;
- P9 permanece bloqueado hasta completar el gate operativo manual pre-piloto.

**P8 queda técnicamente cerrado. P9 NO está autorizado todavía.**
