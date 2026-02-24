// models/Request.js
const mongoose = require('mongoose');
const { Schema } = mongoose;

const commentSchema = new Schema(
  {
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    authorName: {
      type: String,
      required: true
    },
    text: {
      type: String,
      required: true,
      trim: true
    }
  },
  { timestamps: true }
);

const attachmentSchema = new Schema(
  {
    originalName: {
      type: String,
      required: true
    },
    filename: {
      type: String
    },
    path: {
      type: String
    },
    url: {
      type: String
    },
    size: {
      type: Number
    },
    mimetype: {
      type: String
    },
    cloudinaryUrl: {
      type: String,
      required: false
    },
    publicId: {
      type: String,
      required: false
    }
  },
  { _id: false }
);

const approvalSchema = new Schema(
  {
    approver: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    approverName: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reason: {
      type: String,
      trim: true
    }
  },
  { timestamps: true }
);

const requestSchema = new Schema(
  {
    requestNumber: {
      type: String,
      required: true
    },

    // Relación con usuario que crea la solicitud
    requester: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    // Opcional: diseñador asignado
    assignedTo: {
      type: Schema.Types.ObjectId,
      ref: 'User'
    },

    assignedAt: {
      type: Date
    },
    
    // Historial de cambios cuando se edita
    editHistory: [{
      editedBy: {
        type: Schema.Types.ObjectId,
        ref: 'User'
      },
      editedAt: {
        type: Date,
        default: Date.now
      },
      changes: {
        type: String
      }
    }],
    
    // Hora de llegada a la cola (formato 12h)
    queuedAt: {
      type: Date,
      default: Date.now
    },
    
    // Posición en cola
    queuePosition: {
      type: Number
    },

    area: {
      type: String,
      enum: [
        'Dirección',
        'Comunicaciones',
        'Formación Empresarial',
        'Comercial',
        'Coworking - Casa Fenalco',
        'Jurídico',
        'Contabilidad',
        'Fenalcobra',
        'Fenalempleo'
      ],
      required: true
    },

    type: {
      type: String,
      enum: [
        'diseno_grafico',
        'redes_sociales',
        'redes',
        'pieza_impresa',
        'presentacion',
        'video',
        'banner',
        'landing_page',
        'merchandising',
        'emailing',
        'otro'
      ],
      required: true
    },

    preferredExecutorRole: {
      type: String,
      enum: ['gerente', 'diseñador', 'practicante'],
      default: 'diseñador'
    },

    title: {
      type: String,
      required: true,
      trim: true
    },

    description: {
      type: String,
      required: true,
      trim: true
    },

    targetAudience: {
      type: String,
      trim: true
    },

    referenceLinks: {
      type: String,
      trim: true
    },

    categoryDetails: {
      digital: {
        channels: [{ type: String, trim: true }],
        channelConfigs: {
          type: Schema.Types.Mixed,
          default: {}
        },
        objective: { type: String, trim: true },
        copyTitle: { type: String, trim: true },
        copyBody: { type: String, trim: true }
      },
      print: {
        size: { type: String, trim: true },
        material: { type: String, trim: true },
        finishes: { type: String, trim: true }
      },
      video: {
        duration: { type: String, trim: true },
        voiceOver: { type: String, trim: true },
        format: { type: String, trim: true }
      },
      landing: {
        sections: { type: String, trim: true },
        referenceUrl: { type: String, trim: true }
      }
    },

    urgency: {
      type: String,
      enum: ['normal', 'urgent', 'express'],
      default: 'normal'
    },

    status: {
      type: String,
      enum: ['pending', 'in-process', 'review', 'completed', 'rejected'],
      default: 'pending'
    },

    requestDate: {
      type: Date,
      default: Date.now
    },

    deliveryDate: {
      type: Date,
      required: true
    },

    completedDate: {
      type: Date
    },

    attachments: [attachmentSchema],

    comments: [commentSchema],

    approvals: [approvalSchema]
  },
  {
    timestamps: true
  }
);

// Generar requestNumber automáticamente si no existe
requestSchema.pre('validate', function (next) {
  if (!this.requestNumber) {
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomPart = Math.floor(1000 + Math.random() * 9000);
    this.requestNumber = `REQ-${datePart}-${randomPart}`;
  }
  next();
});

// Índices para mejorar performance de queries
requestSchema.index({ requestNumber: 1 }, { unique: true });
requestSchema.index({ requester: 1, status: 1 });
requestSchema.index({ assignedTo: 1, status: 1 });
requestSchema.index({ status: 1, urgency: 1 });
requestSchema.index({ area: 1, createdAt: -1 });
requestSchema.index({ createdAt: -1 });

// Métodos estáticos útiles
requestSchema.statics.findByStatus = function(status) {
  return this.find({ status }).sort({ createdAt: -1 });
};

requestSchema.statics.findByUrgency = function(urgency) {
  return this.find({ urgency }).sort({ deliveryDate: 1 });
};

requestSchema.statics.findPending = function() {
  return this.find({ status: 'pending' }).sort({ createdAt: 1 });
};

module.exports = mongoose.model('Request', requestSchema);
