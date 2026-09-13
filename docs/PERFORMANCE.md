# P8 — Rendimiento y escalabilidad

## P8.0 — Baseline y metodología ✅

P8.0 establece la línea base reproducible de rendimiento del Sistema de Inventario Judicial. Este bloque **no optimiza** el sistema: mide el comportamiento actual con un dataset sintético representativo del piloto, fija presupuestos y deja evidencia comparable para P8.1–P8.7.

## Objetivos

- medir tiempos de respuesta p50/p95/p99 y tamaño de respuesta en recorridos críticos;
- medir el peso del build frontend comprimido con gzip;
- ejecutar siempre sobre una base descartable `test/ci/e2e`, nunca sobre staging o producción;
- usar datos sintéticos, sin información judicial real;
- distinguir entre **objetivo** y **techo duro**;
- conservar resultados como artifacts del Quality Gate;
- usar la misma metodología antes y después de cada optimización.

## Dataset de referencia

El baseline prepara automáticamente:

- **6000 activos** totales, escala aproximada del piloto inicial (~300 bienes × ~20 oficinas);
- **300 insumos**;
- activos distribuidos entre todas las oficinas disponibles en el catálogo;
- usuarios sintéticos ADMIN, RESPONSABLE y USUARIO ya utilizados por integración/E2E.

El dataset se genera con `scripts/performance-fixtures.js`, reutilizando las guardas de `integration-fixtures.js`. Por diseño solo opera sobre una base de test/CI.

## Escenarios API

| Escenario | Propósito |
| --- | --- |
| `health_ready` | readiness con comprobación de DB |
| `login_admin` | autenticación + bcrypt + creación de sesión |
| `auth_me_admin` | validación de sesión autenticada |
| `activos_admin` | listado global de activos a escala piloto |
| `activos_responsable` | listado acotado a una oficina |
| `dashboard_admin` | agregaciones del panel principal |
| `insumos_admin` | catálogo de insumos a escala de referencia |

Para cada escenario se registran muestras, errores, códigos HTTP, promedio, p50/p95/p99, máximo y payload máximo en KB.

## Baseline inicial — Quality Gate #172

Evidencia capturada el 13/09/2026 sobre la rama `performance/p8-baseline`, dataset de 6000 activos + 300 insumos, Node 22 y MySQL 8.4 en GitHub Actions.

| Escenario | p50 | p95 | p99 | Payload | Errores |
| --- | ---: | ---: | ---: | ---: | ---: |
| `health_ready` | 3,14 ms | 5,74 ms | 5,74 ms | 0,07 KB | 0 |
| `login_admin` | 10,15 ms | 12,76 ms | 12,76 ms | 0,75 KB | 0 |
| `auth_me_admin` | 4,43 ms | 5,09 ms | 5,09 ms | 0,31 KB | 0 |
| `activos_admin` | 205,27 ms | **224,09 ms** | 224,09 ms | **3331,35 KB** | 0 |
| `activos_responsable` | 12,14 ms | 13,11 ms | 13,11 ms | 123,34 KB | 0 |
| `dashboard_admin` | 9,19 ms | 10,97 ms | 10,97 ms | 0,73 KB | 0 |
| `insumos_admin` | 10,44 ms | 15,85 ms | 15,85 ms | 111,53 KB | 0 |

### Hallazgo prioritario

El listado global de activos es el primer candidato claro de P8:

- el tiempo p95 de ~224 ms no supera el techo duro;
- el payload de **3,33 MB por respuesta** es excesivo para una consulta interactiva;
- el mismo endpoint acotado a una oficina baja a ~123 KB y ~13 ms p95;
- el controlador actual usa un `findAll` global sin paginación para Dirección.

Por lo tanto, P8.1/P8.2 deben estudiar primero el listado global de activos: plan de ejecución, cantidad de filas/columnas transferidas, paginación y contrato de búsqueda. P8.0 **no cambia todavía** ese contrato.

El objetivo de payload de `activos_admin` queda fijado en 1000 KB; el baseline actual debe aparecer como `target=warn`, pero continúa debajo del techo duro de 15 MB. Esto hace visible la deuda sin bloquear la línea base.

