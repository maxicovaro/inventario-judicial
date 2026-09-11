# P7 — Staging y despliegue controlado

Este documento define la implementación concreta de staging para el Sistema de Inventario Judicial.

## Estado

- P6.1: cerrado e integrado a `main`.
- Quality Gate post-merge #151: verde.
- P7: bloque activo.
- Proveedor elegido para staging: **Railway**.
- Rama de implementación: `feature/p7-staging`.

## 1. Objetivo

Construir un entorno de preproducción aislado que reproduzca los contratos relevantes de producción sin usar datos personales reales.

Debe validar:

- despliegue reproducible desde Git;
- frontend React/Vite sobre HTTPS;
- backend Node 22 / Express;
- sesión por cookie HttpOnly y MFA ADMIN;
- MySQL separado;
- uploads persistentes;
- migraciones versionadas;
- health checks;
- backup y restore;
- rollback;
- smoke tests funcionales y de seguridad.

## 2. Arquitectura elegida

Se utilizará un único proyecto Railway con un ambiente `staging` y tres servicios:

```text
Internet
   |
   | HTTPS
   v
[frontend]  PUBLICO
 React/Vite + Caddy
   | \
   |  \-- /health/* --------------------+
   |                                    |
   +-- /api/*                            |
          |                              |
          | Railway private network      |
          v                              |
      [backend] PRIVADO <----------------+
      Node 22 / Express
          |
          | Railway private network
          v
       [mysql] PRIVADO

      [backend volume]
       /data/uploads
```

### Decisión de seguridad

Solo `frontend` tendrá dominio público.

`backend` no tendrá dominio público. Caddy enviará `/api/*` y `/health/*` al backend por la red privada de Railway.

Beneficios:

- navegador y API comparten un único origen público;
- `SameSite=Strict` mantiene un contrato simple;
- la cookie `__Host-...` sigue siendo host-only;
- no se expone backend directamente;
- MySQL permanece privado;
- CORS puede restringirse al único origen del frontend.

## 3. Servicios Railway

### 3.1 `frontend`

Fuente: repositorio GitHub del proyecto.

Root Directory:

```text
inventario-frontend
```

Railway detectará `inventario-frontend/Dockerfile`.

Runtime:

- build: Node 22 Alpine;
- servidor: Caddy;
- `VITE_API_URL=/api` durante build;
- SPA fallback a `index.html`.

Networking:

- generar dominio público Railway;
- no exponer otros servicios públicamente.

Healthcheck Path:

```text
/frontend-health
```

Variable:

```text
BACKEND_INTERNAL_URL=http://${{backend.RAILWAY_PRIVATE_DOMAIN}}:${{backend.PORT}}
```

No guardar host/puerto privado en código.

### 3.2 `backend`

Fuente: mismo repositorio GitHub.

Root Directory: raíz del repositorio.

Railway detectará `/Dockerfile`.

Runtime:

- Node 22 Alpine;
- `npm ci --omit=dev`;
- antes del arranque: `npm run db:migrate`;
- proceso: `npm start`;
- Express escucha `process.env.PORT`.

El servicio **no debe tener dominio público**.

Health internos de aplicación:

```text
/health/live
/health/ready
```

Caddy los expone same-origin desde el frontend para smoke tests.

Healthcheck Railway recomendado para backend:

```text
/health/ready
```

### 3.3 `mysql`

Agregar servicio Railway MySQL.

Debe permanecer privado; no habilitar Public Access salvo una necesidad operativa puntual y explícita.

El backend utilizará Reference Variables:

```text
DB_HOST=${{mysql.MYSQLHOST}}
DB_PORT=${{mysql.MYSQLPORT}}
DB_NAME=${{mysql.MYSQLDATABASE}}
DB_USER=${{mysql.MYSQLUSER}}
DB_PASSWORD=${{mysql.MYSQLPASSWORD}}
```

No hardcodear credenciales ni copiar URLs públicas.

