const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  RESPONSABLE: "RESPONSABLE",
  USUARIO: "USUARIO",
});

const esOficinaCentral = (usuario = {}) =>
  usuario.oficina_es_central === true || usuario.oficina_es_central === 1;

const esAdminGeneral = (usuario = {}) =>
  usuario.role === ROLES.ADMIN && esOficinaCentral(usuario);

const esDireccion = (usuario = {}) => esAdminGeneral(usuario);

const esResponsable = (usuario = {}) => usuario.role === ROLES.RESPONSABLE;

const tieneOficinaAsignada = (usuario = {}) => Boolean(usuario.oficina_id);

const puedeGestionarOficina = (usuario = {}) =>
  esAdminGeneral(usuario) || (esResponsable(usuario) && tieneOficinaAsignada(usuario));

const puedeGestionarDeposito = (usuario = {}) => esAdminGeneral(usuario);

module.exports = {
  ROLES,
  esOficinaCentral,
  esDireccion,
  esAdminGeneral,
  esResponsable,
  tieneOficinaAsignada,
  puedeGestionarOficina,
  puedeGestionarDeposito,
};
