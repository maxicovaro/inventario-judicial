const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  RESPONSABLE: "RESPONSABLE",
  USUARIO: "USUARIO",
});

const esOficinaCentral = (usuario = {}) =>
  usuario.oficina_es_central === true || usuario.oficina_es_central === 1;

const oficinaGestionaDeposito = (usuario = {}) =>
  usuario.oficina_gestiona_deposito === true ||
  usuario.oficina_gestiona_deposito === 1;

const esAdminGeneral = (usuario = {}) =>
  usuario.role === ROLES.ADMIN && esOficinaCentral(usuario);

const esDireccion = (usuario = {}) => esAdminGeneral(usuario);

const esResponsable = (usuario = {}) => usuario.role === ROLES.RESPONSABLE;

const tieneOficinaAsignada = (usuario = {}) => Boolean(usuario.oficina_id);

const puedeGestionarOficina = (usuario = {}) =>
  esAdminGeneral(usuario) || (esResponsable(usuario) && tieneOficinaAsignada(usuario));

const puedeGestionarDeposito = (usuario = {}) =>
  esAdminGeneral(usuario) ||
  (esResponsable(usuario) &&
    tieneOficinaAsignada(usuario) &&
    oficinaGestionaDeposito(usuario));

module.exports = {
  ROLES,
  esOficinaCentral,
  oficinaGestionaDeposito,
  esDireccion,
  esAdminGeneral,
  esResponsable,
  tieneOficinaAsignada,
  puedeGestionarOficina,
  puedeGestionarDeposito,
};
