# P9.2B — Primera ola: Área Contable + Área Informática

## Estado

P9.2B es el subbloque activo de P9.2 una vez cerrado formalmente P9.2A.

Entrada habilitada por:
- PR #33 y Quality Gate #267;
- merge funcional P9.2A `3fe4b3ae487d0dfb53f44e7654e4c18dcc39bd29`;
- Quality Gate post-merge #268;
- PR documental #34;
- `main@d92ebe6d00e6889d1a20585d01bba1bb206ceebf`;
- Quality Gate post-merge #270 verde;
- relectura de `ROADMAP.md` desde `main`.

La primera ola **no comienza creando usuarios**. Primero staging debe ejecutar una revisión que contenga P9.2A y tener aplicada la migración 006.

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

No se incorpora ningún `ADMIN` mediante el manifiesto. Dirección conserva la administración general con las cuentas centrales ya existentes.

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
- Railway staging ejecuta `cb7b9fcbd39cdabc34b41552fdf407b1f8c8a044`;
- esa revisión corresponde a P8.6;
- P9.2A todavía no fue promovido a staging;
- staging venía con migraciones 001–005.

Por lo tanto, antes de `plan` se exige:
1. seleccionar un SHA de `main` con Quality Gate verde que contenga P9.2A;
2. establecer `DEPLOY_REVISION` con ese SHA exacto;
3. ejecutar `deploy:preflight`;
4. comprobar el estado de migraciones;
5. crear y verificar **backup** de staging;
6. aplicar la **migración 006** mediante el procedimiento protegido;
7. verificar `db:status` con 001–006 aplicadas;
8. comprobar `/health/live` y `/health/ready`;
9. ejecutar smoke externo;
10. confirmar que Área Contable tiene `gestiona_deposito=true` y existe exactamente un `es_deposito_central=true`.

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
- backup no verificable.

## 12. Evidencia necesaria para cerrar P9.2B

Antes de declarar P9.2B cerrado deben existir:
- SHA exacto desplegado en staging;
- preflight aprobado;
- backup previo verificado;
- migración 006 aplicada y `db:status` verde;
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
