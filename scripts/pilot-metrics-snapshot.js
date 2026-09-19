const fs = require("fs");
const path = require("path");
const { QueryTypes } = require("sequelize");
const sequelize = require("../src/config/database");
const env = require("../src/config/env");
const { uploadsDir } = require("../src/utils/uploadStorage");

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const positiveInteger = (value, fallback, max = 365) => {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`Valor inválido: se esperaba un entero entre 1 y ${max}`);
  }
  return parsed;
};

const summarizeDirectory = (directory) => {
  const root = path.resolve(directory);
  if (!fs.existsSync(root)) {
    return {
      path: root,
      exists: false,
      files: 0,
      bytes: 0,
      latest_modified_at: null,
    };
  }

  let files = 0;
  let bytes = 0;
  let latestModified = 0;

  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        visit(fullPath);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = fs.statSync(fullPath);
      files += 1;
      bytes += stat.size;
      latestModified = Math.max(latestModified, stat.mtimeMs);
    }
  };

  visit(root);

  return {
    path: root,
    exists: true,
    files,
    bytes,
    latest_modified_at: latestModified
      ? new Date(latestModified).toISOString()
      : null,
  };
};

const select = (sql, replacements = {}) =>
  sequelize.query(sql, {
    replacements,
    type: QueryTypes.SELECT,
    logging: false,
  });

const writeStdout = (text) =>
  new Promise((resolve, reject) => {
    process.stdout.write(text, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });

const normalizeRows = (rows) =>
  rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => {
        if (typeof value === "bigint") return [key, Number(value)];
        if (value === null || value === undefined) return [key, value];
        if (
          typeof value === "string" &&
          /^-?\d+(?:\.\d+)?$/.test(value) &&
          /(total|bytes|cantidad|eventos|actores|usuarios|operaciones)$/i.test(key)
        ) {
          return [key, Number(value)];
        }
        return [key, value];
      }),
    ),
  );

