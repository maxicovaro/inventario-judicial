# Arquitectura backend y seguridad — Inventario Judicial

Este documento resume la arquitectura de backend, autenticación, autorización, consistencia y seguridad del Sistema de Inventario Judicial, y define la continuidad hacia pre-staging.

Estado de referencia: 11/09/2026.

## 1. Alcance

Este documento cubre:
- autenticación y sesiones;
- autorización por rol y oficina;
- seguridad HTTP y secretos;
- bitácora y trazabilidad;
- consistencia/concurrencia/idempotencia;
- migraciones relacionadas con seguridad;
- estado de P6.1 pre-staging;
- dependencias con frontend y operaciones.

Para backup, restore, health, logging, incidentes y rollback operativo ver `docs/OPERATIONS.md`.

## 2. Stack backend

- Node.js + Express.
- MySQL.
- `mysql2` / Sequelize según módulo.
- JWT para identidad de sesión.
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

## 4. Sesiones y JWT — base integrada en `main`

La base previa a P6.1 ya incorpora hardening de sesiones:
- JWT con algoritmo restringido;
- `issuer` y `audience` controlados;
- `jti` por sesión;
- sesiones persistentes y revocables;
- logout con revocación real;
- revocación de sesiones después de cambios sensibles de cuenta;
- límites defensivos para payloads y encabezado Bearer;
- respuestas de error que evitan exposición innecesaria.

La migración 004 incorporó soporte de sesiones persistentes.

## 5. P6 — consistencia, concurrencia e idempotencia ✅

P6 está integrado y forma parte del Quality Gate.

Objetivos ya cubiertos:
- proteger operaciones críticas frente a concurrencia;
- transacciones/bloqueos donde corresponde;
- soporte de idempotencia para acciones sensibles;
- pruebas MySQL reales de concurrencia;
- migración 003 validada de forma idempotente;
- `Idempotency-Key` opcional en backend mientras no se incorpore de forma deliberada en todos los clientes frontend.

La adopción desde el frontend no debe hacerse como cambio aislado: debe coordinarse con los flujos afectados y sus E2E.

## 6. P6.1 — cierre de seguridad pre-staging 🔄

Frente activo: PR #13, rama `security/prestaging-hardening`.

P6.1 está diseñado para cerrar brechas antes de desplegar staging institucional.

### 6.1 Transporte de sesión

Objetivo de producción:
- cookie de sesión `HttpOnly`;
- `SameSite=Strict`;
- `Secure` en production;
- production fuerza transporte por cookie;
- el JWT no se expone en JSON en production;
- modos de compatibilidad quedan limitados a development/test.

### 6.2 Autoridad de sesión

`GET /api/auth/me` pasa a ser la fuente de autoridad para restaurar la sesión frontend.

Consecuencias esperadas en frontend:
- requests con credenciales;
- no persistir JWT en `localStorage`;
- `AuthProvider`/rutas privadas gobernadas por el estado confirmado por backend;
- logout contra backend antes de considerar cerrada la sesión local.

### 6.3 Protección de origen y CORS

Para autenticación por cookie:
- CORS debe permitir credenciales solo desde orígenes configurados;
- las mutaciones autenticadas deben validar `Origin`;
- no se habilitan orígenes comodín con credenciales;
- los valores concretos deben separarse por ambiente.

### 6.4 Rate limiting

P6.1 incorpora límites defensivos para login/MFA.

Principio:
- contar fallos relevantes;
- no penalizar indiscriminadamente autenticaciones válidas;
- configurar correctamente IP/origen real detrás de proxy.

### 6.5 Proxy y cabeceras

- `trust proxy` debe ser explícito y depender de infraestructura conocida;
- CSP defensiva;
- HSTS en producción con parámetros deliberados;
- no asumir `includeSubDomains` sin validar la arquitectura de dominios.

## 7. MFA administrativo

P6.1 agrega MFA/TOTP obligatorio para `ADMIN` en producción.

Diseño:
- enrolamiento TOTP en primer acceso cuando corresponde;
- verificación TOTP en accesos posteriores;
- secreto MFA cifrado con AES-256-GCM mediante clave separada de otros secretos;
- códigos de recuperación de un solo uso;
- códigos de recuperación almacenados únicamente como hashes;
- eventos relevantes registrados en bitácora sin exponer secretos;
- fallos de bitácora no deben convertir una operación de seguridad ya confirmada en un falso HTTP 500.

Migración asociada: 005 para MFA administrativo.

## 8. Contraseñas y bloqueo

- contraseñas almacenadas con bcrypt;
- política mínima validada centralmente;
- intentos fallidos y bloqueo temporal;
- acciones administrativas de reset/desbloqueo sujetas a rol;
- cambios sensibles revocan sesiones según contrato de seguridad vigente.

Nunca almacenar contraseñas, JWT, secretos TOTP o códigos de recuperación en logs, commits o documentación.

## 9. Migraciones de seguridad

Estado conceptual:
- 001/002: base histórica del esquema;
- 003: soporte de consistencia/idempotencia P6;
- 004: sesiones persistentes/revocables;
- 005: MFA administrativo, pendiente de integración final con P6.1.

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
- eventos MFA deben ser auditables sin registrar secreto/código.

## 11. Observabilidad y disponibilidad

Ya integrado:
- `GET /health/live`;
- `GET /health/ready`;
- Request ID;
- logging estructurado;
- cierre controlado;
- restore drill en CI.

Ver procedimientos concretos en `docs/OPERATIONS.md`.

## 12. Validación obligatoria de seguridad

Antes de mergear un cambio de autenticación/autorización:
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

No considerar suficiente un lint/build frontend para cambios de seguridad.

## 13. Coordinación actual con frontend

PR #11 de UX/UI ya fue integrado a `main`:
- UX final: `fa6941b830fbcb621b6342ce878c6f2e7a89dd54`;
- merge commit: `0cb1f5285ca150b41bc17859eb10f607c784f6cc`.

P6.1 fue desarrollado/validado inicialmente contra revisiones anteriores del frontend. Por lo tanto, antes de integrar PR #13 debe:

1. incorporar el `main` actual;
2. reconciliar el frontend de cookie/MFA sobre el Design System final;
3. preservar shell, sidebar, accesibilidad y refresh A–E;
4. adaptar E2E al flujo MFA;
5. ejecutar nuevamente el Quality Gate completo;
6. integrar PR #13 a `main` solo si todo está verde.

Los PR temporales de integración sirven como evidencia, pero no reemplazan esa validación final.

## 14. Continuidad hacia P7

P7 solo comienza cuando P6.1 esté integrado y `main` vuelva a estar verde.

Antes de staging deben quedar definidos:
- dominio/origin real de staging;
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
2. No almacenar tokens/secretos en `localStorage` cuando production use cookie HttpOnly.
3. No cambiar roles/permisos sin pruebas negativas.
4. No agregar un nuevo mecanismo de sesión sin estrategia de revocación.
5. No introducir migraciones fuera del sistema versionado.
6. No mergear auth/MFA con Quality Gate parcial.
7. Actualizar este documento cuando cambie un contrato global de seguridad.
8. Mantener `ROADMAP.md` como estado ejecutivo y este archivo como detalle técnico.
