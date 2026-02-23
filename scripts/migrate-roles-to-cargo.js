// scripts/migrate-roles-to-cargo.js
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');

dotenv.config();

const LEGACY_ROLE_TO_CARGO = {
  gerente: 'Gerente',
  manager: 'Gerente',
  'diseñador': 'Diseñador gráfico',
  designer: 'Diseñador gráfico',
  practicante: 'Practicante',
  collaborator: ''
};

const APP_ROLES = new Set(['admin', 'usuario']);
const LEGACY_EXECUTOR_TYPES = new Set(['gerente', 'diseñador', 'practicante']);

function normalizeRole(role) {
  return role === 'admin' ? 'admin' : 'usuario';
}

function defaultCargoForRole(role) {
  if (LEGACY_ROLE_TO_CARGO[role]) return LEGACY_ROLE_TO_CARGO[role];
  if (role === 'admin') return 'Administrador de Plataforma';
  return '';
}

function isInvalidCargo(value) {
  const normalized = (value || '').toString().trim().toLowerCase();
  return ['usuario', 'user', 'colaborador', 'solicitante', ''].includes(normalized);
}

async function run() {
  const dryRun = process.argv.includes('--dry-run');
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    console.error('❌ MONGODB_URI no está definido en .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(`✅ Conectado a MongoDB (${dryRun ? 'modo simulación' : 'modo ejecución'})`);

  try {
    const users = await User.find().select('_id email role position executorProfile').lean();

    let scanned = 0;
    let toUpdate = 0;
    let roleChanges = 0;
    let cargoChanges = 0;
    let executorTypeChanges = 0;
    const operations = [];

    for (const user of users) {
      scanned += 1;

      const updates = {};
      const originalRole = user.role || 'usuario';
      const normalizedRole = normalizeRole(originalRole);

      if (originalRole !== normalizedRole) {
        updates.role = normalizedRole;
        roleChanges += 1;
      }

      const currentPosition = (user.position || '').trim();
      if (!currentPosition) {
        const cargo = defaultCargoForRole(originalRole);
        if (cargo) {
          updates.position = cargo;
          cargoChanges += 1;
        }
      } else if (isInvalidCargo(currentPosition)) {
        updates.position = '';
        cargoChanges += 1;
      }

      const currentExecutorType = user.executorProfile?.executorType || '';
      if (!currentExecutorType && LEGACY_EXECUTOR_TYPES.has(originalRole)) {
        updates['executorProfile.executorType'] = originalRole;
        executorTypeChanges += 1;
      }

      if (Object.keys(updates).length > 0) {
        toUpdate += 1;
        operations.push({
          updateOne: {
            filter: { _id: user._id },
            update: { $set: updates }
          }
        });
      }
    }

    console.log(`📊 Usuarios analizados: ${scanned}`);
    console.log(`🛠️ Usuarios a actualizar: ${toUpdate}`);
    console.log(`   - Cambios de rol: ${roleChanges}`);
    console.log(`   - Cargos asignados: ${cargoChanges}`);
    console.log(`   - executorType asignado: ${executorTypeChanges}`);

    if (dryRun) {
      console.log('ℹ️ Simulación finalizada. No se aplicaron cambios.');
      return;
    }

    if (operations.length === 0) {
      console.log('✅ No hay cambios pendientes.');
      return;
    }

    const result = await User.bulkWrite(operations, { ordered: false });
    console.log(`✅ Migración aplicada. Modified: ${result.modifiedCount || 0}`);
  } catch (error) {
    console.error('❌ Error durante migración:', error.message);
    process.exitCode = 1;
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Conexión MongoDB cerrada');
  }
}

run();
