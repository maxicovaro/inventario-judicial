const express = require("express");
const sequelize = require("../config/database");
const env = require("../config/env");
const logger = require("../utils/logger");

const router = express.Router();

const withTimeout = (promise, timeoutMs) =>
  Promise.race([
    promise,
    new Promise((_, reject) => {
      const timer = setTimeout(
        () => reject(new Error("health_db_timeout")),
        timeoutMs,
      );
      timer.unref?.();
    }),
  ]);

router.get("/live", (req, res) => {
  return res.status(200).json({
    status: "ok",
    service: "inventario-judicial",
    uptime_seconds: Math.floor(process.uptime()),
  });
});

router.get("/ready", async (req, res) => {
  try {
    await withTimeout(
      sequelize.query("SELECT 1", { logging: false }),
      env.HEALTH_DB_TIMEOUT_MS,
    );

    return res.status(200).json({
      status: "ready",
      service: "inventario-judicial",
    });
  } catch (error) {
    logger.warn("health_readiness_failed", {
      request_id: req.requestId,
      error,
    });

    return res.status(503).json({
      status: "not_ready",
      service: "inventario-judicial",
    });
  }
});

module.exports = router;
