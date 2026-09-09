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
    indexes: [
      {
        name: "uq_stock_oficina_insumo_oficina",
        unique: true,
        fields: ["insumo_id", "oficina_id"],
      },
    ],
  },
);

module.exports = StockOficina;