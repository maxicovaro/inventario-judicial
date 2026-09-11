# Cierre formal de P7 — Staging y despliegue controlado

Fecha de cierre: **11/09/2026**

Este documento registra la evidencia consolidada que permite considerar **P7 — Staging y despliegue controlado** como cerrado y habilita la apertura de **P8 — rendimiento y escalabilidad**.

## 1. Resultado

P7 queda **CERRADO ✅**.

Condiciones cumplidas:
- staging real separado;
- MySQL de staging separado;
- HTTPS real;
- secretos exclusivos del entorno;
- proxy y cookie production-like;
- backup verificado;
- migraciones protegidas;
- healthchecks;
- smoke post-deploy;
- persistencia de volumen;
- rollback simulado;
- observabilidad mínima;
- Quality Gate pre-merge y post-merge verdes.

## 2. Evidencia Git

### P7.1
- PR #20 integrado;
- HEAD validado: `5860d4e85a0a64514bdfa8ede052dcdfff9f56ba`;
- Gate #158: verde;
- squash en `main`: `eaad8daeb101f988e00310c408554e66affde1d4`;
- Gate post-merge #159: verde.

### P7.2
- PR #22: **mergeado**;
- HEAD final pre-merge: `3836cd828359fc0500453e2bfb4bdeb729a9c95d`;
- Gate pre-merge #167: **verde completo**;
- merge commit: `6872095e3f4e6d11bf097c6254e83104a2a5e394`;
- Gate post-merge #168: **verde completo**, incluido Chromium E2E.

## 3. Infraestructura Railway validada

Proyecto privado:

```text
inventario-judicial-staging
```

Servicios permanentes:

```text
frontend
backend
mysql
```

Topología:

```text
Internet
   |
 HTTPS
   v
frontend PUBLICO
React/Vite + Caddy
   |
   | /api/* y /health/*
   v
backend PRIVADO
Node 22 / Express
   |
   v
mysql PRIVADO
```

Persistencia:

```text
backend-data -> /data             500 MB
mysql-data   -> /var/lib/mysql    500 MB
```

Rutas relevantes:

```text
UPLOAD_DIR=/data/uploads
backups=/data/backups
```

Único origen público validado durante P7.2:

```text
https://frontend-production-245b.up.railway.app
```

## 4. Contrato de seguridad preservado

Staging ejecuta controles production-like:

```text
NODE_ENV=production
DEPLOY_ENV=staging
AUTH_TOKEN_TRANSPORT=cookie
REQUIRE_ADMIN_MFA=true
TRUST_PROXY_HOPS=1
```

Se preservan:
- cookie HttpOnly;
- `SameSite=Strict`;
- MFA administrativo;
- validación de Origin;
- CORS con credenciales;
- backend y MySQL privados;
- secretos fuera de Git.

## 5. Base de datos y migraciones

La base staging se inicializó sin datos judiciales reales.

Procedimiento validado:
1. preflight;
2. backup en `/data/backups/pre-migrate-p7.sql`;
3. checksum SHA-256;
4. validación de metadata/base objetivo;
5. `deploy:migrate`;
6. `db:status`;
7. healthcheck.

Migraciones aplicadas:

```text
001 ✅
002 ✅
003 ✅
004 ✅
005 ✅
```

El backend quedó finalmente con arranque normal:

```text
npm start
```

No se dejaron migraciones automáticas en cada deploy.

## 6. Incidencia MySQL resuelta

El primer backup real detectó incompatibilidad entre `mariadb-client` y MySQL 8 con `caching_sha2_password`.

La corrección fue:
- mantener `caching_sha2_password`;
- reemplazar el cliente del runtime por `mysql-community-client` 8.0;
- proteger esta decisión con `test:staging-contracts`.

No se degradó MySQL a `mysql_native_password`.

## 7. Smoke post-deploy

El smoke definitivo se ejecutó desde un runner Railway temporal externo al backend.

Validó:
- `/health/live`;
- `/health/ready`;
- revisión/ambiente exactos;
- frontend HTTP 200;
- `/api/auth/me` sin sesión según contrato;
- CORS exacto con credenciales.

Resultado: **VERDE**.

El servicio temporal `smoke-runner` fue eliminado después de la prueba.

## 8. Persistencia

Se comprobó que:
- el backup creado durante la migración permaneció en `/data/backups` después de redeploys;
- su metadata SHA-256 también permaneció;
- por lo tanto el volumen `/data` sobrevive al ciclo del contenedor;
- adjuntos usan la misma raíz persistente mediante `UPLOAD_DIR=/data/uploads`;
- `test:upload-storage` forma parte de `npm test` y del Quality Gate.

## 9. Rollback

Se realizó simulación controlada read-only.

Reglas confirmadas:
- volúmenes no se revierten con el código;
- migraciones 001–005 no se deshacen automáticamente;
- no existe `migrate:down` genérico;
- no se fuerza rollback hacia un binario antiguo sin verificar compatibilidad de esquema;
- ante incompatibilidad de datos/esquema se utiliza restore seguro desde backup o corrección hacia adelante;
- después de cualquier rollback son obligatorios health + smoke.

Detalle operativo: `docs/OPERATIONS.md`.

## 10. Observabilidad mínima

Durante P7 se utilizaron correctamente:
- logs de build Railway;
- logs de deployment/runtime;
- healthchecks;
- identidad `environment`/`revision`;
- logs estructurados del backend;
- estados de deployment.

Estas señales permitieron diagnosticar problemas reales sin alterar datos productivos.

## 11. Quality Gate definitivo

### Gate pre-merge

```text
#167 — SUCCESS
HEAD: 3836cd828359fc0500453e2bfb4bdeb729a9c95d
```

Incluyó:
- frontend lint/build;
- backend tests;
- MySQL;
- migraciones;
- auth hardening;
- MFA;
- P6 concurrencia/idempotencia;
- health;
- backup/restore;
- Chromium E2E.

### Gate post-merge

```text
#168 — SUCCESS
main: 6872095e3f4e6d11bf097c6254e83104a2a5e394
```

El mismo conjunto crítico quedó verde después de integrar PR #22.

## 12. Criterio de salida

P7 cumple los criterios establecidos en `docs/STAGING.md` y `docs/RAILWAY_STAGING.md`.

Por lo tanto:

> **P7 queda cerrado y P8 — rendimiento y escalabilidad — pasa a ser el bloque activo.**

No iniciar P9 hasta cerrar P8 con su propia evidencia, Quality Gate y actualización documental.
