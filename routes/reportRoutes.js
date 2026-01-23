// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth');
const Request = require('../models/Request');

// Todas las rutas requieren usuario autenticado
router.use(authenticate);

/**
 * GET /api/reports/dashboard
 * Estadísticas generales para tarjetas del dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const total = await Request.countDocuments();
    const completed = await Request.countDocuments({ status: 'completed' });
    const inProcess = await Request.countDocuments({ status: 'in-process' });
    const inReview = await Request.countDocuments({ status: 'review' });
    const pending = await Request.countDocuments({ status: 'pending' });

    // Promedio de días de entrega (completed)
    const completedRequests = await Request.find({
      status: 'completed',
      completedDate: { $ne: null }
    }).select('requestDate completedDate');

    let averageDeliveryDays = 0;
    if (completedRequests.length > 0) {
      const totalDays = completedRequests.reduce((sum, r) => {
        const diffMs = r.completedDate - r.requestDate;
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return sum + diffDays;
      }, 0);
      averageDeliveryDays = Math.round((totalDays / completedRequests.length) * 10) / 10;
    }

    res.json({
      success: true,
      statistics: {
        total,
        completed,
        inProcess,
        inReview,
        pending,
        averageDeliveryDays
      }
    });
  } catch (error) {
    console.error('Error en /reports/dashboard:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas del dashboard'
    });
  }
});

/**
 * GET /api/reports/by-area
 * Estadísticas agrupadas por área
 */
router.get('/by-area', async (req, res) => {
  try {
    const areaStats = await Request.aggregate([
      {
        $group: {
          _id: '$area',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          inProcess: {
            $sum: {
              $cond: [{ $eq: ['$status', 'in-process'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]); // patrón típico de aggregate con $group y contadores condicionales[web:178][web:179]

    res.json({
      success: true,
      areaStats: areaStats.map(a => ({
        area: a._id,
        total: a.total,
        completed: a.completed,
        inProcess: a.inProcess,
        pending: a.pending
      }))
    });
  } catch (error) {
    console.error('Error en /reports/by-area:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas por área'
    });
  }
});

/**
 * GET /api/reports/by-type
 * Estadísticas agrupadas por tipo de solicitud
 */
router.get('/by-type', async (req, res) => {
  try {
    const typeStats = await Request.aggregate([
      {
        $group: {
          _id: '$type',
          total: { $sum: 1 },
          completed: {
            $sum: {
              $cond: [{ $eq: ['$status', 'completed'] }, 1, 0]
            }
          },
          inProcess: {
            $sum: {
              $cond: [{ $eq: ['$status', 'in-process'] }, 1, 0]
            }
          },
          pending: {
            $sum: {
              $cond: [{ $eq: ['$status', 'pending'] }, 1, 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      typeStats: typeStats.map(t => ({
        type: t._id,
        total: t.total,
        completed: t.completed,
        inProcess: t.inProcess,
        pending: t.pending
      }))
    });
  } catch (error) {
    console.error('Error en /reports/by-type:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener estadísticas por tipo'
    });
  }
});

/**
 * (Opcional) GET /api/reports/recent
 * Últimas N solicitudes para gráficos o listados
 */
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit || '10', 10);

    const recent = await Request.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('requester', 'firstName lastName email');

    res.json({
      success: true,
      requests: recent
    });
  } catch (error) {
    console.error('Error en /reports/recent:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener solicitudes recientes'
    });
  }
});

module.exports = router;
