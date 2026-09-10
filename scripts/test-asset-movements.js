const assert = require("assert");
const fs = require("fs");

const server = fs.readFileSync("server.js", "utf8");
const routes = fs.readFileSync("src/routes/movimientoRoutes.js", "utf8");
const controller = fs.readFileSync("src/controllers/movimientoController.js", "utf8");
const activos = fs.readFileSync("src/controllers/activoController.js", "utf8");
const activosFrontend = fs.readFileSync(
  "inventario-frontend/src/pages/Activos.jsx",
  "utf8",
);

assert.match(server, /require\("\.\/src\/routes\/movimientoRoutes"\)/);
assert.match(server, /app\.use\("\/api\/movimientos", movimientoRoutes\)/);

assert.match(routes, /verificarGestionOficina/);
assert.match(routes, /router\.get\("\/", verificarToken, listarMovimientos\)/);

assert.match(
  controller,
  /TIPOS_MANUALES_PERMITIDOS\s*=\s*new Set\(\["REPARACION", "ACTUALIZACION"\]\)/,
);
assert.doesNotMatch(
  controller,
  /TIPOS_MANUALES_PERMITIDOS[^;]*"(?:ALTA|BAJA|TRASLADO|CAMBIO_ESTADO)"/s,
);
assert.match(
  controller,
  /includeActivo\.where\s*=\s*\{\s*oficina_id: req\.usuario\.oficina_id/s,
);
assert.match(
  controller,
  /No tenés permisos para registrar movimientos de otra oficina/,
);
assert.doesNotMatch(controller, /error:\s*error\.message/);

assert.match(activos, /const sequelize = require\("\.\.\/config\/database"\)/);
assert.match(activos, /Movimiento\.create\(/);
assert.match(activos, /tipo:\s*"ALTA"/);
assert.ok(activos.includes('tipo: "TRASLADO"'));
assert.ok(activos.includes('tipo: "CAMBIO_ESTADO"'));
assert.ok(activos.includes('tipo: "ACTUALIZACION"'));
assert.match(activos, /tipo:\s*"BAJA"/);
assert.match(activos, /await transaction\.commit\(\)/);
assert.match(activos, /if \(transaction\) await transaction\.rollback\(\)/);
assert.match(
  activos,
  /La baja debe realizarse con la acción formal Dar de baja/,
);
assert.match(
  activos,
  /El activo está dado de baja y no puede modificarse/,
);
assert.doesNotMatch(activos, /error:\s*error\.message/);

assert.match(
  activosFrontend,
  /La baja debe realizarse con la acción formal Dar de baja/,
);
assert.match(
  activosFrontend,
  /puedeGestionar && puedeVerAdjuntos && !estaDadoDeBaja/,
);
assert.doesNotMatch(
  activosFrontend,
  /<option value="Dado de baja">Dado de baja<\/option>[\s\S]{0,120}<\/select>[\s\S]{0,120}register\("estado"\)/,
);

assert.match(
  activos,
  /Object\.prototype\.hasOwnProperty\.call\(req\.body, "activo"\)/,
);
assert.match(activos, /activo:\s*true/);
assert.doesNotMatch(activos, /activo !== undefined/);
assert.match(
  controller,
  /activo\.activo === false \|\| activo\.estado === "Dado de baja"/,
);
assert.match(
  controller,
  /El activo está dado de baja y no admite movimientos manuales/,
);

assert.match(activos, /const movimientos = \[\]/);
assert.match(activos, /if \(traslado\) \{/);
assert.match(activos, /if \(cambioEstado\) \{/);
assert.doesNotMatch(activos, /else if \(cambioEstado\)/);
assert.ok(activos.includes("Movimiento.bulkCreate("));
assert.ok(activos.includes("movimientos.length === 0"));

console.log("Historial y permisos de movimientos de activos validados correctamente.");
