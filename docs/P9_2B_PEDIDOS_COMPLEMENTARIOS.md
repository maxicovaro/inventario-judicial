# P9.2B — Pedidos mensuales y complementarios

## Contexto

Durante la validación funcional de la primera ola P9.2B se detectó que `POST /pedidos-insumos` rechazaba cualquier segundo pedido de una oficina para el mismo mes y año con el mensaje `Ya existe un pedido para ese mes y esa oficina`.

La regla no representa la operación real: la dependencia realiza un pedido general mensual, pero durante el transcurso del mes puede necesitar solicitar elementos sueltos o agregar necesidades no previstas.

Este hallazgo se trata como una corrección del bloque activo P9.2B y no como un bloque nuevo.

## Regla funcional

Para cada combinación `oficina + mes + año`:

- el primer pedido se registra como `MENSUAL`;
- los siguientes pedidos se registran automáticamente como `COMPLEMENTARIO`;
- no se exige al usuario seleccionar manualmente el tipo;
- cada pedido conserva ID, estado, detalle, provisión, notificaciones y trazabilidad propios;
- crear un pedido no descuenta stock central;
- el movimiento de stock continúa ocurriendo únicamente durante la provisión autorizada.

## Integridad de datos

El modelo incorpora:

- `tipo`: `MENSUAL | COMPLEMENTARIO`;
- `clave_mensual_unica`: `1` para el pedido mensual y `NULL` para los complementarios.

La restricción única pasa de:

```text
(oficina_id, mes, anio)
```

a:

```text
(oficina_id, mes, anio, clave_mensual_unica)
```

De esta forma la base conserva como máximo un pedido mensual por oficina/período y permite múltiples pedidos complementarios. Los pedidos existentes se migran como `MENSUAL`.

## Concurrencia

Si dos solicitudes intentan crear simultáneamente el primer pedido de un mismo período, la restricción única de base sigue siendo la autoridad final. Solo una puede quedar como `MENSUAL`; la otra recibe HTTP 409 y puede reintentarse para registrarse como `COMPLEMENTARIO`.

## UI y trazabilidad

La pantalla de pedido informa que, cuando ya existe el pedido base del período, el nuevo envío se registra automáticamente como complementario.

El historial muestra explícitamente `Mensual` o `Complementario` para evitar que dos pedidos del mismo período parezcan duplicados accidentales.

## Evidencia técnica pre-merge

Implementación validada en PR #38 (`fix/p9-2b-pedidos-complementarios`).

HEAD validado:

```text
6d3651e2ad06020edf55f918cfc7d90559d14b67
```

Quality Gate #287: **verde**.

La corrida completa validó:

- lint y build frontend;
- tests backend;
- migraciones desde base limpia;
- re-ejecución idempotente de migraciones;
- `db:status`;
- integración MySQL real;
- creación del primer pedido como `MENSUAL` y del siguiente como `COMPLEMENTARIO`;
- aislamiento de pedidos entre oficinas;
- autenticación y MFA;
- concurrencia e idempotencia;
- health y backup/restore;
- baselines y perfiles de rendimiento P8;
- Playwright E2E crítico, incluido el ciclo `MENSUAL -> APROBADO -> ENTREGADO -> reporte` con el tipo mensual visible en el historial.

Durante la adecuación de los contratos se detectaron y corrigieron expectativas antiguas que todavía suponían un único pedido por período o textos previos al rediseño. No se relajaron invariantes de base ni controles de autorización.

## Evidencia requerida en staging

Antes de dar por resuelto este hallazgo dentro de P9.2B debe verificarse:

1. migración 007 aplicada en staging;
2. Quality Gate verde antes y después del merge;
3. pedido mensual existente de Área Informática conservado;
4. segundo pedido del mismo mes aceptado como `COMPLEMENTARIO`;
5. pedido complementario de `P9.2B PEDIDO - Insumo 002` por 2 unidades creado en estado `ENVIADO`;
6. stock central permanece en 5 mientras el pedido está pendiente;
7. el tipo `Complementario` es visible en historial;
8. el circuito posterior de aprobación/provisión descuenta stock una sola vez y deja trazabilidad correcta.

El cierre de este hallazgo no cierra P9.2B: después debe continuar el resto de los escenarios definidos en `P9_2B_FIRST_WAVE.md`.
