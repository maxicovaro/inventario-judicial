# P9.1 — Soporte e incident response del piloto

## Estado y objetivo

Este documento define el procedimiento operativo de soporte e incident response para el piloto de Inventario Judicial.

P9.1 no modifica reglas de negocio ni debilita controles existentes. Su objetivo es que un incidente pueda ser detectado, clasificado, contenido, recuperado y cerrado de forma reproducible, con evidencia suficiente y sin improvisar sobre seguridad, datos o consistencia.

El runbook general de backup, restore, health, logging y despliegue continúa en `OPERATIONS.md`. Este documento agrega la capa específica del piloto: responsables, severidad, tiempos objetivo, stop conditions, escalamiento, comunicaciones, métricas y cierre.

---

## 1. Principios obligatorios

Durante un incidente del piloto:

1. La seguridad y la integridad de datos tienen prioridad sobre la disponibilidad.
2. No se desactiva autenticación, MFA, autorización por oficina, rate limiting ni validación de origin para recuperar servicio.
3. No se eliminan locks de stock, idempotencia ni transacciones para reducir latencia.
4. No se ejecuta una migración o restore destructivo sin evidencia del estado, preflight aplicable y backup verificado.
5. No se sobrescribe la base activa como primera opción de recuperación; se restaura primero en una base alternativa.
6. No se borran logs, Request IDs, registros de auditoría, dumps ni otra evidencia relevante durante el incidente.
7. No se publican secretos, contraseñas, tokens, dumps reales ni datos personales innecesarios en issues, chats o documentación.
8. Todo cambio de código correctivo sigue rama, PR, Quality Gate y revisión de diff; un incidente no habilita cambios directos en `main`.

---

## 2. Roles operativos

En un piloto pequeño una persona puede ocupar más de un rol, pero las responsabilidades deben quedar explícitas.

### Incident Commander (IC)

Responsable de coordinar el incidente.

Funciones:
- declarar severidad inicial;
- decidir si se activa una stop condition;
- asignar tareas y evitar acciones contradictorias;
- autorizar rollback o recuperación según el runbook;
- mantener una única línea temporal del incidente;
- decidir cuándo el servicio puede reabrirse;
- asegurar el cierre documental.

### Responsable técnico

Funciones:
- revisar health, logs, Request IDs y revisión desplegada;
- reproducir o aislar el fallo cuando sea seguro;
- proponer contención, rollback o corrección;
- verificar migraciones, esquema, integridad y pruebas técnicas;
- no ejecutar acciones destructivas sin autorización del IC cuando corresponda.

### Responsable de datos/operación

Funciones:
- verificar MySQL, backups, checksums, volúmenes y capacidad;
- crear backup de emergencia si la base todavía responde y hacerlo no agrava el incidente;
- ejecutar restore drill o restauración siguiendo `OPERATIONS.md`;
- registrar RPO y RTO reales.

### Responsable institucional/comunicación

Funciones:
- informar a los usuarios piloto cuando el impacto lo requiera;
- comunicar restricciones temporales de uso;
- evitar divulgar detalles sensibles;
- registrar decisiones institucionales que cambien alcance, usuarios u oficinas.

---

## 3. Severidad

La severidad se clasifica por impacto real, no por cantidad de mensajes o urgencia percibida.

### SEV-1 — Crítico / stop inmediato

Cualquiera de estas condiciones es suficiente:
- pérdida o corrupción de datos confirmada o altamente probable;
- stock negativo, doble gasto o inconsistencia material de inventario;
- duplicación de una operación física que debía quedar protegida por idempotencia;
- acceso no autorizado o bypass de permisos por rol/oficina;
- secreto, credencial o token sensible comprometido;
- backup/restore inconsistente justo cuando se necesita recuperar;
- indisponibilidad total con riesgo de pérdida de datos o acciones repetidas por usuarios.

Objetivo de reconocimiento del piloto: **hasta 15 minutos** desde que el incidente es detectado.

Acción inicial: detener la operación riesgosa, preservar evidencia y priorizar contención antes que disponibilidad.

### SEV-2 — Alto

