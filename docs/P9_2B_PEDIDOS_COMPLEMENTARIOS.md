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

Toda evidencia operativa derivada del ciclo debe conservar el tipo real del pedido. Esto incluye como mínimo:

- motivo de `MovimientoStock`;
- notificaciones al solicitante;
- bitácora de cambio de estado;
- bitácora de provisión.

Un pedido `COMPLEMENTARIO` no puede quedar rotulado como `mensual` en esas trazas.

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

## Hallazgo de provisión cero y corrección

Durante la validación manual en staging se comprobó que un pedido `APROBADO` podía pasar a `ENTREGADO` con `cantidad_provista = 0`. El sistema informaba éxito, pero no existía EGRESO ni descuento de stock.

La corrección se integró mediante PR #41 y quedó validada con:

- Quality Gate del PR #295 en verde;
- merge en `main@f3a81036a2126904dca8c663dcfd66c8704be724`;
- Quality Gate post-merge #296 en verde;
- despliegue de staging `6e7235eb-7b8f-45df-8d28-fd8082c86969` en `SUCCESS`;
- preflight con revisión exacta `f3a81036a2126904dca8c663dcfd66c8704be724`;
- `/ready` HTTP 200.

Validación manual posterior:

- provisión `0` rechazada con `No se puede marcar el pedido como ENTREGADO sin registrar al menos una unidad provista.`;
- pedido conservado en `APROBADO`;
- stock central conservado en `5`;
- provisión real posterior de `2` unidades completada;
- stock central `5 -> 3`;
- EGRESO de `2` unidades a Área Informática;
- Pedido #4 marcado como entregado.

## Hallazgo posterior de trazabilidad del tipo

En la entrega válida del Pedido #4, que era `COMPLEMENTARIO`, el movimiento de stock quedó registrado como:

```text
Entrega por pedido mensual N° 4 a Área Informática
```

El movimiento cuantitativo fue correcto, pero la etiqueta era incorrecta y podía inducir a error en auditoría. La misma denominación fija `mensual` existía en notificaciones y bitácoras de estado/provisión.

La corrección debe:

1. derivar la etiqueta desde `PedidoInsumo.tipo`;
2. mantener `pedido mensual` para `MENSUAL`;
3. usar `pedido complementario` para `COMPLEMENTARIO`;
4. aplicarse al motivo de EGRESO/DEVOLUCIÓN, notificaciones y bitácoras;
5. conservar autorización, transacciones, stock e idempotencia existentes;
6. contar con una integración MySQL que cree mensual + complementario, apruebe y provisione el complementario y verifique las trazas persistidas.

Este hallazgo permanece dentro de P9.2B y no abre un bloque nuevo.

## Evidencia requerida en staging

Antes de dar por resuelto este hallazgo dentro de P9.2B debe verificarse:

1. migración 007 aplicada en staging;
2. Quality Gate verde antes y después del merge;
3. pedido mensual existente de Área Informática conservado;
4. segundo pedido del mismo mes aceptado como `COMPLEMENTARIO`;
5. pedido complementario de `P9.2B PEDIDO - Insumo 002` por 2 unidades creado en estado `ENVIADO`;
6. stock central permanece en 5 mientras el pedido está pendiente;
7. el tipo `Complementario` es visible en historial;
8. el circuito posterior de aprobación/provisión descuenta stock una sola vez;
9. provisión `0` no puede cerrar el pedido como `ENTREGADO`;
10. movimiento, notificación y bitácora conservan explícitamente `COMPLEMENTARIO` cuando corresponde.

El cierre de este hallazgo no cierra P9.2B: después debe continuar el resto de los escenarios definidos en `P9_2B_FIRST_WAVE.md`.
