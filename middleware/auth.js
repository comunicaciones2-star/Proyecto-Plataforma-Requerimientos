// middleware/auth.js
const jwt = require('jsonwebtoken');

// Verifica que el request tenga un token válido
function authenticate(req, res, next) {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'No autorizado: token no proporcionado'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Guardamos los datos del usuario en la request
    req.user = decoded;
    next();
  } catch (err) {
    console.error('Error verificando token:', err.message);
    return res.status(401).json({
      success: false,
      message: 'Token inválido o expirado'
    });
  }
}

// Verifica que el usuario tenga uno de los roles permitidos
function authorize(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: usuario no autenticado'
      });
    }

    // Si roles está vacío, permitir a todos los autenticados
    if (allowedRoles.length === 0) {
      return next();
    }

    // Verificar si el usuario tiene uno de los roles permitidos
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Acceso denegado: permisos insuficientes',
        requiredRoles: allowedRoles,
        userRole: req.user.role
      });
    }

    next();
  };
}

// Middleware específico para ejecutores
function isExecutor(req, res, next) {
  const executorRoles = ['gerente', 'diseñador', 'practicante'];
  
  if (!executorRoles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Esta acción solo está disponible para ejecutores'
    });
  }
  
  next();
}

module.exports = {
  authenticate,
  authorize,
  isExecutor
};
