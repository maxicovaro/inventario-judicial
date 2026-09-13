# P8 — Rendimiento y escalabilidad

## P8.0 — Baseline y metodología

Este documento define la línea base reproducible de rendimiento del Sistema de Inventario Judicial. P8.0 **no optimiza** todavía: mide el comportamiento actual con un dataset sintético representativo del piloto, fija presupuestos y deja evidencia comparable para P8.1–P8.7.

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

El dataset se genera con `scripts/performance-fixtures.js`, que reutiliza las guardas de `integration-fixtures.js`. Por diseño solo puede operar sobre una base de test/CI.

## Escenarios API

El baseline HTTP mide:

| Escenario | Propósito |
| --- | --- |
| `health_ready` | costo de readiness con comprobación de DB |
| `login_admin` | autenticación + bcrypt + creación de sesión |
| `auth_me_admin` | validación de sesión autenticada |
| `activos_admin` | listado global de activos a escala piloto |
| `activos_responsable` | listado acotado a una oficina |
| `dashboard_admin` | agregaciones del panel principal |
| `insumos_admin` | catálogo de insumos a escala de referencia |

Para cada escenario se registran muestras, errores, códigos HTTP, promedio, p50/p95/p99, máximo y payload máximo en KB.

## Frontend

Después de `vite build`, `scripts/performance-frontend.js` registra:

- JS gzip total;
- CSS gzip total;
- peso gzip total del `dist`;
- peso raw total;
- cinco/diez archivos más pesados.

No se usa Lighthouse como gate en P8.0 porque su variabilidad en runners compartidos puede generar falsos positivos. Las métricas de experiencia y carga de navegador podrán incorporarse en P8.4 con una metodología específica.

## Presupuestos

Los límites versionados viven en `performance/budgets.json`.

Cada métrica tiene dos niveles:

1. **Objetivo:** si se supera, el resultado queda en `warn` y se convierte en candidato de P8.1–P8.6.
2. **Techo duro:** si se supera, el Quality Gate falla porque indica una regresión extrema o un escenario no operativo.

La línea base inicial no debe cambiarse para “hacer pasar” una optimización. Si un presupuesto necesita revisión, debe justificarse en PR con evidencia.

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

`performance-results/` es evidencia efímera de ejecución y no debe contener datos personales ni secretos.

## Quality Gate

P8.0 añade dos mediciones automáticas:

- **Run P8.0 API baseline:** recrea el dataset sintético, arranca el backend, mide la API y publica `performance-backend-baseline`.
- **Measure P8.0 frontend baseline:** analiza el build y publica `performance-frontend-baseline`.

Después del baseline API, el Quality Gate vuelve a cargar los fixtures E2E normales, por lo que las pruebas posteriores siguen aisladas.

## Interpretación

- `target=pass`: dentro del objetivo inicial.
- `target=warn`: no bloquea P8.0; pasa a la cola de análisis/optimización.
- `hard=fail`: bloquea CI.
- cualquier error HTTP en una medición: bloquea CI.

No se comparan milisegundos de runners diferentes como si fueran benchmarks absolutos de hardware. La utilidad principal es detectar órdenes de magnitud, payloads excesivos y tendencias sobre una metodología estable.

## Evidencia inicial

Los valores numéricos de referencia se completan con el primer Quality Gate de la rama `performance/p8-baseline`. Ese run será la evidencia autoritativa del baseline inicial; los artifacts JSON quedan asociados al workflow.

## Salida de P8.0

P8.0 se considera cerrado cuando:

- dataset y scripts son reproducibles;
- presupuestos están versionados;
- API y frontend generan artifacts en CI;
- existe un baseline numérico inicial documentado;
- Quality Gate completo está verde;
- `ROADMAP.md` marca P8.0 ✅ y habilita **P8.1 — Perfilado backend/MySQL**.

## Continuidad

P8.1 usará esta línea base para estudiar consultas, cantidad de queries, N+1, `EXPLAIN`, índices y rutas críticas. P8.0 no incorpora todavía índices ni cambia paginación o contratos de API.
