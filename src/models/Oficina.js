const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Oficina = sequelize.define('Oficina', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
    unique: true,
  },
  descripcion: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
}, {
  tableName: 'oficinas',
  timestamps: true,
});

module.exports = Oficina;