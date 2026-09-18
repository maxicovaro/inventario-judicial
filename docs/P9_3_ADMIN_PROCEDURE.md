# P9.3 — Procedimiento operativo de administración

## Estado

P9.3 se abre el 18/09/2026 después del cierre formal de P9.2 y de releer `ROADMAP.md` desde `main@a8a6000fea72decf51d9302557e4e22b58ac4814`. Tras adoptar la metodología repo-first en PR #45, el bloque fue reconstruido y realineado contra `main@3b1a6b52edd36314c488ec1cb758f0fa6d014b95` antes de su cierre.

El objetivo de este bloque es convertir las capacidades ya validadas del sistema en un procedimiento operativo único para el piloto. No crea atajos administrativos ni reemplaza autorización, MFA, bitácora, transacciones, idempotencia, backups o runbooks de incidentes.

## 1. Principios obligatorios

1. Cada empleado usa su propia cuenta. No se comparten usuarios.
2. Dirección administra usuarios y Bitácora global.
3. Un `RESPONSABLE` gestiona únicamente su oficina fuera de los módulos específicos para los que tenga una capacidad explícita.
4. Un `RESPONSABLE` de una oficina con `gestiona_deposito=true` puede operar Depósito Central, pero no se convierte en `ADMIN`.
5. Las altas, cambios, bajas, movimientos y entregas se realizan desde la aplicación; no mediante SQL manual ni edición directa de tablas.
6. Las bajas son lógicas/formales y deben conservar historial.
7. Una operación de stock debe ejecutarse una sola vez desde el flujo que corresponda; no compensar errores con movimientos duplicados improvisados.
8. Antes de migraciones, despliegues o cambios de infraestructura se crea y verifica backup conforme a `OPERATIONS.md` y `STAGING.md`.
9. Nunca registrar en Git contraseñas, TOTP, recovery codes, cookies, JWT, dumps reales o datos personales innecesarios.
10. Ante una condición de stop se aplica P9.1 y se preserva evidencia antes de continuar.

## 2. Matriz operativa mínima

| Operación | ADMIN Dirección | RESPONSABLE oficina | RESPONSABLE Contable con depósito | USUARIO |
| --- | --- | --- | --- | --- |
| Usuarios / Bitácora global | Sí | No | No | No |
| Ver activos | Global | Propia oficina | Propia oficina + módulo depósito | Propia oficina |
| Crear/editar activos | Global | Propia oficina | Propia oficina + módulo depósito | No |
| Dar de baja activo | Sí | No | No | No |
| Ver stock de oficina | Global | Propia oficina | Propia oficina + depósito | Propia oficina |
| Asignación global de stock | Sí | No | Módulo Depósito únicamente | No |
| Operar Depósito Central | Sí | No | Sí | No |
| Crear solicitud/pedido | Según alcance | Según alcance | Según alcance | Según alcance |
| Aprobar/provisionar desde Depósito | Sí | No | Sí | No |
| Adjuntos | Según alcance del objeto | Según alcance | Según alcance | Según alcance |

La autorización efectiva siempre la decide backend. Que un botón no aparezca en la interfaz no reemplaza el control de permisos.

## 3. Inicio de jornada

Antes de realizar operaciones sensibles:

1. confirmar que se está usando el entorno correcto;
2. verificar que la sesión corresponde a la persona que operará;
3. si se trabaja como ADMIN, completar MFA cuando corresponda;
4. comprobar que no exista un incidente abierto que exija detener escrituras;
5. si hay despliegue/migración planificada, seguir el checklist de `OPERATIONS.md` antes de modificar datos.

Para una revisión técnica de salud:
- `GET /health/live` debe responder 200;
- `GET /health/ready` debe responder 200;
- la revisión reportada debe coincidir con la esperada cuando `DEPLOY_REVISION` está definida.

## 4. Gestión de usuarios — Dirección

Ruta funcional: **Administración → Usuarios**.

### Alta

1. confirmar aprobación institucional;
2. seleccionar rol mínimo necesario;
3. asignar oficina correcta;
4. no crear `ADMIN` fuera de Dirección;
5. definir contraseña inicial conforme a la política vigente;
6. transmitirla por canal institucional seguro;
7. verificar primer acceso y rol/oficina;
8. comprobar Bitácora.

No crear usuarios con SQL ni scripts paralelos cuando el sistema está operativo.

### Edición

Usar únicamente para corregir datos, rol u oficina autorizados. Un cambio de rol/oficina debe tratarse como cambio de privilegios y verificarse después con una nueva sesión.

### Desactivación

Es el mecanismo normal de retiro/rollback:
1. confirmar que no exista una operación en curso;
2. desactivar desde Usuarios;
3. comprobar revocación de sesiones;
4. verificar que no pueda volver a autenticarse;
5. conservar historial y Bitácora.

No borrar usuarios para “limpiar” la base.

### Reactivación

1. confirmar que la persona sigue autorizada;
2. reactivar la misma cuenta;
3. comprobar Bitácora;
4. iniciar sesión nuevamente;
5. verificar rol y oficina.

