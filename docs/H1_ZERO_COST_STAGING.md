# H1 — Continuidad de staging a costo $0

## Estado y objetivo

H1 está **activo**. Su objetivo es conservar un staging funcional después del Trial de Railway sin contratar Hobby/Pro, sin agregar una tarjeta como requisito técnico y sin tocar producción.

Restricciones:
- costo de bolsillo: **USD 0**;
- la aprobación institucional y producción permanecen fuera de alcance;
- MFA, cookie HttpOnly/SameSite=Strict, autorización backend, MySQL, backup/restore y trazabilidad P7–P9 no se debilitan;
- Railway no se destruye hasta que el reemplazo gratuito pase migración, smoke, persistencia, adjuntos y backup.

## 1. Baseline real de Railway

Ventana observada: 7 días, 169 muestras horarias.

| Servicio | RAM media | CPU media |
| --- | ---: | ---: |
| backend | 0,099678 GB | 0,0001192 vCPU |
| frontend | 0,038065 GB | 0,00004153 vCPU |
| mysql | 0,461872 GB | 0,0039689 vCPU |
| pilot-backup-cron | ~0 | ~0 |

Uso de Volumes observado:
- backend-data: ~0,0340 GB;
- mysql-data: ~0,1608 GB;
- pilot-backup-cron-volume: ~0,0324 GB;
- total: ~0,2273 GB.

Con las tarifas públicas de Railway del 20/09/2026, el staging 24x7 equivale a aproximadamente **USD 6,1/mes**, contra **USD 1/mes** de crédito del plan Free.

Railway Free además admite **1 Volume por proyecto**; el staging del Trial tiene 3. Por lo tanto la topología actual no puede ser el estado final H1.

## 2. Experimento Serverless Railway — descartado como solución H1

Se habilitó `sleepApplication=true` y se redeployó:
- mysql: `4dcda2fd-b1e6-4c6d-9214-a67466594d7e`;
- backend: `c02d4fd2-496d-45e4-aaf4-c76a26ab1a2b`;
- frontend: `1c496c70-4fa7-4d4a-af93-124f820937c3`.

Después de más de una hora sin uso funcional:
- no apareció ningún deployment `SLEEPING`;
- backend seguía en ~0,087 GB;
- frontend seguía en ~0,029 GB;
- MySQL seguía en ~0,387 GB y CPU no nula.

Conclusión: **no se usa una proyección de duty-cycle para declarar H1 PASS**. La propia guía actual de Railway clasifica bases de datos como mal candidato para Serverless porque conexiones/background traffic pueden impedir el sueño.

El archivo `pilot/staging-free-budget.example.json` representa ahora el estado real 24x7 y debe resultar `OVER_BUDGET`.

## 3. Topología objetivo external-free

H1 migra únicamente el **staging**, nunca producción.

### Web full-stack: Render Free

Un único Web Service sirve:
- React compilado;
- API Express;
- health endpoints.

Motivo de unificar frontend/backend:
- conserva mismo origen para `__Host-` cookie;
- mantiene `SameSite=Strict`;
- elimina CORS entre dos proveedores;
- evita un segundo proceso permanentemente activo.

Contrato versionado:
- `render.yaml`;
- plan `free`;
- auto-deploy sólo después de CI verde;
- `VITE_API_URL=/api`;
- `SERVE_FRONTEND_STATIC=true`;
- `/health/ready` como healthcheck.

Render Free duerme el web service tras inactividad y usa filesystem efímero. Por eso ningún dato durable queda en disco local.

### Base: TiDB Cloud Starter

TiDB Cloud Starter se usa como destino MySQL-compatible de staging:
- cuota gratuita inicial: 5 GiB row storage + 5 GiB columnar;
- 50 millones de Request Units por mes;
- no requiere tarjeta para comenzar dentro de la cuota gratuita;
- conexión MySQL nativa sobre TLS.

La base actual (~0,16 GB en volumen Railway y <1 MiB de datos lógicos en capturas previas) queda ampliamente por debajo del límite de almacenamiento. Esto no reemplaza una prueba real de migraciones.

H1 agrega:
- `DB_SSL=true`;
- TLS >= 1.2;
- verificación de certificado;
- CA configurable;
- TLS también para mysql2, mysqldump/mysql CLI, backup y restore.

### Objetos y backups: Railway Storage Bucket

Se reutiliza `pilot-backup-bucket`:
- privado;
- S3-compatible;
- adjuntos bajo prefijo `uploads/staging-free/`;
- backups cifrados AES-256-GCM bajo prefijo P9.5;
- sin URLs públicas directas: descarga siempre pasa por autorización backend.

El bucket Free permite hasta 10 GB-mes y consume el crédito Railway Free. El uso actual es mínimo.

### Backup periódico: Railway cron residual

`pilot-backup-cron` se conserva como ejecución corta:
- cron diario;
- sin Volume;
- output primario en `/tmp`;
- DB externa vía TLS;
- copia durable cifrada al bucket;
- proceso termina al finalizar.

El presupuesto residual conservador está en:
`pilot/staging-free-budget-target.example.json`.

Con 0 Volumes, ~0,01 GB de bucket y un cron deliberadamente sobredimensionado a 0,25 GB / 0,1 vCPU durante 0,1 h/día, el modelo queda con margen > USD 0,90 respecto del crédito mensual Railway Free.

## 4. Compatibilidad y seguridad

### Same-origin

El backend sólo sirve la SPA cuando:
`SERVE_FRONTEND_STATIC=true`.

Por defecto continúa comportándose como API, por lo que Railway actual y una futura producción no cambian.

Cuando sirve SPA:
- assets y navegación React usan CSP específica;
- API/health conservan CSP cerrada;
- `connect-src 'self'`;
- cookie, Origin y CORS siguen en el mismo origen HTTPS.

