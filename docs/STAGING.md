# Staging y despliegue controlado — Inventario Judicial

Este documento define el contrato técnico de P7 para desplegar un entorno de staging seguro y reproducible. No contiene credenciales, dominios reales ni decisiones específicas de proveedor.

## 1. Estado del bloque

P7 se divide operativamente en dos hitos dentro del mismo frente:

- **P7.1 — contrato y guardas de staging:** configuración production-like, preflight, backup/migración protegida, smoke tests y procedimiento reproducible.
- **P7.2 — staging real:** aprovisionar infraestructura separada, configurar secretos/dominios/proxy, desplegar y validar el procedimiento completo sobre ese entorno.

P7 **no se considera cerrado** solo por completar P7.1. El cierre exige evidencia de un staging real separado y validado.

## 2. Invariantes de seguridad

Staging debe comportarse como producción en los controles de seguridad:

```text
NODE_ENV=production
DEPLOY_ENV=staging
AUTH_TOKEN_TRANSPORT=cookie
REQUIRE_ADMIN_MFA=true
```

`DEPLOY_ENV` identifica el entorno operativo; no reemplaza `NODE_ENV`. Esta separación evita crear un modo `staging` que accidentalmente desactive cookies `Secure`, MFA u otras protecciones de production.

La variable `DEPLOY_REVISION` debe contener el commit SHA o versión exacta desplegada. Los endpoints de health la exponen junto con `environment` para permitir verificar qué revisión está ejecutándose sin publicar secretos.

## 3. HTTPS, frontend, API y cookie de sesión

Staging debe usar HTTPS real.

El frontend define su API mediante:

```text
VITE_API_URL=https://api-staging.ejemplo/api
```

El backend permite exactamente el origen del frontend mediante `CORS_ORIGIN` y credenciales CORS.

Como la sesión usa una cookie `HttpOnly`, `Secure`, host-only y `SameSite=Strict`, la topología elegida debe mantener frontend y API dentro del **mismo sitio registrable** (por ejemplo, subdominios del mismo dominio institucional) o servirlos desde el mismo origen. No usar dominios totalmente distintos para frontend y API sin rediseñar deliberadamente el contrato de sesión.

Los archivos `.env.staging.example` usan `example.invalid` a propósito; deben reemplazarse por los dominios reales cuando P7.2 aprovisione la infraestructura.

## 4. Separación de base de datos

Staging debe usar una base MySQL separada de producción, como mínimo a nivel lógico y preferentemente también con credenciales propias.

Reglas:

- `DB_NAME` de staging no puede ser la base de producción;
- `DB_USER`/`DB_PASSWORD` deben ser exclusivos del entorno;
- no copiar datos personales reales a staging;
- usar datos sintéticos o fixtures controlados;
- `PRODUCTION_DB_NAME` se declara como guarda no secreta para que el preflight rechace una configuración que apunte por error al mismo nombre de base.

El preflight no puede demostrar por sí solo que dos hosts externos son físicamente distintos; esa verificación forma parte de P7.2 y debe quedar documentada como evidencia del entorno.

## 5. Proxy y red

`TRUST_PROXY_HOPS` debe definirse explícitamente de acuerdo con la topología real:

- `0`: Express recibe directamente al cliente;
- `1`: existe exactamente un reverse proxy confiable delante de la aplicación;
- valores mayores: solo si la infraestructura real lo justifica.

No copiar un valor de ejemplo sin verificar la cadena de proxies, porque afecta la IP observada por rate limiting y seguridad.

## 6. Secretos de staging

Staging necesita secretos propios e independientes:

- `DB_PASSWORD`;
- `JWT_SECRET` de al menos 32 bytes;
- `MFA_ENCRYPTION_KEY` Base64 de exactamente 32 bytes;
- credenciales del proveedor/registro/almacenamiento si corresponde.

Nunca reutilizar secretos de producción ni comprometer archivos `.env` reales en Git.

## 7. Preflight obligatorio

Con las variables del entorno real cargadas:

```bash
npm run deploy:preflight
```

El preflight bloquea el despliegue si detecta, entre otros casos:

- `DEPLOY_ENV` distinto de `staging`/`production`;
- `NODE_ENV` distinto de `production`;
- revisión no identificada;
- autenticación distinta de cookie;
- MFA administrativo desactivado;
- secretos criptográficos inválidos;
- `CORS_ORIGIN` sin HTTPS o con ruta;
- `TRUST_PROXY_HOPS` no definido explícitamente;
- configuración MySQL incompleta;
- base de staging con el mismo nombre que producción.

