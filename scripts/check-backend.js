const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const roots = ["server.js", "src", "scripts"];
const files = [];

const collect = (entry) => {
  const absolute = path.resolve(entry);
  const stat = fs.statSync(absolute);

  if (stat.isFile()) {
    if (entry.endsWith(".js")) files.push(entry);
    return;
  }

  for (const child of fs.readdirSync(absolute)) {
    collect(path.join(entry, child));
  }
};

for (const root of roots) {
  collect(root);
}

files.sort();

for (const file of files) {
  const result = spawnSync(process.execPath, ["--check", file], {
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`✗ Sintaxis inválida: ${file}`);
    process.exit(1);
  }
}

console.log(`✓ Sintaxis backend validada en ${files.length} archivos.`);
