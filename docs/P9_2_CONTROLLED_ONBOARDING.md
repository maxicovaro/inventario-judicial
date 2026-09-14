# P9.2 — Alta controlada de oficinas y usuarios

## Estado y objetivo

P9.2 prepara la incorporación de la primera ola del piloto sin altas masivas, sin credenciales versionadas y sin crear caminos alternativos que eviten la autorización normal del sistema.

La regla central de onboarding se mantiene: **el preflight es read-only y el alta real de usuarios se realiza únicamente desde el módulo administrativo** por un Administrador General autenticado. Así se conservan autorización, política de contraseñas, bitácora, revocación de sesiones y validaciones de rol/oficina ya implementadas.

Antes de seleccionar personas reales se abrió **P9.2A — Modelo operativo Depósito Central + Área Contable**, porque la operatoria institucional requiere distinguir con precisión la oficina Contable de los bienes e insumos que custodia para toda Policía Judicial.

---

## 1. P9.2A — Regla institucional aprobada

### Área Contable como oficina

`Área Contable` es una oficina ordinaria a efectos de inventario. Tiene y consume sus propios recursos:
- PC, monitores, impresoras y otros activos;
- escritorios, sillas y mobiliario;
- papel, tóner y otros insumos asignados a la oficina;
- solicitudes, pedidos y consumos propios.

Esos elementos **no forman parte del Depósito Central** por el solo hecho de que Contable sea quien lo administra.

Cuando Contable recibe papel u otro insumo para su propio consumo, debe existir una distribución real:

```text
Depósito Central -> Área Contable
```

Del mismo modo, un bien pasa a formar parte del inventario propio de Contable únicamente cuando sale formalmente del depósito y se registra su traslado.

### Depósito Central como ubicación separada

`Depósito` representa la custodia institucional previa a la distribución:
- bienes nuevos todavía no asignados a una dependencia;
- stock central de insumos;
- ingresos y devoluciones;
- entregas a oficinas y unidades judiciales;
- respuesta operativa a solicitudes;
- provisión de pedidos mensuales.

La separación evita que mercadería institucional pendiente de distribución aparezca como patrimonio o consumo propio de Contable.

### Responsable de Contable

El `RESPONSABLE` de `Área Contable` mantiene sus permisos normales sobre su oficina y recibe además una **capacidad explícita de gestión de depósito**.

No se lo convierte en `ADMIN` y, por lo tanto, no obtiene:
- administración global de usuarios;
- configuración de seguridad;
- funciones de MFA administrativo;
- acceso general a bitácora como administrador;
- autoridad global sobre cualquier dato por el solo hecho de gestionar depósito.

La autorización se basa en atributos persistidos de oficina, no en comparar textos como `nombre === "Área Contable"`.

---

## 2. Modelo técnico de capacidades

La tabla `oficinas` incorpora dos atributos independientes:

```text
gestiona_deposito
es_deposito_central
```

Configuración inicial:
- `Área Contable`: `gestiona_deposito = true`;
- `Depósito`: `es_deposito_central = true`;
- demás oficinas: ambas capacidades en `false`, salvo modificación institucional futura mediante migración/proceso controlado.

La capacidad efectiva requiere simultáneamente:
1. rol `RESPONSABLE` con oficina asignada y `oficina_gestiona_deposito=true`; o
2. ser Administrador General.

Un `USUARIO` de Contable no recibe automáticamente gestión del depósito.

La sesión recupera estas capacidades desde base de datos en cada verificación autenticada. Cambiar el nombre visible de una oficina no cambia permisos.

---

## 3. Separación de superficies de trabajo

El responsable de Contable trabaja con dos contextos explícitos.

### Mi oficina

Usa las pantallas normales del sistema:
- Mis activos;
- Mis insumos;
- Solicitudes propias;
- Pedido mensual;
- Consumo mensual;
- reportes de su oficina.

El alcance continúa limitado a `Área Contable` como cualquier otro `RESPONSABLE`.

### Depósito Central

Usa rutas dedicadas protegidas por capacidad:

```text
/deposito-central/activos
/deposito-central/insumos
/deposito-central/solicitudes
/deposito-central/pedidos
```

API dedicada:

```text
/api/deposito/*
```

El guard de estas rutas exige autenticación y `verificarGestionDeposito`.

Este diseño evita ampliar las pantallas normales de Contable para que vean arbitrariamente datos de otras oficinas.

---

## 4. Operatoria de activos del Depósito Central

Un activo nuevo pendiente de asignación se registra con ubicación `Depósito Central` determinada por el backend.

