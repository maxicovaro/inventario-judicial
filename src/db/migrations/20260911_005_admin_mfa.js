const { DataTypes } = require("sequelize");

const addColumnIfMissing = async (queryInterface, table, column, definition) => {
  const description = await queryInterface.describeTable(table);
  if (!description[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
};

module.exports = {
  up: async ({ queryInterface }) => {
    await addColumnIfMissing(queryInterface, "usuarios", "mfa_enabled", {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    await addColumnIfMissing(queryInterface, "usuarios", "mfa_secret_enc", {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    });

    await addColumnIfMissing(
      queryInterface,
      "usuarios",
      "mfa_pending_secret_enc",
      {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
    );

    await addColumnIfMissing(
      queryInterface,
      "usuarios",
      "mfa_recovery_codes",
      {
        type: DataTypes.TEXT,
        allowNull: true,
        defaultValue: null,
      },
    );

    await addColumnIfMissing(
      queryInterface,
      "auth_sessions",
      "mfa_verified_at",
      {
        type: DataTypes.DATE,
        allowNull: true,
        defaultValue: null,
      },
    );
  },
};
