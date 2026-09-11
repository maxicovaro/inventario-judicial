# Runbook operativo — Inventario Judicial

Este documento define el procedimiento mínimo de operación, respaldo y recuperación para el piloto. No reemplaza la política institucional de seguridad o continuidad que pueda establecer la Dirección.

Para el contrato específico de staging, preflight, migración protegida y smoke post-deploy ver `STAGING.md`.

## 1. Objetivos operativos iniciales

Para el piloto se adoptan como objetivos de trabajo:

- **RPO objetivo:** hasta 24 horas de datos, mediante al menos un backup diario.
- **RTO objetivo:** hasta 4 horas para recuperar una instancia utilizable en un incidente de base de datos.
- Backup adicional **antes de toda migración, despliegue o cambio de infraestructura**.
- Retención mínima recomendada: 7 backups diarios y 4 semanales.
- Una copia que exista únicamente en el mismo equipo/servidor **no se considera respaldo suficiente**: debe existir al menos una copia fuera del host y con acceso restringido.

Estos objetivos deben revisarse antes de pasar de piloto a producción institucional.

## 2. Backup MySQL

Los backups locales se guardan por defecto bajo `backups/`, directorio excluido de Git.

Crear un backup:

```bash
npm run db:backup
```

Elegir nombre explícito:

```bash
npm run db:backup -- --output backups/pre-migracion.sql
```

Cada backup genera dos archivos:

- `*.sql`: dump MySQL.
- `*.sql.sha256.json`: metadata y checksum SHA-256.

Verificar un backup antes de copiarlo o restaurarlo:

```bash
npm run db:backup:verify -- backups/pre-migracion.sql
```

Nunca almacenar `.env`, contraseñas o dumps con datos reales dentro del repositorio.

## 3. Copia fuera del host

Después de crear y verificar el backup:

1. Copiar **el `.sql` y su `.sha256.json`** a almacenamiento externo autorizado.
2. Restringir el acceso a personal autorizado.
3. Volver a ejecutar la verificación SHA-256 sobre la copia antes de considerarla válida.
4. No enviar dumps de datos reales por canales de mensajería no aprobados.

P7.1 formaliza esta exigencia dentro del procedimiento de despliegue. La automatización concreta del almacenamiento externo depende de la infraestructura/proveedor que se seleccione en P7.2; no se deben introducir credenciales ni un adaptador de proveedor ficticio en el repositorio.

## 4. Restauración segura

La regla general es **restaurar primero en una base alternativa**. El script bloquea por defecto la restauración sobre `DB_NAME`.

Ejemplo:

```bash
npm run db:restore -- backups/pre-migracion.sql --target inventario_restore --confirm inventario_restore --recreate
```

Para usar credenciales distintas para restauración se pueden definir:

```text
RESTORE_DB_HOST
RESTORE_DB_PORT
RESTORE_DB_NAME
RESTORE_DB_USER
RESTORE_DB_PASSWORD
```

Una restauración sobre la base activa solo se habilita de manera excepcional con `ALLOW_RESTORE_CURRENT_DB=true`, el nombre exacto en `--confirm` y una ventana de mantenimiento. Antes de hacerlo debe existir un backup verificado del estado actual, incluso si se sospecha que está dañado.

## 5. Prueba de restauración

Un backup no se considera confiable solo porque `mysqldump` terminó sin error. CI ejecuta una prueba que:

1. inserta un dato de control en la base descartable de CI;
2. crea un dump;
3. verifica su SHA-256;
4. restaura el dump en otra base descartable;
5. comprueba que el dato de control exista;
6. elimina la base de prueba.

Además del CI, realizar un simulacro operativo al menos una vez por mes cuando exista el entorno de piloto estable.

## 6. Health checks

La aplicación expone dos endpoints sin autenticación y sin datos sensibles:

- `GET /health/live`: indica que el proceso HTTP está vivo.
- `GET /health/ready`: comprueba también acceso a MySQL; responde HTTP 503 si la base no está disponible dentro del timeout configurado.

Variables:

```text
HEALTH_DB_TIMEOUT_MS=2000
SHUTDOWN_TIMEOUT_MS=10000
```

Desde P7.1 ambos endpoints incluyen `environment` y, cuando está definida, `revision`. Estos campos permiten confirmar el entorno y commit desplegados sin exponer secretos.

Interpretación:

- `live = 200`, `ready = 200`: servicio operativo.
- `live = 200`, `ready = 503`: proceso vivo pero no apto para recibir tráfico; revisar MySQL/red/credenciales.
- `live` no responde: revisar proceso, puerto, host o infraestructura.

## 7. Logging y correlación

Los logs operativos se escriben en JSON, una línea por evento. Las solicitudes reciben `X-Request-Id`; si el cliente aporta uno válido se conserva, de lo contrario se genera uno.

Campos típicos:

```text
timestamp
level
event
request_id
method
path
status
duration_ms
```

