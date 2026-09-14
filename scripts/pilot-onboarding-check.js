const sequelize = require("../src/config/database");
const env = require("../src/config/env");
const { Usuario, Role, Oficina } = require("../src/models");
const {
  loadManifest,
  maskEmail,
  validateManifest,
} = require("./pilot-onboarding-utils");

const getArg = (name, fallback = null) => {
  const direct = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (direct) return direct.slice(name.length + 1);
  const index = process.argv.indexOf(name);
  if (index >= 0 && process.argv[index + 1]) return process.argv[index + 1];
  return fallback;
};

const manifestPath = getArg("--manifest");
const mode = String(getArg("--mode", "plan")).trim().toLowerCase();

const fail = (messages) => {
  const items = Array.isArray(messages) ? messages : [messages];
  for (const message of items) console.error(`✗ ${message}`);
  process.exitCode = 2;
};

const main = async () => {
  if (!["plan", "verify"].includes(mode)) {
    return fail("--mode debe ser plan o verify");
  }

  const validation = validateManifest(loadManifest(manifestPath));
  if (!validation.valid) return fail(validation.errors);

  const manifest = validation.normalized;
  if (manifest.environment !== env.DEPLOY_ENV) {
    return fail(
      `El manifiesto declara ${manifest.environment} pero DEPLOY_ENV=${env.DEPLOY_ENV}`,
    );
  }

  if (mode === "verify" && manifest.approved !== true) {
    return fail("verify exige un manifiesto con approved=true");
  }

  await sequelize.authenticate();

  const offices = await Oficina.findAll({
    where: { nombre: manifest.offices },
    attributes: ["id", "nombre", "es_central"],
    raw: true,
  });
  const officeByName = new Map(offices.map((office) => [office.nombre, office]));

  const missingOffices = manifest.offices.filter((name) => !officeByName.has(name));
  if (missingOffices.length > 0) {
    return fail(missingOffices.map((name) => `Oficina inexistente: ${name}`));
  }

  const roles = await Role.findAll({
    where: { nombre: ["ADMIN", "RESPONSABLE", "USUARIO"] },
    attributes: ["id", "nombre"],
    raw: true,
  });
  const roleByName = new Map(roles.map((role) => [role.nombre, role]));

  for (const requiredRole of ["ADMIN", "RESPONSABLE", "USUARIO"]) {
    if (!roleByName.has(requiredRole)) {
      return fail(`Falta el rol base ${requiredRole}`);
    }
  }

  const activeAdmins = await Usuario.findAll({
    where: { role_id: roleByName.get("ADMIN").id, activo: true },
    attributes: ["id", "email", "oficina_id", "mfa_enabled"],
    raw: true,
  });

  if (activeAdmins.length === 0) return fail("No existe ningún ADMIN activo");

  const centralOfficeIds = new Set(
    (
      await Oficina.findAll({
        where: { es_central: true },
        attributes: ["id"],
        raw: true,
      })
    ).map((office) => Number(office.id)),
  );

  const invalidAdmins = activeAdmins.filter(
    (admin) => !centralOfficeIds.has(Number(admin.oficina_id)),
  );
  if (invalidAdmins.length > 0) {
    return fail("Existe al menos un ADMIN activo fuera de la oficina central");
  }

  if (["staging", "production"].includes(env.DEPLOY_ENV)) {
    const adminsWithoutMfa = activeAdmins.filter((admin) => !admin.mfa_enabled);
    if (adminsWithoutMfa.length > 0) {
      return fail("Todos los ADMIN activos deben tener MFA habilitado antes del piloto");
    }
  }

  const existingUsers = await Usuario.findAll({
    where: { email: manifest.users.map((user) => user.email) },
    attributes: ["id", "email", "role_id", "oficina_id", "activo"],
    raw: true,
  });
  const userByEmail = new Map(existingUsers.map((user) => [user.email, user]));

  const results = [];
  const errors = [];

  for (const planned of manifest.users) {
    const role = roleByName.get(planned.role);
    const office = officeByName.get(planned.office);
    const existing = userByEmail.get(planned.email);

    if (mode === "plan") {
      results.push({
        email: maskEmail(planned.email),
        role: planned.role,
        office: planned.office,
        status: existing ? "YA_EXISTE" : "LISTO_PARA_ALTA_MANUAL",
      });
      if (existing) {
        errors.push(`Ya existe ${maskEmail(planned.email)}; revisar antes del alta`);
      }
      continue;
    }

    if (!existing) {
      errors.push(`Falta el usuario ${maskEmail(planned.email)}`);
      continue;
    }

    const matches =
      Number(existing.role_id) === Number(role.id) &&
      Number(existing.oficina_id) === Number(office.id) &&
      Boolean(existing.activo);

    results.push({
      email: maskEmail(planned.email),
      role: planned.role,
      office: planned.office,
      status: matches ? "VERIFICADO" : "CONFIGURACION_INCORRECTA",
    });

    if (!matches) {
      errors.push(
        `Rol/oficina/estado no coincide para ${maskEmail(planned.email)}`,
      );
    }
  }

  console.log(`Ola: ${manifest.wave_id}`);
  console.log(`Entorno: ${manifest.environment}`);
  console.log(`Modo: ${mode}`);
  console.log(`Aprobada: ${manifest.approved === true ? "sí" : "no"}`);
  console.table(results);

  if (errors.length > 0) return fail(errors);

  if (mode === "plan") {
    console.log("✓ Preflight read-only completado. No se modificó la base de datos.");
    if (manifest.approved !== true) {
      console.log("ℹ La ola todavía no está aprobada; no realizar altas reales.");
    }
  } else {
    console.log("✓ Primera ola verificada contra la base. No se modificó la base de datos.");
  }
};

main()
  .catch((error) => {
    console.error("✗ Error en preflight de onboarding:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sequelize.close();
  });
