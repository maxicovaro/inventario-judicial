const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Insumo = sequelize.define('Insumo', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre: {
    type: DataTypes.STRING(150),
    allowNull: false,
  },
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  categoria: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  unidad_medida: {
    type: DataTypes.ENUM('unidad', 'caja', 'paquete', 'litro', 'kg', 'resma'),
    allowNull: false,
    defaultValue: 'unidad',
  },
  stock_actual: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  stock_minimo: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  lote: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  fecha_vencimiento: {
    type: DataTypes.DATEONLY,
    allowNull: true,
  },
  proveedor: {
    type: DataTypes.STRING(150),
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
  tableName: 'insumos',
  timestamps: true,
});

module.exports = Insumo;