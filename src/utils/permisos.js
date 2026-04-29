const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const esDireccion = (usuario = {}) => {
  const oficinaNombre = normalizar(usuario.oficina_nombre || "");

  return (
    usuario.role === "ADMIN" &&
    oficinaNombre.includes("DIRECCION") &&
    oficinaNombre.includes("POLICIA JUDICIAL")
  );
};

const esAdminGeneral = (usuario = {}) => {
  return esDireccion(usuario);
};

const puedeGestionarDeposito = (usuario = {}) => {
  return esDireccion(usuario);
};

module.exports = {
  normalizar,
  esDireccion,
  esAdminGeneral,
  puedeGestionarDeposito,
};