# Design System y arquitectura frontend — Inventario Judicial

Este documento define la base visual, de interacción y de continuidad del frontend del Sistema de Inventario Judicial.

Estado de referencia al 11/09/2026:
- Bloques A–E: completos.
- PR #11: mergeado a `main`.
- HEAD UX final previo al merge: `fa6941b830fbcb621b6342ce878c6f2e7a89dd54`.
- Merge commit: `0cb1f5285ca150b41bc17859eb10f607c784f6cc`.
- Quality Gate pre-merge: #140, verde.

La evolución posterior del frontend debe preservar esta base y coordinar cualquier cambio de autenticación con `docs/backend-security-architecture.md`.

## Principios

1. **Claridad operativa antes que decoración.**
2. **Institucional, no burocrático.**
3. **Densidad controlada.** Tablas para comparar registros; tarjetas para resúmenes, estados y acciones claras.
4. **Permisos comprensibles.** La UI refleja capacidades, pero la autorización real siempre vive en backend.
5. **Accesibilidad desde el componente.** Etiquetas, foco, teclado, semántica y contraste se resuelven en patrones reutilizables.
6. **Responsive sin pérdida de información.**
7. **Una sola gramática visual.** No reimplementar botones, badges, formularios o estados si ya existe un componente equivalente.
8. **Cambios visuales aislados de reglas de negocio.** Un refresh de UI no debe alterar endpoints, roles, permisos o contratos de seguridad.

## Identidad visual actual

El lenguaje visual final toma referencias de dashboards modernos tipo Admina, pero la implementación es propia.

- Tipografía: Inter local, con fallback de sistema.
- Fondo de aplicación: gris/lila muy claro.
- Superficies principales: blanco.
- Acento principal del refresh: índigo institucional (`#5b52e8` como referencia visual).
- Colores semánticos: verde, ámbar, rojo y azul reservados para estados.
- Bordes: suaves pero suficientemente perceptibles, especialmente en inputs/selects.
- Sombras: cortas y discretas.
- Radios: moderados, evitando estética excesivamente redondeada.
- Movimiento: corto, funcional y respetando `prefers-reduced-motion`.
- Contraste objetivo: WCAG 2.2 AA.

Los valores efectivos viven en las hojas CSS del frontend; este documento describe la intención de diseño.

## Arquitectura de estilos

Capas principales:

- `src/styles/design-system.css`: tokens y primitives globales.
- `src/styles/ui-kit.css`: componentes UI reutilizables.
- `src/styles/app-shell.css`: shell, sidebar y topbar.
- `src/styles/dashboard.css`: dashboard.
- `src/styles/assets.css`: activos.
- `src/styles/operations.css`: módulos operativos.
- `src/styles/admin-flows.css`: solicitudes, pedidos, notificaciones y reportes.
- `src/styles/administration.css`: usuarios y bitácora.
- `src/styles/attachments-panel.css`: paneles de adjuntos.
- `src/styles/admina-refresh.css`: refresh visual de shell/primitives/Dashboard/Activos.
- `src/styles/admina-modules.css`: propagación del refresh al resto de módulos.
- `src/styles/admina-premerge-fixes.css`: aislamiento de colisiones CSS y ajustes finales de contraste.

### Regla importante de aislamiento

`admin-flows.css` y `administration.css` comparten históricamente nombres como `.admin-card`, `.admin-toolbar`, `.admin-form` y `.admin-description`. La capa `admina-premerge-fixes.css` delimita esos contextos para impedir contaminación visual entre Solicitudes y Usuarios/Bitácora.

No eliminar esa capa sin revisar primero las colisiones de selectores.

## Componentes base

Los componentes reutilizables se centralizan en `src/components/ui/index.jsx`.

### Button
Variantes: `primary`, `secondary`, `ghost`, `danger`.

Usar una sola acción primaria dominante por región cuando sea posible.

### Badge
Tonos: `success`, `warning`, `danger`, `info`, `neutral`.

El color nunca debe ser la única señal de estado.

### Card
Contenedor visual neutral para agrupamientos conceptuales claros.

### StatCard
Resumen compacto para Dashboard o cabeceras de módulo.

### PageHeader / SectionHeader
Jerarquía consistente de título, descripción y acciones.

### Field
Agrupa label, control, ayuda y error. El placeholder no reemplaza el label.

### Alert
Mensajes de error, advertencia, éxito e información con semántica accesible.

### EmptyState
Estado vacío accionable y explicativo.

### Skeleton
Indicador de carga acompañado por estado `aria-busy` en el contenedor relevante.

### TableFrame
Región navegable para tablas anchas con scroll horizontal controlado.

### ConfirmDialog
Confirmación accesible para acciones destructivas/de impacto mediante `dialog` nativo.

### Dialog
Diálogo reutilizable para formularios administrativos, incluido reset de contraseña.

## AppShell y navegación

