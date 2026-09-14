const { DataTypes, QueryTypes } = require("sequelize");

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
  const description = await queryInterface.describeTable(table);
  if (!description[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
};

module.exports = {
  up: async ({ sequelize, queryInterface }) => {
    await addColumnIfMissing(queryInterface, "oficinas", "gestiona_deposito", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await addColumnIfMissing(queryInterface, "oficinas", "es_deposito_central", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await sequelize.query(
      "UPDATE oficinas SET gestiona_deposito = 1 WHERE nombre = :nombre",
      {
        replacements: { nombre: "Área Contable" },
        type: QueryTypes.UPDATE,
      },
    );

    await sequelize.query(
      "UPDATE oficinas SET es_deposito_central = 1 WHERE nombre = :nombre",
      {
        replacements: { nombre: "Depósito" },
        type: QueryTypes.UPDATE,
      },
    );
  },
};
