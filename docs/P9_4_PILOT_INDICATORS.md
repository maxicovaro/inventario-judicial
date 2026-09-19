# P9.4 — Indicadores reales del piloto

## Estado y objetivo

P9.4 convierte la observabilidad ya existente en un procedimiento reproducible para medir el piloto real sin crear una base paralela de métricas ni debilitar controles de seguridad.

El bloque usa cuatro fuentes:
- MySQL del entorno para actividad funcional agregada, auth, pedidos, solicitudes, movimientos, idempotencia y tamaño de base;
- `/health/live` y `/health/ready` para estado e identidad del despliegue;
- Railway para logs HTTP/runtime y recursos de servicios;
- registros P9.1 para incidentes, MTTA, MTTR, RPO y RTO.

No modifica reglas de negocio ni requiere migraciones.

---

## 1. Principios

1. Los indicadores deben provenir de evidencia real del entorno, no de valores sintéticos de CI.
2. La recolección desde MySQL es estrictamente read-only.
3. No se versionan snapshots reales, dumps, secretos, nombres personales ni correos.
4. Los indicadores de actividad se agregan por oficina, módulo, acción, tipo o estado.
5. Los logs HTTP se usan para errores y latencia; la Bitácora no sustituye telemetría HTTP.
6. P8 continúa siendo la referencia reproducible para comparaciones de rendimiento controladas.
7. P9.1 continúa siendo la fuente para severidad, stop conditions y tiempos de incident response.
8. Cualquier indicio de corrupción, bypass de permisos, doble operación física o pérdida de datos activa P9.1; P9.4 no “promedia” una stop condition.

---

## 2. Ventana de observación

El snapshot local usa por defecto los últimos **7 días**.

Puede modificarse con:

```bash
npm run pilot:metrics:snapshot -- --days 14
```

La salida recomendada es efímera:

```bash
npm run pilot:metrics:snapshot -- \
  --days 7 \
  --output pilot-metrics-results/staging-YYYYMMDD.json
```

`pilot-metrics-results/` está excluido de Git.

**Regla operativa:** ejecutar el snapshot desde una shell/CLI de operador o tarea puntual. **No** anteponerlo al `startCommand` del servicio Railway ni encadenarlo con `&& npm start`: el ciclo de arranque y healthcheck debe permanecer independiente de la recolección de métricas.

El comando solo admite `DEPLOY_ENV=staging` o `DEPLOY_ENV=test`. No debe ejecutarse contra producción institucional.

---

## 3. Snapshot read-only

Script:

```text
scripts/pilot-metrics-snapshot.js
```

Comando:

```text
npm run pilot:metrics:snapshot
```

El script:
- autentica contra la DB configurada;
- ejecuta únicamente consultas `SELECT`;
- no crea tablas;
- no actualiza filas;
- no elimina datos;
- no ejecuta migraciones;
- no requiere cuenta funcional de usuario;
- no incluye nombres ni correos en la salida.

### Datos generados

#### Usuarios / alcance
- usuarios por oficina y rol;
- usuarios activos;
- ADMIN activos;
- ADMIN con MFA;
- ADMIN fuera de Dirección/central, que debe permanecer en 0 salvo decisión institucional explícita.

#### Uso por oficina y flujo
Desde Bitácora, agregado por:
- oficina;
- módulo;
- acción;
- cantidad de eventos;
- cantidad de actores distintos.

También:
- solicitudes creadas en la ventana por oficina/estado;
- pedidos enviados en la ventana por oficina/tipo/estado;
- estado actual de pedidos mensuales/complementarios;
- movimientos de stock por tipo/oficina y cantidad total.

#### Auth
Desde Bitácora:
- LOGIN;
- LOGIN_FALLIDO;
- LOGIN_BLOQUEADO;
- LOGOUT;
- otros eventos AUTH que existan.

Los 401/403 HTTP se cuentan aparte desde logs Railway.

#### Idempotencia / consistencia
Desde DB:
- operaciones idempotentes por `scope`;
- operaciones incompletas (`status_code IS NULL`).

Desde runtime:
- `idempotency_replay`;
- `idempotency_conflict`;
- `idempotency_in_progress`.

Estos eventos no alteran el contrato HTTP existente; agregan trazabilidad estructurada.