- Sidebar responsive para desktop/mobile.
- Navegación condicionada por rol.
- Opción activa visualmente destacada.
- Persistencia de scroll del sidebar durante la sesión.
- Persistencia de estado colapsado/expandido.
- El enlace activo se mantiene visible después de navegar.
- Limpieza del estado al cerrar sesión.
- E2E específico para evitar regresión de la navegación lateral.
- Enlace “Saltar al contenido principal”.

## Formularios

- Label visible en todos los controles.
- Errores asociados mediante `aria-describedby` cuando corresponde.
- `aria-invalid` en campos inválidos.
- Estado loading/busy para evitar dobles envíos.
- Acciones destructivas con confirmación explícita.
- Validaciones frontend no sustituyen reglas del backend.
- Contraseñas respetan la política definida por backend.

## Tablas y listados

- Desktop: tabla cuando la comparación entre filas sea relevante.
- Mobile: scroll o representación equivalente; nunca ocultar información sin alternativa.
- Cabeceras semánticas.
- Recuento de resultados y filtros claros.
- Estados loading/error/empty/retry.
- Acciones sensibles separadas visualmente de acciones normales.

## Accesibilidad

Objetivo: WCAG 2.2 AA.

Requisitos mínimos:
- foco visible;
- navegación completa por teclado;
- controles con nombre accesible;
- labels persistentes;
- contraste suficiente para texto normal y secundario;
- no depender solo del color;
- targets táctiles razonables;
- zoom/reflow;
- `prefers-reduced-motion`;
- tablas semánticas;
- mensajes de error/éxito/carga/vacío;
- diálogos con título y descripción accesibles.

## Cobertura del rediseño

### Bloque A — Base institucional ✅
- Login.
- AppShell y navegación por rol.
- Dashboard.
- Activos.
- Design tokens y kit reutilizable.

### Bloque B — Operación de inventario ✅
- Insumos.
- Stock por oficina.
- Consumo de oficina.
- Movimientos de stock.
- Adjuntos.

### Bloque C — Flujos administrativos ✅
- Solicitudes.
- Pedido mensual de insumos.
- Historial de pedidos y provisión.
- Notificaciones.
- Reporte general de pedidos.
- Reporte mensual de consumo por oficina.

### Bloque D — Administración y cierre UX ✅
- Usuarios.
- Bitácora.
- Formulario de alta/edición moderno.
- Reset de contraseña mediante diálogo propio.
- Estados loading/error/empty/retry.
- Revisión responsive.
- Paneles embebidos de adjuntos migrados al Design System.
- Persistencia de scroll/selección del sidebar.
- Correcciones de accesibilidad y consistencia.

### Bloque E — Refresh visual inspirado en Admina ✅
- Refresh de AppShell, Dashboard y Activos como piloto.
- Propagación posterior a todos los módulos autenticados.
- Sidebar claro y acento índigo.
- Botones/inputs/badges/tablas refinados.
- KPI/cards con jerarquía y microanimaciones suaves.
- Contraste AA reforzado.
- Aislamiento de colisiones CSS pre-merge.
- Sin Tailwind y sin dependencias visuales nuevas.

## Decisiones deliberadas / deuda controlada

Se mantienen temporalmente algunos diálogos nativos en flujos críticos ya estabilizados por E2E:
- asignación de stock;
- registro de consumo;
- alertas del flujo de provisión/estado de pedidos.

No reescribir estos flujos dentro de un cambio visual menor. Deben tratarse como una tarea futura coordinada y con regresión completa.

La adopción frontend explícita de `Idempotency-Key` también queda diferida hasta después de estabilizar P6.1 y su contrato final de autenticación/transporte.

## Integración con P6.1

El frontend de `main` todavía debe recibir la capa final de seguridad pre-staging mediante PR #13:
- sesión por cookie `HttpOnly` en producción;
- `/auth/me` como autoridad de sesión;
- eliminación del JWT de `localStorage`;
- UI de MFA/TOTP para `ADMIN`;
- códigos de recuperación.

Esa integración debe partir del `main` que ya contiene PR #11 y volver a pasar todo el Quality Gate. Ver `docs/backend-security-architecture.md`.

## Validación requerida

Todo bloque frontend debe cerrar como mínimo con:

```bash
npm --prefix inventario-frontend ci
npm --prefix inventario-frontend run lint
npm --prefix inventario-frontend run build
```

Antes de integrar a `main`, ejecutar además el Quality Gate completo y E2E críticos. Cualquier cambio en dependencias debe incluir `package.json` y `package-lock.json` de forma atómica.

## Regla para futuros módulos

Antes de crear CSS o JSX específico:
1. revisar `components/ui`;
2. revisar patrones de módulos equivalentes;
3. evitar selectores genéricos que puedan colisionar globalmente;
4. no introducir reglas de autorización solo en frontend;
5. actualizar este documento si cambia una convención global.
