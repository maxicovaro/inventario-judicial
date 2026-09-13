const fs = require("fs");
const path = require("path");

const ALLOWED_ENVIRONMENTS = new Set(["development", "staging"]);
const ALLOWED_PILOT_ROLES = new Set(["RESPONSABLE", "USUARIO"]);

const normalize = (value) => String(value ?? "").trim();
const normalizeEmail = (value) => normalize(value).toLowerCase();

const maskEmail = (value) => {
  const email = normalizeEmail(value);
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(1, local.length - visible.length))}@${domain}`;
};

const loadManifest = (manifestPath) => {
  if (!manifestPath) throw new Error("Indicá --manifest <archivo.json>");
  const absolutePath = path.resolve(manifestPath);
  if (!fs.existsSync(absolutePath)) {
    throw new Error(`No existe el manifiesto: ${absolutePath}`);
  }
  return JSON.parse(fs.readFileSync(absolutePath, "utf8"));
};

const validateManifest = (manifest) => {
  const errors = [];

  const waveId = normalize(manifest?.wave_id);
  const environment = normalize(manifest?.environment).toLowerCase();
  const offices = Array.isArray(manifest?.offices)
    ? manifest.offices.map(normalize).filter(Boolean)
    : [];
  const users = Array.isArray(manifest?.users) ? manifest.users : [];

  if (!waveId) errors.push("wave_id es obligatorio");
  if (!ALLOWED_ENVIRONMENTS.has(environment)) {
    errors.push("environment debe ser development o staging");
  }
  if (offices.length === 0) errors.push("Debe seleccionarse al menos una oficina");
  if (new Set(offices).size !== offices.length) {
    errors.push("La lista de oficinas no puede contener duplicados");
  }
  if (users.length === 0) errors.push("Debe declararse al menos un usuario piloto");

  const emails = new Set();
  users.forEach((user, index) => {
    const prefix = `users[${index}]`;
    const nombre = normalize(user?.nombre);
    const apellido = normalize(user?.apellido);
    const email = normalizeEmail(user?.email);
    const role = normalize(user?.role).toUpperCase();
    const office = normalize(user?.office);

    if (!nombre) errors.push(`${prefix}.nombre es obligatorio`);
    if (!apellido) errors.push(`${prefix}.apellido es obligatorio`);
    if (!/^\S+@\S+\.\S+$/.test(email)) errors.push(`${prefix}.email no es válido`);
    if (emails.has(email)) errors.push(`${prefix}.email está duplicado en la ola`);
    emails.add(email);

    if (!ALLOWED_PILOT_ROLES.has(role)) {
      errors.push(`${prefix}.role debe ser RESPONSABLE o USUARIO`);
    }
    if (!office || !offices.includes(office)) {
      errors.push(`${prefix}.office debe pertenecer a offices`);
    }
  });

  if (manifest?.approved === true) {
    if (!normalize(manifest?.approved_by)) {
      errors.push("approved_by es obligatorio cuando approved=true");
    }
    const approvedAt = normalize(manifest?.approved_at);
    if (!approvedAt || Number.isNaN(Date.parse(approvedAt))) {
      errors.push("approved_at debe ser una fecha válida cuando approved=true");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      ...manifest,
      wave_id: waveId,
      environment,
      offices,
      users: users.map((user) => ({
        nombre: normalize(user.nombre),
        apellido: normalize(user.apellido),
        email: normalizeEmail(user.email),
        role: normalize(user.role).toUpperCase(),
        office: normalize(user.office),
      })),
    },
  };
};

module.exports = {
  ALLOWED_ENVIRONMENTS,
  ALLOWED_PILOT_ROLES,
  loadManifest,
  maskEmail,
  validateManifest,
};