Ejemplos:
- `/health/ready` devuelve 503 de forma persistente;
- fallos repetidos de login, MFA o permisos que impiden operar a usuarios válidos;
- un flujo crítico de una oficina queda indisponible;
- 5xx repetitivos o degradación sostenida que supera un techo duro P8 en un escenario comparable;
- fallo de adjuntos, reportes, pedidos o movimientos con impacto operacional relevante pero sin corrupción confirmada.

Objetivo de reconocimiento del piloto: **hasta 30 minutos** desde que el incidente es detectado.

### SEV-3 — Menor

Ejemplos:
- defecto visual;
- error recuperable sin pérdida de datos;
- comportamiento menor que tiene workaround seguro;
- consulta de soporte sin degradación del sistema.

Se registra y procesa por el flujo normal de trabajo. No habilita acciones de emergencia.

La severidad puede subir o bajar cuando aparece nueva evidencia. Todo cambio debe registrarse con hora y motivo.

---

## 4. Stop conditions del piloto

Ante SEV-1 se detiene inmediatamente el flujo afectado. Según el alcance, el IC puede indicar detener todas las escrituras o sacar temporalmente la aplicación de tráfico.

Stop obligatorio si existe:
- riesgo de pérdida/corrupción de datos;
- evidencia de stock negativo o doble operación;
- acceso no autorizado;
- secreto comprometido con capacidad activa;
- comportamiento de idempotencia que duplica una operación física;
- necesidad de restaurar sin un backup verificado disponible;
- incertidumbre razonable sobre si continuar escribiendo agravará el incidente.

No se detiene todo el piloto por un único pico aislado de latencia si seguridad, integridad y disponibilidad general continúan correctas.

---

## 5. Ciclo de respuesta

### Fase A — Detectar y declarar

Registrar inmediatamente:
- fecha y hora local;
- quién detectó el incidente;
- entorno afectado;
- oficina/usuarios afectados sin datos personales innecesarios;
- síntoma observable;
- severidad inicial;
- revisión desplegada (`DEPLOY_REVISION` o SHA de `main`);
- Request IDs disponibles.

Crear un incidente usando `.github/ISSUE_TEMPLATE/incident.md` cuando GitHub esté disponible y no implique exponer información sensible.

### Fase B — Contener

Elegir la medida mínima que reduzca el riesgo:
- detener un flujo funcional;
- restringir temporalmente nuevas operaciones;
- poner el servicio fuera de tráfico;
- rotar/revocar un secreto;
- congelar nuevos despliegues;
- preservar el estado actual para análisis.

Toda contención debe ser reversible o documentar por qué no lo es.

### Fase C — Recolectar evidencia

Como mínimo revisar:
- `/health/live`;
- `/health/ready`;
- revisión desplegada;
- logs alrededor del evento;
- `request_id` relacionados;
- estado de MySQL;
- `npm run db:status` cuando sea seguro;
- último despliegue/cambio;
- último backup verificado;
- métricas P8 comparables si el problema es de rendimiento.

No copiar cuerpos completos de requests ni información sensible al issue.

### Fase D — Diagnosticar

Determinar si el origen probable está en:
- infraestructura/proxy;
- aplicación/backend;
- frontend;
- autenticación/MFA/origin;
- MySQL/esquema/migraciones;
- stock/concurrencia/idempotencia;
- almacenamiento de adjuntos;
- carga/rendimiento;
- error operativo.

Si la causa no está confirmada, documentar `causa probable` y no presentarla como causa raíz.

### Fase E — Recuperar

Orden preferido:
1. corrección operativa reversible;
2. rollback de aplicación a revisión estable cuando el esquema siga siendo compatible;
3. corrección hacia adelante validada;
4. restore en base alternativa;
5. restauración excepcional sobre base activa solo siguiendo `OPERATIONS.md`.

No revertir manualmente una migración de base para hacer coincidir código antiguo.

### Fase F — Validar antes de reabrir

Como mínimo:
- `/health/live` = 200;
- `/health/ready` = 200;
- revisión esperada confirmada;
- `db:status` al día cuando el incidente involucró base/migraciones;
- login válido;
- autorización por rol/oficina;
- smoke del flujo afectado;
- invariantes de stock si el incidente involucró inventario/insumos;
- backup/restore verificado si hubo recuperación de datos.

