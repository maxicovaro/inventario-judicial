const Role = require("./Role");
const Oficina = require("./Oficina");
const Usuario = require("./Usuario");
const Categoria = require("./Categoria");
const Activo = require("./Activo");
const Movimiento = require("./Movimiento");
const Solicitud = require("./Solicitud");
const Notificacion = require("./Notificacion");
const Adjunto = require("./Adjunto");
const Insumo = require("./Insumo");
const MovimientoStock = require("./MovimientoStock");
const PedidoInsumo = require("./PedidoInsumo");
const PedidoInsumoDetalle = require("./PedidoInsumoDetalle");


// Relaciones Usuario
Role.hasMany(Usuario, { foreignKey: "role_id" });
Usuario.belongsTo(Role, { foreignKey: "role_id" });

Oficina.hasMany(Usuario, { foreignKey: "oficina_id" });
Usuario.belongsTo(Oficina, { foreignKey: "oficina_id" });

// Relaciones Activo
Categoria.hasMany(Activo, { foreignKey: "categoria_id" });
Activo.belongsTo(Categoria, { foreignKey: "categoria_id" });

Oficina.hasMany(Activo, { foreignKey: "oficina_id" });
Activo.belongsTo(Oficina, { foreignKey: "oficina_id" });

// Relaciones Movimiento
Activo.hasMany(Movimiento, { foreignKey: "activo_id" });
Movimiento.belongsTo(Activo, { foreignKey: "activo_id" });

Usuario.hasMany(Movimiento, { foreignKey: "usuario_id" });
Movimiento.belongsTo(Usuario, { foreignKey: "usuario_id" });

// Relaciones Solicitud
Usuario.hasMany(Solicitud, { foreignKey: "usuario_id" });
Solicitud.belongsTo(Usuario, { foreignKey: "usuario_id" });

Oficina.hasMany(Solicitud, { foreignKey: "oficina_id" });
Solicitud.belongsTo(Oficina, { foreignKey: "oficina_id" });

Activo.hasMany(Solicitud, { foreignKey: "activo_id" });
Solicitud.belongsTo(Activo, { foreignKey: "activo_id" });

// Relaciones Notificacion
Usuario.hasMany(Notificacion, { foreignKey: "usuario_id" });
Notificacion.belongsTo(Usuario, { foreignKey: "usuario_id" });

// Relaciones Adjunto
Activo.hasMany(Adjunto, { foreignKey: "activo_id" });
Adjunto.belongsTo(Activo, { foreignKey: "activo_id" });

Solicitud.hasMany(Adjunto, { foreignKey: "solicitud_id" });
Adjunto.belongsTo(Solicitud, { foreignKey: "solicitud_id" });

// Relaciones Insumo
Insumo.hasMany(MovimientoStock, { foreignKey: "insumo_id" });
MovimientoStock.belongsTo(Insumo, { foreignKey: "insumo_id" });

Usuario.hasMany(MovimientoStock, { foreignKey: "usuario_id" });
MovimientoStock.belongsTo(Usuario, { foreignKey: "usuario_id" });

Oficina.hasMany(MovimientoStock, { foreignKey: "oficina_id" });
MovimientoStock.belongsTo(Oficina, { foreignKey: "oficina_id" });

PedidoInsumo.belongsTo(Usuario, { foreignKey: "usuario_id" });
PedidoInsumo.belongsTo(Oficina, { foreignKey: "oficina_id" });
PedidoInsumo.hasMany(PedidoInsumoDetalle, { foreignKey: "pedido_id" });

PedidoInsumoDetalle.belongsTo(PedidoInsumo, { foreignKey: "pedido_id" });
PedidoInsumoDetalle.belongsTo(Insumo, { foreignKey: "insumo_id" });

module.exports = {
  Role,
  Oficina,
  Usuario,
  Categoria,
  Activo,
  Movimiento,
  Solicitud,
  Notificacion,
  Adjunto,
  Insumo,
  MovimientoStock,
  PedidoInsumo,
  PedidoInsumoDetalle,
};
