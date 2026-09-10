const fs = require("fs");
const path = require("path");
const {
  databaseConfig,
  metadataPathFor,
  mysqlEnvironment,
  run,
  sha256File,
} = require("./db-cli-utils");

const argValue = (name) => {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : null;
};

const timestamp = () => new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

const main = () => {
  const config = databaseConfig();
  const requestedOutput = argValue("--output");
  const output = path.resolve(
    requestedOutput || path.join("backups", `inventario-${timestamp()}.sql`),
  );

  fs.mkdirSync(path.dirname(output), { recursive: true });

  const dumpCommand = process.env.MYSQLDUMP_BIN || "mysqldump";
  const version = run(dumpCommand, ["--version"]);
  const versionText = String(version.stdout || version.stderr || "").trim();
  const help = run(dumpCommand, ["--help"]);
  const helpText = String(help.stdout || help.stderr || "");

  const args = [
    `--host=${config.host}`,
    `--port=${config.port}`,
    `--user=${config.user}`,
    "--single-transaction",
    "--quick",
    "--triggers",
    "--hex-blob",
    "--default-character-set=utf8mb4",
  ];

  if (/set-gtid-purged/i.test(helpText)) {
    args.push("--set-gtid-purged=OFF");
  }

  if (/no-tablespaces/i.test(helpText)) {
    args.push("--no-tablespaces");
  }

  args.push(config.name);

  const fd = fs.openSync(output, "w");
  try {
    run(dumpCommand, args, {
      env: mysqlEnvironment(config.password),
      stdio: ["ignore", fd, "pipe"],
      encoding: null,
    });
  } catch (error) {
    try {
      fs.unlinkSync(output);
    } catch {}
    throw error;
  } finally {
    fs.closeSync(fd);
  }

  const stats = fs.statSync(output);
  if (stats.size < 128) {
    fs.unlinkSync(output);
    throw new Error("mysqldump generó un archivo vacío o inválido");
  }

  const sha256 = sha256File(output);
  const metadata = {
    format: "mysql-sql",
    database: config.name,
    created_at: new Date().toISOString(),
    bytes: stats.size,
    sha256,
    dump_tool: versionText,
  };

  fs.writeFileSync(
    metadataPathFor(output),
    `${JSON.stringify(metadata, null, 2)}\n`,
    "utf8",
  );

  console.log(`✓ Backup creado: ${output}`);
  console.log(`✓ SHA-256: ${sha256}`);
  console.log(`✓ Bytes: ${stats.size}`);
};

try {
  main();
} catch (error) {
  console.error(`✗ Backup falló: ${error.message}`);
  process.exitCode = 1;
}
