const { DataTypes } = require("sequelize");

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
  const description = await queryInterface.describeTable(table);
  if (!description[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
};

const removeIndexIfExists = async (queryInterface, table, indexName) => {
  const indexes = await queryInterface.showIndex(table);
  if (indexes.some((index) => index.name === indexName)) {
    await queryInterface.removeIndex(table, indexName);
  }
};

const addIndexIfMissing = async (queryInterface, table, fields, options) => {
  const indexes = await queryInterface.showIndex(table);
  if (!indexes.some((index) => index.name === options.name)) {
    await queryInterface.addIndex(table, fields, options);
  }
};

module.exports = {
  up: async ({ sequelize, queryInterface }) => {
    await addColumnIfMissing(queryInterface, "pedidos_insumos", "tipo", {
      type: DataTypes.ENUM("MENSUAL", "COMPLEMENTARIO"),
      allowNull: false,
      defaultValue: "MENSUAL",
    });

    await addColumnIfMissing(
      queryInterface,
      "pedidos_insumos",
      "clave_mensual_unica",
      {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 1,
      },
    );

    await sequelize.query(
      "UPDATE pedidos_insumos SET tipo = 'MENSUAL' WHERE tipo IS NULL",
    );
    await sequelize.query(
      "UPDATE pedidos_insumos SET clave_mensual_unica = 1 WHERE tipo = 'MENSUAL' AND clave_mensual_unica IS NULL",
    );
    await sequelize.query(
      "UPDATE pedidos_insumos SET clave_mensual_unica = NULL WHERE tipo = 'COMPLEMENTARIO'",
    );

    // Crear primero el índice nuevo. En instalaciones existentes MySQL puede estar
    // usando el índice único anterior como índice de soporte de la FK oficina_id;
    // eliminarlo antes de que exista otro índice con oficina_id como prefijo hace
    // que MySQL rechace el DROP INDEX. El índice nuevo mantiene ese soporte y
    // permite retirar luego la unicidad antigua sin tocar la clave foránea.
    await addIndexIfMissing(
      queryInterface,
      "pedidos_insumos",
      ["oficina_id", "mes", "anio", "clave_mensual_unica"],
      {
        name: "uq_pedido_mensual_oficina_mes_anio",
        unique: true,
      },
    );

    await removeIndexIfExists(
      queryInterface,
      "pedidos_insumos",
      "uq_pedido_oficina_mes_anio",
    );
  },
};
