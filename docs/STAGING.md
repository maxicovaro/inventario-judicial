# P7 — Staging y despliegue controlado

Este documento define el plan ejecutable para construir y operar un entorno de **staging separado** del Sistema de Inventario Judicial. No autoriza por sí mismo un despliegue: P7 comienza operativamente únicamente cuando P6.1 haya sido integrado a `main` con Quality Gate completo en verde.

## 1. Objetivo

Disponer de un entorno de preproducción que reproduzca, con datos no sensibles y recursos separados, las condiciones relevantes de producción para validar:

- despliegue reproducible;
- configuración por ambiente;
- cookie de sesión segura y MFA ADMIN;
- migraciones MySQL;
- persistencia de uploads;
- health checks;
- backup y restore;
- smoke tests funcionales;
- observabilidad básica;
- rollback de aplicación;
- procedimiento de promoción hacia piloto.

## 2. Regla de entrada a P7

No crear ni promover infraestructura de staging hasta cumplir simultáneamente:

1. P6.1 integrado a `main` mediante PR revisado;
2. Quality Gate final verde con frontend cookie + MFA;
3. `main` limpio y commit de referencia identificado;
4. `ROADMAP.md` actualizado indicando P7 como bloque activo;
5. secretos reales fuera del repositorio;
6. estrategia de backup/restauración confirmada.

Si cualquiera de estos puntos falla, P7 queda en **NO-GO**.

## 3. Principios de aislamiento

Staging debe estar separado de desarrollo/local y de producción futura:

- base MySQL propia;
- credenciales propias;
- secretos JWT/MFA propios;
- dominio/origen propio;
- almacenamiento de adjuntos propio;
- logs propios;
- usuarios de prueba propios;
- backups propios;
- nunca reutilizar datos personales reales para pruebas.

No se permite apuntar staging a la base local del desarrollador ni a una futura base de producción.

## 4. Topología objetivo

La topología concreta dependerá del proveedor elegido, pero debe respetar estos roles:

```text
Navegador
   |
 HTTPS
   v
Frontend React/Vite
   |
 HTTPS / API
   v
Backend Node.js / Express
   |
   +--> MySQL staging
   +--> almacenamiento persistente de uploads
   +--> logs / observabilidad
```

Requisitos mínimos:

- HTTPS obligatorio;
- backend Node 22 compatible con el proyecto;
- proceso reiniciable de manera controlada;
- volumen o almacenamiento persistente para adjuntos;
- MySQL 8 compatible;
- posibilidad de configurar secretos sin versionarlos;
- posibilidad de consultar health checks desde fuera del proceso.

## 5. Variables y secretos de staging

Como mínimo deben definirse fuera de Git:

```text
NODE_ENV=production
PORT
DB_HOST
DB_PORT
DB_NAME
DB_USER
DB_PASSWORD
JWT_SECRET
JWT_ISSUER
JWT_AUDIENCE
CORS_ORIGIN
AUTH_TOKEN_TRANSPORT=cookie
REQUIRE_ADMIN_MFA=true
MFA_ENCRYPTION_KEY
TRUST_PROXY
HEALTH_DB_TIMEOUT_MS
SHUTDOWN_TIMEOUT_MS
VITE_API_URL
```

Reglas:

- `JWT_SECRET`: aleatorio, exclusivo de staging y >= 32 bytes;
- `MFA_ENCRYPTION_KEY`: independiente de JWT y exclusiva de staging;
- nunca copiar valores desde CI ni desde `.env.example`;
- `CORS_ORIGIN` debe ser el origen exacto del frontend de staging;
- `VITE_API_URL` debe apuntar exclusivamente al backend de staging;
- `AUTH_TOKEN_TRANSPORT=cookie` y `REQUIRE_ADMIN_MFA=true` son obligatorios para reproducir el modelo de seguridad preproducción;
- los secretos deben poder rotarse sin modificar el repositorio.

## 6. Cookie, CORS y proxy

Antes del primer smoke test validar:

- cookie `HttpOnly`;
- `Secure` bajo HTTPS;
- `SameSite=Strict` según contrato P6.1;
- frontend con `withCredentials`;
- JWT ausente de `localStorage`;
- CORS únicamente desde el origen de staging;
- `trust proxy` configurado de acuerdo con la plataforma real, no habilitado a ciegas;
- mutaciones autenticadas por cookie rechazadas cuando el `Origin` no es confiable.

## 7. Base de datos

### 7.1 Creación

Crear una base vacía exclusiva para staging y un usuario MySQL con privilegios mínimos necesarios para la aplicación y migraciones.

No cargar un dump de producción ni datos personales reales.

### 7.2 Migraciones

El despliegue debe aplicar únicamente migraciones versionadas:

```bash
npm run db:migrate
npm run db:status
```

No usar `sequelize.sync()` ni alterar tablas manualmente como parte del deploy normal.

### 7.3 Preflight

Antes de migrar:

- confirmar `DB_HOST` y `DB_NAME`;
- confirmar entorno staging;
- crear backup si la base ya contiene datos de prueba útiles;
- verificar checksum;
- registrar commit desplegado.

## 8. Datos de staging

Usar un set controlado de datos ficticios suficiente para probar:

- ADMIN central;
- RESPONSABLE de al menos dos oficinas;
- USUARIO;
- activos en distintas oficinas/estados;
- insumos y stock;
- solicitudes;
- pedidos mensuales;
- notificaciones;
- adjuntos de prueba sin información real.

Los fixtures destructivos de integración/CI no deben ejecutarse contra staging salvo que exista un script explícitamente diseñado para resetear una base descartable y la operación haya sido autorizada.

