require("../../models");

module.exports = {
  up: async ({ sequelize }) => {
    await sequelize.sync({
      force: false,
      alter: false,
      logging: false,
    });
  },
};