### Object storage

`UPLOAD_STORAGE_MODE=s3` es obligatorio para staging external-free.

El backend:
- recibe el upload en memoria;
- comprime imágenes como antes;
- persiste en S3;
- guarda sólo la clave interna en DB;
- nunca expone `ruta_archivo`;
- descarga luego de comprobar autorización;
- borra objeto + registro mediante el flujo protegido.

### Restore portable de dumps MySQL

H1 debe poder restaurar un backup verificado aunque la estación local no tenga `mysql.exe` instalado. El cliente MySQL nativo sigue siendo la vía preferida cuando existe; si no está disponible, `db-restore.js` usa un fallback `mysql2` restringido.

El fallback no envía el dump completo como una consulta multi-statement. Parsea el formato real de `mysqldump`, elimina comentarios de control y locks, conserva correctamente comillas/escapes y ejecuta sólo sentencias permitidas (`DROP TABLE`, `CREATE TABLE`, `INSERT`) una por una. Cualquier sentencia inesperada bloquea el restore antes de continuar. El Quality Gate fuerza además el escenario `mysql` ausente contra una base MySQL descartable para evitar regresiones.

Evidencia de causa raíz H1: el Quality Gate #393 reprodujo contra MySQL 8.4 el mismo error observado al restaurar en TiDB (`;` vacíos antes de `DROP TABLE IF EXISTS`). El fallo correspondía al primer fallback mysql2 y no a TiDB. El parser corregido queda sujeto al mismo test de restore descartable antes de repetir la validación real.

### DB TLS

En `STAGING_TOPOLOGY=external-free`, preflight exige:
- `DB_SSL=true`;
- `DB_SSL_REJECT_UNAUTHORIZED=true`;
- `SERVE_FRONTEND_STATIC=true`;
- storage S3 configurado.

No se permite “resolver” una incompatibilidad deshabilitando validación TLS.

## 5. Migración segura

Orden obligatorio:

1. Gate H1 completamente verde.
2. Crear TiDB Cloud Starter gratuito.
3. Crear Render Free desde `render.yaml`, sin tarjeta.
4. Configurar secretos únicamente en los dashboards.
5. Generar backup final verificado de Railway.
6. Restaurar el backup en TiDB.
7. Aplicar/verificar migraciones 001–007.
8. Comparar tablas/conteos y usuarios/oficinas piloto.
9. Desplegar Render sobre el SHA H1 aprobado.
10. Ejecutar health + smoke + auth/MFA + permisos.
11. Probar adjunto real: alta, descarga y borrado.
12. Probar backup desde TiDB hacia bucket y restore desde bucket sobre base alternativa.
13. Verificar cold start/wake de Render y persistencia posterior.
14. Recién entonces detener compute Railway antiguo.
15. Eliminar `backend-data` y `pilot-backup-cron-volume` sólo después de confirmar que no contienen el único ejemplar de ningún dato.
16. Conservar cero Volumes en Railway si MySQL ya fue migrado.

No se elimina MySQL Railway antes del paso 13.

## 6. Rollback

Hasta el cutover:
- Railway sigue siendo la referencia de staging.

Después del cutover y antes de eliminar el MySQL antiguo:
- si Render/TiDB falla, volver el frontend al staging Railway y reactivar servicios previos;
- no copiar cambios parciales hacia atrás sin una estrategia de consistencia;
- si hubo escrituras en TiDB, congelar el staging y hacer backup antes de decidir retorno.

Una vez retirado MySQL Railway:
- recuperación parte del backup cifrado verificado del bucket hacia una DB alternativa.

## 7. Criterios de cierre H1

H1 sólo se cierra cuando:

- Quality Gate H1 verde;
- baseline Railway queda explícitamente `OVER_BUDGET`;
- topología external-free versionada;
- TLS DB cubierto por contratos/tests;
- SPA same-origin cubierta por contratos/tests;
- TiDB Starter real creado sin plan pago;
- backup Railway restaurado correctamente en TiDB;
- migraciones y conteos validados;
- Render Free real desplegado sobre SHA aprobado;
- health/live + ready verdes;
- login, MFA y permisos críticos verdes;
- adjuntos S3: alta/descarga/borrado verdes;
- backup cron opera sin Volume contra TiDB;
- restore desde bucket cifrado PASS;
- Render demuestra sleep/wake real;
- datos piloto persisten tras wake;
- Railway queda reducido al consumo residual compatible con USD 1;
- no quedan más de los Volumes permitidos por Free;
- costo de bolsillo confirmado en USD 0;
- documentación/ROADMAP alineados;
- PR mergeado y Gate post-merge verde.

## 8. Stop conditions

Detener H1 y no retirar Railway si:
- TiDB no acepta alguna migración/regla de integridad requerida;
- una FK/unique/transaction cambia de semántica;
- TLS sólo funciona desactivando verificación;
- Render Free supera memoria o presenta inestabilidad que invalida el staging;
- auth/cookie/MFA falla por la nueva topología;
- adjuntos dejan de respetar alcance por oficina/usuario;
- backup/restore no puede demostrarse;
- algún proveedor exige plan pago/tarjeta para completar el estado objetivo.

En cualquiera de esos casos se conserva staging Railway mientras exista crédito y se evalúa otra alternativa gratuita en la misma rama o en un bloque explícito.

## 9. Fuentes operativas verificadas

Consultadas el 20/09/2026:
- Railway Pricing / Plans / Volumes / Storage Buckets / Serverless;
- Render Free / Blueprint Spec;
- TiDB Cloud Starter plan, límites y TLS.

Los límites de terceros pueden cambiar. H1 los trata como evidencia fechada, no como contrato permanente.
