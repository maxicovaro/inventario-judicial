const assert = require("assert");
const {
  stripSequelizePrefix,
  normalizeSql,
  queryType,
  querySignature,
  extractTables,
  summarizeExplainRows,
  explainFlags,
  aggregateScenario,
} = require("./performance-profile-utils");

const raw = "Executed (default): SELECT `Activo`.`id` FROM `activos` AS `Activo` INNER JOIN `oficinas` AS `Oficina` ON `Activo`.`oficina_id` = `Oficina`.`id` WHERE `Activo`.`oficina_id` = 7 AND `Activo`.`nombre` = 'Equipo 123' ORDER BY `Activo`.`id` DESC;";
const stripped = stripSequelizePrefix(raw);
assert.ok(stripped.startsWith("SELECT"));

const normalized = normalizeSql(raw);
assert.ok(!normalized.includes("Equipo 123"));
assert.ok(!normalized.includes("= 7"));
assert.match(normalized, /oficina_id` = \?/);
assert.strictEqual(queryType(raw), "SELECT");
assert.strictEqual(querySignature(raw), querySignature(normalized));
assert.deepStrictEqual(extractTables(raw), ["activos", "oficinas"]);

const plan = summarizeExplainRows([
  {
    id: 1,
    select_type: "SIMPLE",
    table: "Activo",
    type: "ALL",
    possible_keys: "idx_oficina,PRIMARY",
    key: null,
    key_len: null,
    ref: null,
    rows: 6000,
    filtered: 10,
    Extra: "Using where; Using filesort",
  },
]);
assert.deepStrictEqual(plan[0].possible_keys, ["idx_oficina", "PRIMARY"]);
assert.deepStrictEqual(explainFlags(plan), [
  "filesort",
  "full_scan",
  "high_rows_estimate",
  "possible_index_not_used",
]);

const signature = querySignature(raw);
const scenario = aggregateScenario("activos_admin", [
  {
    index: 1,
    status: 200,
    http_ms: 20,
    queries: [
      {
        signature,
        type: "SELECT",
        normalized_sql: normalized,
        tables: ["activos", "oficinas"],
        duration_ms: 5,
        raw_sql: stripped,
      },
      {
        signature,
        type: "SELECT",
        normalized_sql: normalized,
        tables: ["activos", "oficinas"],
        duration_ms: 6,
        raw_sql: stripped,
      },
    ],
  },
]);
assert.strictEqual(scenario.query_count.min, 2);
assert.strictEqual(scenario.query_count.max, 2);
assert.strictEqual(scenario.repeated_query_candidates.length, 1);
assert.strictEqual(scenario.queries[0].max_per_request, 2);
assert.strictEqual(scenario.queries[0].total_duration_ms, 11);

console.log("Utilidades de perfilado P8.1 validadas correctamente.");
