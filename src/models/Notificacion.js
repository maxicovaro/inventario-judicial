const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Notificacion = sequelize.define(
  "Notificacion",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    titulo: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    mensaje: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    leida: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },

    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
  },
  {
    tableName: "notificaciones",
    timestamps: true,
  }
);

module.exports = Notificacion;