## 4. Variables backend

Configurar en el servicio `backend`:

```text
NODE_ENV=production
AUTH_TOKEN_TRANSPORT=cookie
REQUIRE_ADMIN_MFA=true
MFA_ISSUER=Inventario Judicial - Staging
TRUST_PROXY_HOPS=1
UPLOAD_DIR=/data/uploads
HEALTH_DB_TIMEOUT_MS=2000
SHUTDOWN_TIMEOUT_MS=10000

DB_HOST=${{mysql.MYSQLHOST}}
DB_PORT=${{mysql.MYSQLPORT}}
DB_NAME=${{mysql.MYSQLDATABASE}}
DB_USER=${{mysql.MYSQLUSER}}
DB_PASSWORD=${{mysql.MYSQLPASSWORD}}

CORS_ORIGIN=https://${{frontend.RAILWAY_PUBLIC_DOMAIN}}
```

Railway proporciona `PORT`; no fijarlo manualmente salvo necesidad concreta.

### Secretos

Crear valores exclusivos de staging:

```text
JWT_SECRET=<secreto aleatorio >= 32 bytes>
MFA_ENCRYPTION_KEY=<32 bytes Base64>
```

Ejemplos de generación local:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

Después de verificarlos, sellarlos en Railway si la cuenta/plan lo permite.

Nunca usar secretos de CI ni los de producción futura.

## 5. Proxy y cookies

Flujo normal:

```text
Browser -> https://frontend.../api/... -> Caddy -> http://backend.railway.internal:$PORT/api/...
```

Caddy conserva `/api/*` y `/health/*`.

El backend recibe el `Origin` público del frontend y valida contra `CORS_ORIGIN`.

`TRUST_PROXY_HOPS=1` se usa porque Express recibe las solicitudes a través de Caddy como proxy de aplicación. Si la topología cambia, este número debe revisarse; no incrementar a ciegas.

Smoke test de seguridad:

- cookie `HttpOnly`;
- cookie `Secure`;
- `SameSite=Strict`;
- JWT ausente de `localStorage`;
- `/api/auth/me` restaura sesión;
- mutaciones con `Origin` inválido son rechazadas;
- ADMIN exige MFA.

## 6. Uploads persistentes

El backend conserva el comportamiento local cuando `UPLOAD_DIR` no está configurado:

```text
storage/uploads
```

En staging:

```text
UPLOAD_DIR=/data/uploads
```

Crear un Railway Volume adjunto al servicio `backend` con mount path:

```text
/data/uploads
```

Validar después del primer deploy:

1. subir archivo de prueba;
2. descargarlo;
3. redeploy del backend;
4. volver a descargarlo;
5. verificar permisos por rol/oficina;
6. eliminarlo y confirmar eliminación física/lógica esperada.

No incluir `storage/uploads` dentro de la imagen Docker.

## 7. Migraciones

El Dockerfile backend ejecuta:

```bash
npm run db:migrate && npm start
```

Condiciones:

- migraciones 001–005 versionadas;
- no usar `sequelize.sync()`;
- una sola réplica de backend durante P7 inicial;
- no ejecutar fixtures destructivos contra staging.

Antes de cualquier migración futura con datos útiles:

1. verificar commit a desplegar;
2. generar backup;
3. verificar checksum;
4. ejecutar migración;
5. comprobar `db:status` y `/health/ready`.

## 8. Datos de staging

Usar únicamente datos ficticios/controlados.

Set mínimo:

- ADMIN central;
- RESPONSABLE de dos oficinas;
- USUARIO;
- activos en estados distintos;
- insumos y stock;
- solicitudes;
- pedidos mensuales;
- notificaciones;
- adjuntos sin información real.

Los fixtures de CI no deben ejecutarse contra staging salvo script explícito diseñado para una base descartable.

## 9. Secuencia de primer despliegue

### P7.0 — Diseño/proveedor

