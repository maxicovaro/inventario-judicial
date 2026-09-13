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

---

## P8.2 — Índices, queries y paginación ✅

P8.2 aplica únicamente las optimizaciones justificadas por P8.0/P8.1 y conserva intactos permisos, MFA, alcance por oficina, concurrencia e idempotencia. La primera ejecución completamente verde de la implementación fue el **Quality Gate #184** sobre la rama `performance/p8-query-pagination`.

### Cambios implementados

- `GET /api/activos` soporta contrato paginado con `page`, `page_size`, `q`, `estado` y `oficina_id`;
- tamaño por defecto 25 filas y máximo 100;
- búsqueda y filtros se resuelven en MySQL, no sobre 6000 objetos en el navegador;
- el listado proyecta únicamente las columnas necesarias para la tabla;
- `GET /api/activos/:id` carga el detalle completo solo al editar y conserva el mismo alcance por rol/oficina;
- los KPI de Activos se obtienen mediante agregación SQL independiente del contenido de la página;
- la pantalla React usa debounce de 300 ms, paginación accesible y tamaños 25/50/100;
- el middleware de autenticación proyecta solo atributos de usuario requeridos por autorización/MFA;
- Dashboard reutiliza la agregación agrupada de pedidos y elimina tres `COUNT` redundantes por estado;
- `scripts/performance-baseline.js` y `scripts/performance-profile.js` miden explícitamente el contrato `page=1&page_size=25`;
- la paginación y el aislamiento por oficina tienen prueba HTTP sobre MySQL real dentro de `test:integration`;
- los contratos estáticos P8.2 se ejecutan en `npm test` antes de preparar la base.

### Antes/después — Gate #172 vs Gate #184

Dataset idéntico: 6000 activos + 300 insumos.

| Escenario | Antes p95 | Después p95 | Antes payload | Después payload |
| --- | ---: | ---: | ---: | ---: |
| `activos_admin` | 224,09 ms | **11,35 ms** | 3331,35 KB | **9,16 KB** |
| `activos_responsable` | 13,11 ms | **7,81 ms** | 123,34 KB | **9,09 KB** |
| `dashboard_admin` | 10,97 ms | **8,80 ms** | 0,73 KB | 0,73 KB |

Resultados derivados:

- Activos Dirección: p95 reducido ~**94,9 %** (~19,7× más rápido en esta muestra);
- Activos Dirección: payload reducido ~**99,7 %** (~363× menor);
- Activos de oficina: p95 reducido ~40,4 %;
- Activos de oficina: payload reducido ~92,6 %;
- 0 errores HTTP en todos los escenarios del baseline.

Los milisegundos de GitHub Actions siguen siendo comparativos, no un SLA; la reducción de payload sí es estructural y directamente atribuible a la paginación/proyección.

### Perfil SQL después de P8.2

En Gate #184:

- `dashboard_admin`: **13 queries/request**, contra 16 en P8.1; desaparecieron los tres `COUNT(pedidos_insumos) WHERE estado=?` redundantes;
- `activos_admin`: el profiler registró 4 queries/request y ~9,69 ms HTTP promedio;
- `activos_responsable`: 4 queries registradas/request y ~8,06 ms HTTP promedio;
- auth conserva 2 queries indexadas/request y no se debilitaron controles de sesión/MFA.

Nota de instrumentación: la agregación SQL de resumen de Activos se ejecuta actualmente con `logging: false`, por lo que no aparece en el contador del profiler; el valor de 4 corresponde a queries capturadas por la instrumentación, no a un conteo absoluto de round-trips del endpoint. El rendimiento HTTP completo sí incluye esa agregación. Esta diferencia no altera la comparación de p95/payload y debe tenerse presente al interpretar el artifact P8.1.

### Decisión de índices

**P8.2 no agrega índices nuevos.** La decisión es deliberada y basada en evidencia:

