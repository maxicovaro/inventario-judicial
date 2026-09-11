# Hoja de ruta técnica — Inventario Judicial

> **Fuente principal de continuidad del proyecto.**
>
> Actualizada al 11/09/2026 para cerrar P6.1 después de reconciliar seguridad con el frontend final A–E y validar el Quality Gate #148 en verde.

Cada bloque se trabaja en rama propia, con commits lógicos, PR, revisión completa, Quality Gate y validación local cuando involucra base de datos o entorno de ejecución. Los PR documentan la evidencia de cada cambio, pero este archivo define **el estado consolidado y el próximo punto de continuidad**.

## Estado ejecutivo

| Frente | Estado | Continuidad |
| --- | --- | --- |
| Integridad funcional P0 | ✅ Completo | Mantener regresiones |
| Base técnica/calidad P1 | ✅ Completo | Mantener Quality Gate |
| Autorización/historial P2 | ✅ Completo | Mantener controles negativos |
| Resiliencia/recuperación P3 | ✅ Completo | Mantener restore drills |
| Integración MySQL P4 | ✅ Completo | Se ejecuta en CI |
| E2E/regresiones P5 | ✅ Completo | Se ejecuta en CI |
| Concurrencia/idempotencia P6 | ✅ Completo | Se ejecuta en CI |
| Frontend Bloques A–E | ✅ Integrado a `main` | Merge `0cb1f528...` |
| P6.1 seguridad pre-staging | ✅ Cierre validado | PR #13; Gate #148 verde; documentación de cierre incluida |
| P7 staging/despliegue | ⏳ Siguiente | Abrir solo después de integrar PR #13 y confirmar `main` verde |
| P8 rendimiento/escalabilidad | ⏳ Pendiente | Después de staging estable |
| P9 piloto | ⏳ Pendiente | Después de P7/P8 |

## Backend, calidad y seguridad

### P0 — Integridad funcional crítica ✅
- P0.1 Integridad de asignación de stock.
- P0.2 Restricciones únicas en base de datos.
- P0.3 Flujo consistente de pedidos.
- P0.4 Seguridad crítica inicial.

### P1 — Base técnica y calidad ✅
- P1.1 Configuración por ambientes.
- P1.2 Respuestas de error seguras.
- P1.3 Migraciones versionadas y arranque sin `sequelize.sync()`.
- P1.4 Baseline de calidad y lint estricto.
- P1.5 CI obligatorio mediante Quality Gate.
- P1.6 Auditoría y actualización segura de dependencias.

### P2 — Autorización por alcance e historial de activos ✅
- P2.1 Administrador General definido por `oficina.es_central`.
- P2.2 `RESPONSABLE` limitado a la gestión de su propia oficina.
- P2.3 Historial transaccional de altas, traslados, cambios de estado y bajas.

### P3 — Resiliencia operativa y recuperación ✅
- P3.0 Documentación formal de hoja de ruta.
- P3.1 Backup, checksum y restauración segura MySQL con restore drill en CI.
- P3.2 Health checks, Request ID, logging estructurado y apagado controlado.
- P3.3 Runbook de recuperación, rollback e incidentes (`docs/OPERATIONS.md`).

### P4 — Integración con MySQL real de test ✅
- Flujos completos con base MySQL descartable.
- Usuarios, activos, stock, pedidos y movimientos.
- Casos negativos de autorización por rol/oficina.
- Fixtures reproducibles y aislados.
- Migraciones aplicadas y reejecutadas de forma segura en CI.

### P5 — Protección contra regresiones y E2E ✅
- Playwright/Chromium para recorridos críticos.
- Login, activos, solicitudes, provisión, reportes y adjuntos.
- Validación de permisos por rol.
- Regresión específica de navegación/sidebar.
- Los recorridos críticos forman parte del Quality Gate.

### P6 — Consistencia, concurrencia e idempotencia ✅
- Operaciones simultáneas de stock/pedidos protegidas.
- Suite de concurrencia/idempotencia incluida en Quality Gate.
- Migración 003 validada en base descartable antes de integración.
- Operaciones sensibles preparadas para claves de idempotencia donde corresponde.

### P6.1 — Cierre de seguridad pre-staging ✅

PR de cierre: #13 (`security/prestaging-hardening`).

Implementado y validado:
- transporte de sesión mediante cookie `HttpOnly`;
- `SameSite=Strict` y `Secure` en production;
- prefijo `__Host-` para la cookie de producción;
- production fuerza transporte por cookie y no expone el JWT al navegador;
- `/api/auth/me` como autoridad de sesión;
- JWT fuera de `localStorage` en el frontend final;
- Axios con credenciales y `AuthProvider`/`PrivateRoute` gobernados por backend;
- validación de `Origin` y CORS con credenciales para sesión por cookie;
- rate limiting de login/MFA;
- `trust proxy`, CSP y HSTS configurables de forma explícita;
- MFA/TOTP obligatorio para `ADMIN` en producción;
- secretos MFA cifrados con AES-256-GCM y códigos de recuperación almacenados como hashes;
- migración 005 para MFA administrativo;
- E2E de setup y segundo acceso MFA, cookie HttpOnly, ausencia de JWT local y logout real;
- revalidación integral con MySQL, auth hardening, P6, health, backup/restore y Chromium.

Evidencia de cierre técnico:
- base reconciliada con `main` `45ae8ad48d050390aa87ea9ad646bb79410f6ceb`;
- HEAD de implementación previo al cierre documental: `b2e8d935d135a1966078b75faeeae435aedd0cb6`;
- Quality Gate #148: **verde**;
- PR #16 fue únicamente evidencia de integración temporal y **NO debe mergearse**.

