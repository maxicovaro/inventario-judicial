const { DataTypes } = require("sequelize");

const TABLE = "auth_sessions";
const UNIQUE_JTI = "uq_auth_sessions_jti";
const IDX_USUARIO = "ix_auth_sessions_usuario";
const IDX_EXPIRA = "ix_auth_sessions_expira";

const normalizarNombreTabla = (tabla) => {
  if (typeof tabla === "string") return tabla;
  return tabla?.tableName || tabla?.name || "";
};

module.exports = {
  up: async ({ queryInterface }) => {
    const tablas = await queryInterface.showAllTables();
    const existe = tablas.some(
      (tabla) => normalizarNombreTabla(tabla).toLowerCase() === TABLE,
    );

    if (!existe) {
      await queryInterface.createTable(TABLE, {
        id: {
          type: DataTypes.BIGINT.UNSIGNED,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        usuario_id: {
          type: DataTypes.INTEGER,
          allowNull: false,
          references: {
            model: "usuarios",
            key: "id",
          },
          onUpdate: "CASCADE",
          onDelete: "CASCADE",
        },
        jti: {
          type: DataTypes.STRING(64),
          allowNull: false,
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
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        updatedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      });
    }

    const indexes = await queryInterface.showIndex(TABLE);
    const nombres = new Set(indexes.map((index) => index.name));

    if (!nombres.has(UNIQUE_JTI)) {
      await queryInterface.addIndex(TABLE, ["jti"], {
        name: UNIQUE_JTI,
        unique: true,
      });
    }

    if (!nombres.has(IDX_USUARIO)) {
      await queryInterface.addIndex(TABLE, ["usuario_id"], {
        name: IDX_USUARIO,
      });
    }

    if (!nombres.has(IDX_EXPIRA)) {
      await queryInterface.addIndex(TABLE, ["expires_at"], {
        name: IDX_EXPIRA,
      });
    }
  },
};