Un SEV-1 no se cierra únicamente porque la interfaz vuelve a cargar.

### Fase G — Comunicar y cerrar

Registrar:
- hora de recuperación;
- impacto final;
- causa raíz o probable;
- contención aplicada;
- cambio/rollback ejecutado;
- RPO real;
- RTO real;
- usuarios/oficinas afectados a nivel agregado;
- acciones preventivas.

---

## 6. Objetivos de tiempo del piloto

Estos valores son objetivos operativos internos del piloto, no SLA institucionales.

| Métrica | SEV-1 | SEV-2 | SEV-3 |
| --- | ---: | ---: | ---: |
| Reconocimiento | <= 15 min | <= 30 min | Próxima jornada de trabajo |
| Actualización de estado mientras continúa activo | cada <= 30 min | cada <= 60 min | según necesidad |
| Postmortem / cierre técnico | <= 2 días hábiles | <= 5 días hábiles | cuando la corrección se integre |

El RPO/RTO de recuperación de datos continúa definido en `OPERATIONS.md`: RPO objetivo de hasta 24 h y RTO objetivo de hasta 4 h para el piloto.

---

## 7. Comunicaciones

### Mensaje de apertura interno

Debe indicar, sin secretos:
- severidad;
- síntoma;
- alcance conocido;
- si se detuvieron escrituras o un flujo;
- quién coordina;
- próxima actualización prevista.

### Mensaje a usuarios piloto

Solo si existe impacto real. Debe explicar:
- qué función está afectada;
- qué deben evitar hacer;
- si pueden continuar usando otras funciones;
- cuándo habrá una nueva actualización.

No comunicar hipótesis técnicas no verificadas como causa.

### Mensaje de recuperación

Debe confirmar:
- función restablecida;
- validaciones ejecutadas;
- restricciones que sigan vigentes;
- si se requiere alguna acción del usuario.

---

## 8. Evidencia mínima por incidente

Todo SEV-1/SEV-2 debe conservar:
- ID o enlace del incidente;
- severidad y cambios de severidad;
- timeline;
- SHA/revisión desplegada;
- Request IDs relevantes;
- health checks;
- evidencia de DB/migraciones cuando corresponda;
- backup/checksum involucrado cuando corresponda;
- decisión de rollback/restore y autorización;
- validaciones de recuperación;
- RPO/RTO reales;
- acciones preventivas.

Los SEV-3 pueden usar una evidencia reducida siempre que no haya seguridad, datos o permisos involucrados.

---

## 9. Métricas de soporte del piloto

Registrar como mínimo:
- cantidad de incidentes por severidad;
- MTTA: tiempo medio hasta reconocimiento;
- MTTR: tiempo medio hasta recuperación;
- cantidad de incidentes repetidos por misma causa;
- cantidad de rollbacks;
- cantidad de restores reales;
- cantidad de incidentes de auth/MFA/permisos;
- cantidad de incidentes de stock/concurrencia;
- cantidad de incidentes con pérdida de datos confirmada;
- cumplimiento o incumplimiento de RPO/RTO.

Estas métricas alimentarán P9.4 y los criterios de salida del piloto.

---

## 10. Ejercicio mínimo antes de ampliar el piloto

Antes de incorporar una segunda ola de oficinas debe existir al menos un tabletop exercise documentado que simule:

1. `ready=503` persistente;
2. clasificación SEV-2;
3. recolección de health/revisión/logs;
4. decisión de rollback o recuperación;
5. validación final;
6. cierre con RTO medido.

No es necesario provocar una caída real para cumplir este ejercicio.

---

## 11. Criterios de cierre P9.1

P9.1 puede considerarse cerrado cuando:
- este procedimiento está versionado;
- `OPERATIONS.md` referencia y alinea el procedimiento;
- existe plantilla de incidente versionada;
- existe prueba de contrato P9.1 incluida en `npm test` / Quality Gate;
- `docs/README.md` indexa la documentación;
- `ROADMAP.md` refleja P9.1 cerrado y P9.2 como siguiente bloque;
- Quality Gate del PR queda verde;
- PR se integra a `main`;
- Quality Gate post-merge queda verde.

No iniciar P9.2 antes de cumplir esos criterios.
