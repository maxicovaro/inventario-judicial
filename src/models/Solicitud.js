const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Solicitud = sequelize.define(
  "Solicitud",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    tipo: {
      type: DataTypes.ENUM(
        "REPOSICION",
        "REPARACION",
        "BAJA",
        "TRASLADO",
        "ADQUISICION"
      ),
      allowNull: false,
    },

    descripcion: {
      type: DataTypes.TEXT,
      allowNull: false,
    },

    estado: {
      type: DataTypes.ENUM(
        "PENDIENTE",
        "APROBADA",
        "RECHAZADA",
        "EN_PROCESO",
        "FINALIZADA"
      ),
      defaultValue: "PENDIENTE",
    },

    prioridad: {
      type: DataTypes.ENUM("BAJA", "MEDIA", "ALTA"),
      defaultValue: "MEDIA",
    },

    respuesta_admin: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    fecha: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },

    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    oficina_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },

    activo_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
  },
  {
    tableName: "solicitudes",
    timestamps: true,
  }
);

module.exports = Solicitud;