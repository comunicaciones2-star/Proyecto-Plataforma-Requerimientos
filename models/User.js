// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true
    },
    firstName: {
      type: String,
      required: true,
      trim: true
    },
    lastName: {
      type: String,
      required: true,
      trim: true
    },
    password: {
      type: String,
      required: true,
      minlength: 6,
      select: false // no devolver la contraseña por defecto
    },
    // Campo para cédula
    cedula: {
      type: String,
      unique: true,
      sparse: true  // Permite valores nulos
    },
    role: {
      type: String,
      enum: ['admin', 'gerente', 'diseñador', 'practicante', 'usuario'],
      default: 'usuario'
    },
    department: {
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
      default: 'Comunicaciones'
    },
    // NUEVO: Perfil de ejecutor (subdocumento)
    executorProfile: {
      // Capacidad de tareas simultáneas
      capacity: {
        type: Number,
        default: function() {
          switch(this.role) {
            case 'gerente': return 15;
            case 'diseñador': return 8;
            case 'practicante': return 5;
            default: return 0;
          }
        }
      },
      
      // Nivel de prioridad para asignación automática
      // 1 = máxima prioridad, 3 = mínima prioridad
      priority: {
        type: Number,
        default: function() {
          switch(this.role) {
            case 'gerente': return 1;
            case 'diseñador': return 2;
            case 'practicante': return 3;
            default: return 999;
          }
        }
      },
      
      // Tipos de diseño que puede ejecutar
      // ['all'] significa que puede ejecutar todos los tipos
      allowedDesignTypes: {
        type: [String],
        default: function() {
          switch(this.role) {
            case 'gerente': 
              return ['all']; // Puede hacer todo
            case 'diseñador': 
              return ['redes', 'pieza_impresa', 'presentacion', 'video', 'banner'];
            case 'practicante': 
              return ['redes', 'pieza_impresa']; // Solo tareas básicas
            default: 
              return [];
          }
        }
      },
      
      // Especialidades del ejecutor (opcional)
      specialties: [{
        type: String,
        enum: [
          'social_media',
          'branding', 
          'editorial',
          'video',
          'motion_graphics',
          'ilustracion'
        ]
      }],
      
      // Disponibilidad actual
      available: {
        type: Boolean,
        default: true
      },
      
      // Razón de no disponibilidad
      unavailableReason: {
        type: String,
        enum: ['vacaciones', 'incapacidad', 'proyecto_externo', 'otra'],
        default: null
      },
      
      // Fecha hasta la cual no está disponible
      unavailableUntil: Date,
      
      // Estadísticas del ejecutor
      stats: {
        totalCompleted: { type: Number, default: 0 },
        averageCompletionTime: { type: Number, default: 0 }, // en días
        onTimeDeliveryRate: { type: Number, default: 100 }, // porcentaje
        currentLoad: { type: Number, default: 0 } // tareas actuales
      }
    },
    phone: {
      type: String,
      trim: true
    },
    avatar: {
      type: String,
      default: ''
    },
    notificationPreferences: {
      email: {
        type: Boolean,
        default: true
      },
      web: {
        type: Boolean,
        default: true
      }
    },
    isActive: {
      type: Boolean,
      default: true
    }
  },
  {
    timestamps: true
  }
);

// Hash de contraseña antes de guardar
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt); // hash seguro recomendado[web:120][web:122]
    next();
  } catch (err) {
    next(err);
  }
});

// Método para comparar contraseña en login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Método para verificar si es un ejecutor
userSchema.methods.isExecutor = function() {
  return ['gerente', 'diseñador', 'practicante'].includes(this.role);
};

// Método para verificar si tiene capacidad disponible
userSchema.methods.hasCapacity = async function() {
  if (!this.isExecutor()) return false;
  if (!this.executorProfile.available) return false;
  
  const Request = mongoose.model('Request');
  const currentLoad = await Request.countDocuments({
    assignedTo: this._id,
    status: { $in: ['pending', 'in-process', 'review'] }
  });
  
  return currentLoad < this.executorProfile.capacity;
};

// Método para verificar si puede ejecutar un tipo de diseño
userSchema.methods.canExecuteType = function(designType) {
  if (!this.isExecutor()) return false;
  if (this.executorProfile.allowedDesignTypes.includes('all')) return true;
  return this.executorProfile.allowedDesignTypes.includes(designType);
};

// Método para obtener carga actual
userSchema.methods.getCurrentLoad = async function() {
  const Request = mongoose.model('Request');
  return await Request.countDocuments({
    assignedTo: this._id,
    status: { $in: ['pending', 'in-process', 'review'] }
  });
};

// Método para actualizar estadísticas
userSchema.methods.updateStats = async function() {
  const Request = mongoose.model('Request');
  
  const completedRequests = await Request.find({
    assignedTo: this._id,
    status: 'completed'
  });
  
  this.executorProfile.stats.totalCompleted = completedRequests.length;
  
  if (completedRequests.length > 0) {
    // Calcular tiempo promedio
    const totalTime = completedRequests.reduce((acc, req) => {
      const days = (new Date(req.completedAt) - new Date(req.createdAt)) / (1000 * 60 * 60 * 24);
      return acc + days;
    }, 0);
    this.executorProfile.stats.averageCompletionTime = totalTime / completedRequests.length;
    
    // Calcular tasa de entrega a tiempo
    const onTime = completedRequests.filter(req => {
      const deadline = new Date(req.deadline);
      const completed = new Date(req.completedAt);
      return completed <= deadline;
    }).length;
    this.executorProfile.stats.onTimeDeliveryRate = (onTime / completedRequests.length) * 100;
  }
  
  // Actualizar carga actual
  this.executorProfile.stats.currentLoad = await this.getCurrentLoad();
  
  await this.save();
};

// Índices para optimizar queries
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ role: 1, availability: 1 });

module.exports = mongoose.model('User', userSchema);
