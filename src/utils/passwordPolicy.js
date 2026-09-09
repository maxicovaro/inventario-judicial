const MIN_PASSWORD_LENGTH = 12;
const PASSWORD_BCRYPT_ROUNDS = 12;

const PASSWORD_MESSAGE =
  "La contraseña debe tener al menos 12 caracteres e incluir mayúscula, minúscula, número y símbolo";

const validarPassword = (value) => {
  const password = String(value ?? "").trim();

  const valida =
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /\d/.test(password) &&
    /[^A-Za-z0-9]/.test(password);

  return {
    valida,
    password,
    mensaje: valida ? null : PASSWORD_MESSAGE,
  };
};

module.exports = {
  MIN_PASSWORD_LENGTH,
  PASSWORD_BCRYPT_ROUNDS,
  PASSWORD_MESSAGE,
  validarPassword,
};