const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const ConsumoOficina = sequelize.define(
  "ConsumoOficina",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    oficina_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    insumo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    mes: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    anio: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad_consumida: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    observaciones: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "consumo_oficina",
    timestamps: true,
  },
);

module.exports = ConsumoOficina;