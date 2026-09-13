const crypto = require("crypto");

const round = (value, digits = 2) => {
  if (!Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
};

const stripSequelizePrefix = (sql) =>
  String(sql || "")
    .replace(/^Execut(?:ed|ing) \([^)]*\):\s*/i, "")
    .trim();

const normalizeSql = (sql) =>
  stripSequelizePrefix(sql)
    .replace(/X'[0-9A-F]+'/gi, "?")
    .replace(/'(?:''|\\.|[^'])*'/g, "?")
    .replace(/\b\d+(?:\.\d+)?\b/g, "?")
    .replace(/\s+/g, " ")
    .trim();

const queryType = (sql) => {
  const match = normalizeSql(sql).match(/^([A-Z]+)/i);
  return match ? match[1].toUpperCase() : "UNKNOWN";
};

const querySignature = (sql) =>
  crypto.createHash("sha256").update(normalizeSql(sql)).digest("hex").slice(0, 16);

const extractTables = (sql) => {
  const cleaned = stripSequelizePrefix(sql);
  const tables = new Set();
  const pattern = /\b(?:FROM|JOIN|UPDATE|INTO)\s+`?([A-Za-z0-9_]+)`?/gi;
  let match;
  while ((match = pattern.exec(cleaned)) !== null) {
    tables.add(match[1]);
  }
  return [...tables].sort();
};

const summarizeExplainRows = (rows) =>
  (Array.isArray(rows) ? rows : []).map((row) => ({
    id: row.id === undefined ? null : Number(row.id),
    select_type: row.select_type || null,
    table: row.table || null,
    partitions: row.partitions || null,
    access_type: row.type || null,
    possible_keys: row.possible_keys
      ? String(row.possible_keys).split(",").filter(Boolean)
      : [],
    key: row.key || null,
    key_len: row.key_len || null,
    ref: row.ref || null,
    estimated_rows: row.rows === undefined || row.rows === null ? null : Number(row.rows),
    filtered_pct:
      row.filtered === undefined || row.filtered === null ? null : Number(row.filtered),
    extra: row.Extra || "",
  }));

const explainFlags = (plan) => {
  const flags = new Set();
  for (const row of plan) {
    if (row.access_type === "ALL") flags.add("full_scan");
    if (!row.key && row.possible_keys.length > 0) flags.add("possible_index_not_used");
    const extra = String(row.extra || "").toLowerCase();
    if (extra.includes("filesort")) flags.add("filesort");
    if (extra.includes("temporary")) flags.add("temporary_table");
    if (Number(row.estimated_rows || 0) >= 1000) flags.add("high_rows_estimate");
  }
  return [...flags].sort();
};

const aggregateScenario = (name, samples) => {
  const signatures = new Map();
  const sampleSummaries = [];

  for (const sample of samples) {
    const perSignature = new Map();
    let sqlTotal = 0;
    let sqlMax = 0;

    for (const query of sample.queries) {
      const duration = Number.isFinite(query.duration_ms) ? query.duration_ms : 0;
      sqlTotal += duration;
      sqlMax = Math.max(sqlMax, duration);
      perSignature.set(query.signature, (perSignature.get(query.signature) || 0) + 1);

      if (!signatures.has(query.signature)) {
        signatures.set(query.signature, {
          signature: query.signature,
          type: query.type,
          normalized_sql: query.normalized_sql,
          tables: query.tables,
          executions: 0,
          total_duration_ms: 0,
          max_duration_ms: 0,
          max_per_request: 0,
          raw_sql: query.raw_sql,
        });
      }

      const aggregate = signatures.get(query.signature);
      aggregate.executions += 1;
      aggregate.total_duration_ms += duration;
      aggregate.max_duration_ms = Math.max(aggregate.max_duration_ms, duration);
    }

    for (const [signature, count] of perSignature.entries()) {
      const aggregate = signatures.get(signature);
      aggregate.max_per_request = Math.max(aggregate.max_per_request, count);
    }

    sampleSummaries.push({
      index: sample.index,
      status: sample.status,
      http_ms: round(sample.http_ms),
      query_count: sample.queries.length,
      sql_total_ms: round(sqlTotal),
      sql_max_ms: round(sqlMax),
    });
  }

  const querySummaries = [...signatures.values()]
    .map((item) => ({
      signature: item.signature,
      type: item.type,
      normalized_sql: item.normalized_sql,
      tables: item.tables,
      executions: item.executions,
      per_request_avg: round(item.executions / Math.max(samples.length, 1)),
      max_per_request: item.max_per_request,
      total_duration_ms: round(item.total_duration_ms),
      avg_duration_ms: round(item.total_duration_ms / Math.max(item.executions, 1)),
      max_duration_ms: round(item.max_duration_ms),
      _raw_sql: item.raw_sql,
    }))
    .sort((a, b) => (b.total_duration_ms || 0) - (a.total_duration_ms || 0));

  const queryCounts = sampleSummaries.map((sample) => sample.query_count);
  const httpDurations = sampleSummaries.map((sample) => sample.http_ms || 0);
  const repeated = querySummaries
    .filter((item) => item.type === "SELECT" && item.max_per_request > 1)
    .map(({ _raw_sql, ...item }) => item);

  return {
    name,
    samples: samples.length,
    errors: sampleSummaries.filter((sample) => sample.status < 200 || sample.status >= 400).length,
    query_count: {
      min: queryCounts.length ? Math.min(...queryCounts) : 0,
      max: queryCounts.length ? Math.max(...queryCounts) : 0,
      avg: round(queryCounts.reduce((sum, value) => sum + value, 0) / Math.max(queryCounts.length, 1)),
    },
    http_ms: {
      avg: round(httpDurations.reduce((sum, value) => sum + value, 0) / Math.max(httpDurations.length, 1)),
      max: round(Math.max(...httpDurations, 0)),
    },
    samples_detail: sampleSummaries,
    queries: querySummaries,
    repeated_query_candidates: repeated,
  };
};

module.exports = {
  round,
  stripSequelizePrefix,
  normalizeSql,
  queryType,
  querySignature,
  extractTables,
  summarizeExplainRows,
  explainFlags,
  aggregateScenario,
};
