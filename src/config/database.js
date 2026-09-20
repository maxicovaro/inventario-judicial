const fs = require("fs");
const { Sequelize } = require("sequelize");
const env = require("./env");

const ssl = env.DB_SSL
  ? {
      minVersion: "TLSv1.2",
      rejectUnauthorized: env.DB_SSL_REJECT_UNAUTHORIZED,
      ...(env.DB_SSL_CA_PATH
        ? { ca: fs.readFileSync(env.DB_SSL_CA_PATH) }
        : {}),
    }
  : undefined;

const sequelize = new Sequelize(env.DB_NAME, env.DB_USER, env.DB_PASSWORD, {
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: "mysql",
  logging: false,
  ...(ssl ? { dialectOptions: { ssl } } : {}),
});

module.exports = sequelize;
