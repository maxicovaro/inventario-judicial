const normalizar = (texto = "") =>
  texto
    .toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const obtenerNombreOficina = (usuario) => {
  return normalizar(
    usuario?.oficina_nombre ||
      usuario?.Oficina?.nombre ||
      usuario?.oficina ||
      "",
  );
};

const esDireccion = (usuario) => {
  const oficina = obtenerNombreOficina(usuario);
  return oficina.includes("DIRECCION") && oficina.includes("POLICIA JUDICIAL");
};

const esDeposito = (usuario) => {
  const oficina = obtenerNombreOficina(usuario);
  return oficina.includes("DEPOSITO");
};

const esContable = (usuario) => {
  const oficina = obtenerNombreOficina(usuario);
  return oficina.includes("CONTABLE");
};

const esAdminGeneral = (usuario) => {
  return usuario?.role === "ADMIN" && esDireccion(usuario);
};

const puedeGestionarDeposito = (usuario) => {
  return (
    usuario?.role === "ADMIN" && (esDireccion(usuario) || esDeposito(usuario))
  );
};

const puedeVerReportesGlobales = (usuario) => {
  return (
    usuario?.role === "ADMIN" && (esDireccion(usuario) || esContable(usuario))
  );
};

module.exports = {
  esDireccion,
  esDeposito,
  esContable,
  esAdminGeneral,
  puedeGestionarDeposito,
  puedeVerReportesGlobales,
};
