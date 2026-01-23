// utils/autoAssign.js
const User = require('../models/User');
const Request = require('../models/Request');

/**
 * Asigna automáticamente una solicitud según disponibilidad y tipo
 * @param {Object} request - La solicitud a asignar
 * @returns {Object} Usuario asignado o null
 */
async function autoAssignRequest(request) {
  try {
    // Obtener usuarios que pueden atender solicitudes
    const assignableUsers = await User.find({
      role: { $in: ['gerente_comunicaciones', 'disenador_grafico', 'practicante'] },
      isActive: true,
      availability: true
    });

    if (assignableUsers.length === 0) {
      console.log('⚠️  No hay usuarios disponibles para asignar');
      return null;
    }

    // Contar tareas actuales de cada usuario
    const usersWithLoad = await Promise.all(
      assignableUsers.map(async (user) => {
        const currentTasks = await Request.countDocuments({
          assignedTo: user._id,
          status: { $in: ['pending', 'in-process', 'review'] }
        });

        return {
          user,
          currentTasks,
          availableSlots: user.capacity - currentTasks,
          loadPercentage: (currentTasks / user.capacity) * 100
        };
      })
    );

    // Filtrar solo usuarios con capacidad disponible
    const availableUsers = usersWithLoad.filter(u => u.availableSlots > 0);

    if (availableUsers.length === 0) {
      console.log('⚠️  Todos los usuarios están a capacidad máxima');
      return null;
    }

    // Lógica de asignación según tipo de solicitud y urgencia
    let selectedUser = null;

    // Solicitudes EXPRESS siempre al Diseñador Gráfico
    if (request.urgency === 'express') {
      const designer = availableUsers.find(u => u.user.role === 'disenador_grafico');
      if (designer) {
        selectedUser = designer.user;
        console.log(`✅ Express asignado a Diseñador Gráfico: ${designer.user.firstName}`);
      }
    }

    // Diseño gráfico complejo → Diseñador Gráfico
    if (!selectedUser && request.type === 'diseno_grafico') {
      const designer = availableUsers.find(u => u.user.role === 'disenador_grafico');
      if (designer) {
        selectedUser = designer.user;
      }
    }

    // Redes sociales simples → Practicante
    if (!selectedUser && request.type === 'redes_sociales' && request.urgency === 'normal') {
      const intern = availableUsers.find(u => u.user.role === 'practicante');
      if (intern) {
        selectedUser = intern.user;
      }
    }

    // Si no hay asignación específica, asignar al que tenga menos carga
    if (!selectedUser) {
      availableUsers.sort((a, b) => a.loadPercentage - b.loadPercentage);
      selectedUser = availableUsers[0].user;
      console.log(`✅ Asignado por carga a: ${selectedUser.firstName} (${availableUsers[0].currentTasks}/${selectedUser.capacity})`);
    }

    return selectedUser;
  } catch (error) {
    console.error('❌ Error en asignación automática:', error);
    return null;
  }
}

/**
 * Calcula la posición en cola de una solicitud
 * @param {String} requestId - ID de la solicitud
 * @returns {Number} Posición en la cola
 */
async function calculateQueuePosition(requestId) {
  try {
    const request = await Request.findById(requestId);
    if (!request || request.status !== 'pending') {
      return null;
    }

    // Ordenar por urgencia y fecha de creación
    const urgencyOrder = { express: 1, urgent: 2, normal: 3 };
    
    const pendingRequests = await Request.find({ 
      status: 'pending',
      assignedTo: { $exists: false }
    }).sort({ queuedAt: 1 });

    // Ordenar manualmente por urgencia primero, luego por fecha
    pendingRequests.sort((a, b) => {
      const urgencyDiff = urgencyOrder[a.urgency] - urgencyOrder[b.urgency];
      if (urgencyDiff !== 0) return urgencyDiff;
      return new Date(a.queuedAt) - new Date(b.queuedAt);
    });

    const position = pendingRequests.findIndex(r => r._id.toString() === requestId.toString()) + 1;
    return position;
  } catch (error) {
    console.error('❌ Error calculando posición en cola:', error);
    return null;
  }
}

/**
 * Formatea hora a formato 12h (8:00 AM - 5:00 PM)
 * @param {Date} date - Fecha a formatear
 * @returns {String} Hora formateada
 */
function formatTime12h(date) {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const hours12 = hours % 12 || 12;
  const minutesStr = minutes.toString().padStart(2, '0');
  return `${hours12}:${minutesStr} ${ampm}`;
}

/**
 * Verifica si está dentro del horario laboral (8 AM - 5 PM, Lun-Vie)
 * @param {Date} date - Fecha a verificar
 * @returns {Boolean}
 */
function isBusinessHours(date = new Date()) {
  const day = date.getDay(); // 0=Dom, 6=Sáb
  const hours = date.getHours();
  
  // Lunes a Viernes (1-5) y entre 8 AM (8) y 5 PM (17)
  return day >= 1 && day <= 5 && hours >= 8 && hours < 17;
}

module.exports = {
  autoAssignRequest,
  calculateQueuePosition,
  formatTime12h,
  isBusinessHours
};
