export const esAdminGeneral = (usuario = {}) =>
  usuario.role === "ADMIN" && Boolean(usuario.oficina_es_central);

export const esResponsable = (usuario = {}) => usuario.role === "RESPONSABLE";

export const puedeGestionarOficina = (usuario = {}) =>
  esAdminGeneral(usuario) || (esResponsable(usuario) && Boolean(usuario.oficina_id));

export const puedeGestionarDeposito = (usuario = {}) =>
  esAdminGeneral(usuario) ||
  (esResponsable(usuario) &&
    Boolean(usuario.oficina_id) &&
    Boolean(usuario.oficina_gestiona_deposito));