- RESPONSABLE continúa usando el índice existente `oficina_id` (`ref` + backward index scan`);
- autenticación usa índices/PK y mantiene costo bajo;
- el orden global paginado no mostró un cuello de botella que justifique un índice adicional;
- `activo=true` tiene baja selectividad y un índice simple sobre el booleano no ofrece evidencia suficiente de beneficio;
- full scans restantes del Dashboard ocurren sobre ~300 insumos o tablas transaccionales con volumen insuficiente para justificar índices por intuición.

Agregar índices sin selectividad ni mejora medida aumentaría costo de escritura/mantenimiento sin una ganancia demostrada. Cualquier índice futuro debe volver a pasar `EXPLAIN` y baseline antes/después.

### Compatibilidad transitoria hacia P8.3

Por compatibilidad con los selectores existentes de Solicitudes y Adjuntos, `GET /api/activos` **sin parámetros de consulta** conserva temporalmente la respuesta legacy completa. La pantalla principal de Activos y las mediciones oficiales usan siempre el contrato paginado.

Esta compatibilidad queda como deuda explícita de **P8.3 — Payloads, uploads y reportes**, donde esos consumidores deberán migrarse a un catálogo ligero/búsqueda específica antes de retirar el modo legacy. No se considera una excusa para volver a utilizar el listado global completo en nuevas pantallas.

### Presupuestos después de la optimización

Tras demostrar la mejora, los presupuestos de Activos se endurecen para prevenir regresiones:

- p95 objetivo: **150 ms**; techo duro: **1000 ms**;
- payload objetivo: **100 KB**; techo duro: **500 KB**;
- aplica tanto a Dirección como a RESPONSABLE en el escenario paginado de 25 filas.

La finalidad es impedir que una futura modificación vuelva silenciosamente a respuestas de varios MB.

### Frontend

El cambio no aumentó el bundle:

- JS gzip: 266,50 KB → **264,85 KB**;
- CSS gzip: 16,41 KB → **16,41 KB**;
- total gzip: 500,91 KB → **499,26 KB**.

### Seguridad y regresión

Quality Gate #184 quedó verde completo con:

- lint/build frontend;
- `npm test`;
- MySQL real + migraciones;
- prueba dinámica P8.2 de paginación/búsqueda/filtros/alcance;
- auth hardening y MFA;
- P6 concurrencia/idempotencia;
- backup/restore;
- baseline P8.0;
- profiler P8.1;
- Chromium E2E.

### Criterios de salida P8.2

- paginación server-side ✅;
- búsqueda/filtros server-side ✅;
- proyección de columnas + detalle bajo demanda ✅;
- aislamiento por rol/oficina preservado ✅;
- Dashboard sin counts redundantes ✅;
- minimización de atributos de auth ✅;
- índices evaluados con `EXPLAIN` y no agregados sin evidencia ✅;
- mejora antes/después cuantificada ✅;
- presupuestos endurecidos ✅;
- Quality Gate de implementación #184 verde ✅;
- siguiente bloque: **P8.3 — Payloads, uploads y reportes**.

---

## P8.3 — Payloads, uploads y reportes ✅

P8.3 elimina la deuda transitoria de P8.2 en los consumidores de activos y revisa payloads, adjuntos y reportes sin debilitar permisos, MFA, persistencia ni controles de archivos. La implementación quedó completamente verde en el **Quality Gate #201** sobre la rama `performance/p8-payloads-uploads-reports` / PR #27.

### Catálogo ligero de activos

Se agregó `GET /api/activos/catalogo` con estas propiedades:

- proyección mínima: `id`, `nombre`, `codigo_interno`, `oficina_id`;
- solo activos vigentes y no dados de baja;
- búsqueda server-side por nombre, código interno o número de serie;
- límite 50 por defecto y máximo 500;
- ADMIN puede acotar por `oficina_id`;
- RESPONSABLE/usuario de oficina queda forzado a su propia oficina aunque intente enviar otra;
- contratos MySQL reales validan proyección, búsqueda, límites, exclusión de bajas y aislamiento por oficina.

Migración de consumidores:

- **Solicitudes** deja de descargar el listado global de ~6000 activos; Dirección selecciona primero la oficina y carga un catálogo acotado a esa dependencia, con máximo 500. El escenario de referencia continúa siendo ~300 bienes por oficina.
- **Adjuntos** deja de descargar el listado global; usa búsqueda server-side con debounce de 250 ms, cancelación de requests anteriores y máximo 50 coincidencias.
- los contratos estáticos P8.3 impiden reintroducir `api.get("/activos")` en esas pantallas.

### Medición oficial del catálogo — Gate #201

Dataset idéntico de referencia: 6000 activos + 300 insumos.

| Escenario | p95 | Payload | Errores | Presupuesto |
| --- | ---: | ---: | ---: | --- |
| `activos_catalogo_admin` | **8,89 ms** | **4,71 KB** | 0 | pass |
| `activos_catalogo_responsable` | **5,73 ms** | **4,73 KB** | 0 | pass |

Presupuesto protegido para ambos escenarios:

- p95 objetivo **150 ms**, techo duro **1000 ms**;
- payload objetivo **25 KB**, techo duro **100 KB**.

Los tiempos de runner son comparativos y no un SLA. El tamaño del payload sí demuestra estructuralmente que los selectores ya no necesitan transportar el inventario global.

### Adjuntos y uploads

La revisión detectó que el listado y la respuesta de subida podían exponer `ruta_archivo`, dato interno del almacenamiento que la UI no necesita. P8.3 lo elimina de ambos payloads.

Se preservan deliberadamente los controles existentes porque ya son adecuados para el piloto:

- tamaño máximo **10 MB**;
- allowlist MIME del middleware;
- imágenes redimensionadas hasta 1600 px sin agrandar originales;
- conversión JPEG con calidad 75;
- almacenamiento persistente compartido y cubierto por prueba;
- descarga y eliminación siguen resolviendo la ruta únicamente en backend después de verificar autorización;
- `res.download` continúa siendo el mecanismo de entrega del archivo autorizado.

No se elevan límites ni se relajan tipos para obtener rendimiento aparente.

### Reportes

Reporte general de pedidos:

- JSON y PDF reutilizan `obtenerDatosResumenPedidos`;
- las agregaciones independientes se ejecutan en paralelo con `Promise.all`;
- se evita duplicar la preparación de datos entre salida JSON y PDF;
- el PDF continúa transmitiéndose con `doc.pipe(res)`, sin acumular todo el documento en memoria antes de responder;
- el contrato dinámico verifica métricas JSON, restricción exclusiva ADMIN y un PDF válido `%PDF` con `Content-Disposition`.

Reporte mensual por oficina:

- proyecta solo atributos usados de pedido, detalle, insumo y oficina;
- pedido, consumos y stock actual se cargan en paralelo;
- se mantiene el mismo contrato de respuesta y el aislamiento por oficina.

### Revisión de insumos, pedidos y solicitudes

No se introducen paginaciones o cambios de contrato solo por intuición:

- `insumos_admin` en Gate #201 quedó en **13,97 ms p95**, payload **111,53 KB** y 0 errores, dentro del presupuesto actual;
- Solicitudes conserva su payload funcional; la carga de activos asociada, que era la deuda concreta, ya fue eliminada;
- Pedidos conserva sus contratos; se optimiza la preparación de sus reportes sin alterar reglas de negocio;
- cualquier presión por crecimiento concurrente o cardinalidad transaccional se medirá en P8.5 con pruebas de carga antes de cambiar contratos.

### Protección contra regresiones

P8.3 incorpora:

- `test:p8-payload-contracts` para catálogo, frontend consumidor, uploads y reportes;
- `test:p8-payload-catalog` sobre MySQL real;
- `test:p8-report-contracts` sobre MySQL real;
- catálogo ligero dentro del baseline oficial P8.0;
- presupuestos versionados para sus dos perfiles de autorización.

Quality Gate #201 quedó verde completo con:

- lint/build frontend y baseline de bundle;
- sintaxis backend y `npm test`;
- migraciones y MySQL descartable;
- integración P4/P8.2/P8.3;
- auth hardening y MFA;
- P6 concurrencia/idempotencia;
- health checks;
- backup/restore;
- baseline P8.0;
- profiler P8.1;
- **10/10 recorridos Chromium E2E**.

### Criterios de salida P8.3

- Solicitudes sin listado global legacy de activos ✅;
- Adjuntos sin listado global legacy de activos ✅;
- catálogo ligero/búsqueda server-side con aislamiento por oficina ✅;
- payload interno `ruta_archivo` eliminado de respuestas ✅;
- límites, MIME, compresión, persistencia y autorización de uploads preservados ✅;
- reportes con proyección/reutilización/paralelización donde existe evidencia ✅;
- PDF transmitido por stream ✅;
- catálogo medido sobre 6000 activos y presupuestado ✅;
- contratos estáticos + MySQL real agregados al Quality Gate ✅;
- Quality Gate de implementación #201 verde completo ✅;
- siguiente bloque: **P8.4 — Rendimiento frontend**.

---

## P8.4 — Rendimiento frontend ✅

P8.4 mide y reduce el costo de carga inicial del frontend sin alterar autenticación, permisos, navegación, accesibilidad ni los contratos funcionales. La implementación quedó completamente verde en el **Quality Gate #206** sobre la rama `performance/p8-frontend` / PR #28.

### Línea base antes de P8.4

El artifact frontend del Gate post-merge #204 mostraba un build esencialmente monolítico:

- JavaScript: **265,15 KB gzip**;
- CSS: **16,41 KB gzip**;
- total `dist`: **499,56 KB gzip**;
- bundle JS principal: **265,15 KB gzip / 930,16 KB raw**;
- todas las pantallas protegidas se importaban estáticamente desde `AppRouter.jsx`;
- Dashboard importaba Recharts dentro de ese mismo grafo inicial.

El problema no era superar el presupuesto global, sino obligar al navegador a descargar y parsear rutas que el usuario podía no visitar.

### Code splitting por rutas

Se aplicó separación por ruta con `React.lazy` + `Suspense`:

- Login permanece eager para no agregar una espera artificial a la entrada pública;
- las 15 pantallas protegidas pasan a chunks diferidos;
- `PrivateRoute` permanece en el mismo lugar del árbol y sigue siendo la autoridad de navegación por sesión/rol;
- el fallback reutiliza estilos existentes y expone `role="status"` + `aria-live="polite"`;
- `test:p8-frontend-contracts` impide volver accidentalmente a imports estáticos de esas rutas.

La biblioteca Recharts queda fuera de la carga inicial y aislada dentro del chunk de Dashboard.

### Fuentes y assets estáticos

El import genérico de Inter se reemplazó por `@fontsource/inter/latin-400.css`:

- se mantiene el mismo peso tipográfico usado por la interfaz;
- se eliminan subsets innecesarios de alfabetos que el sistema no utiliza;
- el build conserva WOFF + WOFF2 por compatibilidad;
- peso de fuentes medido: **52,98 KB gzip**.

Los únicos assets públicos adicionales son dos SVG pequeños (~9,5 KB y ~5 KB raw); no existe evidencia para agregar pipelines de imagen, compresión adicional o lazy loading de imágenes.

### Baseline frontend v2 — Quality Gate #206

`scripts/performance-frontend.js` mantiene los presupuestos globales y agrega métricas de carga inicial extraídas del `index.html` generado (`script`, `modulepreload` y stylesheets), cantidad de chunks y peso de fuentes.

| Métrica | Antes #204 | Después #206 | Resultado |
| --- | ---: | ---: | --- |
| JS inicial gzip | 265,15 KB | **129,79 KB** | ~51 % menor |
| JS total gzip | 265,15 KB | **282,16 KB** | +~6,4 % por overhead de chunks |
| CSS gzip | 16,41 KB | **19,49 KB** | dentro de presupuesto |
| carga inicial JS + CSS | 281,56 KB | **139,57 KB** | ~50 % menor |
| total `dist` gzip | 499,56 KB | **358,43 KB** | ~28 % menor |
| total `dist` raw | 1251,60 KB | **1094,18 KB** | menor |
| chunks JS | 1 | **18** | separación por rutas |
| fuentes gzip | múltiples subsets | **52,98 KB** | Latin 400 únicamente |

El aumento pequeño del JS total es una consecuencia esperada de separar módulos; se acepta porque reduce aproximadamente a la mitad la descarga JS de entrada y el peso total del build también disminuye de forma significativa.

### Presupuestos protegidos

El baseline v2 agrega límites accionables:

- JS inicial gzip: objetivo **180 KB**, techo duro **300 KB**;
- fuentes gzip: objetivo **60 KB**, techo duro **80 KB**;
- continúan vigentes los límites globales de JS, CSS y total `dist`.

El objetivo de fuentes se calibró después de medir el subset Latin real: WOFF + WOFF2 suman 52,98 KB. Se conserva margen estrecho para detectar la reintroducción de subsets no usados sin sacrificar compatibilidad por una cifra arbitraria.

### Renders y trabajo del navegador

La revisión de las pantallas críticas no encontró evidencia reproducible que justifique memoización adicional generalizada:

- Dashboard ya utiliza `useMemo`/`useCallback` donde corresponde;
- no se agregan `memo`, callbacks o caches por intuición;
- la optimización estructural demostrada es evitar descargar pantallas no visitadas.

El chunk de Dashboard queda en **104,42 KB gzip**, principalmente por Recharts. Como Recharts ya no forma parte del bundle inicial, no se difieren los gráficos dentro del propio Dashboard sin una medición de experiencia de usuario que demuestre beneficio; ese punto puede reevaluarse con carga/telemetría posterior.

### Regresión y seguridad

Quality Gate #206 quedó verde completo con:

- auditoría de dependencias frontend/backend;
- lint + build frontend;
- baseline frontend v2 con `target=pass` y `hard=pass`;
- sintaxis backend y `npm test`, incluido `test:p8-frontend-contracts`;
- migraciones + integración MySQL real;
- auth hardening y MFA;
- P6 concurrencia/idempotencia;
- health checks;
- backup/restore;
- baseline API P8.0;
- profiler P8.1;
- Chromium E2E crítico.

### Criterios de salida P8.4

- baseline inicial comparado antes/después ✅;
- code splitting por rutas con Login eager ✅;
- Recharts fuera de la carga inicial ✅;
- fallback de lazy loading accesible ✅;
- permisos/navegación preservados ✅;
- subset de fuentes justificado y medido ✅;
- assets estáticos revisados sin optimizaciones especulativas ✅;
- métricas de JS inicial/fuentes agregadas al baseline ✅;
- presupuestos objetivo/techo versionados ✅;
- contratos P8.4 incluidos en `npm test` ✅;
- Quality Gate de implementación #206 verde completo ✅;
- siguiente bloque: **P8.5 — Pruebas de carga**.