### Desbloqueo y reset de contraseña

- Desbloquear solo después de validar que el bloqueo corresponde a intentos fallidos legítimos.
- Resetear contraseña únicamente desde Gestión de Usuarios.
- Un reset revoca sesiones vigentes; el usuario debe autenticar otra vez.
- No enviar la contraseña nueva por canales no autorizados.

## 5. Bienes patrimoniales

### Alta ordinaria en una oficina

- ADMIN puede operar globalmente.
- RESPONSABLE puede crear/editar solo dentro de su oficina.
- Código interno, si existe, debe ser único.
- No usar estado `Dado de baja` durante creación/edición: la baja tiene una acción formal separada.
- Toda alta genera movimiento y trazabilidad.

### Alta en Depósito Central

Para bienes aún no asignados:
1. ingresar desde **Depósito Central → Bienes en depósito**;
2. la ubicación se determina automáticamente como Depósito Central;
3. registrar datos patrimoniales verificables;
4. no asignarlo a una oficina final hasta que exista entrega real.

### Traslado

- Desde Depósito Central usar la acción **Entregar** y seleccionar la oficina destino.
- Fuera de Depósito, un traslado global corresponde a Dirección.
- El cambio debe generar movimiento `TRASLADO`.
- Confirmar que el bien desaparece del origen y aparece en el destino.

### Baja

Solo Dirección puede dar de baja un activo.

Antes de confirmar:
1. verificar identificación del bien;
2. confirmar motivo/documentación correspondiente;
3. comprobar que no se trate de un simple traslado o reparación;
4. ejecutar la baja formal;
5. verificar que quede estado `Dado de baja`, `activo=false` y movimiento de baja.

No eliminar físicamente el registro para representar una baja.

## 6. Insumos y stock

### Stock central

El stock institucional central se administra desde Dirección o desde el módulo Depósito Central según el rol/capacidad.

Reglas:
- un insumo nuevo de Depósito Central nace con stock 0;
- la entrada física se registra como `INGRESO`;
- `DEVOLUCION` suma stock devuelto;
- `AJUSTE` fija la existencia real y exige una justificación;
- no usar `AJUSTE` para ocultar una entrega o un error operativo sin investigar.

### Distribución a oficinas

La entrega debe:
1. identificar oficina destino;
2. identificar insumo;
3. indicar cantidad entera positiva;
4. registrar motivo cuando aporte contexto;
5. descontar stock central;
6. acreditar la misma cantidad en `StockOficina`;
7. generar movimiento con autor.

Después de entregar, verificar ambos extremos. Una oficina normal no puede consultar stock de otra oficina.

### Stock propio de Área Contable

El stock propio de Contable se consulta en **Mi oficina → Mis insumos** y permanece separado del Depósito Central.

Una entrega `Depósito -> Área Contable`:
- disminuye stock central;
- aumenta stock de Contable;
- no transforma el stock central en “stock de Contable” por el solo hecho de que Contable administre el depósito.

## 7. Movimientos de stock

La vista global de movimientos es administrativa y está reservada a Dirección.

Tipos:
- `INGRESO`: suma;
- `DEVOLUCION`: suma;
- `EGRESO`: resta y exige destino cuando corresponde;
- `AJUSTE`: fija la existencia real.

Antes de un movimiento manual:
1. comprobar que no exista un flujo específico más apropiado, como distribución o provisión de pedido;
2. verificar stock y oficina;
3. evitar duplicar un movimiento que ya fue generado por una entrega;
4. revisar el resultado y Bitácora.

## 8. Solicitudes y pedidos

### Solicitudes

La persona autenticada crea solicitudes dentro de su alcance. La gestión institucional se realiza por el flujo autorizado correspondiente.

No editar o eliminar evidencia para corregir una decisión administrativa ya ejecutada; ante un error, registrar el incidente/corrección de forma trazable.

### Pedidos

Reglas vigentes:
- primer pedido de oficina/período: `MENSUAL`;
- posteriores del mismo período: `COMPLEMENTARIO`;
- crear o aprobar no descuenta stock;
- un pedido no puede quedar `ENTREGADO` con provisión 0;
- el descuento ocurre al registrar provisión positiva autorizada;
- movimientos, notificaciones y bitácora deben conservar el tipo real;
- una entrega no debe ejecutarse dos veces.

Secuencia operativa:
1. oficina crea pedido;
2. Depósito revisa;
3. aprobar o rechazar;
4. si se aprueba, registrar cantidad provista;
5. entregar;
6. verificar stock central, stock destino, movimiento y auditoría.

## 9. Adjuntos

Los adjuntos deben vincularse a **un activo o una solicitud**, no a ambos.

Tipos permitidos:
- JPEG, PNG, WebP;
- PDF;
- DOC/DOCX;
- XLS/XLSX.

Límite por archivo: **10 MB**.

