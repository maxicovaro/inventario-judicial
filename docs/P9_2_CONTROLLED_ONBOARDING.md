# P9.2 — Alta controlada de oficinas y usuarios

## Estado y objetivo

P9.2 prepara la incorporación de la primera ola del piloto sin altas masivas, sin credenciales versionadas y sin crear caminos alternativos que eviten la autorización normal del sistema.

La regla central es deliberada: **el preflight es read-only y el alta real se realiza únicamente desde el módulo administrativo** por un Administrador General autenticado. Así se conservan autorización, política de contraseñas, bitácora, revocación de sesiones y validaciones de rol/oficina ya implementadas.

La selección institucional de oficinas y personas debe quedar explícitamente aprobada antes de realizar altas reales.

---

## 1. Alcance de la primera ola

La primera ola debe ser pequeña y observable. Como criterio técnico:
- seleccionar una cantidad mínima de oficinas que permita validar el aislamiento por oficina;
- incorporar solo los usuarios necesarios para ejecutar los recorridos críticos;
- preferir inicialmente `RESPONSABLE` y `USUARIO`;
- no crear nuevos `ADMIN` mediante el manifiesto de piloto;
- mantener los administradores generales existentes bajo la política MFA obligatoria del entorno production-like.

`pilot/wave.example.json` es únicamente un ejemplo sintético y no constituye una selección aprobada.

La selección real se guarda en un archivo local/privado excluido de Git, por ejemplo:

```text
pilot/wave-1.private.json
```

Nunca versionar nombres, emails reales u otros datos personales de la ola piloto salvo que exista una necesidad institucional explícita y autorizada.

---

## 2. Formato del manifiesto privado

Partir de:

```text
pilot/wave.example.json
```

Campos principales:
- `wave_id`: identificador de la ola;
- `environment`: debe coincidir con `DEPLOY_ENV`; P9.2 solo admite `development` o `staging`;
- `approved`: `true` únicamente después de aprobación explícita;
- `approved_by` y `approved_at`: evidencia mínima de esa aprobación;
- `selection_reason`: motivo de selección;
- `offices`: nombres exactos de oficinas existentes;
- `users`: nombre, apellido, email, rol y oficina esperados.

Roles admitidos por el manifiesto:
- `RESPONSABLE`;
- `USUARIO`.

`ADMIN` se excluye deliberadamente para no convertir el onboarding del piloto en un mecanismo de elevación de privilegios.

**No incluir contraseñas**, TOTP, recovery codes, JWT, cookies, secretos ni credenciales de base de datos en el manifiesto.

---

## 3. Preflight read-only

