# Hoja de ruta técnica — Inventario Judicial

Este documento es la fuente de continuidad del proyecto. Cada bloque se trabaja en rama propia, con commits lógicos, PR, revisión completa, Quality Gate y validación local cuando involucra la base de datos o el entorno de ejecución.

## Estado consolidado

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
- P1.5 CI obligatorio mediante Quality Gate y protección de `main`.
- P1.6 Auditoría y actualización segura de dependencias.

### P2 — Autorización por alcance e historial de activos ✅
- P2.1 Administrador General definido por `oficina.es_central`.
- P2.2 `RESPONSABLE` limitado a la gestión de su propia oficina.
- P2.3 Historial transaccional de altas, traslados, cambios de estado y bajas.

### P3 — Resiliencia operativa y recuperación 🚧
- P3.0 Documentación formal de hoja de ruta.
- P3.1 Backup, verificación y restauración MySQL.
- P3.2 Health checks, logging estructurado y apagado controlado.
- P3.3 Runbook de recuperación e incidentes.

## Próximos bloques

### P4 — Pruebas de integración con base real de test
- Flujos completos de usuarios, activos, stock, pedidos y movimientos.
- Casos negativos de autorización por rol/oficina.
- Datos de prueba reproducibles y aislados.

### P5 — Protección contra regresiones y E2E
- Recorridos críticos desde el navegador.
- Login, gestión de activos, solicitudes, provisión, reportes y adjuntos.
- Validación de regresiones en autenticación, permisos y suspensión.

### P6 — Consistencia y concurrencia
- Operaciones simultáneas de stock y pedidos.
- Idempotencia de acciones sensibles.
- Bloqueos/transacciones donde corresponda.

### P7 — Despliegue controlado
- Entorno de staging separado.
- Variables/secretos por ambiente.
- Procedimiento de deploy y rollback.
- Verificación post-deploy.

### P8 — Escalabilidad y rendimiento
- Medición de consultas y endpoints críticos.
- Índices y paginación.
- Límites de carga, uploads y reportes.
- Pruebas de carga apropiadas al piloto.

### P9 — Operación de piloto
- Soporte, moderación e incident response.
- Alta controlada de oficinas/usuarios.
- Indicadores de uso, errores y tiempos de respuesta.

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
10. Si se abre un bloque nuevo, este documento debe conservar el punto exacto de continuidad.
