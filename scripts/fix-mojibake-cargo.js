const mongoose = require('mongoose');
require('dotenv').config();

const User = require('../models/User');

function normalizeTextForCompare(value) {
  return String(value || '')
    .replace(/\uFFFD/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function repairCargo(value) {
  const raw = String(value || '').trim();
  const normalized = normalizeTextForCompare(raw);

  const aliases = {
    'diseador grfico': 'Diseñador gráfico',
    'disenador grafico': 'Diseñador gráfico',
    'ejecutivo formacion empresarial': 'Ejecutivo Formación Empresarial',
    'asistente de direccion': 'Asistente de Dirección',
    'profesional juridico': 'Profesional Jurídico'
  };

  if (aliases[normalized]) {
    return aliases[normalized];
  }

  if (/dise.?ador/i.test(raw) || /gr.?fico/i.test(raw)) {
    return 'Diseñador gráfico';
  }

  return raw.includes('�') ? '' : raw;
}

async function run() {
  const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017/fenalco-disenos';
  await mongoose.connect(uri);

  const users = await User.find({ position: /�/ }).select('_id email position').lean();
  let updated = 0;

  for (const user of users) {
    const repaired = repairCargo(user.position);
    await User.updateOne({ _id: user._id }, { $set: { position: repaired } });
    updated += 1;
  }

  console.log(JSON.stringify({ found: users.length, updated }, null, 2));

  await mongoose.disconnect();
}

run().catch(async (error) => {
  console.error('Error reparando cargos:', error);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});
