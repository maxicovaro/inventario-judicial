# P9.2 — Alta controlada de oficinas y usuarios

## Estado y objetivo

P9.2 prepara la incorporación de la primera ola del piloto sin altas masivas, sin credenciales versionadas y sin crear caminos alternativos que eviten la autorización normal del sistema.

La regla central de onboarding se mantiene: **el preflight es read-only y el alta real se realiza únicamente desde el módulo administrativo** por un Administrador General autenticado. Así se conservan autorización, política de contraseñas, bitácora, revocación de sesiones y validaciones de rol/oficina ya implementadas.

Antes de seleccionar personas reales se abrió **P9.2A — Modelo operativo Depósito Central + Área Contable**. Este subbloque define cómo conviven el inventario propio de Contable y la custodia institucional del Depósito Central, incluyendo operación multiusuario y trazabilidad individual.

---

## 1. Regla institucional aprobada

### Área Contable sigue siendo una oficina común

`Área Contable` tiene sus propios recursos y consumos, igual que cualquier otra dependencia:
- PC, monitores, impresoras y otros activos;
- escritorios, sillas y mobiliario;
- papel, tóner y demás insumos asignados a su oficina;
- solicitudes, pedidos y consumos propios.

Estos elementos **no forman parte del Depósito Central** por el solo hecho de que Contable sea quien lo administra.

Cuando Contable necesita insumos del depósito, debe existir una distribución real:

```text
Depósito Central -> Área Contable
```

Cuando recibe un bien patrimonial, debe existir un traslado formal desde Depósito Central a Área Contable.

### Depósito Central es una ubicación separada

`Depósito` representa la custodia institucional previa a la distribución:
- bienes nuevos todavía no asignados;
- stock central de insumos;
- ingresos y devoluciones;
- entregas a oficinas y unidades judiciales;
- respuesta operativa a solicitudes;
- provisión de pedidos mensuales.

Esto evita que bienes o insumos institucionales pendientes de distribución aparezcan como patrimonio o consumo propio de Contable.

---

## 2. Múltiples responsables de Contable

Área Contable puede tener **más de un usuario con rol `RESPONSABLE`**.

Cada `RESPONSABLE` de una oficina con `gestiona_deposito=true` puede operar el Depósito Central. La capacidad no pertenece a una sola persona: pertenece a la función institucional de la oficina y se combina con el rol del usuario.

Un `USUARIO` común de Contable no obtiene permisos de depósito aunque pertenezca a la misma oficina.

Esto permite que varios empleados compartan las tareas de:
- recibir/cargar activos;
- registrar ingresos o devoluciones de insumos;
- controlar existencias;
- entregar activos;
- distribuir insumos;
- responder solicitudes;
- gestionar y provisionar pedidos.

Cada acción se ejecuta con la identidad autenticada del empleado que la realiza. No se comparte una cuenta genérica de depósito.

---

## 3. Modelo técnico de capacidades

La tabla `oficinas` incorpora dos atributos independientes:

```text
gestiona_deposito
es_deposito_central
```

Configuración inicial:
- `Área Contable`: `gestiona_deposito = true`;
- `Depósito`: `es_deposito_central = true`;
- demás oficinas: ambas capacidades en `false` salvo decisión institucional futura y cambio controlado.

La capacidad efectiva de depósito exige:
1. ser `RESPONSABLE` con oficina asignada y `oficina_gestiona_deposito=true`; o
2. ser Administrador General.

No se decide autorización por textos como `nombre === "Área Contable"`.

La sesión recupera las capacidades desde base de datos. Cambiar el nombre visible de una oficina no concede ni quita permisos.

El responsable de Contable **no se convierte en `ADMIN`** y no obtiene por esta función:
- administración global de usuarios;
- configuración de seguridad;
- funciones de MFA administrativo;
- Bitácora global de Dirección;
- permisos globales sobre cualquier oficina fuera de los flujos específicos de depósito.

---

## 4. Dos contextos de trabajo para Contable

### Mi oficina

El responsable usa las pantallas normales para:
- activos propios de Contable;
- stock propio de Contable;
- solicitudes propias;
- pedido mensual;
- consumo y reportes de su oficina.

Estas pantallas continúan limitadas a `Área Contable` como cualquier otro `RESPONSABLE`.

### Depósito Central

El responsable autorizado dispone de un bloque separado:

```text
/deposito-central/activos
/deposito-central/insumos
/deposito-central/solicitudes
/deposito-central/pedidos
/deposito-central/auditoria
```

API dedicada:

```text
/api/deposito/*
```

Todas estas rutas exigen autenticación y `verificarGestionDeposito`.

Este diseño evita ampliar las pantallas ordinarias de Contable para consultar o editar arbitrariamente información de otras oficinas.

