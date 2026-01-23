// utils/autoAssign.js
const User = require('../models/User');
const Request = require('../models/Request');

/**
 * Encuentra el mejor ejecutor disponible para una solicitud
 * @param {Object} request - Solicitud a asignar
 * @returns {Object|null} - Ejecutor asignado o null si no hay disponibles
 */
async function findBestExecutor(request) {
  try {
    const designType = request.designType || request.type;
    const urgency = request.urgency;

    // Buscar ejecutores disponibles
    const availableExecutors = await User.find({
      role: { $in: ['gerente', 'diseñador', 'practicante'] },
      isActive: true,
      'executorProfile.available': true
    }).sort({ 'executorProfile.priority': 1 }); // Ordenar por prioridad

    // Filtrar por capacidad y tipo de diseño
    const eligibleExecutors = [];
    
    for (const executor of availableExecutors) {
      // Verificar capacidad
      const hasCapacity = await executor.hasCapacity();
      if (!hasCapacity) continue;

      // Verificar si puede ejecutar el tipo de diseño
      const canExecute = executor.canExecuteType(designType);
      if (!canExecute) continue;

      // Calcular carga actual
      const currentLoad = await executor.getCurrentLoad();
      const loadPercentage = (currentLoad / executor.executorProfile.capacity) * 100;

      eligibleExecutors.push({
        executor,
        currentLoad,
        loadPercentage,
        priority: executor.executorProfile.priority
      });
    }

    if (eligibleExecutors.length === 0) {
      return null;
    }

    // Estrategia de asignación según urgencia
    let selectedExecutor;

    if (urgency === 'express') {
      // Para urgente/express: asignar al ejecutor de mayor prioridad con capacidad
      selectedExecutor = eligibleExecutors[0].executor;
    } else {
      // Para normal: asignar al ejecutor con menor carga
      eligibleExecutors.sort((a, b) => a.loadPercentage - b.loadPercentage);
      selectedExecutor = eligibleExecutors[0].executor;
    }

    return selectedExecutor;
  } catch (error) {
    console.error('Error en asignación automática:', error);
    return null;
  }
}

/**
 * Asigna automáticamente una solicitud al mejor ejecutor disponible
 * @param {String} requestId - ID de la solicitud
 * @returns {Boolean} - True si se asignó exitosamente
 */
async function autoAssignRequest(requestId) {
  try {
    const request = await Request.findById(requestId);
    if (!request) return false;

    const executor = await findBestExecutor(request);
    if (!executor) return false;

    request.assignedTo = executor._id;
    request.status = 'in-process';
    request.assignedAt = new Date();
    await request.save();

    // Actualizar estadísticas del ejecutor
    await executor.updateStats();

    return true;
  } catch (error) {
    console.error('Error al asignar solicitud:', error);
    return false;
  }
}

module.exports = {
  findBestExecutor,
  autoAssignRequest
};
