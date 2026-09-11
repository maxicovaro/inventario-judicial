# P7.2 — Railway staging

Runbook específico del entorno de staging del Sistema de Inventario Judicial en Railway.

Este documento complementa `docs/STAGING.md`. No reemplaza las guardas de P7.1 (`deploy:preflight`, backup verificado, `deploy:migrate`, `deploy:smoke`).

## Arquitectura

Servicios dentro de un mismo proyecto/ambiente Railway:

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
```

Solo `frontend` debe tener dominio público.

## Nombres de servicios

Usar exactamente:

```text
frontend
backend
mysql
```

Esto mantiene simples las Reference Variables y la documentación.

## Fuente Git

Repositorio:

```text
maxicovaro/inventario-judicial
```

Mientras P7.2 esté en validación se despliega la rama de trabajo autorizada. Al cierre, staging debe quedar promovido desde `main` con un SHA identificado.

## Servicio `backend`

Root Directory:

```text
/
```

Dockerfile:

```text
/Dockerfile
```

La imagen:

- usa Node 22 Alpine;
- instala cliente MySQL/MariaDB para backup/restore;
- instala dependencias con `npm ci --omit=dev`;
- arranca con `npm start`;
- NO ejecuta migraciones automáticamente.

### Networking

No generar dominio público.

Healthcheck Railway:

```text
/health/ready
```

El proceso escucha `process.env.PORT`, inyectado por Railway.

### Volume

Adjuntar un Railway Volume con mount path:

```text
/data
```

Variables:

```text
UPLOAD_DIR=/data/uploads
```

Backups operativos:

```text
/data/backups
```

El volumen debe sobrevivir redeploys antes de considerar staging válido.

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

Variable Railway:

```text
BACKEND_INTERNAL_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}
```

### Networking

Generar un dominio público Railway.

Healthcheck Railway:

```text
/frontend-health
```

Caddy también expone desde el mismo origen:

```text
/api/*       -> backend privado
/health/*    -> backend privado
```

De esta forma `SMOKE_API_ORIGIN` y `SMOKE_FRONTEND_ORIGIN` son el mismo origen HTTPS público.

## Servicio `mysql`

Crear MySQL desde Railway.

No habilitar Public Access para operación normal.

Configurar en `backend` mediante Reference Variables:

```text
DB_HOST=${{mysql.MYSQLHOST}}
DB_PORT=${{mysql.MYSQLPORT}}
DB_NAME=${{mysql.MYSQLDATABASE}}
DB_USER=${{mysql.MYSQLUSER}}
DB_PASSWORD=${{mysql.MYSQLPASSWORD}}
```

`PRODUCTION_DB_NAME` debe contener el nombre reservado para producción y nunca coincidir con `DB_NAME` de staging.

## Variables backend

Valores no secretos:

```text
NODE_ENV=production
DEPLOY_ENV=staging
DEPLOY_REVISION=<SHA exacto desplegado>
AUTH_TOKEN_TRANSPORT=cookie
REQUIRE_ADMIN_MFA=true
MFA_ISSUER=Inventario Judicial - Staging
TRUST_PROXY_HOPS=1
UPLOAD_DIR=/data/uploads
HEALTH_DB_TIMEOUT_MS=2000
SHUTDOWN_TIMEOUT_MS=10000
PRODUCTION_DB_NAME=inventario_judicial
CORS_ORIGIN=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
SMOKE_API_ORIGIN=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
SMOKE_FRONTEND_ORIGIN=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
SMOKE_TIMEOUT_MS=5000
```

Railway inyecta `PORT`; no fijarlo manualmente.

Secretos exclusivos de staging:

```text
JWT_SECRET=<mínimo 32 bytes>
MFA_ENCRYPTION_KEY=<Base64 de exactamente 32 bytes>
```

Después de validarlos, sellarlos en Railway cuando corresponda.

## Primer aprovisionamiento

Orden obligatorio:

1. crear proyecto/ambiente `staging`;
2. crear servicios `frontend`, `backend`, `mysql`;
3. conectar repo/branch;
4. configurar Root Directory de frontend;
5. agregar Reference Variables de MySQL;
6. cargar variables/secretos backend;
7. crear Volume `/data` en backend;
8. generar dominio únicamente para frontend;
9. configurar healthchecks;
10. desplegar backend/frontend;
11. ejecutar preflight;
12. crear y verificar backup de la DB staging;
13. ejecutar migración protegida;
14. comprobar health;
15. ejecutar smoke;
16. probar persistencia de adjuntos;
17. registrar SHA y evidencia.

## Migración protegida en Railway

No usar `pre-deploy` para `deploy:migrate`: los pre-deploy containers no tienen el Volume montado.

Ejecutar dentro del backend desplegado.

### 1. Preflight

```bash
railway ssh --service backend --environment staging -- npm run deploy:preflight
```

### 2. Backup pre-migración

```bash
railway ssh --service backend --environment staging -- \
  npm run db:backup -- --output /data/backups/pre-deploy.sql
```

### 3. Verificación

```bash
railway ssh --service backend --environment staging -- \
  npm run db:backup:verify -- /data/backups/pre-deploy.sql
```

### 4. Migración

```bash
railway ssh --service backend --environment staging -- \
  npm run deploy:migrate -- --backup /data/backups/pre-deploy.sql
```

### 5. Estado

```bash
railway ssh --service backend --environment staging -- npm run db:status
```

No usar `db:migrate` directamente para un despliegue controlado de staging.

## Smoke post-deploy

```bash
railway ssh --service backend --environment staging -- npm run deploy:smoke
```

Debe validar:

- `/health/live`;
- `/health/ready`;
- identidad `staging@DEPLOY_REVISION`;
- frontend HTML;
- `/api/auth/me` sin sesión = 401;
- CORS exacto con credenciales.

## Persistencia de adjuntos

Prueba obligatoria:

1. subir un archivo ficticio desde la UI;
2. descargarlo;
3. confirmar que existe bajo `/data/uploads`;
4. redeploy del backend;
5. volver a descargar el mismo adjunto;
6. verificar autorización por oficina/rol;
7. eliminarlo;
8. confirmar comportamiento físico/lógico esperado.

Nunca usar datos judiciales reales en staging.

## Backup fuera del servicio

El Volume mejora persistencia pero no sustituye una copia externa.

Después de un backup válido se debe descargar una copia fuera del runtime/Volume usando Railway Volume Files, SFTP/SCP o el mecanismo institucional aprobado.

Verificar nuevamente SHA-256 de la copia antes de considerarla recuperable.

## Rollback de aplicación

Si un deployment de código falla:

1. detener nuevas promociones;
2. seleccionar el último deployment estable de Railway;
3. redeploy/rollback de esa versión;
4. no deshacer manualmente migraciones;
5. verificar `/health/live` y `/health/ready`;
6. ejecutar smoke mínimo;
7. documentar el incidente.

## Rollback de datos

Si hay riesgo de corrupción:

1. detener escrituras;
2. preservar logs/evidencia;
3. backup de emergencia si es viable;
4. restaurar primero a una DB alternativa;
5. validar schema/datos;
6. promover restauración únicamente después de aprobación explícita.

Seguir `docs/OPERATIONS.md`.

## Evidencia requerida para cerrar P7.2

Registrar en Git/PR:

- proyecto/ambiente Railway creado;
- servicios y topología;
- SHA desplegado;
- dominio público de staging;
- healthchecks verdes;
- resultado de `deploy:preflight`;
- backup + checksum;
- migraciones aplicadas/estado;
- smoke verde;
- prueba de adjunto persistente tras redeploy;
- acceso a logs estructurados;
- rollback probado o simulado;
- secretos ausentes de Git.

P7.2 no se considera terminado únicamente porque los containers estén `Active`.
