# P7.2 — Railway staging

Runbook específico y evidencia del entorno de staging real del Sistema de Inventario Judicial en Railway.

Este documento complementa `docs/STAGING.md`. No reemplaza las guardas de P7.1 (`deploy:preflight`, backup verificado, `deploy:migrate`, `deploy:smoke`).

## Estado validado

P7.2 fue validado técnicamente el 11/09/2026 sobre la rama `ops/p7-staging-real` y PR #22.

Revisión validada:

```text
d5933555d99d8f7dece3d9fc915e2e8704a710d0
```

Quality Gate de referencia:

```text
#165 — VERDE COMPLETO
```

El cierre formal de P7 completo requiere integrar PR #22 a `main` y verificar el Quality Gate post-merge.

## Arquitectura real

Proyecto Railway privado:

```text
inventario-judicial-staging
```

Railway creó su environment interno con nombre `production`, pero el proyecto completo es el entorno aislado de staging. La aplicación se identifica correctamente mediante:

```text
NODE_ENV=production
DEPLOY_ENV=staging
```

Servicios permanentes:

```text
Internet
   |
 HTTPS
   v
frontend (PUBLICO)
React/Vite + Caddy
   |
   | /api/* y /health/*
   v
backend (PRIVADO)
Node 22 / Express
   |
   v
mysql (PRIVADO)

backend volume: /data
  ├─ uploads/
  └─ backups/

mysql volume: /var/lib/mysql
```

Solo `frontend` tiene dominio público.

Origen público validado:

```text
https://frontend-production-245b.up.railway.app
```

`backend` y `mysql` no tienen dominio público ni TCP proxy de operación normal.

## Nombres de servicios

Servicios permanentes exactos:

```text
frontend
backend
mysql
```

Se creó un `smoke-runner` temporal únicamente para ejecutar el smoke desde fuera del backend. Fue eliminado después de la validación.

## Fuente Git

Repositorio:

```text
maxicovaro/inventario-judicial
```

Rama P7.2 validada:

```text
ops/p7-staging-real
```

Staging quedó validado con el SHA `d5933555...`. Después de integrar PR #22, las promociones normales deben originarse desde `main` con SHA identificado.

## Servicio `backend`

Root Directory:

```text
/
```

Dockerfile:

```text
/Dockerfile
```

La imagen validada:

- usa `node:22-bookworm-slim`;
- instala `mysql-community-client` 8.0 desde el repositorio oficial MySQL;
- soporta autenticación MySQL 8 `caching_sha2_password`;
- instala dependencias con `npm ci --omit=dev`;
- arranca normalmente con `npm start`;
- NO ejecuta migraciones automáticamente.

### Incidencia resuelta del cliente MySQL

El primer backup real falló antes de migrar porque `mariadb-client` no podía cargar el plugin `caching_sha2_password` usado por MySQL 8.

La corrección fue deliberadamente mantener la autenticación moderna de MySQL y sustituir el cliente del contenedor por:

```text
mysql-community-client 8.0.46
```

No se cambió MySQL a `mysql_native_password`.

La corrección quedó protegida por `test:staging-contracts` y Quality Gate #165.

### Networking

Backend privado, sin dominio público.

Healthcheck Railway:

```text
/health/ready
```

Timeout validado:

```text
120 s
```

El proceso escucha `PORT=3000` en el despliegue validado.

### Volumen

Volumen Railway:

```text
backend-data
```

Tamaño disponible por el plan Hobby durante P7.2:

```text
500 MB
```

Mount path:

```text
/data
```

Variables/rutas:

```text
UPLOAD_DIR=/data/uploads
backups=/data/backups
```

La persistencia del volumen quedó comprobada: `pre-migrate-p7.sql` y su metadata SHA-256 seguían presentes en un deployment posterior al que los generó.

## Servicio `frontend`

Root Directory:

```text
/inventario-frontend
```

Dockerfile:

```text
/inventario-frontend/Dockerfile
```

El frontend se construye con:

```text
VITE_API_URL=/api
```

Caddy sirve la SPA y proxyea al backend privado.

Variable validada:

```text
BACKEND_INTERNAL_URL=http://backend.railway.internal:3000
```

### Networking

Único dominio público:

```text
https://frontend-production-245b.up.railway.app
```

El healthcheck Railway efectivo se configuró sobre:

```text
/
```

Railway no aceptó `/frontend-health` como healthcheck configurado durante el aprovisionamiento. La raíz de Caddy devuelve 200 y fue utilizada para verificar que el contenedor frontend atiende tráfico.

Caddy expone desde el mismo origen:

```text
/api/*       -> backend privado
/health/*    -> backend privado
```

Por lo tanto:

```text
SMOKE_API_ORIGIN=https://frontend-production-245b.up.railway.app
SMOKE_FRONTEND_ORIGIN=https://frontend-production-245b.up.railway.app
```

