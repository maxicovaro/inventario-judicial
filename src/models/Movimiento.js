const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Movimiento = sequelize.define('Movimiento', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  tipo: {
  type: DataTypes.ENUM(
    'ALTA',
    'BAJA',
    'TRASLADO',
    'REPARACION',
    'CAMBIO_ESTADO',
    'ACTUALIZACION'
  ),
  allowNull: false,
},
  descripcion: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'movimientos',
  timestamps: true,
});

module.exports = Movimiento;