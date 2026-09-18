# AGENTS.md — Metodología de trabajo de Inventario Judicial

Este archivo define la forma obligatoria de trabajar en el repositorio `inventario-judicial`. Su objetivo es que la continuidad dependa del estado real del proyecto y no del historial de una conversación.

## 1. Fuente de verdad

Antes de actuar, reconstruir siempre el estado desde fuentes verificables, en este orden:

1. Git / GitHub real:
   - rama actual;
   - HEAD;
   - working tree / `git status`;
   - commits recientes;
   - PRs abiertos;
   - Quality Gates / CI;
   - merges reales.
2. `ROADMAP.md`.
3. Este `AGENTS.md`.
4. Documentación técnica aplicable en `docs/`.
5. `package.json`, scripts, tests y workflows de CI.
6. Staging / infraestructura cuando el bloque lo requiera.

No asumir que una conversación anterior refleja el estado actual del repo.

## 2. Apertura de cada bloque

Antes de abrir un bloque:

1. releer `ROADMAP.md` desde `main`;
2. identificar:
   - último bloque formalmente cerrado;
   - bloque activo;
   - siguiente bloque elegible;
3. verificar que no exista PR pendiente, rama paralela o Gate fallando que afecte el mismo límite técnico;
4. revisar documentación y arquitectura del área;
5. inspeccionar si ya existe una solución equivalente;
6. definir alcance, criterios de aceptación, riesgos, pruebas y rollback.

No abrir un bloque posterior mientras el activo permanezca sin cerrar, salvo trabajo de gobernanza o emergencia claramente separado y trazable.

## 3. Causa raíz antes que parche

Antes de editar código:

- investigar el flujo completo;
- reutilizar abstracciones existentes;
- evitar endpoints paralelos, autorización duplicada, validaciones repetidas y fixes sintomáticos;
- evitar código muerto y capas innecesarias;
- corregir la causa raíz en la capa adecuada;
- agregar una regresión cuando un defecto real haya escapado a CI.

No aceptar una solución porque “funciona manualmente” si deja inconsistencia, duplicación o deuda implícita.

## 4. Flujo de implementación obligatorio

Secuencia base:

```text
análisis
→ diseño
→ inspección de implementación existente
→ rama dedicada
→ implementación
→ pruebas específicas
→ pruebas de regresión y permisos
→ lint/check/build
→ validación de migraciones/consistencia si aplica
→ staging si aplica
→ documentación
→ revisión de diff/status
→ PR
→ Quality Gate
→ merge
→ Quality Gate post-merge
→ validación final del entorno si aplica
→ actualización de ROADMAP
→ cierre formal
```

No desarrollar directamente sobre `main`.

## 5. Pruebas mínimas

Según el cambio, ejecutar las pruebas relevantes de:

- unitarias / contratos;
- integración sobre MySQL descartable;
- autenticación;
- autorización por rol;
- alcance por oficina;
- pruebas negativas;
- concurrencia e idempotencia;
- migraciones e idempotencia de migraciones;
- backup/restore cuando corresponda;
- seguridad;
- regresión;
- E2E;
- lint;
- build;
- rendimiento cuando el bloque lo afecte.

Un cambio funcional que corrige un defecto debe incorporar una prueba que demuestre que el defecto no reaparece, cuando sea técnicamente razonable.

## 6. Intervención humana

Automatizar y ejecutar directamente todas las verificaciones posibles.

Pedir intervención manual sólo cuando sea inevitable, por ejemplo:
- observación visual específica;
- operación que exige una sesión interactiva del usuario;
- aprobación institucional;
- credenciales o MFA que no deben compartirse;
- validación física/operativa que no pueda reproducirse automáticamente.

Cuando se requiera intervención humana, dar un recorrido corto, exacto y con resultados esperados.

## 7. Git, PR y Quality Gate

- Cada bloque trabaja en rama propia.
- Commits claros y trazables.
- Revisar el diff completo antes de abrir/mergear PR.
- No mergear con Quality Gate rojo.
- Si un Gate falla:
  1. diagnosticar causa;
  2. corregir en la misma rama;
  3. agregar regresión cuando corresponda;
  4. repetir el Gate completo.
- Después del merge, exigir Gate post-merge verde.
- El merge no equivale por sí solo a cierre de bloque.

## 8. Staging y despliegues

Cuando el bloque requiera despliegue:

1. desplegar el SHA exacto aprobado;
2. usar staging antes de producción;
3. confirmar entorno, revisión y base;
4. ejecutar preflight;
5. crear/verificar backup antes de migraciones o cambios destructivos;
6. aplicar migraciones mediante el procedimiento protegido;
7. verificar health/smoke;
8. conservar evidencia;
9. probar rollback cuando el riesgo lo amerite.

No considerar un despliegue exitoso hasta que la plataforma reporte estado terminal de éxito y las verificaciones posteriores estén verdes.

Producción no se toca salvo que `ROADMAP.md` lo requiera expresamente y exista aprobación para ello.

## 9. Seguridad e integridad

Nunca:
- debilitar autenticación, MFA o autorización para facilitar una prueba;
- retirar locks/transacciones/idempotencia para resolver síntomas;
- usar SQL manual sobre datos reales cuando existe un flujo protegido;
- ejecutar pruebas destructivas en producción;
- versionar secretos, tokens, dumps reales o credenciales;
- ejecutar `npm audit fix --force` automáticamente;
- restaurar sobre la base activa como primera opción.

Toda migración debe ser versionada, verificable e idempotente o fallar de forma segura.

## 10. Documentación y cierre

Un bloque sólo se considera cerrado cuando están alineados:

- implementación;
- pruebas;
- CI;
- seguridad;
- migraciones/consistencia;
- staging cuando aplique;
- documentación técnica;
- `ROADMAP.md`;
- PR;
- merge;
- Gate post-merge;
- evidencia real del entorno cuando corresponda.

Al cerrar:
1. actualizar el documento técnico;
2. actualizar `ROADMAP.md` con PR, commit y Gates reales;
3. releer `ROADMAP.md` desde `main`;
4. identificar el siguiente bloque exacto.

No dejar pendientes implícitos. Toda deuda debe:
- resolverse dentro del bloque; o
- registrarse explícitamente en `ROADMAP.md` / documentación con condición de tratamiento.

## 11. Superbloques

Al cerrar o planificar un bloque, evaluar si conviene agrupar tareas relacionadas.

Un superbloque sólo se permite si:
- comparte el mismo contexto técnico;
- reduce repetición;
- mantiene pruebas claras;
- conserva rollback simple;
- no compromete seguridad;
- no dificulta trazabilidad;
- no deja estados parciales inseguros.

No agrupar por velocidad solamente.

Si agrupar aumenta riesgo, mezcla límites técnicos o vuelve el PR difícil de revisar, mantener bloques separados.

## 12. Reporte de avance

Cada cierre o punto de control debe distinguir con claridad:

- **terminado**;
- **validado**;
- **pendiente**;
- **bloqueado**;
- evidencia concreta: commit, PR, Gate, deployment o prueba.

No atribuir evidencia inexistente ni declarar cerrado algo que sólo fue implementado o probado parcialmente.

## 13. Prioridad de continuidad

Cuando exista contradicción entre chat y repositorio:
- prevalece el estado verificable del repositorio;
- `ROADMAP.md` define qué sigue;
- este archivo define cómo trabajar;
- los documentos técnicos definen contratos específicos.

El objetivo es mantener un proyecto profesional, reversible, testeable y trazable, evitando acumulación de parches.