El usuario no puede elegir otra oficina durante el alta de depósito ni convertir esa acción en una baja.

Ciclo esperado:

```text
Ingreso físico
    -> alta en Depósito Central
    -> custodia
    -> selección de oficina destino
    -> entrega/traslado
    -> activo asignado a la oficina destino
```

La entrega:
- bloquea el registro durante la operación;
- utiliza idempotencia donde corresponde;
- cambia la oficina del activo;
- registra un movimiento `TRASLADO` con origen y destino;
- registra bitácora.

Después de la entrega, el bien deja de aparecer como existencia del depósito y pasa al inventario de la oficina receptora.

El responsable de Contable no obtiene por esto permiso de baja formal global. La baja continúa bajo el procedimiento administrativo existente.

---

## 5. Operatoria de insumos y stock central

`Insumo.stock_actual` continúa representando la existencia central disponible para distribución.

Un insumo nuevo se crea con **stock inicial 0**. Toda entrada física posterior debe registrarse como:
- `INGRESO`;
- `DEVOLUCION`; o
- `AJUSTE` cuando exista una regularización explícita.

No se admite crear una referencia con stock inicial positivo, porque eso produciría existencia sin movimiento trazable.

Las entregas a oficinas no usan un `EGRESO` manual. Se realizan mediante la operación de distribución existente, que dentro de una transacción:
1. bloquea el stock central;
2. valida disponibilidad;
3. descuenta la cantidad central;
4. crea o bloquea `StockOficina` del destino;
5. acredita la cantidad en la oficina;
6. registra `MovimientoStock`;
7. preserva idempotencia y reglas P6.

Esto aplica también cuando la oficina destino es la propia `Área Contable`.

---

## 6. Solicitudes y pedidos recibidos

El Depósito Central dispone de bandejas específicas para operación institucional.

### Solicitudes generales

El gestor puede:
- visualizar solicitudes de las dependencias;
- registrar respuesta operativa;
- aprobar, rechazar, poner en proceso o finalizar según el flujo existente;
- generar notificación al solicitante.

No se le concede un permiso genérico para borrar evidencia o administrar usuarios.

### Pedidos mensuales de insumos

El gestor puede:
- visualizar pedidos institucionales;
- tomar un pedido en revisión;
- aprobar/rechazar conforme a la máquina de estados;
- registrar cantidades provistas;
- concretar la entrega.

La provisión reutiliza la lógica transaccional existente. Solo un pedido previamente `APROBADO` puede mover stock real. La entrega descuenta stock central y acredita stock de oficina dentro de la misma operación.

---

## 7. Primera ola recomendada

La primera ola funcional prevista es:

```text
Dirección
  -> supervisión y administración del sistema

Área Contable
  -> RESPONSONSABLE de su propia oficina
  -> gestión adicional del Depósito Central

Área Informática
  -> primera oficina receptora ordinaria
```

Esto permite validar un circuito completo con muy pocos usuarios:

```text
Ingreso -> Depósito -> Solicitud/Pedido -> Gestión Contable
       -> Entrega -> Informática -> Stock/Activo de oficina -> Trazabilidad
```

También permite comprobar el caso especial:

```text
Depósito -> Contable
```

sin confundir las existencias centrales con el consumo propio del área gestora.

La selección de **personas reales** todavía requiere aprobación explícita antes de crear usuarios en staging.

---

## 8. Alcance de la primera ola de usuarios

La ola debe ser pequeña y observable. Como criterio técnico:
- iniciar con `Área Contable` y `Área Informática`;
- incorporar solo los usuarios necesarios para ejecutar recorridos críticos;
- preferir inicialmente `RESPONSABLE` y `USUARIO`;
- no crear nuevos `ADMIN` mediante el manifiesto de piloto;
- mantener los administradores generales existentes bajo la política MFA obligatoria del entorno production-like.

`pilot/wave.example.json` es únicamente un ejemplo sintético y no constituye una selección aprobada.

La selección real se guarda en un archivo local/privado excluido de Git, por ejemplo:

```text
pilot/wave-1.private.json
```

Nunca versionar nombres, emails reales u otros datos personales de la ola piloto salvo necesidad institucional explícita y autorizada.

---

## 9. Formato del manifiesto privado

Partir de:

```text
pilot/wave.example.json
```

Campos principales:
- `wave_id`;
- `environment`: debe coincidir con `DEPLOY_ENV`; P9.2 solo admite `development` o `staging`;
- `approved`;
- `approved_by` y `approved_at`;
- `selection_reason`;
- `offices`;
- `users`: nombre, apellido, email, rol y oficina esperados.

