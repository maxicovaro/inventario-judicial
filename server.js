const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./src/config/database');
require('./src/models');

const app = express();

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ mensaje: 'Servidor del sistema de inventario funcionando ✓' });
});

sequelize.authenticate()
  .then(() => {
    console.log('✓ Conectado a MySQL correctamente');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`✓ Servidor corriendo en http://localhost:${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error('✗ Error al conectar:', error.message);
  });