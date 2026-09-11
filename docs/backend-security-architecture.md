# Arquitectura backend y seguridad — Inventario Judicial

Este documento resume la arquitectura de backend, autenticación, autorización, consistencia y seguridad del Sistema de Inventario Judicial y deja consolidado el contrato de P6.1 antes de staging.

Estado de referencia: 11/09/2026. P6.1 validado en PR #13 con Quality Gate #148 verde.

## 1. Alcance

Este documento cubre:
- autenticación y sesiones;
- autorización por rol y oficina;
- seguridad HTTP y secretos;
- bitácora y trazabilidad;
- consistencia/concurrencia/idempotencia;
- migraciones relacionadas con seguridad;
- contrato final de P6.1 pre-staging;
- dependencias con frontend y operaciones.

Para backup, restore, health, logging, incidentes y rollback operativo ver `docs/OPERATIONS.md`.

## 2. Stack backend

- Node.js + Express.
- MySQL.
- `mysql2` / Sequelize según módulo.
- JWT para identidad de sesión, transportado por cookie segura en production.
- bcrypt para credenciales.
- Migraciones versionadas.
- Quality Gate con MySQL real descartable.
- E2E con Chromium para recorridos críticos.

## 3. Modelo de autorización

Roles funcionales:
- `ADMIN`;
- `RESPONSABLE`;
- `USUARIO`.

Principios:
- la autorización sensible se valida siempre en backend;
- el frontend solo refleja capacidades para UX;
- `RESPONSABLE` opera dentro del alcance de su oficina;
- `ADMIN` dispone de capacidades administrativas sujetas a las reglas de oficina central;
- los accesos negativos por rol/oficina forman parte de integración/E2E;
- no se autorizan acciones por nombres visibles ni por datos controlados exclusivamente por cliente.

## 4. Sesiones y JWT — contrato consolidado con P6.1

La aplicación mantiene JWT con sesión persistente/revocable, pero en production el navegador no administra ese token directamente.

Contrato:
- JWT con algoritmo restringido, `issuer`, `audience` y `jti` controlados;
- sesión persistente en base y revocable;
- logout con revocación real;
- revocación de sesiones después de cambios sensibles de cuenta;
- production fuerza `AUTH_TOKEN_TRANSPORT=cookie`;
- cookie `HttpOnly`, `SameSite=Strict`, `Secure` y con prefijo `__Host-` en production;
- el JWT no se devuelve al navegador en JSON cuando el transporte es `cookie`;
- `GET /api/auth/me` es la autoridad para restaurar la sesión del cliente;
- el middleware puente permite reutilizar internamente la validación Bearer sin exponer el token al frontend;
- límites defensivos para payloads y encabezado Bearer;
- respuestas de error que evitan exposición innecesaria.

La migración 004 incorporó sesiones persistentes y P6.1 extiende ese contrato con verificación MFA por sesión.

## 5. P6 — consistencia, concurrencia e idempotencia ✅

P6 está integrado y forma parte del Quality Gate.

Objetivos cubiertos:
- proteger operaciones críticas frente a concurrencia;
- transacciones/bloqueos donde corresponde;
- soporte de idempotencia para acciones sensibles;
- pruebas MySQL reales de concurrencia;
- migración 003 validada de forma idempotente;
- `Idempotency-Key` opcional en backend mientras no se incorpore de forma deliberada en todos los clientes frontend.

La adopción desde el frontend no debe hacerse como cambio aislado: debe coordinarse con los flujos afectados y sus E2E.

## 6. P6.1 — cierre de seguridad pre-staging ✅

PR de cierre: #13, rama `security/prestaging-hardening`.

La implementación fue reconciliada con el `main` vigente `45ae8ad48d050390aa87ea9ad646bb79410f6ceb` y con el frontend A–E final. El HEAD de implementación previo al cierre documental fue `b2e8d935d135a1966078b75faeeae435aedd0cb6`.

Quality Gate #148: **verde**, incluyendo frontend lint/build, audit backend, sintaxis/tests, migraciones 001–005 y rerun, integración MySQL, auth hardening, MFA ADMIN, P6 concurrencia/idempotencia, health, backup/restore y Chromium E2E.

### 6.1 Transporte de sesión

Producción:
- cookie de sesión `HttpOnly`;
- `SameSite=Strict`;
- `Secure`;
- nombre con prefijo `__Host-`;
- production fuerza transporte por cookie;
- el JWT no se expone en JSON al navegador;
- modos de compatibilidad quedan limitados a development/test.

### 6.2 Autoridad de sesión

`GET /api/auth/me` es la fuente de autoridad para restaurar la sesión frontend.

Contrato cliente:
- requests con credenciales;
- JWT fuera de `localStorage`;
- `AuthProvider` y rutas privadas gobernadas por el estado confirmado por backend;
- cache local de datos de usuario no concede autorización;
- logout contra backend antes de considerar cerrada la sesión local.

### 6.3 Protección de origen y CORS

Para autenticación por cookie:
- CORS permite credenciales solo desde el origen configurado;
- las mutaciones autenticadas por cookie validan `Origin`;
- no se habilitan orígenes comodín con credenciales;
- los valores concretos se separan por ambiente.

### 6.4 Rate limiting

P6.1 incorpora límites defensivos para login y MFA.

Principios:
- contar fallos relevantes;
- no penalizar indiscriminadamente autenticaciones válidas;
- usar IP/origen real coherente con `trust proxy`;
- revisar almacenamiento distribuido del limiter recién si P8/P9 introduce múltiples instancias y el volumen lo exige.

### 6.5 Proxy y cabeceras

