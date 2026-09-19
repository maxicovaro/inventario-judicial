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