El comando es:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode plan
```

El preflight:
- valida el formato del manifiesto;
- exige que el entorno del manifiesto coincida con `DEPLOY_ENV`;
- confirma que oficinas y roles existan;
- confirma que exista al menos un `ADMIN` activo;
- confirma que todo `ADMIN` activo pertenezca a oficina central;
- en staging exige MFA habilitado en todos los `ADMIN` activos;
- detecta emails que ya existen;
- enmascara emails en la salida;
- no crea, modifica ni elimina registros.

Una ola no aprobada puede evaluarse en `plan`, pero **no habilita altas reales**.

---

## 4. Aprobación de la ola

Antes del alta real deben quedar definidos:
1. oficinas seleccionadas;
2. cantidad mínima de usuarios por oficina;
3. rol de cada usuario;
4. responsable institucional que aprobó la ola;
5. fecha de aprobación;
6. motivo de selección;
7. canal seguro para entregar credenciales iniciales.

Cambiar entonces en el manifiesto privado:

```json
{
  "approved": true,
  "approved_by": "referencia institucional",
  "approved_at": "2026-09-13T21:00:00-03:00"
}
```

No se necesita guardar firma, DNI, teléfono ni otro dato personal en este archivo.

---

## 5. Alta real

La alta real se realiza únicamente desde el módulo administrativo de Inventario Judicial.

Secuencia por usuario:
1. iniciar sesión como Administrador General;
2. abrir Gestión de Usuarios;
3. crear el usuario con el rol y oficina exactos del manifiesto aprobado;
4. utilizar una contraseña inicial fuerte conforme a la política del sistema;
5. entregar la contraseña por un canal autorizado, sin guardarla en Git ni en el manifiesto;
6. verificar que el usuario aparezca activo y asignado a la oficina correcta;
7. confirmar que la creación quedó registrada en bitácora.

No cargar usuarios directamente con SQL, scripts de `INSERT`, edición manual de tablas ni acceso de emergencia salvo incident response documentado.

---

## 6. Verificación post-alta

Después de crear todos los usuarios:

```bash
npm run pilot:onboarding:check -- --manifest pilot/wave-1.private.json --mode verify
```

`verify` exige `approved=true` y comprueba de forma read-only que:
- cada usuario existe;
- está activo;
- tiene el rol esperado;
- pertenece a la oficina esperada;
- los administradores activos mantienen oficina central;
- MFA permanece habilitado para administradores en staging.

La salida no muestra contraseñas ni secretos y enmascara los emails.

---

## 7. Validación funcional por usuario

Antes de declarar incorporada una oficina, validar al menos:
- login correcto;
- navegación permitida por rol;
- acceso limitado a la oficina correspondiente;
- ausencia de acceso a datos/acciones administrativas no autorizadas;
- creación o consulta de un flujo representativo según el rol;
- logout y nueva autenticación;
- bitácora de acciones relevantes.

Para `RESPONSABLE`, validar además que cualquier acción de oficina se mantenga dentro del scope correspondiente.

No usar datos sensibles reales para una prueba que pueda resolverse con datos controlados del piloto.

---

## 8. Rollback operativo

El onboarding debe ser reversible sin borrar historial.

Ante error de asignación, incidente o retiro de un usuario:
1. un Administrador General desactiva el usuario desde Gestión de Usuarios;
2. la desactivación revoca sus sesiones activas según la lógica actual del backend;
3. verificar que el usuario ya no pueda autenticarse/operar;
4. conservar bitácora e historial;
5. corregir el manifiesto privado si la composición de la ola cambió;
6. volver a ejecutar `verify` para el conjunto que continúe activo.

El **rollback operativo** preferido es desactivar, no borrar usuarios ni eliminar evidencia.

Si una oficina completa se retira de la primera ola, desactivar sus usuarios piloto y registrar el motivo.

---

## 9. Condiciones de stop y escalamiento

Detener nuevas altas si aparece cualquiera de estas condiciones:
- un usuario ve información de otra oficina sin autorización;
- un rol obtiene acciones que no le corresponden;
- un `ADMIN` aparece fuera de oficina central;
- un administrador de staging no tiene MFA habilitado;
- el alta no queda auditada en bitácora;
- aparecen errores repetidos de auth/MFA/permisos;
- existe duda sobre si se está operando en staging o production.

Clasificar y responder según `P9_1_INCIDENT_RESPONSE.md` cuando corresponda.

---

## 10. Evidencia de P9.2

Por cada ola conservar, sin publicar datos personales innecesarios:
- `wave_id`;
- oficinas seleccionadas;
- cantidad de usuarios por rol y oficina;
- aprobación institucional;
- resultado del preflight `plan`;
- resultado de `verify`;
- validaciones funcionales;
- incidentes encontrados;
- usuarios desactivados/revertidos, a nivel agregado;
- fecha de apertura y cierre de la ola.

Los archivos privados con nombres/emails reales permanecen fuera de Git.

---

## 11. Criterios de cierre de P9.2

P9.2 podrá cerrarse cuando:
- exista una primera ola explícitamente seleccionada y aprobada;
- preflight `plan` sea verde en staging;
- las altas reales se realicen por el módulo administrativo;
- `verify` sea verde después del alta;
- roles y scope por oficina se validen funcionalmente;
- MFA de administradores permanezca correcto;
- rollback operativo esté documentado y probado al menos de forma controlada;
- `ROADMAP.md` y documentación técnica estén actualizados;
- contratos P9.2 y Quality Gate estén verdes;
- PR sea mergeado y el Gate post-merge quede verde.

Hasta completar la selección explícita y la validación real en staging, P9.2 permanece abierto y P9.3 no se inicia.
