const fs = require("fs");
const path = require("path");
const env = require("../config/env");

const uploadsDir = env.UPLOAD_DIR
  ? path.resolve(env.UPLOAD_DIR)
  : path.join(__dirname, "../../storage/uploads");

const ensureUploadsDir = () => {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
  return uploadsDir;
};

const resolveUploadPath = (filename) => path.join(uploadsDir, filename);

module.exports = {
  uploadsDir,
  ensureUploadsDir,
  resolveUploadPath,
};
