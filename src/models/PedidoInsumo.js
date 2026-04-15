const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PedidoInsumo = sequelize.define(
  "PedidoInsumo",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    estado: {
      type: DataTypes.ENUM(
        "BORRADOR",
        "ENVIADO",
        "EN_REVISION",
        "APROBADO",
        "ENTREGADO",
        "RECHAZADO"
      ),
      defaultValue: "BORRADOR",
    },
    cantidad_hechos_delictivos: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    cantidad_autopsias: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "pedidos_insumos",
    timestamps: true,
  }
);

module.exports = PedidoInsumo;