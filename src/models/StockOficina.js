const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const StockOficina = sequelize.define(
  "StockOficina",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    insumo_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    oficina_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
  },
  {
    tableName: "stock_oficina",
    timestamps: true,
  },
);

module.exports = StockOficina;