## 9. Adjuntos y persistencia

El almacenamiento de uploads debe sobrevivir reinicios y redeploys.

Validar:

- upload PDF permitido;
- listado según rol/oficina;
- descarga autorizada;
- denegación por ID directo desde otra oficina;
- eliminación autorizada;
- archivo físico/persistente eliminado cuando corresponde;
- límites de tamaño y tipo;
- backup o estrategia de recuperación definida antes de piloto.

No depender del filesystem efímero del runtime si la plataforma lo reemplaza durante un despliegue.

## 10. Pipeline de despliegue

El primer P7 puede ser manual controlado, pero debe ser reproducible.

Secuencia mínima:

1. identificar SHA de `main` a desplegar;
2. confirmar Quality Gate verde;
3. construir frontend desde checkout limpio;
4. instalar backend con `npm ci`;
5. ejecutar preflight de entorno;
6. crear/verificar backup si corresponde;
7. ejecutar migraciones;
8. desplegar backend;
9. desplegar frontend;
10. comprobar `/health/live`;
11. comprobar `/health/ready`;
12. ejecutar smoke tests;
13. registrar resultado y SHA desplegado.

No desplegar directamente desde un working tree con cambios locales.

## 11. Smoke test post-deploy

Debe ejecutarse como mínimo:

1. página de login accesible por HTTPS;
2. credenciales inválidas no crean sesión;
3. ADMIN configura/verifica MFA;
4. segundo login ADMIN exige TOTP;
5. sesión persiste tras recarga mediante cookie HttpOnly;
6. logout revoca sesión;
7. RESPONSABLE ve solo su alcance;
8. USUARIO no recibe controles administrativos;
9. alta/edición permitida de activo según rol;
10. solicitud de oficina y revisión administrativa;
11. pedido mensual, aprobación y provisión;
12. stock consistente;
13. upload/listado/descarga de adjunto;
14. `/health/live` = 200;
15. `/health/ready` = 200;
16. logs muestran `request_id` sin exponer tokens, contraseñas ni cuerpos sensibles.

## 12. Backup y restore en staging

Antes de declarar P7 estable realizar al menos un simulacro real:

```bash
npm run db:backup
npm run db:backup:verify -- <archivo.sql>
```

Restaurar en una base alternativa, nunca inicialmente sobre la activa:

```bash
npm run db:restore -- <archivo.sql> --target <db_alternativa> --confirm <db_alternativa> --recreate
```

Después verificar migraciones y datos de control.

## 13. Rollback

### Aplicación

Si una nueva versión falla sin corrupción de datos:

- retirar la versión defectuosa de tráfico;
- volver al artefacto/commit estable anterior;
- no deshacer migraciones manualmente;
- comprobar health checks y smoke test antes de reabrir.

### Base de datos

Si el esquema/datos resultan afectados:

- detener escrituras;
- conservar evidencia;
- crear backup de emergencia si es posible;
- restaurar primero en base alternativa;
- validar antes de promover la restauración.

Seguir `docs/OPERATIONS.md` para incidentes y recuperación.

## 14. Observabilidad mínima

Staging debe permitir:

- revisar logs estructurados del backend;
- correlacionar por `X-Request-Id`;
- observar reinicios/fallos del proceso;
- detectar `/health/ready = 503`;
- identificar versión/SHA desplegado;
- medir al menos errores HTTP y tiempos de respuesta de endpoints críticos antes de P8.

## 15. Seguridad de staging

Aunque no sea producción, staging debe tratarse como entorno expuesto:

- HTTPS;
- secretos fuertes y exclusivos;
- MFA ADMIN activo;
- sin cuentas/contraseñas por defecto;
- sin datos personales reales;
- acceso administrativo limitado;
- uploads no ejecutables;
- CORS/origin restringido;
- dependencias auditadas;
- backup protegido;
- no exponer paneles de depuración ni stack traces al cliente.

## 16. Sub-bloques P7

### P7.0 — Diseño y proveedor
- elegir plataforma para frontend, backend, MySQL y uploads;
- documentar costos/límites y persistencia;
- definir dominio de staging.

### P7.1 — Contrato de ambiente
- variables y secretos;
- CORS/cookies/proxy;
- preflight automático que falle de forma segura.

### P7.2 — Infraestructura staging
- recursos separados;
- HTTPS;
- DNS;
- persistencia de uploads;
- MySQL staging.

### P7.3 — Deploy reproducible
- build limpio;
- migraciones;
- health checks;
- registro de SHA;
- procedimiento de rollback.

### P7.4 — Validación funcional y de seguridad
- smoke test de roles;
- cookie/MFA;
- flujos críticos;
- adjuntos;
- errores seguros.

### P7.5 — Recuperación
- backup real de staging;
- checksum;
- restore drill;
- evidencia de RPO/RTO inicial.

### P7.6 — Cierre de staging
- checklist completo;
- incidencias resueltas;
- documentación actualizada;
- decisión GO/NO-GO para P8 y piloto controlado.

## 17. Criterio de cierre P7

P7 se considera terminado únicamente si:

- staging está físicamente separado;
- despliegue desde `main` es reproducible;
- HTTPS/cookie/MFA funcionan;
- migraciones están al día;
- uploads son persistentes;
- health checks están operativos;
- smoke tests críticos pasan;
- backup + restore drill pasan;
- existe rollback probado/documentado;
- no hay secretos en Git;
- `ROADMAP.md` y documentación reflejan el estado final.

Hasta entonces, P8 no debe tratarse como bloque activo.