No se registran cuerpos de requests, contraseñas, tokens JWT ni query strings desde el middleware de acceso. Ante un error, usar el `request_id` para correlacionar la solicitud con los logs del servidor.

## 8. Apagado controlado

Ante `SIGTERM` o `SIGINT` la aplicación:

1. deja de aceptar conexiones nuevas;
2. espera el cierre del servidor HTTP;
3. cierra Sequelize/MySQL;
4. finaliza el proceso.

Si el cierre supera `SHUTDOWN_TIMEOUT_MS`, se registra `shutdown_timeout` y el proceso termina con error para no quedar indefinidamente bloqueado.

## 9. Clasificación de incidentes

### SEV-1
- pérdida/corrupción de datos confirmada;
- indisponibilidad total prolongada;
- acceso no autorizado o secreto comprometido.

Acción: detener cambios, preservar evidencia, avisar al responsable técnico/institucional y ejecutar el procedimiento de recuperación.

### SEV-2
- función crítica degradada;
- `ready=503` persistente;
- errores repetitivos que afectan una oficina o flujo central.

Acción: aislar causa, conservar servicio seguro si es posible y preparar rollback/restore.

### SEV-3
- defecto menor sin pérdida de datos ni bloqueo crítico.

Acción: registrar, reproducir y corregir mediante el flujo normal de PR.

## 10. Recuperación ante fallo de base de datos

1. **Detener escrituras**: detener la aplicación o ponerla fuera de tráfico.
2. Registrar hora, síntomas, último cambio y commit desplegado.
3. Si MySQL todavía responde, crear un backup de emergencia y conservarlo separado.
4. Seleccionar el último backup conocido y verificar SHA-256.
5. Restaurarlo **en una base alternativa** con `db:restore`.
6. Verificar estructura, migraciones y datos críticos; ejecutar `npm run db:status` y pruebas pertinentes.
7. Comparar registros críticos (usuarios, oficinas, activos, stock, pedidos y movimientos) con el estado esperado.
8. Solo después de validar, decidir la promoción de la base restaurada o la restauración excepcional sobre la base activa.
9. Iniciar la aplicación y comprobar `/health/live` y `/health/ready`.
10. Registrar qué se perdió desde el último backup conforme al RPO real del incidente.

## 11. Rollback de aplicación

Si el incidente proviene de código y no de datos:

1. detener nuevos despliegues;
2. identificar el último merge estable de `main`;
3. revertir mediante Git/PR o desplegar el artefacto estable anterior según el procedimiento de `STAGING.md` y la plataforma real;
4. no revertir manualmente una migración de base solo para hacer coincidir código antiguo;
5. si el esquema ya avanzó, preferir una corrección hacia adelante o una restauración previamente verificada;
6. comprobar ambos health checks y el smoke post-deploy antes de reabrir tráfico.

## 12. Secreto o credencial comprometida

1. revocar/rotar inmediatamente la credencial afectada;
2. no registrar el valor comprometido en issues, commits o logs;
3. revisar accesos y eventos desde el momento estimado de exposición;
4. actualizar el secreto en el entorno correspondiente;
5. reiniciar de forma controlada;
6. validar login, permisos y health checks.

## 13. Checklist previo a migración o despliegue

- working tree limpio y commit identificado;
- Quality Gate verde;
- `DEPLOY_REVISION` identifica el commit/versión a desplegar;
- `npm run deploy:preflight` verde para staging/production;
- backup creado;
- checksum verificado;
- copia fuera del host confirmada cuando el entorno contenga datos que deban conservarse;
- `db:status` revisado;
- migración de despliegue ejecutada con `npm run deploy:migrate -- --backup ...`;
- plan de rollback identificado;
- después del cambio: `db:status`, `/health/live`, `/health/ready` y `npm run deploy:smoke`.

## 14. Cierre de incidente

Todo incidente SEV-1 o SEV-2 debe terminar con un registro que contenga, sin secretos ni datos personales innecesarios:

- fecha/hora;
- impacto;
- causa raíz o causa probable;
- commit/versión afectada;
- acciones de contención y recuperación;
- RPO/RTO reales;
- acciones preventivas pendientes.

Las acciones preventivas deben volver a la hoja de ruta o convertirse en issue antes de dar el incidente por cerrado.

## 15. Staging y evidencia de despliegue

El procedimiento completo está en `STAGING.md`.

P7.1 aporta las guardas reproducibles dentro del repositorio; P7.2 debe conectar esas guardas con una infraestructura real. Para cerrar P7 se debe conservar evidencia, sin secretos, de:

- entorno y base separados;
- dominio/origin HTTPS;
- topología de proxy y `TRUST_PROXY_HOPS`;
- commit identificado en `DEPLOY_REVISION`;
- preflight y Quality Gate verdes;
- backup/migración controlada;
- health checks y smoke post-deploy;
- rollback probado o simulado;
- ubicación autorizada del backup fuera del host cuando corresponda.

No marcar P7 como terminado si solo existe la configuración en Git y todavía no se desplegó un staging real.