## Servicio `mysql`

MySQL validado:

```text
mysql:8.0
```

Sin Public Access para operación normal.

Volumen:

```text
mysql-data
mount: /var/lib/mysql
size: 500 MB
```

Base y usuario de staging son exclusivos del entorno. Los valores secretos no se documentan en Git.

Backend usa red privada Railway mediante Reference Variables, incluyendo:

```text
DB_HOST=${{mysql.RAILWAY_PRIVATE_DOMAIN}}
DB_PORT=3306
DB_NAME=${{mysql.MYSQL_DATABASE}}
DB_USER=${{mysql.MYSQL_USER}}
DB_PASSWORD=${{mysql.MYSQL_PASSWORD}}
```

`PRODUCTION_DB_NAME` contiene el nombre reservado para producción y no coincide con `DB_NAME` de staging.

## Variables backend validadas

Valores no secretos relevantes:

```text
NODE_ENV=production
DEPLOY_ENV=staging
DEPLOY_REVISION=d5933555d99d8f7dece3d9fc915e2e8704a710d0
AUTH_TOKEN_TRANSPORT=cookie
REQUIRE_ADMIN_MFA=true
MFA_ISSUER=Inventario Judicial - Staging
TRUST_PROXY_HOPS=1
UPLOAD_DIR=/data/uploads
PRODUCTION_DB_NAME=inventario_judicial
CORS_ORIGIN=https://frontend-production-245b.up.railway.app
SMOKE_API_ORIGIN=https://frontend-production-245b.up.railway.app
SMOKE_FRONTEND_ORIGIN=https://frontend-production-245b.up.railway.app
SMOKE_TIMEOUT_MS=10000
```

Secretos exclusivos de staging cargados en Railway y ausentes de Git:

```text
JWT_SECRET
MFA_ENCRYPTION_KEY
DB_PASSWORD
MYSQL_ROOT_PASSWORD
```

## Aprovisionamiento realizado

Secuencia efectiva P7.2:

1. proyecto Railway privado creado;
2. servicios `frontend`, `backend`, `mysql` creados;
3. repo conectado a `ops/p7-staging-real`;
4. Root Directory de frontend configurado;
5. MySQL privado creado;
6. volúmenes `backend-data` y `mysql-data` creados con 500 MB cada uno;
7. variables y secretos exclusivos cargados;
8. dominio generado únicamente para frontend;
9. backend/frontend configurados con Dockerfile;
10. backend healthcheck `/health/ready`;
11. frontend healthcheck `/`;
12. `TRUST_PROXY_HOPS=1` verificado por preflight;
13. backend/frontend/MySQL desplegados con éxito;
14. backup real y migración protegida ejecutados;
15. health validado;
16. smoke externo validado;
17. persistencia del volumen validada;
18. rollback simulado en modo read-only;
19. runner temporal eliminado.

## Operación manual por Railway CLI/SSH

Para operadores humanos con Railway CLI autenticada, el procedimiento preferido de mantenimiento sigue siendo ejecutar los comandos dentro del backend ya desplegado mediante `railway ssh --service backend`.

Ejemplos:

```bash
railway ssh --service backend -- npm run deploy:preflight
```

```bash
railway ssh --service backend -- \
  npm run db:backup -- --output /data/backups/pre-deploy.sql
```

```bash
railway ssh --service backend -- \
  npm run db:backup:verify -- /data/backups/pre-deploy.sql
```

```bash
railway ssh --service backend -- \
  npm run deploy:migrate -- --backup /data/backups/pre-deploy.sql
```

```bash
railway ssh --service backend -- npm run db:status
```

El smoke debe ejecutarse desde un proceso externo al backend que se está validando. No usar `railway ssh` para arrancar `deploy:smoke` antes de que el propio backend esté atendiendo tráfico.

## Migración protegida ejecutada en P7.2

Debido a que la integración Railway disponible en este flujo no ofrecía `exec/ssh` arbitrario dentro del contenedor, la operación de mantenimiento se ejecutó mediante un `startCommand` **temporal y explícito**, aplicado solo durante un deployment controlado y restaurado inmediatamente después a `npm start`.

Cadena de mantenimiento ejecutada:

```text
preflight
→ backup /data/backups/pre-migrate-p7.sql
→ backup:verify
→ deploy:migrate --backup ...
→ db:status
→ npm start
```

Resultado:

```text
P7_MIGRATION_START
✓ Preflight aprobado
✓ Backup creado
✓ SHA-256 verificado
✓ Migración 001 aplicada
✓ Migración 002 aplicada
✓ Migración 003 aplicada
✓ Migración 004 aplicada
✓ Migración 005 aplicada
✓ Base de datos al día
P7_MIGRATION_DONE
✓ /health/ready = 200
```

