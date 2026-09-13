# P8.6 — Optimización + regresión

## Estado

**Cerrado técnicamente el 13/09/2026.**

Rama: `performance/p8-optimization-regression`  
PR: #30  
Quality Gate de evidencia: **#218 — verde completo**, incluido Chromium E2E.

## Objetivo

P8.6 debía partir exclusivamente de la evidencia de P8.0–P8.5, localizar el costo real de la presión observada en escrituras concurrentes de Stock y aplicar una optimización solo si existía una mejora segura, material y repetible sin debilitar P6.

El criterio explícito del bloque permitía cerrar sin cambios productivos si la contención resultaba ser una propiedad necesaria de consistencia y no existía una alternativa demostrablemente mejor.

## Diagnóstico reproducible

Se agregó `scripts/performance-stock-contention.js`, ejecutado únicamente sobre MySQL descartable `test/ci/e2e` con el dataset sintético de referencia de 6000 activos + 300 insumos.

El perfil compara asignaciones de Stock con concurrencia 1 y 20 y captura:

- p50/p95/p99 HTTP;
- cantidad y duración de queries;
- SQL normalizado;
- consultas `FOR UPDATE`;
- tiempo SQL total;
- stock central final;
- stock de oficina final;
- cantidad exacta de movimientos;
- invariantes P6.

El artifact se publica como `performance-stock-contention` y el archivo generado es `performance-results/stock-contention-profile.json`.

La medición y su interpretación están separadas. `scripts/performance-stock-contention-classify.js` calcula la participación del lock central en el tiempo SQL, el crecimiento de la espera c20/c1 y el multiplicador de p95 HTTP. Esto evita mezclar captura de datos con una regla analítica rígida.

## Evidencia — Quality Gate #218

### Concurrencia 1

- requests: 1;
- errores: 0;
- p95 HTTP: **26,03 ms**;
- SQL total: **10 ms**;
- invariantes: `true`.

### Concurrencia 20

- requests: 20;
- errores: **0**;
- p50 HTTP: 254,59 ms;
- p95 HTTP: **270,17 ms**;
- p99 HTTP: 275,99 ms;
- SQL total acumulado: **1179 ms**;
- invariantes: `true`.

### Locks

`Insumo ... FOR UPDATE`:

- 20 ejecuciones;
- **805 ms** acumulados;
- 40,25 ms promedio;
- 109 ms máximo;
- **68,28 % del tiempo SQL total**.

`StockOficina ... FOR UPDATE`:

- 20 ejecuciones;
- 10 ms acumulados;
- 0,5 ms promedio;
- 2 ms máximo.

La clasificación final registró:

- `central_stock_lock_sql_share_pct`: **68,28**;
- `central_stock_lock_avg_wait_multiplier`: **4025** respecto del valor sub-milisegundo medido en c1;
- `http_p95_multiplier_c20_vs_c1`: **10,38**;
- `central_stock_lock_is_dominant_candidate`: `true`;
- `production_change_required`: `false`.

Los milisegundos pertenecen al runner compartido y no son SLA de producción. La señal relevante es estructural: bajo competencia por el mismo insumo central, el lock de esa fila concentra la espera; el lock de StockOficina no es el cuello principal.

## Revisión de seguridad y orden de locks

La asignación manual de Stock bloquea:

1. `Insumo` central con `FOR UPDATE`;
2. `StockOficina` con `FOR UPDATE`;
3. actualiza ambos saldos;
4. registra movimiento e idempotencia dentro de la misma transacción.

El flujo de provisión de pedidos sigue el mismo orden central → oficina para los artículos afectados. El consumo de oficina bloquea `StockOficina` porque modifica ese saldo de forma concurrente.

Por lo tanto:

- quitar el lock central permitiría riesgo de doble gasto del depósito;
- quitar el lock de oficina rompería la coordinación con consumo/provisión;
- invertir locks solo trasladaría la cola en el escenario mismo insumo/misma oficina y puede aumentar riesgo de deadlocks si no se rediseña todo el circuito;
- índices o cachés no eliminan una espera causada por exclusión transaccional deliberada;
- reducir bcrypt, MFA, rate limiting, autorización o idempotencia no guarda relación con este cuello y queda expresamente prohibido como “optimización”.

## Decisión P8.6

**No se modifica lógica productiva de Stock.**

La serialización observada es coherente con la invariante de no gastar dos veces la misma unidad de stock central. A la escala de referencia no se superó ningún techo duro, no hubo errores HTTP y todas las invariantes permanecieron correctas.

No existe evidencia suficiente para justificar un rediseño transaccional más complejo. Introducirlo solo para mejorar una cifra de runner aumentaría riesgo operativo sin beneficio material demostrado.

La decisión versionada es:

`preserve_consistency_locks_and_regression_guards`

## Regresiones agregadas

`test:p8-regression-contracts` protege que:

- la asignación conserve lock `FOR UPDATE` del stock central;
- la asignación conserve lock del stock de oficina;
- el consumo conserve lock del stock de oficina;
- asignación y consumo conserven idempotencia;
- el profiler continúe siendo test-only y reproducible;
- la clasificación use participación SQL + crecimiento de espera, no una única duración máxima;
- el Quality Gate siga generando el artifact P8.6.

El Quality Gate ejecuta P8.6 después de P8.5 y antes de recrear fixtures E2E, por lo que el diagnóstico no contamina Chromium.

## Criterios de salida

- hallazgo P8.5 localizado a nivel SQL/lock ✅;
- c1/c20 reproducibles ✅;
- 0 errores HTTP ✅;
- invariantes de stock y movimientos correctas ✅;
- lock central identificado como señal dominante ✅;
- lock de oficina descartado como cuello principal ✅;
- alternativas de eliminación/reordenamiento de locks rechazadas por riesgo y falta de mejora demostrada ✅;
- sin índices/cachés/cambios de contrato especulativos ✅;
- contratos de regresión incorporados a `npm test` ✅;
- artifact P8.6 en CI ✅;
- Quality Gate #218 verde completo ✅;
- siguiente bloque: **P8.7 — Cierre documental y criterios de piloto**.

## Regla para futuras optimizaciones

El circuito de Stock solo debe rediseñarse si una necesidad real del piloto demuestra que la serialización actual limita la operación. Cualquier propuesta futura debe comparar antes/después y conservar simultáneamente:

- stock central no negativo;
- stock de oficina exacto;
- un movimiento por operación lógica;
- replay idempotente correcto;
- autorización por rol/oficina;
- ausencia de deadlocks/regresiones en provisión y consumo.
