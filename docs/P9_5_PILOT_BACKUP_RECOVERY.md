# P9.5 — Backup y recuperación periódica del piloto

## Estado y objetivo

P9.5 está **formalmente cerrado**. La implementación, Quality Gate, validación real de staging, merge y Quality Gate post-merge quedaron completos.

Su objetivo es convertir los mecanismos de backup/restore ya existentes en una rutina periódica, verificable y medible para el piloto, sin ampliar privilegios de la aplicación ni introducir restauraciones destructivas sobre la base activa.

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

El volumen dedicado del servicio de backup conserva esos archivos frente a redeploys, pero **no debe contarse por sí solo como única copia de recuperación**.

### Capa B — Copia cifrada en Storage Bucket S3 compatible

En el staging de costo cero, los backups/PITR nativos del volumen MySQL de Railway no están disponibles porque el proveedor los reserva para el plan Pro. P9.5 no requiere contratar ese plan.

La segunda capa operativa del piloto usa un Storage Bucket privado S3 compatible. Antes de salir del contenedor:
- el dump ya verificado se cifra con **AES-256-GCM**;
- la clave de 32 bytes se mantiene exclusivamente como secreto de entorno;
- se suben el objeto cifrado y metadata no sensible;
- el runner vuelve a descargar el objeto;
- lo descifra en memoria;
- compara bytes y SHA-256 con el backup de origen;
- recién entonces declara `bucket_copy.verified=true`;
- aplica retención inicial de 7 copias cifradas.

El bucket es almacenamiento de objetos separado del volumen `/data`. No se versionan credenciales, clave de cifrado ni dumps reales.

Railway Storage Buckets usan red pública HTTPS. El cifrado previo evita que el SQL viaje o quede almacenado en claro aun cuando el bucket ya tenga cifrado en reposo del proveedor.

### Capa C — Copia por directorio externo opcional

`PILOT_BACKUP_EXTERNAL_DIR` se conserva para entornos de prueba o un montaje externo autorizado y permite copiar el par:
- `*.sql`;
- `*.sql.sha256.json`.

La copia se vuelve a verificar con SHA-256 antes de declararse válida.

Un directorio del mismo volumen **no cuenta** como copia independiente. En staging, `PILOT_BACKUP_REQUIRE_SECONDARY=true` obliga a que exista una segunda copia verificada mediante bucket S3 o destino externo autorizado antes de declarar el backup exitoso.

Si antes de producción institucional se exige una copia off-provider, debe conectarse un destino institucional aprobado; el bucket del piloto no reemplaza esa decisión.

---

## 3. Retención

Valor inicial para dumps lógicos:

```text
PILOT_BACKUP_KEEP=7
```

El runner conserva los 7 backups lógicos más recientes en el directorio primario y elimina pares antiguos `sql + metadata`.

La copia cifrada del bucket usa inicialmente:

```text
PILOT_BACKUP_S3_KEEP=7
```

El runner conserva las 7 copias cifradas más recientes y elimina pares antiguos `*.sql.enc + *.meta.json`. La retención debe revisarse antes de producción institucional.

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
PILOT_BACKUP_REQUIRE_SECONDARY=true
PILOT_BACKUP_S3_ENDPOINT
PILOT_BACKUP_S3_BUCKET
PILOT_BACKUP_S3_REGION
PILOT_BACKUP_S3_ACCESS_KEY_ID
PILOT_BACKUP_S3_SECRET_ACCESS_KEY
PILOT_BACKUP_S3_PREFIX
PILOT_BACKUP_S3_KEEP=7
PILOT_BACKUP_S3_FORCE_PATH_STYLE=false
PILOT_BACKUP_ENCRYPTION_KEY
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

Frecuencia aplicada en staging:
- backup lógico: **diario a las 06:00 UTC / 03:00 Argentina** mediante Railway Cron `0 6 * * *`;
- segunda copia cifrada al bucket: **en la misma ejecución diaria**;
- restore drill real: **mensual** y antes de ampliar el piloto, ejecutado manualmente de forma controlada;
- backup adicional: antes de toda migración/cambio destructivo.

Los backups/PITR nativos del volumen MySQL quedan como mejora opcional de un plan pago y no forman parte del criterio de cierre del piloto de costo cero.

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
- estado de la última copia cifrada en bucket;
- resultado de la última copia externa por directorio cuando exista;
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

Estado al 20/09/2026:

