# P9.6 — Criterios de salida del piloto

## Estado y propósito

P9.6 está **formalmente cerrado**. Se abrió desde main@4a0dcc1de6941e3cd4507a107a00a93e34920983 después del cierre formal de P9.5 y de releer ROADMAP.md y AGENTS.md. La implementación, evaluación real, merge y Quality Gate post-merge quedaron completos.

El objetivo es convertir la evidencia acumulada de P8 y P9 en un gate de salida explícito, reproducible y auditable antes de considerar producción institucional.

P9.6 **no despliega producción**, no modifica datos y no reemplaza una aprobación institucional. El resultado técnico puede habilitar la etapa de aprobación, pero no autoriza por sí mismo un cambio de entorno.

---

## 1. Decisiones posibles

El evaluador scripts/pilot-exit-gate.js separa dos planos:

| Resultado | Significado |
| --- | --- |
| BLOCKED | Existe al menos un criterio técnico incumplido o la decisión institucional fue rechazada. |
| ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL | Todos los criterios técnicos pasan y la aprobación institucional sigue pendiente. |
| APPROVED_FOR_PRODUCTION_PLANNING | Todos los criterios técnicos pasan y existe aprobación institucional explícita con rol y referencia. |

APPROVED_FOR_PRODUCTION_PLANNING significa únicamente que puede abrirse la planificación protegida de producción. No ejecuta despliegue, migración ni cambio de tráfico.

---

## 2. Fuentes de evidencia

P9.6 reutiliza evidencia ya consolidada y no crea una telemetría paralela:

- P9.1: incidentes, stop conditions, SEV-1/SEV-2, pérdida de datos y auth/permisos;
- P9.2B: 12 escenarios funcionales, 4 usuarios piloto verificados, rollback y separación Depósito/Contable;
- P9.3: capacidad operativa, roles, tareas rutinarias y runbooks;
- P9.4: health, uso real, errores HTTP, latencia, recursos, MFA, actividad por oficina e idempotencia;
- P8: carga reproducible, concurrencia, presupuestos y regresiones de rendimiento;
- P9.5: backup periódico, segunda copia, restore drill y RPO/RTO;
- Quality Gate: auth, MFA, autorización, integración MySQL, concurrencia, E2E, backup/restore y rendimiento.

La evidencia real usada para una decisión se conserva fuera de Git bajo pilot-exit-results/. Sólo se documentan valores agregados y referencias no sensibles.

---

## 3. Gate técnico

### Estabilidad

| Criterio | Umbral |
| --- | ---: |
| /health/ready | 200 |
| deployment observado | SUCCESS |
| muestra HTTP | >= 100 requests |
| respuestas 5xx en la muestra de salida | 0 |
| SEV-1 abiertos | 0 |
| SEV-2 abiertos | 0 |

La muestra P9.4 de referencia contiene 562 requests y 0 respuestas 5xx.

### Seguridad

| Criterio | Umbral |
| --- | ---: |
| ADMIN activos con MFA | 100 % |
| ADMIN fuera de Dirección | 0 |
| incidentes abiertos auth/MFA/permisos | 0 |
| regresiones de auth/MFA/autorización | verdes |

No se rebaja MFA, cookie segura, validación de Origin, CORS, rate limiting ni autorización backend para cumplir este gate.

### Integridad

Deben permanecer en cero:
- stop conditions abiertas;
- pérdida/corrupción de datos;
- bypass de autorización;
- stock negativo;
- operación física duplicada;
- operaciones idempotentes incompletas.

Además:
- primera ola funcional: >= 12 escenarios aprobados;
- usuarios de primera ola verificados: >= 4.

### Adopción

P9.6 no exige cantidad masiva de usuarios; exige evidencia mínima de uso real del piloto ya autorizado:

| Criterio | Umbral |
| --- | ---: |
| usuarios piloto activos | >= 4 |
| usuarios piloto verificados | >= 4 |
| oficinas piloto con actividad funcional | >= 2 |
| flujos críticos ejercitados | sí |

La referencia actual es Área Contable + Área Informática con pedidos, provisión, stock, traslados y separación de inventario validados.

### Capacidad operativa y recuperación

| Criterio | Umbral |
| --- | ---: |
| edad del backup verificado | <= 24 h |
| segunda copia verificada | sí |
| restore drill real | PASS |
| RPO real | <= 24 h |
| RTO real | <= 240 min |
| backup periódico | activo |
| runbooks/procedimiento operativo | disponibles |

La evidencia P9.5 de referencia obtuvo RPO 0,2203 h y RTO 0,0373 min, con cleanup de la base temporal correcto.

### Rendimiento

P8 sigue siendo la referencia reproducible; P9.4 aporta el comportamiento real.

| Criterio | Umbral |
| --- | ---: |
| p95 runtime de salida P9.6 | <= 500 ms |
| presión relevante de recursos | no |
| carga controlada | >= concurrencia 20 |
| error rate en carga controlada | 0 % |
| regresión P8 | verde |