Roles admitidos:
- `RESPONSABLE`;
- `USUARIO`.

`ADMIN` se excluye deliberadamente para impedir elevación de privilegios por onboarding.

**No incluir contraseñas**, TOTP, recovery codes, JWT, cookies, secretos ni credenciales de base de datos.

---

## 10. Preflight read-only

Comando:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode plan
```

El preflight:
- valida formato y entorno;
- confirma oficinas y roles;
- confirma al menos un `ADMIN` activo;
- exige que cada `ADMIN` pertenezca a oficina central;
- en staging exige MFA en todos los `ADMIN` activos;
- detecta emails existentes;
- enmascara emails;
- no crea, modifica ni elimina registros.

Una ola no aprobada puede evaluarse en `plan`, pero **no habilita altas reales**.

---

## 11. Aprobación y alta real

Antes del alta deben quedar definidos:
1. personas seleccionadas;
2. rol de cada usuario;
3. oficina;
4. aprobación institucional;
5. fecha y motivo;
6. canal seguro de credenciales iniciales.

La creación real se realiza únicamente desde Gestión de Usuarios por un Administrador General.

No cargar usuarios directamente con SQL, scripts de `INSERT`, edición manual de tablas ni acceso de emergencia salvo incident response documentado.

---

## 12. Verificación post-alta

Después de crear usuarios:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode verify
```

`verify` exige `approved=true` y comprueba read-only:
- existencia y actividad;
- rol esperado;
- oficina esperada;
- administradores en oficina central;
- MFA administrativo correcto en staging.

Para la primera ola debe verificarse además funcionalmente:
- Responsable Contable ve su propia oficina y el bloque separado Depósito Central;
- Responsable Contable no administra usuarios;
- Responsable Informática no puede entrar a `/api/deposito/*` ni a sus rutas frontend;
- un activo de depósito puede entregarse a Informática con `TRASLADO` trazable;
- un insumo distribuido descuenta central y acredita Informática;
- Contable puede recibir stock para sí mediante una entrega real;
- solicitudes y pedidos pueden gestionarse sin elevar al responsable a `ADMIN`.

---

## 13. Rollback operativo

El onboarding es reversible sin borrar historial.

Ante error de asignación, incidente o retiro de un usuario:
1. un Administrador General desactiva el usuario;
2. se revocan sesiones activas;
3. se verifica que no pueda operar;
4. se conserva bitácora e historial;
5. se actualiza el manifiesto privado si cambia la ola;
6. se vuelve a ejecutar `verify`.

El rollback preferido es desactivar, no borrar.

La capacidad de gestión de depósito pertenece a la configuración institucional de la oficina. Un cambio futuro de oficina gestora debe realizarse mediante cambio versionado/controlado, nunca cambiando un nombre para obtener permisos.

---

## 14. Condiciones de stop

Detener nuevas altas si aparece cualquiera de estas condiciones:
- un usuario ve información de otra oficina sin autorización;
- Informática u otra oficina común accede a funciones del depósito;
- Contable obtiene administración global por gestionar depósito;
- bienes/stock de Contable se mezclan con existencias centrales;
- una entrega no conserva movimiento/bitácora;
- aparecen stock negativo, doble entrega o replay incorrecto;
- un `ADMIN` aparece fuera de oficina central;
- un administrador de staging no tiene MFA;
- existen errores repetidos de auth/MFA/permisos;
- hay duda sobre el entorno activo.

Responder según `P9_1_INCIDENT_RESPONSE.md` cuando corresponda.

---

## 15. Evidencia y criterios de cierre de P9.2

Por cada ola conservar, sin publicar datos personales innecesarios:
- `wave_id`;
- oficinas seleccionadas;
- cantidad de usuarios por rol/oficina;
- aprobación institucional;
- `plan` y `verify`;
- validaciones funcionales;
- incidentes;
- reversión/desactivación cuando corresponda;
- fecha de apertura/cierre.

P9.2 podrá cerrarse cuando:
- P9.2A pase contratos, integración MySQL, frontend y Quality Gate;
- la primera ola real quede explícitamente seleccionada/aprobada;
- `plan` sea verde en staging;
- las altas se hagan por módulo administrativo;
- `verify` sea verde;
- roles, scope, gestión de depósito y separación Contable/Depósito se validen funcionalmente;
- MFA administrativo permanezca correcto;
- rollback esté documentado y probado de forma controlada;
- `ROADMAP.md` y documentación técnica estén actualizados;
- PR sea mergeado y Gate post-merge quede verde.

Hasta completar la selección explícita y validación real en staging, P9.2 permanece abierto y P9.3 no se inicia.
