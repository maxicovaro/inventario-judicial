const assert = require("assert");
const fs = require("fs");
const path = require("path");
const { validarPassword } = require("../src/utils/passwordPolicy");

let pruebas = 0;
const probar = (descripcion, fn) => {
  fn();
  pruebas += 1;
  console.log(`OK ${pruebas}: ${descripcion}`);
};

probar("rechaza contraseña corta", () => {
  assert.strictEqual(validarPassword("Ab1!corto").valida, false);
});

probar("rechaza contraseña sin mayúscula", () => {
  assert.strictEqual(validarPassword("abcdefghi12!").valida, false);
});

probar("rechaza contraseña sin minúscula", () => {
  assert.strictEqual(validarPassword("ABCDEFGHI12!").valida, false);
});

probar("rechaza contraseña sin número", () => {
  assert.strictEqual(validarPassword("Abcdefghijk!").valida, false);
});

probar("rechaza contraseña sin símbolo", () => {
  assert.strictEqual(validarPassword("Abcdefghijk1").valida, false);
});

probar("acepta contraseña fuerte", () => {
  assert.strictEqual(validarPassword("Inventario#2026").valida, true);
});

const seed = fs.readFileSync(
  path.join(__dirname, "../src/seeders/initialData.js"),
  "utf8",
);
const server = fs.readFileSync(path.join(__dirname, "../server.js"), "utf8");
const authMiddleware = fs.readFileSync(
  path.join(__dirname, "../src/middlewares/authMiddleware.js"),
  "utf8",
);
const usuariosFrontend = fs.readFileSync(
  path.join(__dirname, "../inventario-frontend/src/pages/Usuarios.jsx"),
  "utf8",
);

probar("el seeder no contiene Admin1234", () => {
  assert.doesNotMatch(seed, /Admin1234/);
});

probar("server no monta /api/test", () => {
  assert.doesNotMatch(server, /\/api\/test/);
});

probar("auth middleware no expone error.message", () => {
  assert.doesNotMatch(authMiddleware, /error:\s*error\.message/);
});

probar("frontend no conserva política antigua de 6 caracteres", () => {
  assert.doesNotMatch(usuariosFrontend, /mínimo 6 caracteres|al menos 6 caracteres/);
});

console.log(`\n${pruebas} pruebas de seguridad superadas correctamente.`);