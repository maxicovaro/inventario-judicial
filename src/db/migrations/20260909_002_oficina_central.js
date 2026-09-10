const { DataTypes } = require("sequelize");

const NOMBRE_OFICINA_CENTRAL_LEGACY = "Dirección de Policía Judicial";

const marcarOficinaCentral = async (sequelize, oficinaId) => {
  await sequelize.query("UPDATE oficinas SET es_central = 0");
  await sequelize.query(
    "UPDATE oficinas SET es_central = 1 WHERE id = ?",
    { replacements: [oficinaId] },
  );
};

module.exports = {
  up: async ({ sequelize, queryInterface }) => {
    const columnas = await queryInterface.describeTable("oficinas");

    if (!columnas.es_central) {
      await queryInterface.addColumn("oficinas", "es_central", {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      });
    }

    const [oficinasAdmin] = await sequelize.query(
      `SELECT DISTINCT o.id, o.nombre
       FROM oficinas o
       INNER JOIN usuarios u ON u.oficina_id = o.id
       INNER JOIN roles r ON r.id = u.role_id
       WHERE r.nombre = 'ADMIN'`,
    );

    if (oficinasAdmin.length > 1) {
      throw new Error(
        "No se puede determinar una única oficina central: existen usuarios ADMIN en más de una oficina",
      );
    }

    if (oficinasAdmin.length === 1) {
      await marcarOficinaCentral(sequelize, oficinasAdmin[0].id);
      return;
    }

    const [oficinasExistentes] = await sequelize.query(
      "SELECT COUNT(*) AS total FROM oficinas",
    );
    const totalOficinas = Number(oficinasExistentes[0]?.total || 0);

    if (totalOficinas === 0) {
      return;
    }

    const [oficinaLegacy] = await sequelize.query(
      "SELECT id FROM oficinas WHERE nombre = ?",
      { replacements: [NOMBRE_OFICINA_CENTRAL_LEGACY] },
    );

    if (oficinaLegacy.length !== 1) {
      throw new Error(
        "No se puede determinar la oficina central en una base existente sin usuarios ADMIN",
      );
    }

    await marcarOficinaCentral(sequelize, oficinaLegacy[0].id);
  },
};
