// utils/helpers.js
const crypto = require('crypto');

/**
 * Genera una contraseña segura aleatoria
 * @param {Number} length - Longitud de la contraseña
 * @returns {String} - Contraseña generada
 */
function generateSecurePassword(length = 12) {
  const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*';
  let password = '';
  
  // Asegurar al menos un carácter de cada tipo
  password += 'abcdefghijklmnopqrstuvwxyz'[Math.floor(Math.random() * 26)];
  password += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(Math.random() * 26)];
  password += '0123456789'[Math.floor(Math.random() * 10)];
  password += '!@#$%^&*'[Math.floor(Math.random() * 8)];
  
  // Completar el resto
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Mezclar caracteres
  return password.split('').sort(() => Math.random() - 0.5).join('');
}

/**
 * Registra una acción en los logs del sistema
 * @param {Object} logData - Datos del log
 */
async function createLog(logData) {
  const Log = require('../models/Log');
  
  try {
    await Log.create({
      timestamp: new Date(),
      level: logData.level || 'info',
      userId: logData.userId,
      userName: logData.userName,
      action: logData.action,
      details: logData.details,
      ip: logData.ip,
      userAgent: logData.userAgent
    });
  } catch (error) {
    console.error('Error al crear log:', error);
  }
}

/**
 * Calcula la fecha de deadline según urgencia
 * @param {String} urgency - Nivel de urgencia
 * @returns {Date} - Fecha de deadline
 */
function calculateDeadline(urgency) {
  const now = new Date();
  
  switch(urgency) {
    case 'normal':
      return new Date(now.setDate(now.getDate() + 3));
    case 'urgente':
      return new Date(now.setDate(now.getDate() + 2));
    case 'express':
      return new Date(now.setDate(now.getDate() + 1));
    default:
      return new Date(now.setDate(now.getDate() + 3));
  }
}

module.exports = {
  generateSecurePassword,
  createLog,
  calculateDeadline
};
