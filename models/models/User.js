// models/User.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
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
    role: {
      type: String,
      enum: ['collaborator', 'designer', 'manager', 'admin', 'gerente_comunicaciones', 'disenador_grafico', 'practicante'],
      default: 'collaborator'
    },
    capacity: {
      type: Number,
      default: 5, // Número máximo de tareas simultáneas
      min: 1,
      max: 20
    },
    availability: {
      type: Boolean,
      default: true
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
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Método para comparar contraseña en login
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Índices para mejorar performance
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ role: 1, isActive: 1 });
userSchema.index({ department: 1 });

// Métodos estáticos
userSchema.statics.findByRole = function(role) {
  return this.find({ role, isActive: true }).sort({ firstName: 1 });
};

userSchema.statics.findDesigners = function() {
  return this.find({ 
    role: 'designer', 
    isActive: true, 
    availability: true 
  }).sort({ capacity: -1 });
};

// Método para obtener nombre completo
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Asegurar que los virtuals se incluyan en JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('User', userSchema);
