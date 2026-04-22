const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Bitacora = sequelize.define(
  "Bitacora",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    accion: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    modulo: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    descripcion: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    tableName: "bitacora",
    timestamps: false,
  },
);

module.exports = Bitacora;