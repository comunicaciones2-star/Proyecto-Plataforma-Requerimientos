// scripts/seed.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const Request = require('../models/Request');

dotenv.config();

async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('❌ MONGODB_URI no está definido en .env');
    process.exit(1);
  }

  await mongoose.connect(uri);

  console.log('✅ Conectado a MongoDB para seeding');
}

async function clearDB() {
  await User.deleteMany({});
  await Request.deleteMany({});
  console.log('🗑️ Base de datos limpiada');
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash('password123', 10);

  const usersData = [
    // Diseñadores
    {
      email: 'comunicaciones@fenalcosantander.com.co',
      firstName: 'Equipo',
      lastName: 'Comunicaciones',
      password: passwordHash,
      role: 'diseñador',
      area: 'comunicaciones'
    },
    {
      email: 'comunicaciones2@fenalcosantander.com.co',
      firstName: 'Comunicaciones',
      lastName: 'Dos',
      password: passwordHash,
      role: 'diseñador',
      area: 'comunicaciones'
    },

    // Gerentes / Managers
    {
      email: 'ejecutivaformacion1@fenalcosantander.com.co',
      firstName: 'Ejecutiva',
      lastName: 'Formación',
      password: passwordHash,
      role: 'gerente',
      area: 'formacion'
    },
    {
      email: 'coordinadoracomercial2@fenalcosantander.com.co',
      firstName: 'Coordinadora',
      lastName: 'Comercial2',
      password: passwordHash,
      role: 'gerente',
      area: 'comercial'
    },
    {
      email: 'juridico@fenalcosantander.com.co',
      firstName: 'Área',
      lastName: 'Jurídica',
      password: passwordHash,
      role: 'gerente',
      area: 'juridica'
    },

    // Admins
    {
      email: 'asistentedireccion@fenalcosantander.com.co',
      firstName: 'Asistente',
      lastName: 'Dirección',
      password: passwordHash,
      role: 'admin',
      area: 'direccion'
    },
    {
      email: 'directorejecutivo@fenalcosantander.com.co',
      firstName: 'Director',
      lastName: 'Ejecutivo',
      password: passwordHash,
      role: 'admin',
      area: 'direccion'
    },

    // Colaboradores
    {
      email: 'coordinadoracomercial3@fenalcosantander.com.co',
      firstName: 'Coordinadora',
      lastName: 'Comercial3',
      password: passwordHash,
      role: 'usuario',
      area: 'comercial'
    },
    {
      email: 'coordinadoracomercial5@fenalcosantander.com.co',
      firstName: 'Coordinadora',
      lastName: 'Comercial5',
      password: passwordHash,
      role: 'usuario',
      area: 'comercial'
    },
    {
      email: 'fenalcobra2@fenalcosantander.com.co',
      firstName: 'Fenalcobra',
      lastName: 'Dos',
      password: passwordHash,
      role: 'usuario',
      area: 'otra'
    }
  ];

  const users = await User.insertMany(usersData);
  console.log(`✅ ${users.length} usuarios creados`);
  return users;
}

function findUserByEmail(users, email) {
  return users.find(u => u.email === email);
}

async function seedRequests(users) {
  const requester1 = findUserByEmail(
    users,
    'coordinadoracomercial3@fenalcosantander.com.co'
  );
  const requester2 = findUserByEmail(
    users,
    'coordinadoracomercial5@fenalcosantander.com.co'
  );
  const requester3 = findUserByEmail(
    users,
    'fenalcobra2@fenalcosantander.com.co'
  );
  const designer = findUserByEmail(
    users,
    'comunicaciones@fenalcosantander.com.co'
  );

  const today = new Date();

  const requestsData = [
    {
      area: 'Comercial',
      type: 'redes_sociales',
      title: 'Post redes sociales - Feria del Afiliado',
      description:
        'Pieza para promocionar la Feria del Afiliado en Instagram y Facebook.',
      urgency: 'urgent',
      status: 'in-process',
      requester: requester1._id,
      assignedTo: designer._id,
      requestDate: today,
      deliveryDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 3
      ),
      comments: [],
      approvals: []
    },
    {
      area: 'Formación Empresarial',
      type: 'pieza_impresa',
      title: 'Pendón para evento de Formación',
      description:
        'Pendón 80x180cm para evento de capacitación empresarial.',
      urgency: 'normal',
      status: 'pending',
      requester: requester2._id,
      requestDate: today,
      deliveryDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() + 7
      ),
      comments: [],
      approvals: []
    },
    {
      area: 'Jurídico',
      type: 'presentacion',
      title: 'Presentación PowerPoint para charla legal',
      description:
        'Plantilla corporativa para presentación sobre normatividad laboral.',
      urgency: 'express',
      status: 'completed',
      requester: requester3._id,
      assignedTo: designer._id,
      requestDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 5
      ),
      deliveryDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 2
      ),
      completedDate: new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - 2
      ),
      comments: [],
      approvals: []
    }
  ];

  const requests = await Request.insertMany(requestsData);
  console.log(`✅ ${requests.length} solicitudes creadas`);
}

async function run() {
  try {
    await connectDB();
    await clearDB();
    const users = await seedUsers();
    await seedRequests(users);

    console.log('\n✅ Base de datos poblada correctamente!\n');
    console.log('📋 Usuarios de prueba (todos con contraseña: password123):');
    console.log('   Diseñadores: comunicaciones@fenalcosantander.com.co');
    console.log('   Managers:    ejecutivaformacion1@fenalcosantander.com.co');
    console.log('   Admins:      asistentedireccion@fenalcosantander.com.co');
    console.log('   Colaboradores: coordinadoracomercial3@fenalcosantander.com.co\n');
  } catch (error) {
    console.error('❌ Error en seed:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

run();
