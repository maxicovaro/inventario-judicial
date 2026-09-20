# H1 — Continuidad de staging a costo $0

## Estado y objetivo

H1 mantiene el staging de Inventario Judicial utilizable después del Trial de Railway sin contratar Hobby/Pro ni tocar producción.

Restricción operativa:

- costo de bolsillo: **USD 0**;
- crédito Railway Free disponible: **USD 1/mes**;
- no agregar tarjeta ni upgrade como requisito técnico;
- producción institucional permanece fuera de alcance;
- los controles P7–P9, MySQL, volúmenes, backup cifrado y restore no se debilitan.

## 1. Baseline real de Railway

Ventana observada: 7 días, 169 muestras horarias.

| Servicio | RAM media | CPU media | Observación |
| --- | ---: | ---: | --- |
| backend | 0,099678 GB | 0,0001192 vCPU | carga muy baja |
| frontend | 0,038065 GB | 0,00004153 vCPU | Caddy estático |
| mysql | 0,461872 GB | 0,0039689 vCPU | principal costo continuo |
| pilot-backup-cron | ~0 | ~0 | ejecución puntual |

Almacenamiento usado observado:

- backend volume: ~0,0340 GB;
- MySQL volume: ~0,1608 GB;
- backup-cron volume: ~0,0324 GB;
- total volumes: ~0,2273 GB;
- bucket P9.5: muy por debajo de 1 MB al corte.

Tarifas Railway usadas por el modelo H1:

- RAM: USD 10 / GB-mes;
- CPU: USD 20 / vCPU-mes;
- volumen: USD 0,15 / GB-mes;
- bucket: USD 0,015 / GB-mes.

Resultado:

- compute continuo estimado: **USD 6,0787/mes**;
- almacenamiento persistente observado: **USD 0,0341/mes**;
- total 24/7 estimado: **USD 6,1128/mes**.

Conclusión: mantener frontend + backend + MySQL despiertos 24/7 no es compatible con Railway Free.

## 2. Estrategia

H1 usa **Railway Serverless** en los tres servicios permanentes:

- frontend;
- backend;
- mysql.

Railway considera inactivo un servicio sin tráfico saliente y normalmente lo duerme después de aproximadamente 5–10 minutos. Un request posterior vuelve a despertarlo.

El servicio `pilot-backup-cron` no necesita Serverless: ya se ejecuta únicamente según su cron diario.

### Cold start

En staging se acepta:

- demora inicial al despertar;
- posibilidad documentada por Railway de un primer 502 durante el wake;
- reintento del primer acceso.

Esto no se traslada automáticamente a una eventual producción institucional.

## 3. Presupuesto operativo

El modelo reproducible es:

~~~bash
npm run staging:free:budget -- \
  --evidence pilot/staging-free-budget.example.json \
  --output staging-free-results/budget.json
~~~

Con la evidencia actual y una proyección conservadora de **1,5 horas activas/día** para frontend/backend/MySQL:

- costo proyectado: **~USD 0,414/mes**;
- margen frente al crédito Free: **~USD 0,586/mes**;
- máximo uniforme aproximado compatible con USD 1: **3,81 h activas/día**.

El valor de 3,81 h/día es un presupuesto, no un SLA. Si el uso real crece, debe recalcularse con métricas nuevas.

## 4. Riesgo de memoria MySQL

Railway documenta un máximo Free de 0,5 GB RAM por servicio. En Trial, MySQL mostró:

- promedio: ~0,462 GB;
- pico observado: ~0,525 GB.

Ese pico está cerca del límite y debe validarse después del redeploy Serverless. H1 no modifica parámetros internos de MySQL de manera especulativa.

Regla:

1. medir memoria después del cambio;
2. si MySQL presenta OOM/restarts o no cabe en Free, **no** desactivar controles ni reducir seguridad;
3. tratar el ajuste de memoria o migración de staging como contingencia separada y reversible.

## 5. Sleep-friendly

El backend usa Sequelize sin keepalive periódico configurado explícitamente. No existe un job de aplicación que consulte MySQL de forma continua.

El frontend es Caddy estático y sólo proxyfica tráfico real a backend.

Esto hace razonable Serverless, pero la prueba real sleep/wake es obligatoria porque Railway detecta actividad por tráfico, no por intención de configuración.

## 6. Backup y persistencia

H1 preserva P9.5:

- volumen MySQL `/var/lib/mysql`;
- volumen backend `/data`;
- volumen backup `/data`;
- bucket privado cifrado AES-256-GCM;
- backup lógico diario;
- SHA-256;
- segunda copia verificada;
- restore drill separado.

Dormir un servicio no equivale a eliminar su volumen.

El bucket consume el mismo crédito Free. Si se consume USD 1 completo, Railway puede suspender acceso hasta el siguiente ciclo, por lo que H1 mantiene retención pequeña y dumps compactos.

## 7. Criterios de aceptación H1

H1 se cierra sólo cuando:

- modelo de presupuesto versionado y cubierto por tests;
- Quality Gate verde;
- Serverless aplicado realmente a frontend/backend/MySQL;
- los tres servicios alcanzan estado de sueño por inactividad;
- un acceso real despierta el flujo frontend -> backend -> MySQL;
- health/smoke posteriores al wake son verdes;
- datos piloto persisten;
- backup/cron y bucket continúan configurados;
- memoria MySQL posterior al cambio queda observada y documentada;
- costo proyectado queda <= USD 1/mes;
- existe contingencia explícita si Railway Free deja de ser suficiente;
- PR, merge y Gate post-merge verdes.

## 8. Contingencia sin costo

Si Railway Free no permite continuidad suficiente, el orden es:

1. no contratar automáticamente un plan;
2. conservar dumps + bucket cifrado y código en GitHub;
3. detener staging antes de consumir crédito;
4. evaluar un reemplazo gratuito compatible en un bloque propio;
5. restaurar siempre desde backup verificado sobre una base alternativa antes del cutover.

No se migra de MySQL ni se reescribe la aplicación sólo por anticipación.

## 9. Evidencia de cierre

Esta sección se completa con:

- deployment IDs que aplicaron Serverless;
- estados SLEEPING observados;
- evidencia de wake;
- health/smoke;
- métricas de memoria posteriores;
- Gate/PR/merge definitivos.
