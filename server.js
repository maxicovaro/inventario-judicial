const express = require('express');
const cors = require('cors');
require('dotenv').config();

const sequelize = require('./src/config/database');
require('./src/models');
const seedInitialData = require('./src/seeders/initialData');

const app = express();
const authRoutes = require('./src/routes/authRoutes');
const testRoutes = require('./src/routes/testRoutes');
const activoRoutes = require('./src/routes/activoRoutes');
const usuarioRoutes = require('./src/routes/usuarioRoutes');
const solicitudRoutes = require('./src/routes/solicitudRoutes');

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/test', testRoutes);
app.use('/api/activos', activoRoutes);
app.use('/api/usuarios', usuarioRoutes);
app.use('/api/solicitudes', solicitudRoutes);


app.get('/', (req, res) => {
  res.json({ mensaje: 'Servidor del sistema de inventario funcionando ✓' });
});

sequelize.authenticate()
  .then(() => {
    console.log('✓ Conectado a MySQL correctamente');
    return sequelize.sync({ alter: true });
  })
  .then(() => {
    return seedInitialData();
  })
  .then(() => {
    app.listen(process.env.PORT, () => {
      console.log(`✓ Servidor corriendo en http://localhost:${process.env.PORT}`);
    });
  })
  .catch((error) => {
    console.error('✗ Error al conectar:', error.message);
  });