const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Activo = sequelize.define('Activo', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  codigo_interno: {
    type: DataTypes.STRING(50),
    allowNull: true,
    unique: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  marca: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  modelo: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  numero_serie: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1,
  },
  estado: {
    type: DataTypes.ENUM(
      'Excelente estado',
      'Buen estado',
      'Regular estado',
      'Mal estado',
      'Sin funcionar',
      'Dado de baja'
    ),
    allowNull: false,
    defaultValue: 'Buen estado',
  },
  fecha_alta: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  activo: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  observaciones: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  tableName: 'activos',
  timestamps: true,
});

module.exports = Activo;