El límite de 500 ms es un criterio interno de salida P9.6, no un SLA institucional ni una comparación directa entre Railway y GitHub Actions.

---

## 4. Ejecución

Ejemplo sintético:

~~~bash
npm run pilot:exit:gate -- \
  --evidence pilot/exit-gate.example.json \
  --output pilot-exit-results/example.json
~~~

Para evidencia real se crea un JSON efímero con datos agregados y referencias verificadas, sin PII ni secretos.

El proceso:
- devuelve exit code 0 cuando el gate técnico pasa;
- devuelve exit code 2 cuando existe al menos un criterio técnico fallido;
- con --require-approval, devuelve exit code 3 si falta aprobación institucional;
- rechaza evidencia que contenga claves sensibles como password, token, cookie, email o TOTP;
- rechaza cualquier evidencia marcada como entorno distinto de staging/test.

---

## 5. Aprobación institucional

Una aprobación positiva requiere un bloque institucional con:
- approval_status = APPROVED;
- approved_by_role = rol institucional;
- decision_reference = nota, acta, resolución o referencia equivalente.

No se requiere ni se debe versionar el nombre personal del aprobador dentro del artifact del gate.

Sin rol y referencia, una entrada APPROVED es rechazada.

---

## 6. Riesgos y guardas

P9.6 es read-only respecto de MySQL y staging. No contiene SQL ni llama endpoints de mutación.

Riesgos principales:
- usar evidencia vieja como si fuera actual;
- convertir un resumen parcial de logs en censo exhaustivo;
- confundir CI reproducible con comportamiento runtime real;
- interpretar ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL como autorización de despliegue;
- aprobar con una referencia institucional inexistente.

Guardas:
- ventana y fecha de evidencia deben quedar registradas;
- logs parciales deben declararse como tales;
- P9.1 prevalece si aparece una stop condition;
- un solo criterio de seguridad/integridad fallido bloquea el gate;
- producción no se toca dentro de P9.6.

---

## 7. Rollback del bloque

P9.6 no aplica migraciones ni modifica staging. El rollback técnico consiste en revertir los archivos del gate/documentación en Git.

Si una validación real descubre un problema:
1. no alterar los datos para “hacer pasar” el gate;
2. registrar el criterio fallido;
3. aplicar P9.1 si corresponde;
4. corregir la causa en un bloque/PR trazable;
5. repetir la evidencia y el gate completo.

---

## 8. Quality Gate

CI debe demostrar:
- fixture válida -> PASS;
- aprobación institucional pendiente -> ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL;
- un 5xx introducido en la fixture -> FAIL/BLOCKED y exit code 2;
- APPROVED sin rol/referencia -> rechazo;
- pilot:exit:gate y test:p9-exit-gate-contracts forman parte del contrato;
- artifact P9.6 sintético disponible.

La fixture CI no constituye evidencia de staging.

---

## 9. Evidencia real requerida para cierre

Antes del cierre formal de P9.6 debe existir una evaluación real y actualizada que consolide:

- estado terminal de staging y health;
- ventana HTTP representativa;
- incidentes abiertos;
- MFA/admin y autorización;
- stop conditions e integridad;
- usuarios/oficinas piloto y actividad funcional;
- backup reciente, segunda copia, restore, RPO/RTO y cron;
- carga/rendimiento y recursos;
- resultado técnico P9.6.

La aprobación institucional puede seguir PENDING; en ese caso P9.6 puede documentar que el sistema está técnicamente elegible, pero **no** declarar producción institucional aprobada.

---

## 10. Criterios de cierre P9.6

P9.6 puede cerrarse cuando:
- el evaluador y su fixture están versionados;
- el contrato P9.6 forma parte de npm test;
- Quality Gate ejecuta el gate sintético y sus casos negativos;
- docs/README.md y ROADMAP.md están alineados;
- se ejecuta una evaluación real con evidencia actual de staging;
- cada dimensión queda PASS o cualquier bloqueo queda explícitamente tratado;
- la decisión técnica queda documentada;
- la situación de aprobación institucional queda explícita;
- PR queda verde y mergeado;
- Quality Gate post-merge queda verde.

El cierre técnico de P9.6 no equivale a desplegar producción.


---

## 11. Evaluación real de salida — 20/09/2026

Hora de corte: **2026-09-20 11:50:44 Argentina / 14:50:44 UTC**.

Resultado:
- technical_status: **PASS**;
- institutional_status: **PENDING**;
- decision: **ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL**;
- criterios: **34/34 PASS**;
- fallos: **0**.

### Estabilidad — 6/6 PASS

- proyecto Railway de staging: servicios backend, frontend y MySQL en estado terminal SUCCESS;
- backend configurado con healthcheck real en /health/ready;
- última observación runtime de /ready en el deployment vigente: HTTP 200;
- muestra HTTP representativa P9.4: 562 requests;
- ventana representativa: 13/09/2026 a 18/09/2026;
- 5xx en esa muestra: 0;
- p95 observado: 65,31 ms;
- SEV-1 abiertos al corte: 0;
- SEV-2 abiertos al corte: 0.