#### Crecimiento de datos
- bytes estimados de MySQL desde `information_schema.tables`;
- cantidad/bytes de archivos en uploads;
- cantidad/bytes de backups;
- cantidad/bytes de adjuntos creados en la ventana.

En Railway staging las rutas persistentes esperadas son:
- `/data/uploads`;
- `/data/backups`.

---

## 4. Indicadores Railway

P9.4 usa métricas nativas de Railway y no introduce un segundo agente de monitoreo.

### Backend
Recolectar:
- CPU;
- memoria;
- disco;
- red RX/TX.

### MySQL
Recolectar:
- CPU;
- memoria;
- disco;
- red RX/TX.

### Frontend
CPU/memoria pueden conservarse como contexto, pero el foco de P9.4 está en backend y MySQL.

La ventana máxima de Railway disponible por la integración utilizada es de 7 días.

---

## 5. Errores y latencia

Fuente primaria:
- logs HTTP de Railway;
- logs runtime estructurados `http_request_completed`.

Registrar:
- total de requests observadas;
- cantidad de 5xx;
- cantidad de 401;
- cantidad de 403;
- rutas con 5xx;
- p50/p95/p99 de duración cuando la muestra disponible sea suficiente;
- máximo observado;
- cobertura temporal efectiva de la muestra.

### Limitación de retención/muestra

La integración de logs puede imponer un máximo de entradas por consulta. Por lo tanto:
- siempre registrar cantidad de entradas recuperadas;
- registrar primera y última marca temporal de la muestra;
- no presentar una muestra truncada como censo exhaustivo;
- si se alcanza el límite, segmentar por ventanas temporales o marcar el indicador como parcial.

---

## 6. Health y revisión desplegada

Toda captura P9.4 debe registrar:
- `/health/live = 200`;
- `/health/ready = 200`;
- `environment=staging`;
- revisión/SHA reportado;
- deployment Railway terminal `SUCCESS`.

Si `ready` devuelve 503 de forma persistente, aplicar P9.1.

---

## 7. Indicadores de incidentes

Fuente: registros P9.1 / issues de incidente.

Por ventana o acumulado del piloto:
- cantidad SEV-1;
- cantidad SEV-2;
- cantidad SEV-3;
- MTTA;
- MTTR;
- incidentes repetidos por causa;
- rollbacks;
- restores reales;
- incidentes auth/MFA/permisos;
- incidentes stock/concurrencia;
- pérdida de datos confirmada;
- cumplimiento de RPO/RTO.

Si no hubo incidentes, registrar explícitamente `0`; no inventar MTTA/MTTR.

---

## 8. Interpretación

P9.4 distingue:

### Estado saludable
- health verde;
- sin stop conditions;
- sin corrupción;
- sin bypass;
- sin doble operación física;
- sin 5xx repetitivos;
- recursos con margen;
- actividad funcional coherente con las oficinas habilitadas.

### Observación
Un evento aislado o una tendencia que no compromete seguridad/integridad debe registrarse y seguirse, sin convertirlo automáticamente en incidente.

### Incidente
Si se cumple una condición de P9.1, P9.1 prevalece.

P9.4 no redefine severidad ni SLA.

---

## 9. Relación con P8

P8 y P9.4 miden cosas distintas.

P8:
- dataset controlado;
- runners reproducibles;
- presupuestos;
- comparaciones antes/después.

P9.4:
- tráfico y uso real del piloto;
- infraestructura real;
- crecimiento real;
- errores reales;
- actividad real por oficina.

No comparar directamente un p95 de Railway con un p95 de GitHub Actions como si fueran el mismo experimento. Se usan juntos para detectar tendencia y decidir si corresponde abrir una investigación reproducible.

---

## 10. Frecuencia operativa

Durante el piloto:
- snapshot funcional: semanal;
- health: en cada revisión operativa y despliegue;
- recursos/logs: semanal y ante incidentes;
- incidentes: actualización al cierre de cada incidente;
- crecimiento de MySQL y `/data`: semanal.

P9.4 no crea una tarea automática permanente por sí solo. La frecuencia puede automatizarse después si el piloto lo necesita.

---

## 11. Evidencia mínima de una captura

