const { DataTypes } = require("sequelize");

const TABLE = "operaciones_idempotentes";
const UNIQUE_INDEX = "uq_idempotencia_usuario_scope_clave";
const ACTIVO_CODE_INDEX = "uq_activos_codigo_interno";

const normalizarNombreTabla = (tabla) => {
  if (typeof tabla === "string") return tabla;
  return tabla?.tableName || tabla?.name || "";
};

module.exports = {
  up: async ({ sequelize, queryInterface }) => {
    // Primero validamos compatibilidad sin modificar ningún dato ni esquema.
    // Los códigos vacíos se consideran ausencia de código y se normalizan después.
    const [duplicados] = await sequelize.query(
      `SELECT codigo_interno, COUNT(*) AS total
       FROM activos
       WHERE codigo_interno IS NOT NULL
         AND TRIM(codigo_interno) <> ''
       GROUP BY codigo_interno
       HAVING COUNT(*) > 1
       LIMIT 10`,
    );

    if (duplicados.length > 0) {
      throw new Error(
        "No se puede aplicar la unicidad de codigo_interno: existen códigos de activo duplicados",
      );
    }

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
    const tieneIndice = indexes.some((index) => index.name === UNIQUE_INDEX);

    if (!tieneIndice) {
      await queryInterface.addIndex(TABLE, ["usuario_id", "scope", "clave"], {
        name: UNIQUE_INDEX,
        unique: true,
      });
    }

    // Un código vacío representa ausencia de código y no debe competir por unicidad.
    await sequelize.query(
      "UPDATE activos SET codigo_interno = NULL WHERE codigo_interno IS NOT NULL AND TRIM(codigo_interno) = ''",
    );

    const activoIndexes = await queryInterface.showIndex("activos");
    const tieneIndiceActivo = activoIndexes.some(
      (index) => index.name === ACTIVO_CODE_INDEX,
    );

    if (!tieneIndiceActivo) {
      await queryInterface.addIndex("activos", ["codigo_interno"], {
        name: ACTIVO_CODE_INDEX,
        unique: true,
      });
    }
  },
};
