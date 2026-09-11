const env = require("./src/config/env");
const sequelize = require("./src/config/database");
require("./src/models");
const app = require("./src/app");
const logger = require("./src/utils/logger");

let server = null;
let shuttingDown = false;

const closeHttpServer = () =>
  new Promise((resolve, reject) => {
    if (!server) return resolve();

    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });

    server.closeIdleConnections?.();
  });

const shutdown = async (reason, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info("shutdown_started", { reason });

  const forceExit = setTimeout(() => {
    logger.error("shutdown_timeout", {
      reason,
      timeout_ms: env.SHUTDOWN_TIMEOUT_MS,
    });
    process.exit(1);
  }, env.SHUTDOWN_TIMEOUT_MS);

  try {
    await closeHttpServer();
    await sequelize.close();
    clearTimeout(forceExit);
    logger.info("shutdown_completed", { reason });
    process.exit(exitCode);
  } catch (error) {
    clearTimeout(forceExit);
    logger.error("shutdown_failed", { reason, error });
    process.exit(1);
  }
};

const registerProcessHandlers = () => {
  process.once("SIGTERM", () => void shutdown("SIGTERM", 0));
  process.once("SIGINT", () => void shutdown("SIGINT", 0));
  process.once("uncaughtException", (error) => {
    logger.error("uncaught_exception", { error });
    void shutdown("uncaughtException", 1);
  });
  process.once("unhandledRejection", (error) => {
    logger.error("unhandled_rejection", { error });
    void shutdown("unhandledRejection", 1);
  });
};

const start = async () => {
  await sequelize.authenticate();
  logger.info("database_connected", { database: env.DB_NAME });

  server = app.listen(env.PORT, () => {
    logger.info("server_started", {
      node_environment: env.NODE_ENV,
      port: env.PORT,
    });
  });

  registerProcessHandlers();
  return server;
};

if (require.main === module) {
  start().catch((error) => {
    logger.error("server_start_failed", { error });
    process.exitCode = 1;
  });
}

module.exports = { start, shutdown };