Reglas:
1. no subir ejecutables ni formatos no autorizados;
2. no subir archivos sin vínculo operativo;
3. confirmar que el usuario tiene acceso al activo/solicitud;
4. no usar nombres de archivo para almacenar secretos;
5. verificar descarga después de una carga importante;
6. eliminar adjuntos solo cuando corresponda y después de confirmar que no sean evidencia necesaria.

En staging/piloto, los archivos viven bajo el almacenamiento persistente configurado; un backup de base por sí solo no representa una copia completa de adjuntos.

## 10. Backups y tareas rutinarias

La autoridad técnica de backup/restore es `OPERATIONS.md`.

Mínimos:
- RPO de trabajo: hasta 24 horas;
- al menos un backup diario durante el piloto;
- backup adicional antes de migraciones, despliegues o cambios de infraestructura;
- verificar SHA-256;
- conservar copia fuera del host cuando los datos deban preservarse;
- restaurar primero en base alternativa;
- simulacro de restore periódico.

No ejecutar una restauración sobre la base activa como primera opción.

## 11. Revisión diaria sugerida

Al inicio o cierre de jornada administrativa:
- revisar notificaciones relevantes;
- revisar stock bajo mínimo;
- comprobar que no existan usuarios que deban desactivarse;
- revisar operaciones sensibles recientes si hubo cambios de usuarios, bajas o ajustes;
- registrar incidentes si aparecen errores repetidos o inconsistencias.

No es necesario modificar datos para “dejar todo en cero”; la trazabilidad histórica debe conservarse.

## 12. Revisión semanal sugerida

- confirmar que existieron backups diarios previstos;
- verificar al menos un checksum reciente;
- revisar capacidad de almacenamiento de uploads/backups;
- revisar Bitácora para operaciones sensibles;
- revisar activos dados de baja o en mal estado pendientes de tratamiento;
- revisar stock bajo mínimo;
- confirmar que las cuentas activas siguen justificadas;
- revisar incidentes abiertos y acciones preventivas.

## 13. Condiciones de stop

Detener el flujo afectado y aplicar P9.1 ante:
- pérdida o corrupción de datos;
- stock negativo;
- doble entrega/replay incorrecto;
- acceso fuera de scope;
- un `RESPONSABLE` con privilegios globales no previstos;
- ADMIN fuera de Dirección;
- baja o traslado sin historial;
- adjunto accesible fuera de alcance;
- errores 5xx repetidos en un flujo crítico;
- backup requerido pero no verificable;
- duda sobre entorno/revisión activa.

No corregir una condición de stop debilitando auth, MFA, autorización, locks, transacciones o idempotencia.

## 14. Cierre de jornada

Antes de terminar una operación sensible:
1. confirmar el mensaje final de la aplicación;
2. verificar el estado resultante;
3. revisar movimiento/auditoría cuando aplique;
4. no dejar formularios críticos a medio confirmar;
5. cerrar sesión en equipos compartidos;
6. si hubo incidencia, registrar evidencia conforme a P9.1.

## 15. Validación de P9.3

P9.3 se considera apto para cierre cuando:
- este procedimiento cubre usuarios, bienes, stock, movimientos, solicitudes/pedidos, bajas, adjuntos, backups y tareas rutinarias;
- la matriz de roles coincide con backend;
- existe un contrato automático que protege las guardas y secciones mínimas;
- Quality Gate completo está verde;
- se realiza una revisión operativa del runbook en staging sin bypass de permisos;
- no quedan contradicciones con `OPERATIONS.md`, `STAGING.md`, P9.1 o P9.2;
- `ROADMAP.md` y este documento se actualizan con evidencia final;
- PR integrado y Gate post-merge verde.

P9.4 no se abre antes del cierre formal de P9.3.


## 16. Validación operativa real — 18/09/2026

La revisión operativa en staging fue realizada con una cuenta ADMIN de Dirección sin ejecutar acciones destructivas.

Resultado confirmado:
- **Usuarios** abre correctamente y muestra las cuentas piloto; están disponibles las acciones Editar, Desactivar/Activar, Desbloquear cuando corresponde y Resetear clave;
- **Bitácora** abre correctamente y conserva la vista administrativa global;
- **Activos** abre correctamente y el ADMIN dispone de la acción formal de baja; no se ejecutó ninguna baja durante esta revisión;
- **Stock por oficina** abre correctamente y permite seleccionar diferentes oficinas;
- **Movimientos** abre correctamente y muestra el historial de movimientos generado durante las validaciones previas;
- **Adjuntos** abre correctamente, muestra el formulario de carga y permite vincular el archivo a un activo o a una solicitud; no se cargó ningún archivo durante esta revisión.

La revisión confirma además que:
- no fue necesario modificar permisos;
- no se utilizaron atajos SQL ni cambios directos de base;
- no se debilitó autenticación, MFA, autorización, locks, transacciones o idempotencia;
- no apareció ninguna condición de stop de P9.1;
- el runbook coincide con las superficies administrativas reales observadas.

Con esta evidencia, los criterios técnico-operativos de P9.3 quedan satisfechos. El cierre formal requiere todavía Quality Gate del HEAD actualizado, integración del PR #44 y Quality Gate post-merge verde.
