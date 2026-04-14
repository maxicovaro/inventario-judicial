const Role = require('./Role');
const Oficina = require('./Oficina');
const Usuario = require('./Usuario');
const Categoria = require('./Categoria');
const Activo = require('./Activo');

// Relaciones Usuario
Role.hasMany(Usuario, { foreignKey: 'role_id' });
Usuario.belongsTo(Role, { foreignKey: 'role_id' });

Oficina.hasMany(Usuario, { foreignKey: 'oficina_id' });
Usuario.belongsTo(Oficina, { foreignKey: 'oficina_id' });

// Relaciones Activo
Categoria.hasMany(Activo, { foreignKey: 'categoria_id' });
Activo.belongsTo(Categoria, { foreignKey: 'categoria_id' });

Oficina.hasMany(Activo, { foreignKey: 'oficina_id' });
Activo.belongsTo(Oficina, { foreignKey: 'oficina_id' });

module.exports = {
  Role,
  Oficina,
  Usuario,
  Categoria,
  Activo,
};