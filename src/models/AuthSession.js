const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AuthSession = sequelize.define(
  "AuthSession",
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
    jti: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    revoked_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
    mfa_verified_at: {
      type: DataTypes.DATE,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    tableName: "auth_sessions",
    timestamps: true,
    indexes: [
      { name: "uq_auth_sessions_jti", unique: true, fields: ["jti"] },
      { name: "ix_auth_sessions_usuario", fields: ["usuario_id"] },
      { name: "ix_auth_sessions_expira", fields: ["expires_at"] },
    ],
  },
);

module.exports = AuthSession;