La actividad posterior al último redeploy fue insuficiente para construir otra muestra de >=100 requests; no se presenta esa muestra pequeña como equivalente. Se conserva la muestra P9.4 con su ventana declarada y se combina únicamente con el estado/deployment actual.

### Seguridad — 4/4 PASS

Evidencia P9.4/P9.6:
- ADMIN activos: 1;
- ADMIN con MFA: 1/1;
- ADMIN fuera de Dirección: 0;
- incidentes abiertos auth/MFA/permisos: 0;
- Quality Gate #336: verde, incluyendo auth hardening, MFA, autorización, MySQL y E2E.

### Integridad — 8/8 PASS

- stop conditions abiertas: 0;
- pérdida/corrupción de datos: 0;
- bypass de autorización: 0;
- señales de stock negativo: 0;
- operaciones físicas duplicadas: 0;
- operaciones idempotentes incompletas observadas: 0;
- primera ola: 12/12 escenarios funcionales;
- usuarios primera ola: 4/4 verificados.

### Adopción — 4/4 PASS

Última captura funcional read-only P9.4: 19/09/2026.

- usuarios piloto activos no ADMIN: 4;
- usuarios piloto verificados: 4;
- oficinas piloto con actividad real: 2, Área Contable y Área Informática;
- flujos ejercitados: pedidos mensuales/complementarios, provisión, movimientos de stock, traslado de activo y separación Depósito/Contable.

La adopción evaluada es la del alcance piloto autorizado; no se extrapola a toda la institución.

### Capacidad operativa — 7/7 PASS

Backup real P9.5:
- evento: 20/09/2026 13:53:28 UTC;
- edad al corte P9.6: **0,9543 h**;
- dump: 44.533 bytes;
- checksum SHA-256 verificado;
- bucket_copy_verified=true;
- secondary_copy_verified=true.

Restore drill:
- resultado: PASS;
- RPO: 0,2203 h <= 24 h;
- RTO: 0,0373 min <= 240 min;
- 19 tablas / 168 filas;
- target_cleanup_ok=true.

Programación:
- pilot-backup-cron: SUCCESS;
- cron: 0 6 * * * UTC = 03:00 Argentina;
- volumen /data y bucket privado presentes;
- procedimientos P9.1/P9.3/P9.5 disponibles.

### Rendimiento — 5/5 PASS

- p95 runtime de referencia: 65,31 ms <= 500 ms;
- 7 días de métricas actuales sin señal de presión relevante;
- backend: CPU máx. ~0,01255; memoria máx. ~0,285 GB; disco máx. ~0,034 GB;
- MySQL: CPU máx. ~0,00797; memoria máx. ~0,528 GB; disco máx. ~0,161 GB;
- carga P8 validada hasta concurrencia 20;
- error rate controlado: 0 %;
- regresiones P8 dentro de Quality Gate #336: verdes.

### Trazabilidad de la revisión desplegada

El backend de staging continúa sobre una revisión anterior a main. La comparación contra la rama P9.6 muestra diferencias únicamente en:
- documentación;
- CI;
- archivos de configuración/ejemplo;
- scripts operativos P9.5/P9.6;
- package.json por comandos de operación/test.

No existen diferencias en src/, server.js, inventario-frontend/ ni migraciones. Por ello no existe un cambio de runtime de aplicación pendiente que invalide esta evaluación.

### Decisión P9.6

El sistema queda **técnicamente elegible para aprobación institucional**.

No existe en este bloque una aprobación institucional formal con rol + referencia. Por lo tanto:
- institutional_status permanece **PENDING**;
- no se declara APPROVED_FOR_PRODUCTION_PLANNING;
- no se despliega producción;
- cualquier avance a producción requiere una decisión institucional explícita y un bloque de planificación/despliegue protegido.

Esta evaluación aplica los mismos criterios versionados por scripts/pilot-exit-gate.js. El comportamiento ejecutable del evaluador y sus casos negativos quedaron validados por Quality Gate #336.



---

## 12. Cierre formal P9.6

Cierre registrado el 20/09/2026.

Evidencia definitiva:
- PR #51 integrado;
- merge squash `24089be4b7f019288f00f450d1952522080cbc0a`;
- Quality Gate final pre-merge #337 verde;
- Quality Gate post-merge #338 verde;
- evaluación real: 34/34 criterios técnicos PASS;
- estabilidad 6/6;
- seguridad 4/4;
- integridad 8/8;
- adopción 4/4;
- capacidad operativa 7/7;
- rendimiento 5/5;
- decisión técnica: `ELIGIBLE_FOR_INSTITUTIONAL_APPROVAL`;
- aprobación institucional: `PENDING`;
- producción no autorizada, no migrada y no desplegada por P9.6.

La finalización técnica del piloto no reemplaza la decisión institucional. Una aprobación posterior debe aportar rol aprobador y referencia de decisión. Sólo entonces puede abrirse un bloque separado de planificación protegida de producción, con su propio preflight, backup, rollback, pruebas y Gate.
