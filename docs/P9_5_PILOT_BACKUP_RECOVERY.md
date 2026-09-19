# P9.5 — Backup y recuperación periódica del piloto

## Estado y objetivo

P9.5 está **activo**. Su objetivo es convertir los mecanismos de backup/restore ya existentes en una rutina periódica, verificable y medible para el piloto, sin ampliar privilegios de la aplicación ni introducir restauraciones destructivas sobre la base activa.

P9.5 no reemplaza P3, P7 ni P9.1. Los reutiliza:
- P3 aporta `db:backup`, checksum SHA-256, `db:restore` y restore drill de CI;
- P7 aporta staging, volúmenes persistentes, preflight y despliegue seguro;
- P9.1 define incident response, stop conditions y criterios de recuperación;
- P9.4 aporta observabilidad y seguimiento de crecimiento.

---

## 1. Objetivos del piloto

Se mantienen los objetivos operativos ya aprobados:

- **RPO objetivo: <= 24 horas**;
- **RTO objetivo: <= 4 horas**;
- backup adicional antes de migraciones/cambios destructivos;
- al menos una copia que no dependa únicamente del mismo runtime/volumen;
- restore drill periódico sobre una base alternativa;
- ningún restore sobre la base activa como primera opción.

Estos valores son objetivos internos del piloto, no SLA institucionales.

---

## 2. Capas de protección

P9.5 usa defensa en profundidad.

### Capa A — Backup lógico MySQL

Comando:

```bash
npm run pilot:backup:run
```

El runner:
- sólo admite `staging` o `test`;
- reutiliza `scripts/db-backup.js`;
- genera dump consistente con `--single-transaction`;
- verifica SHA-256 y tamaño;
- captura tablas y conteos antes y después del dump; si cambian durante esa ventana, descarta el backup y exige reintento;
- incorpora el snapshot estable de tablas/conteos a la metadata y a `latest.json`, sin secretos ni PII;
- aplica retención sobre el directorio primario;
- puede verificar una segunda copia mediante `PILOT_BACKUP_EXTERNAL_DIR`;
- registra un evento estructurado `pilot_backup_completed`.

En staging, el directorio primario previsto es:

```text
/data/backups/pilot-daily
```

El volumen del backend conserva esos archivos frente a redeploys, pero **no debe contarse por sí solo como única copia de recuperación**.

### Capa B — Backup nativo del volumen MySQL

Railway permite backups de volumen:
- diarios;
- semanales;
- mensuales.

Para el piloto se prevé habilitar como mínimo:
- **Daily**;
- **Weekly**.

Esta capa está administrada por el proveedor y se mantiene separada del runtime de la aplicación. Limitación: Railway documenta que estos backups sólo pueden restaurarse dentro del mismo proyecto+entorno. Por eso no sustituyen un dump lógico verificable.

### Capa C — Copia externa opcional del dump

`PILOT_BACKUP_EXTERNAL_DIR` permite copiar el par:
- `*.sql`;
- `*.sql.sha256.json`.

La copia se vuelve a verificar con SHA-256 antes de declararse válida.

Un directorio del mismo volumen **no cuenta** como copia fuera del host. Esta opción sólo cumple la capa externa cuando apunta a un almacenamiento/montaje distinto y autorizado.

No se agregará un proveedor ficticio ni credenciales de almacenamiento al repositorio. Si antes de producción institucional se exige copia off-provider, debe conectarse un destino aprobado y cifrado.

---

## 3. Retención

Valor inicial para dumps lógicos:

```text
PILOT_BACKUP_KEEP=7
```

El runner conserva los 7 backups lógicos más recientes en el directorio primario y elimina pares antiguos `sql + metadata`.

La retención del backup nativo Railway se gestiona por la política del proveedor:
- Daily;
- Weekly;
- Monthly cuando corresponda.

La retención debe revisarse antes de producción institucional.

---

## 4. Restore drill real

Comando:

```bash
npm run pilot:restore:drill
```

El drill:
1. sólo admite `staging/test`;
2. verifica el backup y su checksum;
3. rechaza usar la base activa como destino;
4. restaura en una base alternativa;
5. compara el conjunto de tablas con el snapshot estable registrado al crear el backup;
6. compara `COUNT(*)` exacto de cada tabla restaurada contra ese snapshot, sin depender del estado vivo posterior de staging;
7. mide RPO real desde `created_at` del backup;
8. mide RTO real incluyendo restore + validación;
9. elimina la base temporal;
10. escribe un reporte no sensible;
11. falla si RPO/RTO exceden los objetivos.