const main = async () => {
  const days = positiveInteger(argValue("--days"), 7);
  const outputPath = argValue("--output");
  const backupDir =
    argValue("--backup-dir") ||
    (uploadsDir.startsWith(path.resolve("/data"))
      ? path.join(path.resolve("/data"), "backups")
      : path.resolve("backups"));

  if (!["staging", "test"].includes(env.DEPLOY_ENV)) {
    throw new Error(
      `pilot:metrics:snapshot solo puede ejecutarse en staging/test. Entorno detectado: ${env.DEPLOY_ENV}`,
    );
  }

  const windowEnd = new Date();
  const windowStart = new Date(windowEnd.getTime() - days * 24 * 60 * 60 * 1000);
  const replacements = { since: windowStart };

  await sequelize.authenticate();

  const [
    usersByOfficeRole,
    adminMfa,
    flowActivity,
    authActivity,
    solicitudes,
    pedidosWindow,
    pedidosCurrent,
    stockMovements,
    idempotency,
    attachments,
    databaseSize,
  ] = await Promise.all([
    select(
      `SELECT
         COALESCE(o.nombre, 'Sin oficina') AS oficina,
         r.nombre AS rol,
         COUNT(*) AS usuarios,
         SUM(CASE WHEN u.activo = 1 THEN 1 ELSE 0 END) AS usuarios_activos
       FROM usuarios u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN oficinas o ON o.id = u.oficina_id
       GROUP BY o.id, o.nombre, r.id, r.nombre
       ORDER BY oficina, rol`,
    ),
    select(
      `SELECT
         COUNT(*) AS admins_activos,
         SUM(CASE WHEN u.mfa_enabled = 1 THEN 1 ELSE 0 END) AS admins_con_mfa,
         SUM(CASE WHEN COALESCE(o.es_central, 0) = 0 THEN 1 ELSE 0 END) AS admins_fuera_direccion
       FROM usuarios u
       JOIN roles r ON r.id = u.role_id
       LEFT JOIN oficinas o ON o.id = u.oficina_id
       WHERE u.activo = 1 AND r.nombre = 'ADMIN'`,
    ),
    select(
      `SELECT
         COALESCE(o.nombre, 'Sin oficina') AS oficina,
         b.modulo,
         b.accion,
         COUNT(*) AS eventos,
         COUNT(DISTINCT b.usuario_id) AS actores
       FROM bitacora b
       LEFT JOIN usuarios u ON u.id = b.usuario_id
       LEFT JOIN oficinas o ON o.id = u.oficina_id
       WHERE b.fecha >= :since
       GROUP BY o.id, o.nombre, b.modulo, b.accion
       ORDER BY eventos DESC, oficina, b.modulo, b.accion`,
      replacements,
    ),
    select(
      `SELECT
         accion,
         COUNT(*) AS eventos
       FROM bitacora
       WHERE modulo = 'AUTH' AND fecha >= :since
       GROUP BY accion
       ORDER BY eventos DESC, accion`,
      replacements,
    ),
    select(
      `SELECT
         COALESCE(o.nombre, 'Sin oficina') AS oficina,
         s.estado,
         COUNT(*) AS total
       FROM solicitudes s
       LEFT JOIN oficinas o ON o.id = s.oficina_id
       WHERE s.createdAt >= :since
       GROUP BY o.id, o.nombre, s.estado
       ORDER BY oficina, s.estado`,
      replacements,
    ),
    select(
      `SELECT
         COALESCE(o.nombre, 'Sin oficina') AS oficina,
         p.tipo,
         p.estado,
         COUNT(*) AS total
       FROM pedidos_insumos p
       LEFT JOIN oficinas o ON o.id = p.oficina_id
       WHERE p.fecha_envio IS NOT NULL AND p.fecha_envio >= :since
       GROUP BY o.id, o.nombre, p.tipo, p.estado
       ORDER BY oficina, p.tipo, p.estado`,
      replacements,
    ),
    select(
      `SELECT
         p.tipo,
         p.estado,
         COUNT(*) AS total
       FROM pedidos_insumos p
       GROUP BY p.tipo, p.estado
       ORDER BY p.tipo, p.estado`,
    ),
    select(
      `SELECT
         ms.tipo,
         COALESCE(o.nombre, 'Sin oficina') AS oficina,
         COUNT(*) AS movimientos,
         COALESCE(SUM(ms.cantidad), 0) AS cantidad
       FROM movimientos_stock ms
       LEFT JOIN oficinas o ON o.id = ms.oficina_id
       WHERE ms.createdAt >= :since
       GROUP BY ms.tipo, o.id, o.nombre
       ORDER BY movimientos DESC, ms.tipo, oficina`,
      replacements,
    ),
    select(
      `SELECT
         scope,
         COUNT(*) AS operaciones,
         SUM(CASE WHEN status_code IS NULL THEN 1 ELSE 0 END) AS operaciones_incompletas
       FROM operaciones_idempotentes
       WHERE createdAt >= :since
       GROUP BY scope
       ORDER BY operaciones DESC, scope`,
      replacements,
    ),
    select(
      `SELECT
         COUNT(*) AS archivos,
         COALESCE(SUM(tamanio), 0) AS bytes
       FROM adjuntos
       WHERE createdAt >= :since`,
      replacements,
    ),
    select(
      `SELECT
         COALESCE(SUM(data_length + index_length), 0) AS bytes
       FROM information_schema.tables
       WHERE table_schema = :database`,
      { database: env.DB_NAME },
    ),
  ]);

  const snapshot = {
    schema_version: 1,
    generated_at: windowEnd.toISOString(),
    environment: env.DEPLOY_ENV,
    revision: env.DEPLOY_REVISION || null,
    window: {
      days,
      from: windowStart.toISOString(),
      to: windowEnd.toISOString(),
    },
    users: {
      by_office_role: normalizeRows(usersByOfficeRole),
      admin_mfa: normalizeRows(adminMfa)[0] || {
        admins_activos: 0,
        admins_con_mfa: 0,
        admins_fuera_direccion: 0,
      },
    },
    usage: {
      by_office_module_action: normalizeRows(flowActivity),
      auth_events: normalizeRows(authActivity),
      solicitudes: normalizeRows(solicitudes),
      pedidos_sent_in_window: normalizeRows(pedidosWindow),
      pedidos_current_state: normalizeRows(pedidosCurrent),
      stock_movements: normalizeRows(stockMovements),
    },
    consistency: {
      idempotent_operations: normalizeRows(idempotency),
      replay_events_source:
        "runtime logs: idempotency_replay / idempotency_conflict / idempotency_in_progress",
    },
    storage: {
      mysql: {
        bytes: Number(databaseSize[0]?.bytes || 0),
      },
      uploads: summarizeDirectory(uploadsDir),
      backups: summarizeDirectory(backupDir),
      attachments_created_in_window: normalizeRows(attachments)[0] || {
        archivos: 0,
        bytes: 0,
      },
    },
    external_sources_required: {
      http_and_latency:
        "Railway HTTP/runtime logs: status, totalDuration, http_request_completed",
      resources:
        "Railway service metrics: CPU, memory, disk, network",
      incidents:
        "P9.1 incident records: severity, acknowledge/recovery timestamps, RPO/RTO",
    },
  };

  const json = `${JSON.stringify(snapshot, null, 2)}\n`;

  if (outputPath) {
    const resolved = path.resolve(outputPath);
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    fs.writeFileSync(resolved, json, "utf8");
    console.log(`✓ Snapshot P9.4 generado: ${resolved}`);
  } else {
    await writeStdout(json);
  }
};

const finish = async (exitCode) => {
  let finalCode = exitCode;

  try {
    await sequelize.close();
  } catch (error) {
    console.error(`✗ No se pudo cerrar la conexión del snapshot: ${error.message}`);
    finalCode = 1;
  }

  process.exit(finalCode);
};

main()
  .then(() => finish(0))
  .catch((error) => {
    console.error(`✗ Snapshot P9.4 falló: ${error.message}`);
    return finish(1);
  });
