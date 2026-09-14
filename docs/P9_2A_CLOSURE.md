# P9.2A — Cierre formal: Depósito Central + Área Contable

Fecha de cierre funcional: 13/09/2026 (America/Argentina/Buenos_Aires).

## Resultado

P9.2A queda técnicamente validado con el modelo institucional acordado:

- `Área Contable` continúa siendo una oficina ordinaria con activos, stock, solicitudes y consumos propios;
- `Depósito Central` permanece como ubicación institucional separada para bienes e insumos pendientes de distribución;
- una entrega a Contable se registra como `Depósito -> Área Contable`, igual que para cualquier otra dependencia;
- puede haber varios usuarios `RESPONSABLE` en Área Contable;
- cada responsable opera con su propia cuenta y las operaciones conservan el `usuario_id` del empleado interviniente;
- un `USUARIO` común de Contable no administra depósito;
- administrar depósito no concede rol `ADMIN` ni administración global de usuarios;
- los responsables autorizados disponen de una Auditoría operativa del Depósito Central sin acceso a la Bitácora global de Dirección.

## Implementación consolidada

La migración 006 incorpora capacidades persistidas en `oficinas`:

- `gestiona_deposito`;
- `es_deposito_central`.

La autorización efectiva del depósito depende de rol + capacidad persistida de la oficina, no del nombre visible de la dependencia.

El módulo de depósito queda aislado bajo `/api/deposito/*` y cuenta con superficies frontend separadas para:

- activos;
- insumos y distribución;
- solicitudes;
- pedidos;
- auditoría operativa.

Las pantallas normales de Contable continúan representando exclusivamente su propia oficina.

## Integridad y trazabilidad

Se preservan las garantías previas de P6:

- transacciones;
- locks de stock;
- idempotencia;
- prevención de stock negativo/doble entrega;
- movimientos trazables.

Los insumos nuevos nacen con stock central `0`; la existencia física debe entrar mediante un movimiento trazable.

Los activos pendientes de distribución permanecen en Depósito Central hasta un traslado formal a la oficina receptora.

Recepciones, altas, ajustes, entregas, traslados, respuestas y provisiones quedan atribuidos al usuario autenticado que ejecutó cada acción.

## Operación multiusuario validada

La integración MySQL prueba explícitamente:

- dos `RESPONSABLE` distintos de Área Contable con permiso de depósito;
- un responsable registrando una etapa y otro responsable ejecutando una etapa posterior;
- `usuario_id` individual en movimientos patrimoniales y de stock;
- autor individual en respuestas de solicitudes y gestión/provisión de pedidos;
- un `USUARIO` común de Contable rechazado;
- un `RESPONSABLE` de Informática rechazado;
- un responsable de Contable rechazado al intentar administrar usuarios globales;
- separación entre inventario propio de Contable e inventario del Depósito Central.

## Evidencia definitiva

Implementación funcional:

- rama: `ops/p9-controlled-onboarding`;
- PR: **#33 — P9.2A: Depósito Central gestionado por Área Contable**;
- HEAD final pre-merge: `f09d8883f6eb529162416297ea04b5da92267649`;
- Quality Gate pre-merge: **#267**, verde completo;
- merge squash a `main`: `3fe4b3ae487d0dfb53f44e7654e4c18dcc39bd29`;
- Quality Gate post-merge: **#268**, verde completo sobre ese SHA.

El Gate #268 validó, entre otros:

- frontend lint + build;
- sintaxis y contratos backend;
- migraciones 001–006 e idempotencia de migraciones;
- integración MySQL, incluida P9.2A multiusuario;
- auth hardening y MFA;
- concurrencia/idempotencia P6;
- runtime health;
- backup/restore drill;
- regresiones de rendimiento P8;
- Chromium E2E crítico.

## Datos y entornos

P9.2A no incorporó usuarios reales ni manifiestos privados y no modificó datos de staging.

La migración 006 fue validada en bases descartables de CI. Su aplicación a staging se realizará de forma controlada dentro de P9.2B, respetando preflight, backup y procedimiento de despliegue vigente.

## Continuidad

Con P9.2A cerrado, el siguiente subbloque elegible es **P9.2B — Primera ola Contable + Informática**.

P9.2B debe comenzar únicamente después de:

1. integrar este cierre documental;
2. obtener Quality Gate post-merge verde del cierre;
3. releer `ROADMAP.md` desde `main`.

P9.2B incluirá selección institucional de personas reales, manifiesto privado, `plan` en staging, altas vía Gestión de Usuarios, `verify`, validación funcional y rollback controlado.

P9.3 permanece bloqueado hasta el cierre formal de P9.2 completo.
