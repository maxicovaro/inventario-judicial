const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Adjunto = sequelize.define('Adjunto', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },
  nombre_archivo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  ruta_archivo: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  tipo_archivo: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  tamanio: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'adjuntos',
  timestamps: true,
});

module.exports = Adjunto;