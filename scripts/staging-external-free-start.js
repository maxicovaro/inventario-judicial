const { validateDeployment } = require("./deploy-preflight");

const main = async () => {
  const preflight = validateDeployment(process.env);
  if (!preflight.ok) {
    throw new Error(
      `Preflight external-free rechazado: ${preflight.errors.join("; ")}`,
    );
  }

  console.log(
    JSON.stringify({
      event: "h1_external_free_preflight_passed",
      environment: preflight.summary.deploy_env,
      revision: preflight.summary.revision,
      database: preflight.summary.db_name,
      topology: preflight.summary.staging_topology,
      db_ssl: preflight.summary.db_ssl,
      serve_frontend_static: preflight.summary.serve_frontend_static,
    }),
  );

  const { start } = require("../server");
  await start();
};

main().catch((error) => {
  console.error(`✗ H1 external-free no inició: ${error.message}`);
  process.exitCode = 1;
});