- ✅ runners de backup y restore drill versionados;
- ✅ contrato P9.5 forma parte de `npm test`;
- ✅ Quality Gate ejecuta backup+restore real sobre MySQL descartable;
- ✅ documentación y `ROADMAP.md` alineados para cierre pre-merge;
- ✅ backup lógico real de staging verificado;
- ✅ retención primaria configurada en 7;
- ✅ segunda capa real fuera del volumen primario mediante Storage Bucket privado;
- ✅ copia secundaria cifrada con AES-256-GCM y reverificada por SHA-256;
- ✅ restore drill real de staging sobre base alternativa;
- ✅ RPO/RTO reales dentro de objetivo;
- ✅ base temporal eliminada al finalizar el drill;
- ✅ cron diario real configurado;
- ✅ PR #49 mergeado por squash en `41cb640bc299a5faf9af6c3ed67beb258063bfc5`;
- ✅ Quality Gate final pre-merge #332 verde;
- ✅ Quality Gate post-merge #333 verde.

**P9.5 queda formalmente cerrado. P9.6 pasa a ser elegible como próximo bloque, pero no se abre hasta releer `ROADMAP.md` desde `main`.**

---

## 11. Evidencia real de staging — 20/09/2026

### Quality Gate

- PR: **#49**;
- HEAD validado: `7bdeeec815be4d4e78320063891fb73e1bcb92ee`;
- Quality Gate **#330**: verde;
- incluye contratos, sintaxis, integración MySQL, backup/restore P9.5, concurrencia, rendimiento, E2E y frontend.

### Backup lógico real + segunda copia

Deployment Railway:
- servicio: `pilot-backup-cron`;
- deployment: `66bd32ef-5f88-4b6b-82ba-7e428a7150db`;
- SHA: `7bdeeec815be4d4e78320063891fb73e1bcb92ee`;
- estado: `SUCCESS`.

Resultado estructurado:
- entorno: `staging`;
- dump: **44.533 bytes**;
- SHA-256: `1887757832441ad96f46ddec8f7b057c3313e9a700c98196a2fe64df11682e92`;
- retención primaria observada: 1 de 7;
- `bucket_copy_verified=true`;
- `secondary_copy_verified=true`;
- duración: **970 ms**.

Segunda capa:
- bucket privado: `pilot-backup-bucket`;
- región: US West;
- objeto SQL cifrado del lado cliente con AES-256-GCM antes de salir del contenedor;
- descarga posterior, descifrado en memoria y comparación de SHA-256 antes de declarar éxito;
- backups/PITR nativos del volumen MySQL no se usan porque Railway los reserva para plan Pro y el piloto mantiene objetivo de costo de bolsillo **$0**.

### Restore drill real

Deployment Railway:
- deployment: `3f4d5547-7284-478d-b4d5-00c42f399047`;
- SHA: `7bdeeec815be4d4e78320063891fb73e1bcb92ee`;
- estado del deployment: `SUCCESS`;
- evento: `pilot_restore_drill_completed`;
- resultado: **PASS**.

Validación:
- tablas restauradas/comparadas: **19**;
- filas comparadas: **168**;
- RPO real: **0,2203 h** (~13,2 min), objetivo <= 24 h;
- RTO real: **0,0373 min** (~2,24 s), objetivo <= 240 min;
- `target_cleanup_ok=true`;
- la base activa no fue usada como destino;
- la identidad administrativa de restore fue temporal y separada del usuario normal de aplicación;
- las variables administrativas de restore se vaciaron después del drill.

### Programación final

Configuración efectiva del servicio:
- rama: `ops/p9-5-pilot-backup-recovery`;
- Dockerfile del repositorio;
- comando: `npm run pilot:backup:run`;
- política de restart: `NEVER`;
- volumen dedicado: `/data`, 500 MB;
- cron: `0 6 * * *` UTC = **03:00 Argentina**;
- deployment final de configuración: `cf9ef12f-fe83-4d00-9eb7-10d7d0781cd3`, `SUCCESS`.

Con esta evidencia, los criterios técnicos/operativos de P9.5 están satisfechos. Restan únicamente merge del PR #49 y Quality Gate post-merge para declarar el bloque formalmente cerrado.


---

## 12. Cierre formal

Cierre registrado el 20/09/2026.

Evidencia definitiva:
- PR #49 integrado;
- merge squash `41cb640bc299a5faf9af6c3ed67beb258063bfc5`;
- Quality Gate final pre-merge #332 verde;
- Quality Gate post-merge #333 verde;
- backup real de staging verificado;
- segunda copia cifrada en bucket verificada;
- restore drill real PASS;
- RPO/RTO dentro de objetivo;
- cleanup de base temporal confirmado;
- cron diario de backup activo a las 06:00 UTC / 03:00 Argentina;
- objetivo de costo de bolsillo $0 preservado;
- sin stop conditions P9.1 abiertas.

La continuidad pasa a P9.6 únicamente después de releer `ROADMAP.md` desde `main`.
