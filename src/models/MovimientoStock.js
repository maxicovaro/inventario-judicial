const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const MovimientoStock = sequelize.define('MovimientoStock', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  tipo: {
    type: DataTypes.ENUM('INGRESO', 'EGRESO', 'AJUSTE', 'DEVOLUCION'),
    allowNull: false,
  },
  cantidad: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  motivo: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  fecha: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  tableName: 'movimientos_stock',
  timestamps: true,
});

module.exports = MovimientoStock;