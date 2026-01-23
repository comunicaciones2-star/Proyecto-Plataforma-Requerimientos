// models/Log.js
const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  level: {
    type: String,
    enum: ['info', 'warning', 'error'],
    default: 'info'
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  userName: String,
  action: {
    type: String,
    required: true,
    index: true
  },
  details: mongoose.Schema.Types.Mixed,
  ip: String,
  userAgent: String
}, {
  timestamps: false
});

// Índices compuestos para búsquedas rápidas
logSchema.index({ action: 1, timestamp: -1 });
logSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('Log', logSchema);
