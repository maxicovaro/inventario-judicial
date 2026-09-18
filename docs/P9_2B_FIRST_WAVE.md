# P9.2B — Primera ola: Área Contable + Área Informática

## Estado

P9.2B completó su validación técnico-operativa real en staging el 18/09/2026. Los 12 escenarios funcionales mínimos, el rollback controlado y el `verify` posterior a la reactivación quedaron verdes. Este documento registra el cierre; el bloque se considera formalmente cerrado únicamente después de integrar el PR documental y obtener Quality Gate post-merge verde.

Entrada habilitada por:
- PR #33 y Quality Gate #267;
- merge funcional P9.2A `3fe4b3ae487d0dfb53f44e7654e4c18dcc39bd29`;
- Quality Gate post-merge #268;
- PR documental #34;
- `main@d92ebe6d00e6889d1a20585d01bba1bb206ceebf`;
- Quality Gate post-merge #270 verde;
- relectura de `ROADMAP.md` desde `main`.

La primera ola **no comienza creando usuarios**. Primero staging debe ejecutar una revisión que contenga P9.2A, tener aplicada la migración 006 y contar con los catálogos institucionales base.

## 1. Objetivo

Validar con una cantidad pequeña de empleados reales el circuito institucional completo:

```text
Depósito Central
  -> gestionado por Área Contable
  -> solicitud/pedido de Área Informática
  -> respuesta/aprobación
  -> entrega de activo o insumo
  -> recepción/stock de Informática
  -> auditoría por empleado
```

También se valida que Área Contable conserve su inventario y consumo propios separados del Depósito Central.

## 2. Composición mínima de la ola

P9.2B usa únicamente:
- `Área Contable`;
- `Área Informática`.

Composición mínima:
- **dos `RESPONSABLE` de Área Contable**, para comprobar operación multiusuario y autoría individual;
- **un `RESPONSABLE` de Área Informática**;
- **un `USUARIO` de Área Informática**, para comprobar el scope ordinario y los negativos de autorización.

Cada persona debe usar su propia cuenta. No se permite una cuenta compartida de Depósito.

No se incorpora ningún `ADMIN` mediante el manifiesto. Dirección conserva la administración general con las cuentas centrales ya existentes o con el procedimiento administrativo/bootstrapping autorizado que corresponda.

## 3. Datos reales y privacidad

Los nombres, apellidos y emails reales se guardan únicamente en un archivo privado local, por ejemplo:

```text
pilot/wave-1.private.json
```

Los manifiestos `*.private.json` y `*.local.json` están excluidos de Git.

En Git solo existe `pilot/wave.example.json` con datos sintéticos `.invalid`.

En los manifiestos reales **no se versionan**:
- contraseñas;
- TOTP;
- recovery codes;
- JWT/cookies;
- secretos de base;
- claves privadas;
- datos personales que no sean estrictamente necesarios para el alta.

## 4. Gate técnico de staging antes del plan

Estado observado al abrir P9.2B:
- Railway staging ejecutaba `cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`;
- esa revisión correspondía a P8.6;
- P9.2A todavía no había sido promovido a staging;
- staging venía con migraciones 001–005.

Promoción controlada realizada el 14/09/2026:
- backend y frontend promovidos a `d92ebe6d00e6889d1a20585d01bba1bb206ceebf`;
- `DEPLOY_REVISION` alineada con ese SHA;
- `deploy:preflight` aprobado para `staging` y `inventario_judicial_staging`;
- backup persistente previo a migración creado en `/data/backups/pre-p9-2b-migrate-006.sql`;
- backup verificado con SHA-256 `6050b7b5f2be118f70db4f08b41316f922067425ec1abd6be09e01f4d1de29d7` y 23746 bytes;
- estado previo: migraciones 001–005 aplicadas y 006 pendiente;
- migración `20260913_006_deposito_central_capabilities.js` aplicada mediante `deploy:migrate` usando ese backup;
- estado posterior: migraciones 001–006 aplicadas y base al día;
- backend volvió a `/health/ready` 200 con `environment=staging` y revisión exacta.

### Stop condition detectada: catálogos base ausentes

La validación read-only posterior a la migración devolvió:

```text
P9.2B_CAPABILITIES []
P9.2B_OFFICES []
```