El drill no modifica datos de la base origen ni compara contra su estado vivo posterior al backup. Esto evita falsos fallos cuando el piloto registra escrituras legítimas entre la creación del dump y el simulacro mensual.

Si las credenciales normales de staging no permiten crear/eliminar una base alternativa, eso se considera una restricción de infraestructura a resolver mediante una identidad de restore separada. **No se amplían los privilegios del usuario de aplicación para facilitar el test.**

---

## 5. Variables

```text
PILOT_BACKUP_DIR
PILOT_BACKUP_KEEP=7
PILOT_BACKUP_MANIFEST
PILOT_BACKUP_EXTERNAL_DIR
PILOT_RESTORE_TARGET
PILOT_RESTORE_REPORT
PILOT_RPO_TARGET_HOURS=24
PILOT_RTO_TARGET_MINUTES=240
```

Las credenciales de restore continúan usando:

```text
RESTORE_DB_HOST
RESTORE_DB_PORT
RESTORE_DB_NAME
RESTORE_DB_USER
RESTORE_DB_PASSWORD
```

No versionar valores reales.

---

## 6. Quality Gate

CI debe ejecutar una prueba real contra MySQL descartable:

1. crear backup con el runner P9.5;
2. verificar copia secundaria del backup dentro del sandbox de CI;
3. restaurar en una base alternativa;
4. comparar tablas y conteos;
5. eliminar la base temporal;
6. comprobar RPO/RTO;
7. validar el JSON de reporte.

Los resultados de CI pueden publicarse como artifact sintético. Los resultados reales de staging permanecen fuera de Git.

---

## 7. Programación prevista en staging

Frecuencia objetivo:
- backup lógico: **diario**;
- backup nativo MySQL: **Daily + Weekly**;
- restore drill real: **mensual** y antes de ampliar el piloto;
- backup adicional: antes de toda migración/cambio destructivo.

Railway Cron es apto para tareas cortas que terminan y cierran conexiones. Si se usa un cron service para el dump lógico, debe finalizar después del backup y no quedar `Active`.

La programación real se habilita únicamente después de:
- Quality Gate verde;
- SHA exacto desplegado/identificado;
- destino persistente confirmado;
- permisos mínimos confirmados;
- evidencia de una ejecución manual segura.

---

## 8. Evidencia mínima semanal

Registrar:
- último backup lógico verificado;
- edad del último backup;
- SHA-256;
- bytes;
- cantidad retenida;
- estado del backup nativo Railway;
- resultado de la última copia externa cuando exista;
- último restore drill;
- RPO real;
- RTO real;
- fallos/reintentos;
- stop conditions o incidentes P9.1 relacionados.

No registrar secretos ni contenido del dump.

---

## 9. Stop conditions

Detener el flujo y aplicar P9.1 si:
- no existe backup verificable cuando se requiere recuperación;
- checksum inválido;
- restore alternativo no coincide con el origen;
- la limpieza del target del drill falla y deja una base temporal sin control;
- se excede RPO de forma sostenida;
- el restore requerido no puede completarse dentro del RTO y existe impacto real;
- una operación intenta sobrescribir la base activa sin procedimiento excepcional aprobado.

---

## 10. Criterios de cierre P9.5

P9.5 puede cerrarse cuando:
- runners de backup y restore drill están versionados;
- contrato P9.5 forma parte de `npm test`;
- Quality Gate ejecuta backup+restore real sobre MySQL descartable;
- documentación y `ROADMAP.md` están alineados;
- existe al menos un backup lógico real de staging verificado;
- la retención primaria está validada;
- existe una segunda capa de backup real fuera del runtime primario;
- existe un restore drill real de staging sobre base alternativa;
- RPO/RTO reales quedan medidos y dentro de objetivo, o cualquier incumplimiento está tratado;
- la programación periódica real queda configurada y evidenciada;
- PR del bloque queda verde y mergeado;
- Quality Gate post-merge queda verde.

**P9.6 permanece bloqueado mientras P9.5 esté activo.**
