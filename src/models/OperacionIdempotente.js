const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OperacionIdempotente = sequelize.define(
  "OperacionIdempotente",
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    usuario_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    scope: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    clave: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    request_hash: {
      type: DataTypes.STRING(64),
      allowNull: false,
    },
    status_code: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    response_body: {
      type: DataTypes.TEXT("long"),
      allowNull: true,
    },
  },
  {
    tableName: "operaciones_idempotentes",
    timestamps: true,
    indexes: [
      {
        name: "uq_idempotencia_usuario_scope_clave",
        unique: true,
        fields: ["usuario_id", "scope", "clave"],
      },
    ],
  },
);

module.exports = OperacionIdempotente;