Es decir, la tabla `oficinas` de staging estaba vacía. La migración 006 creó correctamente las columnas y quedó registrada, pero sus `UPDATE` no podían marcar Área Contable/Depósito porque todavía no existían registros de oficinas.

La incorporación de usuarios se detuvo en ese punto. **No se crearon usuarios y no se realizó ningún `UPDATE`/`INSERT` manual de oficinas.**

### Bootstrap protegido de catálogos

P9.2B incorpora un comando específico:

```bash
npm run pilot:staging:bootstrap -- --expected-revision <SHA_EXACTO>
```

Este comando:
- solo admite `NODE_ENV=production` + `DEPLOY_ENV=staging`;
- reutiliza el `deploy:preflight` de staging;
- exige coincidencia exacta entre `DEPLOY_REVISION` y `--expected-revision`;
- exige que la migración 006 ya esté aplicada;
- ejecuta únicamente el seeder de roles, categorías y oficinas base;
- ejecuta el seed dentro de una transacción;
- comprueba que la cantidad de usuarios no cambie;
- valida Dirección como oficina central;
- valida Área Contable como única gestora del depósito;
- valida Depósito como único depósito central;
- valida Área Informática sin capacidades de depósito.

El seed de catálogos no importa ni crea usuarios. Si cualquier guarda falla, la transacción se cancela.

Este bootstrap es un cambio de datos de staging distinto de la migración 006 y requiere autorización explícita antes de ejecutarse.

Por lo tanto, antes de `plan` se exige:
1. revisión exacta de staging identificada;
2. `deploy:preflight` verde;
3. backup previo verificado;
4. migración 006 aplicada;
5. catálogos institucionales base presentes mediante el bootstrap protegido si estaban ausentes;
6. `db:status` con 001–006 aplicadas;
7. `/health/live` y `/health/ready` verdes;
8. smoke externo verde;
9. Área Contable con `gestiona_deposito=true`;
10. exactamente un `es_deposito_central=true`;
11. Área Informática sin capacidad de depósito.

Si cualquiera de estos puntos falla, la incorporación de usuarios se detiene.

## 5. Manifiesto y `plan`

Una vez staging esté actualizado, copiar el ejemplo versionado a un archivo privado y reemplazar los usuarios sintéticos por personas aprobadas.

Primera ejecución recomendada con `approved=false`:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode plan
```

El `plan` es read-only y debe verificar:
- entorno staging;
- `DEPLOY_REVISION` válido;
- migración 006 aplicada;
- Área Contable con capacidad de depósito;
- exactamente un Depósito Central;
- Área Informática sin capacidad de depósito;
- ADMIN activos únicamente en oficina central;
- MFA de todos los ADMIN activos;
- composición mínima de la ola;
- inexistencia previa de los emails a dar de alta.

No se realizan altas si el `plan` informa errores.

## 6. Aprobación institucional

Antes de crear cuentas reales registrar en el manifiesto privado:
- `approved=true`;
- `approved_by`;
- `approved_at`;
- motivo de selección;
- oficina y rol de cada participante.

No colocar secretos en esos campos.

## 7. Alta real

El alta real se realiza **únicamente desde Gestión de Usuarios** por un Administrador General autenticado.

No usar:
- SQL manual;
- `INSERT` directo;
- scripts de provisión paralelos;
- edición de tablas;
- creación de un ADMIN adicional para facilitar el piloto.

Las contraseñas iniciales se transmiten por un canal institucional seguro y nunca se agregan al manifiesto ni al repositorio.

## 8. `verify`

Después de las altas:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode verify
```

`verify` debe confirmar para cada persona:
- usuario existente;
- usuario activo;
- rol exacto;
- oficina exacta;
- prerrequisitos P9.2A todavía válidos;
- MFA administrativo central conservado.

## 9. Validación funcional de la ola

Con las cuatro cuentas piloto se ejecutan, como mínimo, estos escenarios:

1. los dos responsables de Contable pueden abrir Depósito Central;
2. el usuario común de Informática no puede abrir ni invocar funciones de depósito;
3. el responsable de Informática tampoco administra Depósito;
4. responsable Contable A registra una recepción/ingreso;
5. responsable Contable B realiza una entrega posterior;
6. Auditoría operativa muestra a cada empleado como autor de su acción;
7. Informática genera una solicitud o pedido;
8. Contable responde/provisiona y el stock queda consistente;
9. un activo se traslada formalmente `Depósito -> Área Informática`;
10. una entrega `Depósito -> Área Contable` alimenta el inventario/stock propio de Contable sin mezclar existencias centrales;
11. cada responsable normal continúa limitado a su propia oficina fuera del módulo específico de Depósito;
12. Dirección conserva Usuarios y Bitácora global sin transferir esos privilegios a Contable.

No utilizar información judicial sensible para estas pruebas iniciales.

## 10. Rollback controlado

El rollback de usuarios se prueba mediante **desactivación**, nunca borrado.

Sobre una cuenta piloto designada y sin operación en curso:
1. Dirección la desactiva;
2. sus sesiones quedan revocadas;
3. se comprueba que no pueda autenticar/operar;
4. la bitácora e historial se conservan;
5. si continúa en la ola, Dirección la reactiva de forma controlada;
6. se repite `verify`.

No ejecutar rollback si pone en riesgo una operación real en curso.

## 11. Condiciones de stop

Detener la ola y aplicar el runbook P9.1 si aparece cualquiera de estas situaciones:
- pérdida o corrupción de datos;
- stock negativo, doble entrega o replay incorrecto;
- acceso a Depósito por una cuenta no autorizada;
- un `RESPONSABLE` obtiene administración global;
- un `ADMIN` queda fuera de Dirección;
- MFA administrativo falla o se desactiva;
- la autoría de una entrega/recepción no identifica al empleado;
- mezcla entre stock propio de Contable y stock central;
- errores 5xx repetidos en un flujo crítico;
- revisión desplegada o entorno no identificables;
- backup no verificable;
- catálogos base ausentes o inconsistentes.

## 12. Evidencia necesaria para cerrar P9.2B

Antes de declarar P9.2B cerrado deben existir:
- SHA exacto desplegado en staging;
- preflight aprobado;
- backup previo verificado;
- migración 006 aplicada y `db:status` verde;
- catálogos base y capacidades P9.2A verificadas;
- health + smoke verdes;
- manifiesto privado aprobado, conservado fuera de Git;
- `plan` verde;
- altas realizadas vía Gestión de Usuarios;
- `verify` verde;
- evidencia de los escenarios funcionales;
- rollback controlado validado;
- ausencia de stop conditions abiertas;
- documentación actualizada;
- Quality Gate de código/documentación verde;
- PR integrado y Gate post-merge verde.

Solo después de este cierre puede cerrarse P9.2 y habilitarse P9.3.


## 13. Cierre técnico-operativo real — 18/09/2026

### Revisión y entorno validados

La primera ola quedó validada sobre staging Railway con:
- revisión desplegada exacta: `e82569270a60674fd9fd02444dfebcfbd35fe9eb`;
- deployment backend final: `6f3579f8-829b-4c57-911c-1fc7bbacdb3a`;
- `DEPLOY_ENV=staging`;
- base `inventario_judicial_staging`;
- preflight aprobado;
- servidor iniciado normalmente;
- `/health/ready` en 200;
- migraciones 001–007 aplicadas y base al día.

Respaldos relevantes conservados:
- previo a migración 006: `/data/backups/pre-p9-2b-migrate-006.sql`, SHA-256 `6050b7b5f2be118f70db4f08b41316f922067425ec1abd6be09e01f4d1de29d7`, 23746 bytes;
- previo a completar migración 007: `/data/backups/pre-p9-2b-migration-fix-fe272515.sql`, SHA-256 `8f6e223709140434d144aea98003a0d11c0d0c6b622d56440bc4e6e67cb582d9`, 35405 bytes.

### Correcciones detectadas durante la validación

La validación manual no se limitó a confirmar el camino feliz. Detectó y cerró tres defectos relevantes antes del cierre:

1. **Pedidos del mismo período**: el segundo pedido de una oficina debía ser complementario, no rechazarse por unicidad. La solución incorporó un único pedido `MENSUAL` base y pedidos `COMPLEMENTARIO` posteriores, con protección de concurrencia.
2. **Entrega con provisión cero**: un pedido podía pasar a `ENTREGADO` con `cantidad_provista=0` sin movimiento de stock. Se bloqueó esa transición y se agregó regresión automática.
3. **Trazabilidad del tipo de pedido**: los movimientos/bitácoras podían describir un complementario como “mensual”. Se corrigió para conservar `MENSUAL` o `COMPLEMENTARIO` en movimientos, notificaciones y auditoría.