- `trust proxy` es explícito y debe configurarse según infraestructura conocida;
- CSP defensiva;
- HSTS en producción con parámetros deliberados;
- no asumir `includeSubDomains` sin validar la arquitectura de dominios.

## 7. MFA administrativo

P6.1 incorpora MFA/TOTP obligatorio para `ADMIN` en production por defecto.

Diseño consolidado:
- enrolamiento TOTP en primer acceso cuando corresponde;
- verificación TOTP en accesos posteriores;
- estado de segundo factor asociado a la sesión persistente;
- secreto MFA cifrado con AES-256-GCM;
- clave MFA de production separada y validada por configuración cuando MFA administrativo es obligatorio;
- códigos de recuperación de un solo uso;
- códigos de recuperación almacenados únicamente como hashes;
- comparación defensiva de códigos;
- eventos relevantes registrados en bitácora sin exponer secretos;
- fallos de bitácora no convierten una operación de seguridad ya confirmada en falso HTTP 500;
- deshabilitar MFA, cuando el entorno lo permite, exige password + segundo factor y revoca sesiones.

La migración 005 agrega el soporte de MFA administrativo y `mfa_verified_at` para sesiones.

## 8. Contraseñas y bloqueo

- contraseñas almacenadas con bcrypt;
- política mínima validada centralmente;
- intentos fallidos y bloqueo temporal;
- acciones administrativas de reset/desbloqueo sujetas a rol;
- cambios sensibles revocan sesiones según contrato de seguridad vigente.

Nunca almacenar contraseñas, JWT, secretos TOTP o códigos de recuperación en logs, commits o documentación.

## 9. Migraciones de seguridad

Estado:
- 001/002: base histórica del esquema;
- 003: soporte de consistencia/idempotencia P6;
- 004: sesiones persistentes/revocables;
- 005: MFA administrativo y verificación de segundo factor por sesión, validada en P6.1.

Reglas:
- toda migración se prueba en base descartable;
- rerun debe ser idempotente o fallar de forma segura;
- no ejecutar migraciones nuevas sobre datos reales sin backup/preflight;
- CI verifica estado de migraciones antes de considerar verde un cambio.

## 10. Bitácora y auditoría

La aplicación mantiene bitácora para acciones administrativas y eventos relevantes.

Requisitos:
- registrar actor, acción, módulo/contexto y fecha;
- evitar secretos y datos sensibles innecesarios;
- conservar eventos de login/cambios sensibles según diseño del módulo;
- eventos MFA auditables sin registrar secreto/código.

## 11. Observabilidad y disponibilidad

Integrado:
- `GET /health/live`;
- `GET /health/ready`;
- Request ID;
- logging estructurado;
- cierre controlado;
- restore drill en CI.

Ver procedimientos concretos en `docs/OPERATIONS.md`.

## 12. Validación obligatoria de seguridad

Antes de mergear un cambio de autenticación/autorización deben pasar:
- audit de dependencias;
- sintaxis/tests backend;
- migraciones en MySQL descartable;
- rerun de migraciones;
- integración MySQL;
- auth hardening;
- MFA cuando corresponda;
- P6 concurrencia/idempotencia;
- health;
- backup/restore;
- E2E Chromium.

P6.1 cumplió esta matriz en Quality Gate #148. No considerar suficiente un lint/build frontend para futuros cambios de seguridad.

## 13. Integración final con frontend

El frontend A–E fue integrado previamente mediante PR #11:
- UX final: `fa6941b830fbcb621b6342ce878c6f2e7a89dd54`;
- merge commit: `0cb1f5285ca150b41bc17859eb10f607c784f6cc`.

P6.1 fue reconciliado sobre esa base final y preserva:
- AppShell y sidebar;
- accesibilidad y estados de foco/carga;
- `admina-refresh.css`, `admina-modules.css` y `admina-premerge-fixes.css`;
- recorridos funcionales de activos, solicitudes, pedidos, reportes y adjuntos.

La capa agregada incorpora:
- `AuthProvider`/`AuthContext`;
- Axios `withCredentials`;
- `/auth/me` como autoridad;
- eliminación del JWT de `localStorage`;
- setup/verificación MFA y códigos de recuperación;
- E2E específicos de cookie, MFA y navegación.

PR #16 fue un frente temporal de validación y **NO debe mergearse**.

## 14. Continuidad hacia P7

P7 es el próximo bloque y solo se abre desde `main` después de integrar PR #13 y confirmar que Git/CI quedaron alineados.

Antes de staging deben definirse con la infraestructura real:
- dominio/origin de staging;
- política `Secure`/cookie;
- CORS permitido;
- `trust proxy` según proveedor;
- secretos de JWT/MFA/DB por ambiente;
- MySQL de staging independiente;
- almacenamiento de backups fuera del host;
- procedimiento de migración/deploy/rollback;
- smoke tests post-deploy.

## 15. Reglas de mantenimiento

1. No debilitar seguridad para resolver un problema visual o de desarrollo local.
2. No almacenar JWT/secretos en `localStorage` cuando production use cookie HttpOnly.
3. No cambiar roles/permisos sin pruebas negativas.
4. No agregar un nuevo mecanismo de sesión sin estrategia de revocación.
5. No introducir migraciones fuera del sistema versionado.
6. No mergear auth/MFA con Quality Gate parcial.
7. Actualizar este documento cuando cambie un contrato global de seguridad.
8. Mantener `ROADMAP.md` como estado ejecutivo y este archivo como detalle técnico.
9. Antes de abrir el siguiente bloque, verificar primero el punto de continuidad en `ROADMAP.md`.