## Frontend — baseline inicial

Resultado del artifact `performance-frontend-baseline` del mismo Gate #172:

| Métrica | Valor | Objetivo | Estado |
| --- | ---: | ---: | --- |
| JavaScript gzip | 266,50 KB | ≤ 650 KB | pass |
| CSS gzip | 16,41 KB | ≤ 120 KB | pass |
| Total `dist` gzip | 500,91 KB | ≤ 800 KB | pass |
| Total `dist` raw | 1254,13 KB | informativo | — |

El bundle JS principal representa 266,50 KB gzip (932,69 KB raw) y será un punto de observación de P8.4, pero no incumple el presupuesto inicial.

## Presupuestos

Los límites versionados viven en `performance/budgets.json`.

Cada métrica tiene dos niveles:

1. **Objetivo:** si se supera, el resultado queda en `warn` y se convierte en candidato de P8.1–P8.6.
2. **Techo duro:** si se supera, el Quality Gate falla porque indica una regresión extrema o un escenario no operativo.

La línea base no debe modificarse para “hacer pasar” una optimización. Si un presupuesto necesita revisión, debe justificarse en PR con evidencia.

## Frontend

Después de `vite build`, `scripts/performance-frontend.js` registra:

- JS gzip total;
- CSS gzip total;
- peso gzip total del `dist`;
- peso raw total;
- archivos más pesados.

No se usa Lighthouse como gate en P8.0 porque su variabilidad en runners compartidos puede generar falsos positivos. Las métricas de experiencia de navegador se tratarán en P8.4 con metodología específica.

## Ejecución local

Requiere MySQL de test configurado y migrado.

```bash
npm run perf:fixtures
node server.js
npm run perf:baseline
npm --prefix inventario-frontend run build
npm run perf:frontend
```

Resultados:

```text
performance-results/api-baseline.json
performance-results/frontend-baseline.json
```

`performance-results/` es evidencia efímera y está excluido de Git.

## Quality Gate

P8.0 incorpora:

- **Run P8.0 API baseline:** recrea dataset, arranca backend, mide API y publica `performance-backend-baseline`;
- **Measure P8.0 frontend baseline:** analiza el build y publica `performance-frontend-baseline`;
- `test:performance-contracts`: protege dataset, scripts, budgets, workflow y esta metodología.

Después del baseline API, CI vuelve a cargar los fixtures E2E normales para mantener aislamiento.

## Interpretación y límites

- `target=pass`: dentro del objetivo.
- `target=warn`: candidato de optimización; no bloquea por sí solo.
- `hard=fail`: bloquea CI.
- cualquier error HTTP en una medición: bloquea CI.

Los milisegundos del runner compartido **no son un SLA de producción**. Sirven para comparar órdenes de magnitud y tendencias bajo una metodología estable. Los payloads y tamaños de bundle sí son comparables de forma más directa.

## Criterios de salida P8.0

- dataset y scripts reproducibles ✅;
- presupuestos versionados ✅;
- artifacts API/frontend en CI ✅;
- baseline numérico documentado ✅;
- Quality Gate #172 completo verde ✅;
- hallazgo prioritario identificado ✅;
- siguiente bloque: **P8.1 — Perfilado backend/MySQL**.

---

## P8.1 — Perfilado backend/MySQL ✅

P8.1 agrega perfilado reproducible sobre los mismos escenarios de P8.0 sin modificar todavía consultas, índices, paginación ni contratos API.

### Metodología

`scripts/performance-profile.js` ejecuta la aplicación dentro del proceso de test y activa temporalmente `sequelize.options.benchmark` solo durante el perfilado. `src/config/database.js` continúa con `logging: false`; staging y producción no reciben SQL logging adicional.

Por cada escenario se capturan:

- cantidad de queries por request;
- duración de cada query según benchmark de Sequelize;
- firma de SQL normalizado;
- tablas involucradas;
- repeticiones de la misma firma dentro del request;
- `EXPLAIN` de las consultas `SELECT` dominantes;
- índices visibles en `information_schema`;
- estimación de filas y flags como full scan, filesort o temporary table.

