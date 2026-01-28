require('dotenv').config();
const mongoose = require('mongoose');
const Request = require('./models/Request');

// SEGURIDAD: Solo usar variables de entorno, nunca hardcodear credenciales
if (!process.env.MONGODB_URI) {
  console.error('❌ ERROR: MONGODB_URI no está configurado en las variables de entorno');
  console.error('   Por favor, crea un archivo .env con la variable MONGODB_URI');
  process.exit(1);
}

const MONGODB_URI = process.env.MONGODB_URI;

async function checkRequest() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conectado a MongoDB');
    
    // Buscar la solicitud específica
    const request = await Request.findOne({ requestNumber: 'REQ-20260127-6003' }).lean();
    
    if (request) {
      console.log('\n✅ SOLICITUD ENCONTRADA EN BASE DE DATOS:');
      console.log('   Número:', request.requestNumber);
      console.log('   Título:', request.title);
      console.log('   Descripción:', request.description);
      console.log('   Estado:', request.status);
      console.log('   Tipo:', request.type);
      console.log('   Urgencia:', request.urgency);
      console.log('   Área:', request.area);
      console.log('   Fecha de entrega:', request.deliveryDate);
      console.log('   Solicitante:', request.requester);
      if (request.attachments && request.attachments.length > 0) {
        console.log('   Archivos adjuntos:', request.attachments.length);
      }
    } else {
      console.log('\n❌ SOLICITUD NO ENCONTRADA EN BASE DE DATOS');
    }
    
    // Listar todas las solicitudes recientes
    console.log('\n📋 ÚLTIMAS 5 SOLICITUDES EN LA BASE DE DATOS:');
    const recentRequests = await Request.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('requestNumber title status requester createdAt')
      .populate('requester', 'firstName lastName')
      .lean();
    
    recentRequests.forEach((req, index) => {
      const requesterName = req.requester ? `${req.requester.firstName} ${req.requester.lastName}` : 'Sin asignar';
      console.log(`   ${index + 1}. ${req.requestNumber} - "${req.title}" - ${req.status} - ${requesterName}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkRequest();