El `startCommand` final del backend quedó nuevamente en:

```text
npm start
```

No queda migración automática configurada para deployments normales.

## Smoke post-deploy real

No ejecutar `deploy:smoke` como comando previo a `npm start` del mismo backend que se está probando. Ese intento produjo correctamente HTTP 502 porque el backend todavía no escuchaba tráfico.

La validación final se ejecutó desde un servicio temporal externo `smoke-runner` apuntando al origen público real.

Resultado:

```text
✓ /health/live confirma staging@d5933555...
✓ /health/ready confirma revisión esperada y acceso a MySQL
✓ Frontend accesible y con raíz de aplicación
✓ CORS/origin permite exactamente el frontend configurado con credenciales
✓ Smoke test post-deploy completado
P7_EXTERNAL_SMOKE_DONE
```

El runner temporal fue eliminado después de la prueba y no forma parte de la arquitectura permanente.

## Persistencia de adjuntos y backups

Ruta de adjuntos:

```text
/data/uploads
```

Ruta de backups:

```text
/data/backups
```

Evidencia física validada:

- `pre-migrate-p7.sql` creado durante el deployment de migración;
- metadata `pre-migrate-p7.sql.sha256.json` creada simultáneamente;
- ambos archivos permanecieron presentes en un deployment posterior;
- por lo tanto el volumen `/data` sobrevive redeploys.

El código de adjuntos resuelve la misma raíz persistente mediante `UPLOAD_DIR=/data/uploads`. `test:upload-storage` está integrado a `npm test` y Quality Gate para evitar regresar al path efímero del contenedor.

No se usaron datos judiciales reales en staging.

## Backup fuera del servicio

El volumen mejora persistencia pero no sustituye una copia externa institucional.

Cuando staging contenga información que deba conservarse, el `.sql` y su `.sha256.json` deben copiarse fuera del runtime/volumen mediante el mecanismo institucional aprobado y verificar nuevamente su SHA-256.

## Logs y observabilidad mínima

Durante P7.2 se utilizaron exitosamente:

- logs de build Railway;
- logs de deployment/runtime;
- estados de deployment;
- healthcheck Railway;
- identidad `environment`/`revision` en health;
- logs estructurados del backend con `request_id`, método, path, status y duración.

Esto permitió diagnosticar de forma trazable:

- rama fuente incorrecta inicial (`main` en lugar de P7.2);
- incompatibilidad de `mariadb-client` con `caching_sha2_password`;
- smoke ejecutado demasiado temprano antes del arranque del backend.

## Rollback de aplicación — simulación P7.2

La inspección read-only confirmó:

- deployment backend estable actual durante la validación: `e381c9ce-2c78-4ecf-93b0-519082b23b55`;
- revisión: `d5933555...`;
- no existía un deployment anterior estable reutilizable de bajo riesgo;
- uno anterior había sido removido por Railway y otro había fallado por el smoke autoejecutado antes del arranque;
- los volúmenes `/data` y `/var/lib/mysql` permanecen independientes del ciclo del contenedor;
- las migraciones 001–005 no se revierten automáticamente por volver código atrás.

Procedimiento seguro ante incidente de aplicación:

1. detener nuevas promociones;
2. identificar una revisión conocida como estable **y compatible con el esquema actual**;
3. no tocar los volúmenes;
4. desplegar la revisión elegida;
5. exigir `/health/live` y `/health/ready` verdes;
6. ejecutar smoke externo;
7. documentar el incidente.

No volver a un commit antiguo únicamente porque exista en el historial si no está probado contra el esquema vigente.

## Rollback de datos

Si hay riesgo de corrupción o incompatibilidad de esquema:

1. detener escrituras;
2. preservar logs/evidencia;
3. backup de emergencia si es viable;
4. verificar el backup pre-deploy;
5. restaurar primero a una DB alternativa;
6. validar schema/datos;
7. promover restauración únicamente después de aprobación explícita.

El proyecto no define un `migrate:down` genérico. No inventar reversión manual de migraciones para hacer coincidir un binario antiguo.

Seguir `docs/OPERATIONS.md`.

## Criterio de cierre P7.2

Completado técnicamente:

- proyecto/entorno Railway creado;
- tres servicios permanentes y topología correcta;
- SHA desplegado identificado;
- dominio público de staging;
- healthchecks verdes;
- preflight verde;
- backup + checksum;
- migraciones aplicadas/estado verde;
- smoke externo verde;
- persistencia de volumen probada;
- acceso a logs/observabilidad;
- rollback simulado;
- secretos ausentes de Git;
- Quality Gate #165 verde;
- runner temporal eliminado.

Pendiente únicamente para cerrar P7 completo:

1. Quality Gate final del commit documental de cierre;
2. integrar PR #22 a `main`;
3. verificar Quality Gate post-merge sobre `main`.