Los literales se reemplazan por `?` antes de persistir evidencia. El artifact **no guarda SQL crudo ni credenciales**. El resultado vive en `performance-results/backend-profile.json` y CI lo publica como `performance-backend-profile`.

El profiler usa 1 warmup y 3 muestras por escenario. La suma `sql_total_ms` es informativa: puede superar el tiempo HTTP cuando el endpoint ejecuta queries concurrentes con `Promise.all`.

### Evidencia inicial — Quality Gate #175

Dataset: 6000 activos + 300 insumos. Resultado: 0 errores en todos los escenarios y Quality Gate completo verde, incluido Chromium.

| Escenario | Queries/request | HTTP promedio | Observación principal |
| --- | ---: | ---: | --- |
| `login_admin` | 7 | 15,09 ms | transacción + usuario + rol + oficina + sesión + bitácora |
| `auth_me_admin` | 2 | 5,71 ms | validación de sesión + usuario/rol/oficina |
| `activos_admin` | 3 | **219,89 ms** | 2 auth + 1 query global de activos |
| `activos_responsable` | 3 | 12,75 ms | 2 auth + 1 query filtrada por oficina |
| `dashboard_admin` | **16** | 10,34 ms | múltiples agregaciones en paralelo; una firma repetida 3 veces |
| `insumos_admin` | 3 | 10,92 ms | 2 auth + 1 listado de insumos |

`health_ready` no aparece con SQL capturado porque la comprobación de health utiliza logging deshabilitado explícitamente; el tiempo HTTP sigue cubierto por P8.0.

### Hallazgo 1 — Activos Dirección no tiene N+1

`GET /api/activos` para Dirección ejecutó exactamente **3 queries por request**:

1. sesión válida en `auth_sessions`;
2. usuario + rol + oficina;
3. una única consulta de activos con JOIN a categoría y oficina.

No se observó N+1. La consulta funcional de activos promedió ~35 ms de SQL y fue la dominante; `EXPLAIN` mostró:

- `activos`: acceso `index` usando `PRIMARY`;
- recorrido inverso por `ORDER BY id DESC`;
- ~5686 filas estimadas;
- `categorias` y `oficinas`: `eq_ref` por `PRIMARY`.

Por lo tanto, la diferencia entre ~35 ms SQL y ~220 ms HTTP, junto con el payload de 3,33 MB medido en P8.0, indica que el problema principal es **traer/materializar/serializar 6000 registros completos**, no un JOIN N+1 ni la ausencia evidente de un índice para el orden actual.

Prioridad P8.2:
- paginación server-side;
- proyección de columnas para listados;
- filtros/búsqueda server-side compatibles con paginación;
- conservar aislamiento por oficina y permisos.

### Hallazgo 2 — Activos por oficina usa índice existente

Para RESPONSABLE, `EXPLAIN` mostró:

- `activos`: acceso `ref` usando índice `oficina_id`;
- ~223 filas estimadas para una oficina;
- `Using where; Backward index scan`;
- JOINs de categoría/oficina por clave primaria.

El SQL funcional rondó ~2 ms y el HTTP ~13 ms. No hay evidencia para reemplazar ese índice en P8.1.

### Hallazgo 3 — El costo de autorización es estable y bajo

Todos los endpoints protegidos medidos ejecutan dos consultas de seguridad:

- `auth_sessions` por `jti`/usuario/sesión vigente;
- usuario con JOIN a rol y oficina.

`EXPLAIN` mostró acceso `const`/índices existentes; cada consulta quedó aproximadamente entre 0,3 y 1 ms en esta muestra. Estas queries son parte deliberada de la seguridad y **no deben eliminarse para ganar rendimiento**.

Sí queda para P8.2 una mejora segura de proyección: el middleware carga actualmente columnas del usuario que no necesita para autorizar (por ejemplo password/secretos MFA). Reducir atributos puede disminuir transferencia DB→Node y aplicar principio de minimización sin cambiar el modelo de seguridad.

