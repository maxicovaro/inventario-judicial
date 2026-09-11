# Staging y despliegue controlado — Inventario Judicial

Este documento define el contrato técnico de P7 para desplegar un entorno de staging seguro y reproducible, y registra la evidencia de la validación real de P7.2. Los detalles específicos del proveedor Railway quedan en `docs/RAILWAY_STAGING.md`.

## 1. Estado del bloque

P7 se divide operativamente en dos hitos dentro del mismo frente:

- **P7.1 — contrato y guardas de staging: ✅ integrado y cerrado.** Configuración production-like, preflight, backup/migración protegida, smoke tests y procedimiento reproducible.
- **P7.2 — staging real: ✅ validado técnicamente; integración pendiente.** La infraestructura real ya fue aprovisionada y validada. Falta integrar PR #22 a `main` y verificar el Quality Gate post-merge para cerrar P7 completo.

Evidencia de cierre P7.1:

- PR #20 integrado mediante squash;
- HEAD validado previo al merge: `5860d4e85a0a64514bdfa8ede052dcdfff9f56ba`;
- Quality Gate pre-merge #158: **verde**, incluido Chromium E2E;
- squash en `main`: `eaad8daeb101f988e00310c408554e66affde1d4`;
- Quality Gate post-merge #159: **verde**, incluido Chromium E2E.

Evidencia P7.2 validada el 11/09/2026:

- rama `ops/p7-staging-real`, PR #22;
- revisión validada: `d5933555d99d8f7dece3d9fc915e2e8704a710d0`;
- Quality Gate #165: **verde completo**;
- staging real en Railway con frontend público, backend privado y MySQL 8 privado;
- secretos exclusivos de staging cargados fuera de Git;
- preflight real aprobado;
- backup real creado y verificado;
- migraciones 001–005 aplicadas mediante `deploy:migrate`;
- health y smoke post-deploy verdes;
- persistencia física del volumen comprobada entre redeploys;
- rollback inspeccionado/simulado sin modificar el entorno sano;
- runner temporal usado para smoke externo eliminado al finalizar.

P7 **no se considera formalmente cerrado** hasta integrar P7.2 a `main` y confirmar el Quality Gate post-merge.

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

En P7.2 se validó `staging@d5933555d99d8f7dece3d9fc915e2e8704a710d0` mediante `/health/live` y `/health/ready`.

## 3. HTTPS, frontend, API y cookie de sesión

Staging debe usar HTTPS real.

La topología validada en P7.2 usa **same-origin**:

```text
VITE_API_URL=/api
```

El frontend sirve HTTPS y Caddy proxyea `/api/*` y `/health/*` al backend privado. El backend permite exactamente el origen público del frontend mediante `CORS_ORIGIN` y credenciales CORS.

Esta topología preserva la sesión mediante cookie `HttpOnly`, `Secure`, host-only y `SameSite=Strict` sin exponer el backend públicamente.

Origen público validado:

```text
https://frontend-production-245b.up.railway.app
```

Los archivos `.env.staging.example` usan valores de ejemplo a propósito; los secretos reales nunca se comprometen en Git.

## 4. Separación de base de datos

Staging usa una base MySQL separada de producción, con credenciales propias.

Reglas:

- `DB_NAME` de staging no puede ser la base de producción;
- `DB_USER`/`DB_PASSWORD` deben ser exclusivos del entorno;
- no copiar datos personales reales a staging;
- usar datos sintéticos o fixtures controlados;
- `PRODUCTION_DB_NAME` se declara como guarda no secreta para que el preflight rechace una configuración que apunte por error al mismo nombre de base.

P7.2 validó una instancia MySQL 8 privada en Railway, sin dominio ni TCP público y sin datos judiciales reales.

## 5. Proxy y red

`TRUST_PROXY_HOPS` debe definirse explícitamente de acuerdo con la topología real.

P7.2 validó:

```text
TRUST_PROXY_HOPS=1
```

El valor fue aceptado por `deploy:preflight` en la topología real frontend/Caddy → backend privado.

No copiar un valor de ejemplo sin verificar la cadena de proxies, porque afecta la IP observada por rate limiting y seguridad.

## 6. Secretos de staging

Staging necesita secretos propios e independientes:

- `DB_PASSWORD`;
- `JWT_SECRET` de al menos 32 bytes;
- `MFA_ENCRYPTION_KEY` Base64 de exactamente 32 bytes;
- credenciales del proveedor/registro/almacenamiento si corresponde.

P7.2 cargó secretos exclusivos en Railway fuera de Git. Nunca reutilizar secretos de producción ni comprometer archivos `.env` reales.

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

P7.2 ejecutó el preflight real con resultado **aprobado** para `inventario_judicial_staging` y la revisión `d5933555...`.

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

En P7.2:

- el primer intento de backup detectó una incompatibilidad real del cliente `mariadb-client` con MySQL 8 `caching_sha2_password` y se detuvo antes de migrar;
- se sustituyó el cliente de runtime por `mysql-community-client` 8.0.46 desde el repositorio oficial MySQL;
- no se degradó la autenticación MySQL a `mysql_native_password`;
- Quality Gate #165 validó la corrección;
- se creó `/data/backups/pre-migrate-p7.sql` con metadata SHA-256;
- `db:backup:verify` fue verde;
- `deploy:migrate` aplicó migraciones 001, 002, 003, 004 y 005;
- `db:status` confirmó todas `[x]` y base al día.