El detalle contractual queda en `docs/backend-security-architecture.md` y `docs/frontend-design-system.md`.

## Frontend / UX/UI

### Bloque A — Design System e infraestructura UI ✅
- Design tokens y kit reusable.
- Login, AppShell, Dashboard y Activos.
- Navegación por rol y accesibilidad base.

### Bloque B — Operación de inventario ✅
- Insumos.
- Stock por oficina.
- Consumo de oficina.
- Movimientos de stock.
- Adjuntos.

### Bloque C — Flujos administrativos ✅
- Solicitudes.
- Pedido mensual.
- Historial/provisión.
- Notificaciones.
- Reportes.

### Bloque D — Administración y cierre UX ✅
- Usuarios.
- Bitácora.
- Diálogos reutilizables.
- Estados loading/error/empty/retry.
- Responsive y revisión de accesibilidad.
- Paneles de adjuntos alineados al Design System.
- Persistencia visual del sidebar y E2E específico.

### Bloque E — Refresh visual completo ✅
- Lenguaje visual inspirado en Admina, implementado con CSS propio.
- Sin incorporar Tailwind ni copiar código de la plantilla.
- Sidebar/topbar, cards, KPI, inputs, botones, badges y tablas refinados.
- Propagación a todos los módulos autenticados.
- `prefers-reduced-motion`.
- Contraste WCAG 2.2 AA reforzado.
- Aislamiento de colisiones CSS entre flujos administrativos.

Integración UX final:
- PR #11: mergeado.
- HEAD UX final previo al merge: `fa6941b830fbcb621b6342ce878c6f2e7a89dd54`.
- Merge commit en `main`: `0cb1f5285ca150b41bc17859eb10f607c784f6cc`.
- Quality Gate pre-merge: #140, verde.
- P6.1 preserva esta base y agrega el contrato de autenticación seguro sin reemplazar el refresh A–E.

Detalles de frontend: `docs/frontend-design-system.md`.

## Próximos bloques

### P7 — Staging y despliegue controlado ⏳

**Próximo bloque. No abrir hasta que PR #13 esté integrado a `main` y el estado final de Git/CI haya sido comprobado.**

Antes de comenzar P7, releer este `ROADMAP.md` y confirmar que P6.1 aparece integrado en `main`.

Alcance previsto:
- entorno de staging físicamente/lógicamente separado;
- MySQL de staging separado de datos reales;
- variables y secretos por ambiente;
- política de cookies/orígenes adecuada al dominio real de staging;
- `trust proxy` definido según la infraestructura real;
- migraciones controladas con preflight y backup;
- procedimiento reproducible de deploy y rollback;
- smoke tests post-deploy;
- verificación `/health/live` y `/health/ready`;
- observabilidad mínima del entorno.

### P8 — Escalabilidad y rendimiento ⏳
- Medición de consultas y endpoints críticos.
- Índices y paginación.
- Límites de carga, uploads y reportes.
- Revisión de queries N+1 y payloads excesivos.
- Pruebas de carga apropiadas al volumen del piloto.
- Presupuestos de rendimiento frontend y backend.

### P9 — Operación de piloto ⏳
- Soporte e incident response.
- Alta controlada de oficinas/usuarios.
- Procedimiento de moderación/administración operativa.
- Indicadores de uso, errores y tiempos de respuesta.
- Revisión periódica de backups y restore drill.
- Criterios de salida del piloto y paso a producción institucional.

## Deuda técnica / decisiones diferidas

No abrir estos puntos como bloques paralelos mientras P7 esté en curso, salvo que bloqueen seguridad o despliegue:

- reemplazar diálogos nativos restantes de asignación de stock, consumo y provisión por el componente accesible definitivo;
- decidir adopción frontend explícita de `Idempotency-Key` en operaciones críticas después de estabilizar el contrato de despliegue;
- evaluar primitivas especializadas (por ejemplo Radix) solo cuando exista una necesidad concreta;
- no introducir Tailwind únicamente por motivos estéticos: el Design System actual es CSS propio.

## Fuente de verdad documental

- **Estado y próximos pasos:** `ROADMAP.md`.
- **Mapa de documentos:** `docs/README.md`.
- **Frontend / UX / Design System / contrato auth cliente:** `docs/frontend-design-system.md`.
- **Backend / autenticación / autorización / P6.1:** `docs/backend-security-architecture.md`.
- **Operación, backup, restore e incidentes:** `docs/OPERATIONS.md`.
- **Evidencia de implementación:** commits, PRs y Quality Gates.

Si existe contradicción entre un PR histórico y esta hoja de ruta, debe verificarse el estado real de `main` y actualizarse este documento en el siguiente PR de continuidad.

## Reglas de trabajo

1. No desarrollar directamente sobre `main`.
2. Un bloque lógico = un commit identificable, salvo correcciones absorbidas antes del merge.
3. No mergear con Quality Gate fallando.
4. Revisar el diff completo del PR antes del merge.
5. No ejecutar cambios destructivos de base sin preflight y respaldo verificado.
6. No usar `npm audit fix --force` de manera automática.
7. No introducir permisos basados en nombres visibles o decisiones del frontend.
8. Toda autorización sensible se valida en backend.
9. Toda migración debe ser versionada e idempotente o fallar de forma segura.
10. Los PR de integración/validación no se mergean si están marcados explícitamente como temporales.
11. **Antes de abrir un bloque nuevo, releer este `ROADMAP.md` y confirmar el punto exacto de continuidad.**
12. **Un bloque no se considera cerrado hasta que `ROADMAP.md`, el documento técnico correspondiente, CI y estado de Git estén alineados.**
