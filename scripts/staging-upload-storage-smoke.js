const crypto = require("crypto");
const {
  createStoredFilename,
  deleteUpload,
  mode,
  readUpload,
  saveUpload,
} = require("../src/utils/uploadStorage");

const runtimeEnvironment = () =>
  String(process.env.DEPLOY_ENV || process.env.NODE_ENV || "")
    .trim()
    .toLowerCase();

const main = async () => {
  const environment = runtimeEnvironment();
  if (!["staging", "test"].includes(environment)) {
    throw new Error(
      `staging:upload-storage:smoke sólo puede ejecutarse en staging/test; entorno actual: ${environment || "no definido"}`,
    );
  }

  if (environment === "staging" && mode !== "s3") {
    throw new Error(
      "El smoke H1 exige UPLOAD_STORAGE_MODE=s3 en staging",
    );
  }

  const payload = crypto.randomBytes(64);
  const filename = createStoredFilename("h1-storage-smoke.bin");
  let stored = false;

  try {
    await saveUpload(filename, payload, "application/octet-stream");
    stored = true;

    const recovered = await readUpload(filename);
    if (!recovered || !Buffer.isBuffer(recovered)) {
      throw new Error("El objeto H1 no pudo recuperarse");
    }
    if (!recovered.equals(payload)) {
      throw new Error("El objeto H1 recuperado no coincide byte a byte");
    }

    await deleteUpload(filename);
    stored = false;

    const afterDelete = await readUpload(filename);
    if (afterDelete !== null) {
      throw new Error("El objeto H1 sigue disponible después del borrado");
    }

    console.log(
      JSON.stringify({
        event: "h1_upload_storage_smoke_completed",
        environment,
        storage_mode: mode,
        bytes: payload.length,
        roundtrip_match: true,
        delete_verified: true,
      }),
    );
  } finally {
    if (stored) {
      try {
        await deleteUpload(filename);
      } catch {}
    }
  }
};

main().catch((error) => {
  console.error(`✗ Smoke de object storage H1 falló: ${error.message}`);
  process.exitCode = 1;
});