No usar `sequelize.sync()` ni modificar tablas manualmente como sustituto del sistema de migraciones.

## 9. Despliegue reproducible

Secuencia mínima:

1. identificar el commit exacto y confirmar Quality Gate verde;
2. cargar secretos y variables exclusivos de staging;
3. establecer `DEPLOY_REVISION` con ese commit/versión;
4. construir backend/frontend de forma reproducible;
5. ejecutar `npm run deploy:preflight`;
6. ejecutar `npm run db:status`;
7. crear/verificar backup pre-deploy cuando la DB ya exista;
8. ejecutar `npm run deploy:migrate -- --backup ...`;
9. iniciar/reemplazar el backend usando `npm start` bajo el supervisor del proveedor;
10. publicar el frontend con API same-origin o la topología aprobada;
11. comprobar `/health/live` y `/health/ready`;
12. ejecutar el smoke post-deploy desde un proceso externo al backend que se está validando;
13. registrar commit desplegado, resultado del smoke y cualquier incidencia.

P7.2 demostró que el smoke **no debe ejecutarse como comando de arranque del mismo backend antes de que escuche tráfico**: ese intento produjo 502 por diseño. El smoke final se ejecutó desde un runner Railway externo/temporal y fue verde.

## 10. Smoke test post-deploy

Configurar:

```text
DEPLOY_ENV=staging
DEPLOY_REVISION=<commit-o-version-exacta>
SMOKE_API_ORIGIN=<origen-https-publico>
SMOKE_FRONTEND_ORIGIN=<origen-https-publico>
SMOKE_TIMEOUT_MS=5000
```

Ejecutar desde un runner/host externo al backend validado:

```bash
npm run deploy:smoke
```

El smoke comprueba:

- `GET /health/live` → HTTP 200, servicio esperado y `environment`/`revision` exactos;
- `GET /health/ready` → HTTP 200, identidad exacta y conectividad MySQL;
- frontend → HTTP 200 y raíz React presente;
- `GET /api/auth/me` sin sesión → HTTP 401;
- CORS devuelve exactamente el origen del frontend y permite credenciales.

Smoke P7.2: **verde** para `staging@d5933555...`; el runner temporal fue eliminado después de la prueba.

Este smoke no crea usuarios ni altera datos.

## 11. Persistencia y almacenamiento

P7.2 usa un volumen persistente del backend montado en:

```text
/data
```

Rutas:

```text
UPLOAD_DIR=/data/uploads
backups=/data/backups
```

El backup `pre-migrate-p7.sql` y su metadata permanecieron presentes en `/data/backups` después de varios redeploys posteriores, demostrando persistencia física del volumen.

El código de adjuntos usa el mismo volumen mediante `UPLOAD_DIR=/data/uploads`, y `test:upload-storage` forma parte de `npm test`/Quality Gate para impedir regresiones de ruta. No se cargaron datos judiciales reales durante la validación.

## 12. Rollback

Si falla código pero la migración no cambió datos/esquema de forma incompatible:

1. retirar de tráfico la revisión defectuosa;
2. seleccionar una revisión conocida como estable y compatible con el esquema actual;
3. mantener volúmenes y base sin alterarlos;
4. ejecutar health y smoke externo antes de reabrir tráfico.

Si una migración produjo incompatibilidad o daño:

1. detener escrituras;
2. conservar evidencia y, si es posible, un backup de emergencia;
3. verificar el backup pre-deploy;
4. restaurar primero en una base alternativa;
5. validar migraciones y datos críticos;
6. promover/restaurar solo después de la verificación.

P7.2 realizó una simulación read-only y confirmó:

- no existía un deployment anterior estable apto para un rollback automático de bajo riesgo;
- `/data` y `/var/lib/mysql` se preservan entre deployments;
- las migraciones 001–005 no se revierten automáticamente con un rollback de aplicación;
- el proyecto no define un `migrate:down` genérico y no se debe inventar una reversión manual;
- si el esquema fuera incompatible con código anterior, corresponde restauración segura desde backup o corrección hacia adelante según `OPERATIONS.md`.

No ejecutar `down` manual ni editar el esquema a mano únicamente para hacer coincidir un binario viejo.

## 13. Evidencia requerida para cerrar P7

La evidencia técnica de P7.2 ya cubre:

- entorno de staging real separado;
- MySQL de staging separado y sin datos reales de producción;
- HTTPS/origen real configurado;
- `TRUST_PROXY_HOPS` verificado;
- secretos exclusivos de staging;
- preflight verde;
- backup/checksum y migración controlada probados;
- deploy reproducible desde commit identificado;
- `/health/live` y `/health/ready` verdes;
- smoke post-deploy verde;
- persistencia del volumen demostrada;
- rollback simulado de forma controlada;
- logs/build/deploy accesibles para diagnóstico;
- Quality Gate #165 verde.

Para **cerrar formalmente P7 completo** falta únicamente:

1. integrar PR #22 a `main`;
2. ejecutar/verificar Quality Gate post-merge sobre `main`;
3. confirmar que `ROADMAP.md` continúa alineado con el estado real.

Hasta ese merge, P7.2 está técnicamente validado pero P7 completo permanece abierto.