### Hallazgo 4 — Dashboard: repetición real, no N+1 de relaciones

`dashboard_admin` ejecutó **16 queries por request**. La única firma repetida detectada fue:

```sql
SELECT count(*) FROM pedidos_insumos WHERE estado = ?
```

Se ejecuta **3 veces por request** para ENVIADO, EN_REVISION y ENTREGADO. El mismo endpoint además ejecuta otra consulta agrupada por `estado` para `pedidos_por_estado`.

Esto no es un N+1 de ORM, pero sí una **agregación redundante/consolidable**. P8.2 debe estudiar reemplazar los tres `COUNT` por el resultado agrupado ya disponible, manteniendo exactamente el contrato de respuesta.

### Hallazgo 5 — Full scans detectados y prioridad real

`EXPLAIN` marcó full scans en varias agregaciones del dashboard:

- `COUNT(activos) WHERE activo=true`: ~5686 filas estimadas;
- counts de `insumos`: 300 filas;
- stock bajo de insumos: 300 filas;
- solicitudes/pedidos por estado: tablas prácticamente vacías en el dataset P8.0;
- detalle de stock bajo: full scan + filesort sobre 300 insumos;
- agrupación de movimientos de stock: temporary table sobre una tabla vacía en esta muestra.

No todos los full scans justifican un índice. En particular:

- `activo=true` tiene baja selectividad en el dataset (casi todos los activos están activos), por lo que un índice simple sobre `activo` no se debe agregar por reflejo;
- 300 insumos siguen siendo una cardinalidad pequeña;
- pedidos, solicitudes y movimientos no tienen volumen representativo en el fixture actual, por lo que no se deben crear índices basándose solo en estos planes.

P8.2 deberá evaluar índices únicamente cuando exista una consulta concreta, selectividad útil y mejora demostrable con `EXPLAIN`/baseline antes-después.

### Cardinalidad e `information_schema`

El snapshot de `information_schema.STATISTICS.CARDINALITY` devolvió 0 en varias tablas recién cargadas masivamente, mientras `EXPLAIN` sí estimó ~5686 filas para `activos`. Esto evidencia que esa cardinalidad de `information_schema` puede estar desactualizada inmediatamente después de los fixtures.

Consecuencia: P8.1 **no usa ese campo como base única para decidir índices**. Las decisiones se apoyan en plan de ejecución, filas estimadas, distribución conocida del dataset y medición antes/después. Si P8.2 necesita selectividad exacta, debe medir `COUNT(DISTINCT ...)` o actualizar estadísticas de forma controlada en la base descartable antes de concluir.

### Prioridades autorizadas para P8.2

1. **Activos Dirección:** paginación + proyección de columnas + filtros server-side; es la mayor ganancia esperable.
2. **Dashboard:** eliminar los tres counts redundantes por estado reutilizando/agregando una sola consulta agrupada.
3. **Auth middleware:** limitar atributos del usuario sin alterar validación de sesión/MFA/rol/oficina.
4. **Índices:** evaluar con evidencia; no crear índice simple `activo` ni índices de tablas vacías por intuición.
5. Mantener tests negativos de permisos, E2E, P6, MFA y baseline P8.0 en cada cambio.

### Criterios de salida P8.1

- profiler reproducible y sanitizado ✅;
- cantidad/duración de queries por escenario ✅;
- consultas dominantes identificadas ✅;
- candidatos repetidos/N+1 clasificados ✅;
- `EXPLAIN` capturado ✅;
- índices/planes revisados ✅;
- hallazgos documentados ✅;
- Quality Gate #175 completo verde ✅;
- siguiente bloque: **P8.2 — Índices, queries y paginación**.

## Ejecución local P8.1

```bash
npm run perf:fixtures
npm run perf:profile
```

Resultado:

```text
performance-results/backend-profile.json
```

## Continuidad

P8.2 debe optimizar únicamente los hallazgos anteriores y volver a ejecutar P8.0 + P8.1 para comparar antes/después. No se considera mejora si reduce tiempos pero rompe permisos, MFA, consistencia, E2E o aumenta payloads.