---

## 5. Activos del Depósito Central

Un activo nuevo pendiente de asignación se registra directamente en la ubicación `Depósito Central` determinada por backend.

Ciclo esperado:

```text
Ingreso físico
  -> alta en Depósito Central
  -> custodia
  -> selección de oficina destino
  -> entrega/traslado
  -> inventario de la oficina receptora
```

La operación conserva:
- bloqueo transaccional donde corresponde;
- idempotencia;
- origen y destino;
- movimiento `ALTA` o `TRASLADO`;
- `usuario_id` del empleado que recibió, actualizó o entregó;
- bitácora operativa.

Dos responsables distintos pueden intervenir en etapas diferentes. Por ejemplo, un empleado puede cargar la recepción y otro realizar posteriormente la entrega; ambos quedan individualizados.

El responsable de depósito no obtiene por esto permiso general de baja patrimonial.

---

## 6. Insumos y stock central

`Insumo.stock_actual` representa la existencia central disponible para distribución.

Un insumo nuevo se crea con **stock inicial 0**. La entrada física posterior debe registrarse mediante:
- `INGRESO`;
- `DEVOLUCION`; o
- `AJUSTE` cuando exista regularización explícita.

No se permite crear una referencia con stock inicial positivo porque produciría existencia sin movimiento trazable.

Las entregas a oficinas se realizan mediante la operación de distribución, que dentro de una transacción:
1. bloquea stock central;
2. valida disponibilidad;
3. descuenta existencia central;
4. crea o bloquea `StockOficina`;
5. acredita la oficina receptora;
6. registra `MovimientoStock`;
7. conserva `usuario_id` del empleado que realizó la entrega;
8. mantiene las garantías de concurrencia e idempotencia de P6.

Esto también aplica cuando el destino es la propia Área Contable.

---

## 7. Solicitudes y pedidos

### Solicitudes

Los responsables de depósito pueden:
- visualizar solicitudes institucionales;
- registrar respuesta;
- aprobar, rechazar, poner en proceso o finalizar según el flujo;
- notificar al solicitante.

La acción queda asociada al usuario concreto que la realizó.

No se les concede facultad genérica para borrar evidencia o administrar usuarios.

### Pedidos mensuales

Los responsables pueden:
- visualizar pedidos;
- ponerlos en revisión;
- aprobar o rechazar según la máquina de estados;
- registrar cantidades provistas;
- concretar la entrega.

Solo un pedido previamente `APROBADO` puede mover stock real. La provisión reutiliza la lógica transaccional existente, descuenta stock central y acredita stock de oficina en la misma operación.

La aprobación y la entrega pueden ser realizadas por responsables diferentes, quedando cada etapa atribuida a su autor.

---

## 8. Auditoría operativa de Depósito Central

Además de la Bitácora global reservada a Dirección, los responsables habilitados disponen de una vista **Auditoría operativa** limitada al Depósito Central.

La auditoría muestra, según el registro disponible:
- fecha y hora;
- empleado que realizó la acción;
- oficina del empleado;
- acción;
- módulo;
- detalle operativo.

Incluye acciones relevantes como:
- alta y edición de activos en depósito;
- entrega/traslado de activos;
- ingresos, devoluciones y ajustes de stock;
- asignación de stock a oficinas;
- respuestas a solicitudes;
- cambios de estado y provisión de pedidos.

Esta vista permite resolver responsabilidades internas sin entregar a Contable acceso a la Bitácora global de administración.

---

## 9. Seguridad y aislamiento

P9.2A mantiene las siguientes guardas:
- un `RESPONSABLE` de Informática u otra oficina común no puede administrar depósito;
- un `USUARIO` de Contable no puede administrar depósito;
- Contable no administra usuarios por gestionar depósito;
- las pantallas normales de Contable siguen limitadas a su propia oficina;
- la gestión central se realiza solo a través de `/api/deposito/*`;
- no se decide permiso por el nombre visible de la oficina;
- no se eliminan MFA, locks, idempotencia ni controles de autorización.

---

## 10. Primera ola funcional

La primera ola prevista para P9.2B es:

```text
Dirección
  -> supervisión y administración

Área Contable
  -> uno o más RESPONSABLE
  -> gestión del Depósito Central
  -> inventario propio separado

Área Informática
  -> primera oficina receptora ordinaria
```

Con estas dos oficinas se puede validar:

```text
Ingreso
  -> Depósito
  -> Solicitud/Pedido
  -> Gestión Contable
  -> Entrega
  -> Informática
  -> Stock/Activo de oficina
  -> Auditoría y trazabilidad
```

También se prueba expresamente:

```text
Depósito -> Área Contable
```

sin mezclar depósito con consumo propio.

