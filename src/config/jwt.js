const JWT_ALGORITHM = "HS256";
const JWT_ISSUER = "inventario-judicial-api";
const JWT_AUDIENCE = "inventario-frontend";
const JWT_TTL_SECONDS = 8 * 60 * 60;

const opcionesFirmaJwt = ({ jti, subject }) => ({
  algorithm: JWT_ALGORITHM,
  expiresIn: JWT_TTL_SECONDS,
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
  jwtid: jti,
  subject: String(subject),
});

const opcionesVerificacionJwt = Object.freeze({
  algorithms: [JWT_ALGORITHM],
  issuer: JWT_ISSUER,
  audience: JWT_AUDIENCE,
});

module.exports = Object.freeze({
  JWT_ALGORITHM,
  JWT_ISSUER,
  JWT_AUDIENCE,
  JWT_TTL_SECONDS,
  opcionesFirmaJwt,
  opcionesVerificacionJwt,
});
