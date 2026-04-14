const bcrypt = require('bcryptjs');
const {
  Role,
  Oficina,
  Usuario,
  Categoria,
} = require('../models');

const seedInitialData = async () => {
  try {
    // Roles
    const roles = ['ADMIN', 'RESPONSABLE', 'USUARIO'];

    for (const nombre of roles) {
      await Role.findOrCreate({
        where: { nombre },
      });
    }

    // Categorías
    const categorias = [
      {
        nombre: 'Muebles de oficina',
        descripcion: 'Escritorios, sillas, armarios, estanterías y mobiliario en general',
      },
      {
        nombre: 'Equipos informáticos y de comunicación',
        descripcion: 'PC, monitores, impresoras, routers, teléfonos y accesorios',
      },
      {
        nombre: 'Equipos eléctricos',
        descripcion: 'Ventiladores, aires acondicionados, estufas, heladeras, microondas, etc.',
      },
      {
        nombre: 'Otros elementos',
        descripcion: 'Elementos varios no contemplados en otras categorías',
      },
      {
        nombre: 'Unidades móviles',
        descripcion: 'Vehículos, motocicletas y otros medios de movilidad',
      },
      {
        nombre: 'Insumos de limpieza',
        descripcion: 'Lavandina, detergente, escobas, bolsas, papel higiénico, etc.',
      },
      {
        nombre: 'Librería',
        descripcion: 'Resmas, lapiceras, carpetas, cuadernos, toner, etc.',
      },
    ];

    for (const categoria of categorias) {
      await Categoria.findOrCreate({
        where: { nombre: categoria.nombre },
        defaults: categoria,
      });
    }

    // Oficinas iniciales
    const oficinas = [
      { nombre: 'Dirección de Policía Judicial', descripcion: 'Oficina central' },
      { nombre: 'Depósito', descripcion: 'Depósito central de bienes e insumos' },
      { nombre: 'Área de Personal', descripcion: 'Gestión de personal' },
      { nombre: 'Área Contable', descripcion: 'Administración contable' },
      { nombre: 'Área Informática', descripcion: 'Soporte y sistemas' },
      { nombre: 'Mesa de Entradas', descripcion: 'Recepción de documentación' },
      { nombre: 'Secretaría General', descripcion: 'Secretaría General de la Dirección' },
      { nombre: 'Oficina Judicial de Efectos Secuestrados', descripcion: 'Gestión de efectos secuestrados' },
      { nombre: 'Oficina Judicial de Citaciones', descripcion: 'Gestión de citaciones' },
      { nombre: 'Oficina Judicial de Investigaciones Especiales', descripcion: 'Investigaciones especiales' },
      { nombre: 'Morgue Judicial', descripcion: 'Dependencia de morgue judicial' },
      { nombre: 'Criminalística Capital', descripcion: 'Área de criminalística capital' },
      { nombre: 'Criminalística Valle Viejo', descripcion: 'Área de criminalística Valle Viejo' },
      { nombre: 'Unidad Judicial N° 1', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 2', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 3', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 4', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 5', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 6', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 7', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 8', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 9', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 10', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 11', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad Judicial N° 12', descripcion: 'Dependencia judicial' },
      { nombre: 'Unidad de Violencia Familiar Capital', descripcion: 'Violencia Familiar y de Género Capital' },
      { nombre: 'Unidad de Violencia Familiar Valle Viejo', descripcion: 'Violencia Familiar y de Género Valle Viejo' },
    ];

    for (const oficina of oficinas) {
      await Oficina.findOrCreate({
        where: { nombre: oficina.nombre },
        defaults: oficina,
      });
    }

    // Usuario admin inicial
    const adminRole = await Role.findOne({ where: { nombre: 'ADMIN' } });
    const oficinaDireccion = await Oficina.findOne({
      where: { nombre: 'Dirección de Policía Judicial' },
    });

    const hashedPassword = await bcrypt.hash('Admin1234', 10);

    await Usuario.findOrCreate({
      where: { email: 'admin@inventariojudicial.local' },
      defaults: {
        nombre: 'Administrador',
        apellido: 'General',
        email: 'admin@inventariojudicial.local',
        password: hashedPassword,
        activo: true,
        role_id: adminRole.id,
        oficina_id: oficinaDireccion.id,
      },
    });

    console.log('✓ Datos iniciales cargados correctamente');
  } catch (error) {
    console.error('✗ Error al cargar datos iniciales:', error.message);
  }
};

module.exports = seedInitialData;