const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");

const assertIncludes = (content, needle, source) => {
  if (!content.includes(needle)) {
    throw new Error(`${source} debe incluir: ${needle}`);
  }
};

const assertAll = (content, needles, source) => {
  for (const needle of needles) {
    assertIncludes(content, needle, source);
  }
};

const p9 = read("docs/P9_1_INCIDENT_RESPONSE.md");
const operations = read("docs/OPERATIONS.md");
const docsIndex = read("docs/README.md");
const issueTemplate = read(".github/ISSUE_TEMPLATE/incident.md");
const packageJson = JSON.parse(read("package.json"));

assertAll(
  p9,
  [
    "SEV-1",
    "SEV-2",
    "SEV-3",
    "Incident Commander",
    "hasta 15 minutos",
    "hasta 30 minutos",
    "Stop conditions del piloto",
    "DEPLOY_REVISION",
    "request_id",
    "MTTA",
    "MTTR",
    "RPO",
    "RTO",
    "No se desactiva autenticación, MFA, autorización por oficina",
    "No se eliminan locks de stock, idempotencia ni transacciones",
    "No iniciar P9.2 antes",
  ],
  "docs/P9_1_INCIDENT_RESPONSE.md",
);

assertAll(
  operations,
  [
    "SEV-1",
    "SEV-2",
    "SEV-3",
    "RPO objetivo",
    "RTO objetivo",
    "P9.1",
    "P9_1_INCIDENT_RESPONSE.md",
    "no debilitar autenticación",
    "no retirar locks de stock",
  ],
  "docs/OPERATIONS.md",
);

assertAll(
  issueTemplate,
  [
    "No incluir contraseñas, tokens, secretos",
    "DEPLOY_REVISION",
    "Request ID(s)",
    "Stop condition",
    "Timeline",
    "RPO real",
    "RTO real",
    "Incident Commander",
  ],
  ".github/ISSUE_TEMPLATE/incident.md",
);

assertAll(
  docsIndex,
  ["P9_1_INCIDENT_RESPONSE.md", "P9.1"],
  "docs/README.md",
);

if (
  packageJson.scripts?.["test:p9-incident-response-contracts"] !==
  "node scripts/test-p9-incident-response-contracts.js"
) {
  throw new Error(
    "package.json debe exponer test:p9-incident-response-contracts",
  );
}

if (
  !String(packageJson.scripts?.test || "").includes(
    "test:p9-incident-response-contracts",
  )
) {
  throw new Error("npm test debe ejecutar test:p9-incident-response-contracts");
}

console.log("✓ P9.1 incident response contracts validados.");