- [x] Railway elegido.
- [x] arquitectura same-origin definida.
- [x] servicios `frontend`, `backend`, `mysql` definidos.
- [x] persistencia de uploads definida.

### P7.1 — Contrato de ambiente

- [x] Dockerfiles definidos.
- [x] `UPLOAD_DIR` configurable.
- [x] proxy `/api` y `/health` definido.
- [x] contrato estático incorporado a `npm test`.
- [ ] proyecto/ambiente Railway creado.
- [ ] variables y secretos configurados.
- [ ] volume `/data/uploads` creado.

### P7.2 — Infraestructura

- [ ] MySQL staging desplegado.
- [ ] backend desplegado sin dominio público.
- [ ] frontend desplegado con dominio HTTPS.
- [ ] healthchecks configurados.

### P7.3 — Deploy reproducible

- [ ] despliegue desde commit identificado de `main`/PR validado;
- [ ] migraciones ejecutadas;
- [ ] SHA desplegado registrado;
- [ ] rollback operativo definido/probado.

### P7.4 — Smoke funcional/seguridad

- [ ] login inválido;
- [ ] setup MFA ADMIN;
- [ ] segundo login con TOTP;
- [ ] sesión persistente tras reload;
- [ ] logout revoca sesión;
- [ ] RESPONSABLE limitado a su oficina;
- [ ] USUARIO sin controles administrativos;
- [ ] activos;
- [ ] solicitudes;
- [ ] pedido mensual y provisión;
- [ ] stock;
- [ ] adjuntos persistentes;
- [ ] `/health/live` 200;
- [ ] `/health/ready` 200;
- [ ] logs sin secretos.

### P7.5 — Recuperación

- [ ] backup real staging;
- [ ] verificación checksum;
- [ ] restore a base alternativa;
- [ ] validación post-restore;
- [ ] RPO/RTO inicial documentado.

### P7.6 — Cierre

- [ ] incidencias resueltas;
- [ ] documentación actualizada;
- [ ] Quality Gate final verde;
- [ ] decisión GO/NO-GO hacia P8.

## 10. Backup y restore

Usar scripts existentes:

```bash
npm run db:backup
npm run db:backup:verify -- <archivo.sql>
npm run db:restore -- <archivo.sql> --target <db_alternativa> --confirm <db_alternativa> --recreate
```

Nunca probar restauración inicialmente sobre la base activa de staging.

## 11. Rollback

### Aplicación

Si un deploy falla:

1. no promover el deployment;
2. volver al deployment/commit estable anterior;
3. comprobar `/health/live` y `/health/ready`;
4. ejecutar smoke mínimo antes de reabrir.

### Base de datos

Si hay riesgo de corrupción:

1. detener escrituras;
2. preservar evidencia/logs;
3. backup de emergencia si es viable;
4. restaurar en base alternativa;
5. validar;
6. promover restauración solo después de comprobación explícita.

Seguir además `docs/OPERATIONS.md`.

## 12. Observabilidad

Durante P7 registrar al menos:

- SHA desplegado;
- logs estructurados del backend;
- `X-Request-Id`;
- errores HTTP 5xx;
- `/health/ready = 503`;
- reinicios del servicio;
- tiempos aproximados de endpoints críticos;
- consumo de CPU/memoria/volumen/base como línea base para P8.

## 13. Criterio de cierre P7

P7 se considera cerrado únicamente cuando:

- staging está físicamente/lógicamente separado;
- HTTPS funciona;
- frontend es el único servicio público;
- backend y MySQL operan por red privada;
- cookie/MFA funcionan;
- uploads sobreviven redeploy;
- migraciones están al día;
- healthchecks pasan;
- smoke tests pasan;
- backup + restore drill pasan;
- rollback está probado/documentado;
- no hay secretos ni datos reales en Git;
- `ROADMAP.md` y documentación reflejan el estado final;
- Quality Gate final está verde.

Hasta entonces P8 permanece pendiente.
