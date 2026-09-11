# Design System — Inventario Judicial

## Objetivo

Este documento define la base visual y de interacción del frontend del Sistema de Inventario Judicial. El objetivo es que cada módulo nuevo reutilice los mismos patrones y que la interfaz mantenga consistencia, accesibilidad y una identidad institucional contemporánea.

## Principios

1. **Claridad operativa antes que decoración.** La información que requiere acción debe identificarse rápido.
2. **Institucional, no burocrático.** La estética debe transmitir confianza sin parecer un sistema administrativo antiguo.
3. **Densidad controlada.** Tablas para comparar muchos registros; tarjetas solo para resúmenes, alertas y estados vacíos.
4. **Permisos comprensibles.** La interfaz refleja lo que el usuario puede hacer, pero la autorización real siempre corresponde al backend.
5. **Accesibilidad desde el componente.** Etiquetas, foco, teclado, semántica, estados y contraste se resuelven en patrones reutilizables.
6. **Responsive sin pérdida de información.** En móvil una tabla puede transformarse en una vista compacta, pero nunca desaparecer sin alternativa.
7. **Una sola gramática visual.** No crear botones, badges, formularios o estados nuevos dentro de cada página si ya existe un componente equivalente.

## Identidad visual

- Tipografía: Inter, con fallback de sistema.
- Fondo de aplicación: gris azulado muy claro.
- Superficies principales: blanco.
- Primario: azul petróleo.
- Acento: turquesa oscuro.
- Verde, ámbar y rojo: reservados para estados semánticos.
- Sombras: sutiles; no se utilizan como único delimitador.
- Radios: moderados, sin estética excesivamente redondeada.
- Movimiento: corto y funcional; debe respetar `prefers-reduced-motion`.

Los valores definitivos viven como custom properties en `src/styles/design-system.css`.

## Arquitectura UI

Los componentes base están centralizados en `src/components/ui/index.jsx`.

### Button

Variantes actuales: `primary`, `secondary`, `ghost`, `danger`.

Usar `primary` para la acción principal de una vista. Evitar dos acciones primarias compitiendo en el mismo grupo.

### Badge

Tonos: `success`, `warning`, `danger`, `info`, `neutral`.

Un badge debe incluir texto. El color nunca debe ser la única forma de transmitir el estado.

### Field

Agrupa label, control, ayuda y error. Todo formulario nuevo debe mostrar etiquetas persistentes. El placeholder puede complementar, pero no reemplazar el label.

### Alert

Para mensajes de estado globales del módulo. Los errores críticos usan `role="alert"`; los mensajes informativos o de éxito usan un estado no intrusivo.

### Card

Contenedor visual neutral. No convertir todas las secciones en tarjetas: usarlo cuando exista un agrupamiento conceptual claro.

### StatCard

Indicador compacto para dashboard o resumen de módulo. Máximo recomendado: 4–8 métricas según contexto y tamaño de pantalla.

### PageHeader

Encabezado consistente de página: título, descripción y acciones primarias.

### SectionHeader

Encabezado interno de paneles o bloques de información.

### TableFrame

Región navegable que contiene tablas anchas y permite scroll horizontal controlado. Las tablas deben tener caption accesible y encabezados con `scope="col"`.

### EmptyState

Estado vacío accionable. Debe explicar qué ocurre y, cuando corresponde, ofrecer la siguiente acción útil.

### Skeleton

Carga visual no textual. Debe acompañarse de un estado `aria-busy` en el contenedor relevante.

### ConfirmDialog

Confirmación modal para acciones destructivas o de impacto. Usa `dialog` nativo como fallback sin dependencias externas, con título y descripción accesibles. Las decisiones de seguridad siguen siendo validadas en backend.

## Estrategia Radix / shadcn

La arquitectura adopta el principio de shadcn: componentes de aplicación controlados por el proyecto y estilizados con identidad propia, en lugar de una librería visual cerrada.

Radix Primitives se incorporará únicamente para patrones interactivos que se benefician de primitivas especializadas —por ejemplo menús, tooltips, popovers y selectores avanzados— y siempre con `package.json` y `package-lock.json` actualizados de forma atómica para preservar `npm ci` en CI.

No se incorpora Tailwind como requisito global. El proyecto ya dispone de una base CSS propia y el Design System debe poder evolucionar sin reescribir todas las pantallas por una dependencia estética.

## Convenciones de formularios

- Todos los controles tienen label visible.
- Los errores se asocian con `aria-describedby`.
- Los campos inválidos usan `aria-invalid`.
- Las acciones muestran estado de carga y deshabilitan dobles envíos cuando corresponde.
- Las acciones destructivas requieren confirmación explícita.
- No introducir reglas de negocio solo en frontend.

## Convenciones de tablas y listados

- Desktop: tabla cuando la comparación entre filas sea importante.
- Mobile: representación compacta equivalente si la tabla deja de ser usable.
- El buscador debe filtrar por los campos más reconocibles para el usuario.
- Los filtros deben poder limpiarse rápidamente.
- El recuento de resultados debe indicar el alcance actual.
- Acciones destructivas visualmente separadas de las acciones normales.

## Accesibilidad

Objetivo: WCAG 2.2 AA.

Requisitos mínimos del Design System:

- foco visible;
- navegación completa por teclado;
- controles con nombre accesible;
- etiquetas visibles en formularios;
- contraste suficiente;
- no depender solo del color;
- targets táctiles cómodos;
- soporte de zoom y reflow;
- `prefers-reduced-motion`;
- tablas semánticas;
- estados de error, éxito, carga y vacío;
- enlace “Saltar al contenido principal” en el AppShell.

## Regla para nuevos módulos

Antes de crear CSS o JSX específico, revisar si el patrón puede resolverse con los componentes de `components/ui`. El CSS de página debe describir composición y necesidades particulares del módulo, no reimplementar botones, inputs, badges, cards o estados globales.

## Cobertura actual del rediseño

### Bloque A — Base institucional

- Login.
- AppShell y navegación por rol.
- Dashboard.
- Activos.
- Design tokens y kit reusable de componentes.

### Bloque B — Operación de inventario

- Insumos.
- Stock por oficina.
- Consumo de oficina.
- Historial de movimientos de stock.
- Adjuntos.

### Bloque C — Flujos administrativos

- Solicitudes.
- Pedido mensual de insumos.
- Historial de pedidos y provisión.
- Notificaciones.
- Reporte general de pedidos.
- Reporte mensual de consumo por oficina.

Los bloques de UX/UI no modifican las reglas de autorización del backend ni la rama `security/hardening`. La adopción del encabezado opcional `Idempotency-Key` en operaciones críticas queda reservada para una integración coordinada posterior con el hardening P6.

## Validación requerida por bloque

Todo bloque de frontend debe cerrar con:

```bash
npm --prefix inventario-frontend ci
npm --prefix inventario-frontend run lint
npm --prefix inventario-frontend run build
```

Antes de integrar a `main`, ejecutar también el quality gate completo y los E2E críticos del repositorio. Cualquier cambio en dependencias debe incluir el lockfile correspondiente.
