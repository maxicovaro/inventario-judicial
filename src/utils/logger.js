const env = require("../config/env");

const normalizeValue = (value) => {
  if (value instanceof Error) {
    const serialized = {
      name: value.name,
      message: value.message,
    };
    if (!env.IS_PRODUCTION && value.stack) serialized.stack = value.stack;
    return serialized;
  }
  return value;
};

const write = (level, event, fields = {}) => {
  const normalizedFields = Object.fromEntries(
    Object.entries(fields)
      .filter(([, value]) => value !== undefined)
      .map(([key, value]) => [key, normalizeValue(value)]),
  );

  const line = JSON.stringify({
    ...normalizedFields,
    timestamp: new Date().toISOString(),
    level,
    event,
    environment: env.DEPLOY_ENV,
    ...(env.DEPLOY_REVISION ? { revision: env.DEPLOY_REVISION } : {}),
  });

  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

module.exports = {
  info: (event, fields) => write("info", event, fields),
  warn: (event, fields) => write("warn", event, fields),
  error: (event, fields) => write("error", event, fields),
};
