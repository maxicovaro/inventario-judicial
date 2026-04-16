const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PedidoInsumoDetalle = sequelize.define(
  "PedidoInsumoDetalle",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    articulo_manual: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    cantidad_solicitada: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    tuvo_problema: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
    detalle_problema: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    cantidad_provista: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
  },
  {
    tableName: "pedido_insumos_detalle",
    timestamps: false,
  }
);

module.exports = PedidoInsumoDetalle;