Registrar:
- fecha/hora;
- ventana;
- SHA desplegado;
- deployment;
- health;
- snapshot read-only;
- recursos Railway;
- cobertura de logs;
- conteos 5xx/401/403;
- latencias observadas;
- crecimiento DB/uploads/backups;
- idempotencia;
- incidentes;
- observaciones;
- cualquier condición de stop.

No guardar secretos, cuerpos completos de requests ni PII innecesaria.

---

## 12. Criterios de cierre P9.4

P9.4 puede cerrarse cuando:
- el snapshot read-only está versionado;
- el contrato P9.4 está incluido en `npm test`;
- los eventos de idempotencia son observables;
- `docs/README.md` y `ROADMAP.md` están alineados;
- existe una primera captura real de staging;
- health/revisión/deployment están identificados;
- existen métricas Railway de backend/MySQL;
- existe una lectura real de logs HTTP/runtime con cobertura declarada;
- se documenta el estado de incidentes P9.1;
- Quality Gate del HEAD final queda verde;
- PR se integra a `main`;
- Quality Gate post-merge queda verde.

P9.5 no se abre antes de cumplir esos criterios.


---

## 13. Primera captura real de staging — 19/09/2026

### Revisión y entorno

- HEAD P9.4 validado: `b6de2f789ad76545203c4e1e2cf6286559af1776`;
- Quality Gate #311: **SUCCESS** completo;
- el Gate incluye `Run P9.4 pilot metrics snapshot smoke` contra MySQL CI con timeout de 30 s;
- deployment final de staging: `d95d1768-748d-4ce6-a82c-0135e9b7619d`;
- estado final Railway: **SUCCESS**;
- `DEPLOY_ENV=staging`;
- revisión reportada por runtime: `b6de2f789ad76545203c4e1e2cf6286559af1776`;
- `startCommand` final restaurado: `npm start`;
- preflight aprobado;
- conexión `inventario_judicial_staging` confirmada;
- `server_started` confirmado;
- `/health/ready` observado en **200** con 8,72 ms;
- `/health/live` no pudo invocarse externamente desde el conector de esta sesión por una limitación de resolución/acceso; el contrato `live/ready` permanece cubierto por CI y no se registra una llamada externa inexistente.

No se ejecutaron migraciones ni escrituras de negocio para P9.4.

### Ventana del snapshot

- generado: `2026-09-19T21:54:17.635Z`;
- desde: `2026-09-12T21:54:17.635Z`;
- hasta: `2026-09-19T21:54:17.635Z`;
- entorno: `staging`;
- revisión: `b6de2f789ad76545203c4e1e2cf6286559af1776`.

El snapshot fue estrictamente read-only y su salida real quedó registrada en Railway. La salida multilínea puede intercalarse en el visor de logs; por eso los snapshots futuros deben preferir `--output` desde shell/CLI y conservarse fuera de Git.

### Usuarios y MFA

| Oficina | Rol | Usuarios | Activos |
| --- | --- | ---: | ---: |
| Área Contable | RESPONSABLE | 2 | 2 |
| Área Informática | RESPONSABLE | 1 | 1 |
| Área Informática | USUARIO | 1 | 1 |
| Dirección de Policía Judicial | ADMIN | 1 | 1 |

ADMIN:
- activos: **1**;
- con MFA: **1**;
- fuera de Dirección: **0**.

### Actividad funcional observada

Auth en Bitácora:
- LOGIN: **21**;
- LOGOUT: **16**;
- LOGIN_FALLIDO: **1**;
- MFA_HABILITADO: **1**;
- MFA_VERIFICADO: **1**.

Solicitudes creadas en la ventana: **0**.

Pedidos enviados por Área Informática:
- MENSUAL / ENTREGADO: **1**;
- COMPLEMENTARIO / ENVIADO: **1**;
- COMPLEMENTARIO / ENTREGADO: **2**.

Movimientos de stock:
- EGRESO -> Área Informática: **3 movimientos / 6 unidades**;
- INGRESO central: **2 movimientos / 15 unidades**;
- EGRESO -> Área Contable: **1 movimiento / 1 unidad**.

### Consistencia e idempotencia

- operaciones idempotentes persistidas observadas en el snapshot: **0**;
- eventos runtime `idempotency_replay`, `idempotency_conflict` e `idempotency_in_progress` en los deployments principales consultados: **0**;
- no se observaron señales de doble operación, stock negativo, corrupción ni bypass de permisos.