La selección de personas reales continúa pendiente y no forma parte de P9.2A.

---

## 11. Manifiesto privado de primera ola

La selección real de P9.2B se guarda fuera de Git, por ejemplo:

```text
pilot/wave-1.private.json
```

Roles admitidos por onboarding:
- `RESPONSABLE`;
- `USUARIO`.

`ADMIN` está prohibido en el manifiesto para impedir elevación de privilegios.

**No incluir contraseñas**, TOTP, recovery codes, JWT, cookies, secretos ni credenciales de base de datos.

El preflight se ejecuta con:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode plan
```

Es read-only y valida oficinas, roles, administradores centrales, MFA en staging, emails existentes y coherencia del manifiesto.

---

## 12. Alta real y verificación

Antes del alta deben quedar aprobados:
1. personas seleccionadas;
2. rol;
3. oficina;
4. responsable institucional de la aprobación;
5. fecha y motivo;
6. canal seguro para credenciales iniciales.

El **alta real se realiza únicamente desde el módulo administrativo** de Gestión de Usuarios por un Administrador General.

No se cargan usuarios con SQL, `INSERT`, edición manual de tablas o scripts de provisión paralelos.

Después del alta:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode verify
```

`verify` comprueba en modo read-only existencia, actividad, rol, oficina y MFA administrativo correspondiente.

---

## 13. Rollback operativo

El **rollback operativo** preferido es desactivar usuarios, no borrarlos.

Ante error, retiro o incidente:
1. Dirección desactiva el usuario;
2. se revocan sus sesiones;
3. se verifica que no pueda operar;
4. se conserva historial y bitácora;
5. se actualiza el manifiesto privado si cambia la ola;
6. se repite `verify`.

Un cambio futuro de oficina gestora del depósito debe realizarse mediante cambio versionado/controlado, nunca renombrando una oficina para obtener permisos.

---

## 14. Pruebas de P9.2A

La suite incorpora contratos estáticos y prueba real sobre MySQL.

Se valida al menos que:
- existan `gestiona_deposito` y `es_deposito_central`;
- autorización backend/frontend no dependa de nombres;
- rutas de depósito exijan el guard específico;
- existan pantallas separadas y Auditoría operativa;
- el stock inicial de un insumo nuevo sea 0;
- dos `RESPONSABLE` distintos de Contable puedan operar depósito;
- un `USUARIO` de Contable no pueda hacerlo;
- Informática no pueda hacerlo;
- Contable no pueda administrar usuarios;
- recepción y entrega patrimonial puedan tener autores distintos;
- recepción y distribución de stock puedan tener autores distintos;
- solicitudes y pedidos registren al empleado interviniente;
- stock central y stock de oficina mantengan consistencia.

Scripts:

```text
test:p9-deposito-contracts
test:p9-deposito-integration
```

Ambos forman parte del Quality Gate correspondiente.

---

## 15. Condiciones de stop

Detener la incorporación de usuarios reales si ocurre cualquiera de estos casos:
- una oficina no autorizada accede al depósito;
- un usuario común de Contable obtiene permisos de responsable;
- Contable obtiene administración global por gestionar depósito;
- bienes/stock propios de Contable se mezclan con existencias centrales;
- una entrega o recepción no identifica al empleado que la realizó;
- una operación crítica no queda auditada;
- aparece stock negativo, doble entrega o replay incorrecto;
- un `ADMIN` aparece fuera de oficina central;
- un administrador de staging no tiene MFA;
- existen errores repetidos de auth/MFA/permisos;
- existe duda sobre el entorno activo.

Aplicar `P9_1_INCIDENT_RESPONSE.md` cuando corresponda.

---

## 16. Estado de cierre

### P9.2A — Depósito Central + Área Contable

Implementación funcional completada en `ops/p9-controlled-onboarding`:
- separación Contable/Depósito;
- capacidades persistidas de oficina;
- gestión multiusuario para responsables de Contable;
- trazabilidad individual por `usuario_id`;
- auditoría operativa visible para responsables;
- bienes, insumos, solicitudes y pedidos bajo rutas dedicadas;
- stock inicial trazable;
- contratos y prueba MySQL multiusuario.

El cierre formal de P9.2A exige Quality Gate completo verde, integración del PR y Gate post-merge verde.

### P9.2B — Primera ola Contable + Informática

Queda como siguiente paso de P9.2:
- seleccionar personas reales;
- crear manifiesto privado;
- registrar aprobación;
- ejecutar `plan` en staging;
- realizar altas solo desde Gestión de Usuarios;
- ejecutar `verify`;
- validar login, permisos, auditoría y rollback controlado.

P9.2 permanece abierto hasta completar P9.2B. P9.3 no se inicia antes del cierre formal de P9.2.
