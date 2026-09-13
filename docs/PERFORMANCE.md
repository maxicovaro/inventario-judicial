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

## Continuidad

P8.1 utilizará este baseline para instrumentar y estudiar consultas, cantidad de queries, N+1, `EXPLAIN` y rutas críticas. P8.2 abordará índices, paginación y contratos de listado con evidencia de P8.1.