### Crecimiento y almacenamiento

- tamaño estimado MySQL: **884.736 bytes** (~0,84 MiB);
- uploads: **0 archivos / 0 bytes**;
- backups: **12 archivos / 145.351 bytes**;
- último backup observado: `2026-09-14T19:01:43.489Z`;
- adjuntos creados en la ventana: **0 / 0 bytes**.

### Tráfico runtime y latencia

Fuente: eventos estructurados `http_request_completed` del backend, segmentados por deployment/ventana para evitar el límite del conector.

Muestra:
- requests de aplicación observadas: **562**;
- segmentos truncados: **0**;
- cobertura efectiva con actividad: `2026-09-13T23:03:36.435Z` a `2026-09-18T13:14:57.511Z`;
- 200: **131**;
- 201: **8**;
- 202: **4**;
- 304: **402**;
- 401: **16**;
- 403: **1**;
- 5xx: **0**.

Negaciones auth observadas:
- 401 `/me`: 9;
- 401 `/login`: 5;
- 401 `/mfa/confirm`: 1;
- 401 `/no-leidas/count`: 1;
- 403 `/login`: 1.

Latencia de requests de aplicación:
- p50: **12,05 ms**;
- p95: **65,31 ms**;
- p99: **388,18 ms**;
- máximo: **468,69 ms**.

No se observaron 5xx en la muestra.

### Recursos Railway — 7 días

Backend:
- CPU_USAGE promedio: **0,000115**; máximo: **0,00409**;
- memoria promedio: **0,099 GB**; máximo: **0,784 GB**;
- disco promedio: **0,0337 GB**; máximo: **0,0340 GB**.

MySQL:
- CPU_USAGE promedio: **0,00396**; máximo: **0,00503**;
- memoria promedio: **0,454 GB**; máximo: **0,519 GB**;
- disco promedio: **0,1591 GB**; máximo: **0,1593 GB**.

No se detectó una señal de presión de recursos que requiera abrir optimización fuera de P8.

### Incidentes P9.1

Búsqueda de issues del repositorio por `incident` y `SEV`:
- SEV-1 registrados: **0**;
- SEV-2 registrados: **0**;
- SEV-3 registrados: **0**.

Por ausencia de incidentes registrados, MTTA y MTTR quedan **N/A**, no cero.

Los deployments temporales fallidos usados durante la captura P9.4 fueron pruebas controladas de staging sin migraciones ni cambios de datos. La causa fue intentar encadenar el snapshot al `startCommand`; se abandonó ese método, se restauró `npm start` y staging terminó estable en el SHA aprobado. Esto se registra como hallazgo operativo, no como incidente del piloto.

### Evaluación de la captura

No se observaron:
- 5xx;
- pérdida/corrupción de datos;
- bypass de autorización;
- stock negativo;
- doble operación física;
- conflicto/replay idempotente inesperado;
- presión relevante de CPU/memoria/disco;
- stop conditions P9.1.

La evidencia funcional, de recursos, logs, health y almacenamiento requerida por P9.4 está disponible.


---

## 14. Cierre formal P9.4

P9.4 queda técnicamente completo con la siguiente evidencia:

- PR #47 integrado;
- merge: `d1aa207e170e8a5c919f387ca9ea19b217a5529d`;
- Quality Gate final pre-merge #313: **SUCCESS**;
- Quality Gate post-merge #314: **SUCCESS**;
- primera captura real de staging registrada;
- deployment estable `d95d1768-748d-4ce6-a82c-0135e9b7619d`;
- runtime `staging@b6de2f789ad76545203c4e1e2cf6286559af1776`;
- `startCommand=npm start`;
- sin migraciones ni cambios destructivos;
- sin stop conditions abiertas.

El hallazgo del `startCommand` temporal quedó resuelto y convertido en regla operativa documentada. El snapshot tiene además una regresión de terminación real dentro del Quality Gate.

Una vez integrado este cierre documental y con su Gate post-merge verde, **P9.4 se considera formalmente cerrado** y P9.5 pasa a ser el siguiente bloque elegible. Antes de abrir P9.5 se debe releer `ROADMAP.md` desde `main`.