Evidencia de integración asociada:
- PR #37: hidratación correcta de capacidades al iniciar sesión; Gates #280/#281 verdes;
- PR #38: pedidos complementarios; Gates #288/#289 verdes;
- PR #40: refresh de fuente frontend de staging; Gates #291/#292 verdes;
- PR #39: corrección segura de migración 007 con FK; Gates #293/#294 verdes;
- PR #41: impedir `ENTREGADO` con provisión cero; Gate post-merge #296 verde;
- PR #42: conservar el tipo real en trazabilidad; Gate post-merge #298 verde.

### Resultado de los 12 escenarios funcionales

Los escenarios mínimos definidos en la sección 9 quedaron validados:

1. ambos `RESPONSABLE` de Contable acceden al Depósito Central;
2. el `USUARIO` común de Informática no administra Depósito;
3. el `RESPONSABLE` de Informática tampoco administra Depósito;
4. Contable A registró recepción/ingreso;
5. Contable B realizó una entrega posterior;
6. Auditoría operativa conservó autor individual;
7. Informática generó pedidos, incluido flujo complementario;
8. Contable aprobó/provisionó con stock consistente y descuento exactamente una vez;
9. activo trasladado formalmente `Depósito Central -> Área Informática`, visible en destino y auditado;
10. entrega `Depósito Central -> Área Contable` dejó stock central y stock propio separados;
11. un responsable de Contable permaneció limitado a su oficina fuera del módulo específico de Depósito;
12. Dirección conservó Usuarios y Bitácora global; Contable no obtuvo esos privilegios.

Evidencias de stock observadas durante el circuito de pedidos:
- creación/aprobación sin descuento anticipado;
- rechazo explícito de entrega con provisión 0;
- provisión de 2 unidades: stock central 5 -> 3 y un único EGRESO 2;
- nuevo complementario N° 5: stock 3 -> 2 con motivo “Entrega por pedido complementario”;
- distribución posterior a Contable: stock central 2 -> 1 y stock propio de Contable 0 -> 1;
- auditoría `ASIGNAR_STOCK` conservó empleado, oficina, cantidad y stocks resultantes.

### Rollback controlado

Se designó una cuenta `USUARIO` de Área Informática sin operación en curso:
- Dirección la desactivó desde Gestión de Usuarios;
- la sesión vigente quedó revocada;
- el usuario no pudo continuar operando ni volver a autenticarse mientras estuvo inactivo;
- pedidos, historial y bitácora previos permanecieron conservados;
- Bitácora registró `DESACTIVAR` con el ADMIN como autor;
- Dirección reactivó la misma cuenta;
- Bitácora registró `ACTIVAR`;
- el usuario volvió a autenticar con rol y oficina originales intactos.

### Verify final posterior al rollback

El 18/09/2026 se repitió:

```bash
npm run pilot:onboarding:check -- --manifest /tmp/wave-1.private.json --mode verify
```

Resultado:
- entorno: `staging`;
- revisión: `e82569270a60674fd9fd02444dfebcfbd35fe9eb`;
- modo: `verify`;
- manifiesto aprobado;
- 2 RESPONSABLE de Área Contable: `VERIFICADO`;
- 1 RESPONSABLE de Área Informática: `VERIFICADO`;
- 1 USUARIO de Área Informática: `VERIFICADO`;
- prerrequisitos P9.2A: verificados;
- comprobación read-only: la base no fue modificada.

### Condiciones de stop y decisión

Al finalizar la primera ola:
- no quedó stock negativo;
- no quedó doble entrega/replay incorrecto;
- no se detectó acceso de cuentas no autorizadas al Depósito;
- Contable no obtuvo administración global;
- no apareció ningún ADMIN fuera de Dirección;
- la autoría permaneció identificable;
- stock propio de Contable y stock central permanecieron separados;
- no quedó una condición de stop abierta.

Por lo tanto, P9.2B queda técnicamente apto para cierre. Tras el merge de este cierre documental y su Quality Gate post-merge verde, P9.2 queda cerrado y P9.3 pasa a ser el siguiente bloque elegible.