Después del preflight revisar también:

```bash
npm run db:status
```

## 8. Backup y migración controlada

Antes de una migración o despliegue sobre una base existente:

```bash
npm run db:backup -- --output backups/pre-deploy.sql
npm run db:backup:verify -- backups/pre-deploy.sql
```

Cuando staging contenga información que deba conservarse, copiar el `.sql` y su `.sha256.json` fuera del host según `OPERATIONS.md`.

Las migraciones de despliegue se ejecutan con:

```bash
npm run deploy:migrate -- --backup backups/pre-deploy.sql
```

`deploy:migrate` vuelve a ejecutar el preflight, verifica checksum/tamaño del backup y además comprueba que la metadata del dump corresponda exactamente a `DB_NAME`. Si el backup pertenece a otra base, la migración se rechaza.

No usar `sequelize.sync()` ni modificar tablas manualmente como sustituto del sistema de migraciones.

## 9. Despliegue reproducible

Secuencia mínima:

1. identificar el commit exacto de `main` y confirmar Quality Gate verde;
2. cargar secretos y variables exclusivos de staging;
3. establecer `DEPLOY_REVISION` con ese commit/versión;
4. ejecutar `npm ci` en backend y frontend;
5. ejecutar `npm run deploy:preflight`;
6. ejecutar `npm run db:status`;
7. crear/verificar backup pre-deploy cuando la DB ya exista;
8. ejecutar `npm run deploy:migrate -- --backup ...`;
9. iniciar/reemplazar el backend usando `npm start` bajo el supervisor del proveedor;
10. construir el frontend con su `VITE_API_URL` de staging y publicar el artefacto generado;
11. comprobar `/health/live` y `/health/ready`;
12. ejecutar el smoke post-deploy;
13. registrar commit desplegado, resultado del smoke y cualquier incidencia.

El mecanismo concreto de proceso, TLS, DNS y artefactos depende de la plataforma elegida en P7.2. La aplicación no presupone Docker, PM2, systemd, Nginx ni un proveedor específico.

## 10. Smoke test post-deploy

Configurar:

```text
DEPLOY_ENV=staging
SMOKE_API_ORIGIN=https://api-staging.ejemplo
SMOKE_FRONTEND_ORIGIN=https://staging.ejemplo
SMOKE_TIMEOUT_MS=5000
```

Ejecutar:

```bash
npm run deploy:smoke
```

El smoke comprueba:

- `GET /health/live` → HTTP 200 y servicio esperado;
- `GET /health/ready` → HTTP 200, incluida conectividad MySQL;
- frontend → HTTP 200 y raíz React presente;
- `GET /api/auth/me` sin sesión → HTTP 401;
- CORS devuelve exactamente el origen del frontend y permite credenciales.

Este smoke no crea usuarios ni altera datos.

## 11. Rollback

Si falla código pero la migración no cambió datos/esquema de forma incompatible:

1. retirar de tráfico la revisión defectuosa;
2. volver al último artefacto/commit conocido como estable;
3. mantener la misma base si el esquema sigue siendo compatible;
4. ejecutar health y smoke antes de reabrir tráfico.

Si una migración produjo incompatibilidad o daño:

1. detener escrituras;
2. conservar evidencia y, si es posible, un backup de emergencia;
3. verificar el backup pre-deploy;
4. restaurar primero en una base alternativa;
5. validar migraciones y datos críticos;
6. promover/restaurar solo después de la verificación.

No ejecutar `down` manual ni editar el esquema a mano únicamente para hacer coincidir un binario viejo. Seguir `OPERATIONS.md`.

## 12. Evidencia requerida para cerrar P7

P7 puede marcarse ✅ únicamente cuando exista evidencia de:

- entorno de staging real separado;
- MySQL de staging separado y sin datos reales de producción;
- HTTPS y dominios/orígenes reales configurados;
- `TRUST_PROXY_HOPS` verificado contra la infraestructura;
- secretos exclusivos de staging;
- preflight verde;
- backup/checksum y migración controlada probados;
- deploy reproducible desde un commit identificado;
- `/health/live` y `/health/ready` verdes;
- smoke post-deploy verde;
- rollback probado o simulado de forma controlada;
- observabilidad/logs accesibles para diagnóstico;
- `ROADMAP.md` y `OPERATIONS.md` actualizados con la evidencia final;
- Quality Gate verde y estado Git alineado.

Hasta entonces P7 permanece **en curso**, aunque P7.1 haya sido integrado.
