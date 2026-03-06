// routes/reportRoutes.js
const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const Request = require('../models/Request');
const User = require('../models/User');

// Todas las rutas requieren usuario autenticado
router.use(authenticate);

const STATUS_GROUPS = {
  pending: ['pending', 'pendiente'],
  assigned: ['assigned', 'asignada'],
  inProcess: ['in-process', 'in_process', 'en_proceso'],
  review: ['review', 'revision', 'en_revision'],
  completed: ['completed', 'completada'],
  rejected: ['rejected', 'rechazada', 'cancelled', 'cancelada']
};

const TERMINAL_STATUSES = [...STATUS_GROUPS.completed, ...STATUS_GROUPS.rejected];
const ACTIVE_STATUSES = [
  ...STATUS_GROUPS.pending,
  ...STATUS_GROUPS.assigned,
  ...STATUS_GROUPS.inProcess,
  ...STATUS_GROUPS.review
];

const EXECUTOR_ROLE_SET = new Set(['gerente', 'diseñador', 'practicante', 'manager', 'designer']);

function normalizeRoleValue(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function resolveAnalyticsRole(userDoc) {
  if (normalizeRoleValue(userDoc?.role) === 'admin') {
    return 'admin';
  }

  const executorType = normalizeRoleValue(userDoc?.executorProfile?.executorType);
  const roleValue = normalizeRoleValue(userDoc?.role);

  if (EXECUTOR_ROLE_SET.has(executorType) || EXECUTOR_ROLE_SET.has(roleValue)) {
    return 'executor';
  }

  return 'requester';
}

function getIsoWeekParts(dateValue) {
  const date = new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function canonicalStatusProjection() {
  return {
    $switch: {
      branches: [
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.pending] },
          then: 'pending'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.assigned] },
          then: 'assigned'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.inProcess] },
          then: 'in-process'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.review] },
          then: 'review'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.completed] },
          then: 'completed'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.rejected] },
          then: 'rejected'
        }
      ],
      default: 'pending'
    }
  };
}

async function getAverageCloseDays(baseMatch = {}) {
  const rows = await Request.aggregate([
    {
      $match: {
        ...baseMatch,
        status: { $in: STATUS_GROUPS.completed }
      }
    },
    {
      $project: {
        startDate: { $ifNull: ['$requestDate', '$createdAt'] },
        endDate: { $ifNull: ['$completedDate', '$completedAt'] }
      }
    },
    {
      $match: {
        startDate: { $ne: null },
        endDate: { $ne: null }
      }
    },
    {
      $project: {
        days: {
          $divide: [
            { $subtract: ['$endDate', '$startDate'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $group: {
        _id: null,
        averageDays: { $avg: '$days' }
      }
    }
  ]);

  return Number((rows?.[0]?.averageDays || 0).toFixed(1));
}

async function getOnTimeRate(baseMatch = {}) {
  const rows = await Request.aggregate([
    {
      $match: {
        ...baseMatch,
        status: { $in: STATUS_GROUPS.completed },
        deliveryDate: { $ne: null }
      }
    },
    {
      $project: {
        endDate: { $ifNull: ['$completedDate', '$completedAt'] },
        deliveryDate: 1
      }
    },
    {
      $match: {
        endDate: { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        onTime: {
          $sum: {
            $cond: [{ $lte: ['$endDate', '$deliveryDate'] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        total: 1,
        onTime: 1,
        percentage: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$onTime', '$total'] }, 100] },
            0
          ]
        }
      }
    }
  ]);

  return {
    total: Number(rows?.[0]?.total || 0),
    onTime: Number(rows?.[0]?.onTime || 0),
    percentage: Number((rows?.[0]?.percentage || 0).toFixed(1))
  };
}

async function getUrgencyMetrics(baseMatch = {}) {
  const rows = await Request.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        urgent: {
          $sum: {
            $cond: [{ $in: ['$urgency', ['urgent', 'urgente', 'express']] }, 1, 0]
          }
        }
      }
    },
    {
      $project: {
        total: 1,
        urgent: 1,
        percentage: {
          $cond: [
            { $gt: ['$total', 0] },
            { $multiply: [{ $divide: ['$urgent', '$total'] }, 100] },
            0
          ]
        }
      }
    }
  ]);

  const total = Number(rows?.[0]?.total || 0);
  const urgent = Number(rows?.[0]?.urgent || 0);

  return {
    total,
    urgent,
    percentage: Number((rows?.[0]?.percentage || 0).toFixed(1))
  };
}

async function getDistributionByStatus(baseMatch = {}) {
  const rows = await Request.aggregate([
    { $match: baseMatch },
    {
      $project: {
        status: canonicalStatusProjection()
      }
    },
    {
      $group: {
        _id: '$status',
        total: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        total: 1
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  return rows;
}

async function getDistributionByUrgency(baseMatch = {}) {
  const rows = await Request.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: { $ifNull: ['$urgency', 'normal'] },
        total: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        urgency: '$_id',
        total: 1
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);

  return rows;
}

async function getMonthlyTrend(baseMatch = {}, months = 6) {
  const now = new Date();
  const startReference = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

  const rows = await Request.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: { $gte: startReference }
      }
    },
    {
      $group: {
        _id: {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        },
        total: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.month': 1 }
    }
  ]);

  const mapped = new Map(rows.map((row) => [`${row._id.year}-${row._id.month}`, Number(row.total) || 0]));
  const trend = [];

  for (let i = months - 1; i >= 0; i -= 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}`;
    trend.push({
      label: date.toLocaleString('es-CO', { month: 'short' }),
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      total: mapped.get(key) || 0
    });
  }

  return trend;
}

async function getWeeklyTrend(baseMatch = {}, weeks = 8) {
  const now = new Date();
  const thisWeekStart = new Date(now);
  const currentDay = thisWeekStart.getDay();
  const diffToMonday = currentDay === 0 ? -6 : 1 - currentDay;
  thisWeekStart.setDate(thisWeekStart.getDate() + diffToMonday);
  thisWeekStart.setHours(0, 0, 0, 0);

  const startReference = new Date(thisWeekStart.getTime() - (weeks - 1) * 7 * 24 * 60 * 60 * 1000);

  const rows = await Request.aggregate([
    {
      $match: {
        ...baseMatch,
        createdAt: { $gte: startReference }
      }
    },
    {
      $project: {
        isoWeek: { $isoWeek: '$createdAt' },
        isoYear: { $isoWeekYear: '$createdAt' }
      }
    },
    {
      $group: {
        _id: { year: '$isoYear', week: '$isoWeek' },
        total: { $sum: 1 }
      }
    },
    {
      $sort: { '_id.year': 1, '_id.week': 1 }
    }
  ]);

  const mapped = new Map(rows.map((row) => [`${row._id.year}-${row._id.week}`, Number(row.total) || 0]));
  const trend = [];

  for (let i = weeks - 1; i >= 0; i -= 1) {
    const date = new Date(thisWeekStart.getTime() - i * 7 * 24 * 60 * 60 * 1000);
    const { year, week } = getIsoWeekParts(date);
    const key = `${year}-${week}`;
    trend.push({
      label: `Sem ${week}`,
      year,
      week,
      total: mapped.get(key) || 0
    });
  }

  return trend;
}

async function getRequestsByResponsible(baseMatch = {}) {
  return Request.aggregate([
    {
      $match: {
        ...baseMatch,
        assignedTo: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$assignedTo',
        total: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        responsibleId: '$_id',
        responsible: {
          $trim: {
            input: {
              $concat: [{ $ifNull: ['$user.firstName', ''] }, ' ', { $ifNull: ['$user.lastName', ''] }]
            }
          }
        },
        total: 1
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
}

async function getActiveByResponsible(baseMatch = {}) {
  return Request.aggregate([
    {
      $match: {
        ...baseMatch,
        assignedTo: { $ne: null },
        status: { $in: ACTIVE_STATUSES }
      }
    },
    {
      $group: {
        _id: '$assignedTo',
        active: { $sum: 1 }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        responsibleId: '$_id',
        responsible: {
          $trim: {
            input: {
              $concat: [{ $ifNull: ['$user.firstName', ''] }, ' ', { $ifNull: ['$user.lastName', ''] }]
            }
          }
        },
        active: 1
      }
    },
    {
      $sort: { active: -1 }
    }
  ]);
}

async function getAverageByResponsible(baseMatch = {}) {
  return Request.aggregate([
    {
      $match: {
        ...baseMatch,
        assignedTo: { $ne: null },
        status: { $in: STATUS_GROUPS.completed }
      }
    },
    {
      $project: {
        assignedTo: 1,
        startDate: { $ifNull: ['$requestDate', '$createdAt'] },
        endDate: { $ifNull: ['$completedDate', '$completedAt'] }
      }
    },
    {
      $match: {
        startDate: { $ne: null },
        endDate: { $ne: null }
      }
    },
    {
      $project: {
        assignedTo: 1,
        days: {
          $divide: [
            { $subtract: ['$endDate', '$startDate'] },
            1000 * 60 * 60 * 24
          ]
        }
      }
    },
    {
      $group: {
        _id: '$assignedTo',
        averageDays: { $avg: '$days' }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        responsibleId: '$_id',
        responsible: {
          $trim: {
            input: {
              $concat: [{ $ifNull: ['$user.firstName', ''] }, ' ', { $ifNull: ['$user.lastName', ''] }]
            }
          }
        },
        averageDays: { $round: ['$averageDays', 1] }
      }
    },
    {
      $sort: { averageDays: 1 }
    }
  ]);
}

async function getComplianceByResponsible(baseMatch = {}) {
  return Request.aggregate([
    {
      $match: {
        ...baseMatch,
        assignedTo: { $ne: null },
        status: { $in: STATUS_GROUPS.completed },
        deliveryDate: { $ne: null }
      }
    },
    {
      $project: {
        assignedTo: 1,
        endDate: { $ifNull: ['$completedDate', '$completedAt'] },
        deliveryDate: 1
      }
    },
    {
      $match: {
        endDate: { $ne: null }
      }
    },
    {
      $group: {
        _id: '$assignedTo',
        total: { $sum: 1 },
        onTime: {
          $sum: {
            $cond: [{ $lte: ['$endDate', '$deliveryDate'] }, 1, 0]
          }
        }
      }
    },
    {
      $lookup: {
        from: 'users',
        localField: '_id',
        foreignField: '_id',
        as: 'user'
      }
    },
    {
      $unwind: {
        path: '$user',
        preserveNullAndEmptyArrays: true
      }
    },
    {
      $project: {
        _id: 0,
        responsibleId: '$_id',
        responsible: {
          $trim: {
            input: {
              $concat: [{ $ifNull: ['$user.firstName', ''] }, ' ', { $ifNull: ['$user.lastName', ''] }]
            }
          }
        },
        total: 1,
        onTime: 1,
        compliance: {
          $round: [
            {
              $cond: [
                { $gt: ['$total', 0] },
                { $multiply: [{ $divide: ['$onTime', '$total'] }, 100] },
                0
              ]
            },
            1
          ]
        }
      }
    },
    {
      $sort: { compliance: -1 }
    }
  ]);
}

async function getRequestsByArea(baseMatch = {}) {
  return Request.aggregate([
    { $match: baseMatch },
    {
      $group: {
        _id: { $ifNull: ['$area', 'Sin área'] },
        total: { $sum: 1 }
      }
    },
    {
      $project: {
        _id: 0,
        area: '$_id',
        total: 1
      }
    },
    {
      $sort: { total: -1 }
    }
  ]);
}

async function getSatisfactionMetrics(baseMatch = {}) {
  const rows = await Request.aggregate([
    { $match: baseMatch },
    {
      $match: {
        'satisfaction.score': { $ne: null }
      }
    },
    {
      $group: {
        _id: null,
        responses: { $sum: 1 },
        averageScore: { $avg: '$satisfaction.score' }
      }
    }
  ]);

  if (!rows.length) {
    return {
      available: false,
      responses: 0,
      averageScore: null
    };
  }

  return {
    available: true,
    responses: Number(rows[0].responses) || 0,
    averageScore: Number((rows[0].averageScore || 0).toFixed(2))
  };
}

/**
 * GET /api/reports/analytics/overview
 * Modelo analítico por rol con 4 capas:
 * - servicio
 * - operación
 * - desempeño
 * - calidad y riesgo
 */
const getAnalyticsOverview = async (req, res) => {
  try {
    const now = new Date();
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'No autorizado: usuario inválido'
      });
    }

    const user = await User.findById(userId).select('role executorProfile firstName lastName').lean();
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado'
      });
    }

    const roleView = resolveAnalyticsRole(user);
    const requesterScope = { requester: userId };
    const executorScope = { assignedTo: userId };
    const globalScope = {};

    if (roleView === 'requester') {
      const [
        total,
        completed,
        averageCloseDays,
        onTime,
        urgency,
        byUrgency,
        monthlyTrend
      ] = await Promise.all([
        Request.countDocuments(requesterScope),
        Request.countDocuments({ ...requesterScope, status: { $in: STATUS_GROUPS.completed } }),
        getAverageCloseDays(requesterScope),
        getOnTimeRate(requesterScope),
        getUrgencyMetrics(requesterScope),
        getDistributionByUrgency(requesterScope),
        getMonthlyTrend(requesterScope, 6)
      ]);

      return res.json({
        success: true,
        roleView,
        data: {
          servicio: {
            volumenSolicitudesUsuario: total,
            tiempoPromedioCierreDias: averageCloseDays,
            porcentajeCumplimiento: onTime.percentage,
            totalCumplidas: onTime.onTime,
            totalConFechaObjetivo: onTime.total,
            solicitudesUrgentes: urgency.urgent,
            porcentajeUrgentes: urgency.percentage,
            completadas: completed
          },
          operacion: {
            distribucionUrgencia: byUrgency,
            tendenciaMensual: monthlyTrend
          },
          desempeno: {},
          calidadRiesgo: {
            satisfaccion: {
              available: false,
              averageScore: null,
              responses: 0
            }
          }
        }
      });
    }

    if (roleView === 'executor') {
      const [
        activeAssigned,
        inProcess,
        inReview,
        completed,
        averageCloseDays,
        onTime,
        overdue,
        weeklyTrend,
        urgencyDistribution,
        ownStatusDistribution
      ] = await Promise.all([
        Request.countDocuments({ ...executorScope, status: { $in: ACTIVE_STATUSES } }),
        Request.countDocuments({ ...executorScope, status: { $in: STATUS_GROUPS.inProcess } }),
        Request.countDocuments({ ...executorScope, status: { $in: STATUS_GROUPS.review } }),
        Request.countDocuments({ ...executorScope, status: { $in: STATUS_GROUPS.completed } }),
        getAverageCloseDays(executorScope),
        getOnTimeRate(executorScope),
        Request.countDocuments({
          ...executorScope,
          status: { $nin: TERMINAL_STATUSES },
          deliveryDate: { $lt: now }
        }),
        getWeeklyTrend(executorScope, 8),
        getDistributionByUrgency(executorScope),
        getDistributionByStatus(executorScope)
      ]);

      return res.json({
        success: true,
        roleView,
        data: {
          servicio: {},
          operacion: {
            distribucionEstadoPropio: ownStatusDistribution,
            tendenciaSemanal: weeklyTrend,
            distribucionUrgenciaPropia: urgencyDistribution
          },
          desempeno: {
            solicitudesActivasAsignadas: activeAssigned,
            enProceso,
            enRevision: inReview,
            completadas,
            tiempoPromedioCierreDias: averageCloseDays,
            cumplimientoPorcentaje: onTime.percentage,
            totalConFechaObjetivo: onTime.total
          },
          calidadRiesgo: {
            vencidasAsignadas: overdue
          }
        }
      });
    }

    const startOfWeek = new Date(now);
    const day = startOfWeek.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    startOfWeek.setDate(startOfWeek.getDate() + diffToMonday);
    startOfWeek.setHours(0, 0, 0, 0);

    const [
      total,
      newThisWeek,
      unassigned,
      inProcess,
      inReview,
      completed,
      rejected,
      averageCloseDays,
      onTime,
      urgency,
      statusDistribution,
      urgencyDistribution,
      monthlyTrend,
      weeklyTrend,
      byResponsible,
      activeByResponsible,
      averageByResponsible,
      complianceByResponsible,
      byArea,
      overdueBacklog,
      pendingApprovals,
      avgAssignmentTime,
      reworkRate,
      satisfaction
    ] = await Promise.all([
      Request.countDocuments(globalScope),
      Request.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Request.countDocuments({
        $or: [{ assignedTo: null }, { assignedTo: { $exists: false } }],
        status: { $nin: TERMINAL_STATUSES }
      }),
      Request.countDocuments({ status: { $in: STATUS_GROUPS.inProcess } }),
      Request.countDocuments({ status: { $in: STATUS_GROUPS.review } }),
      Request.countDocuments({ status: { $in: STATUS_GROUPS.completed } }),
      Request.countDocuments({ status: { $in: STATUS_GROUPS.rejected } }),
      getAverageCloseDays(globalScope),
      getOnTimeRate(globalScope),
      getUrgencyMetrics(globalScope),
      getDistributionByStatus(globalScope),
      getDistributionByUrgency(globalScope),
      getMonthlyTrend(globalScope, 6),
      getWeeklyTrend(globalScope, 8),
      getRequestsByResponsible(globalScope),
      getActiveByResponsible(globalScope),
      getAverageByResponsible(globalScope),
      getComplianceByResponsible(globalScope),
      getRequestsByArea(globalScope),
      Request.countDocuments({
        deliveryDate: { $lt: now },
        status: { $nin: TERMINAL_STATUSES }
      }),
      Request.aggregate([
        { $unwind: '$approvals' },
        { $match: { 'approvals.status': 'pending' } },
        { $count: 'pending' }
      ]),
      Request.aggregate([
        {
          $match: {
            assignedAt: { $ne: null },
            createdAt: { $ne: null }
          }
        },
        {
          $project: {
            hours: {
              $divide: [
                { $subtract: ['$assignedAt', '$createdAt'] },
                1000 * 60 * 60
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            averageHours: { $avg: '$hours' }
          }
        }
      ]),
      Request.aggregate([
        {
          $project: {
            hadRework: {
              $cond: [
                {
                  $or: [
                    { $gt: [{ $size: { $ifNull: ['$editHistory', []] } }, 0] },
                    { $gt: [{ $size: { $ifNull: ['$comments', []] } }, 3] }
                  ]
                },
                1,
                0
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: 1 },
            withRework: { $sum: '$hadRework' }
          }
        },
        {
          $project: {
            total: 1,
            withRework: 1,
            percentage: {
              $cond: [
                { $gt: ['$total', 0] },
                { $multiply: [{ $divide: ['$withRework', '$total'] }, 100] },
                0
              ]
            }
          }
        }
      ]),
      getSatisfactionMetrics(globalScope)
    ]);

    return res.json({
      success: true,
      roleView,
      data: {
        servicio: {
          tiempoPromedioCierreDias: averageCloseDays,
          porcentajeCumplimiento: onTime.percentage,
          solicitudesUrgentes: urgency.urgent,
          porcentajeUrgentes: urgency.percentage,
          satisfaccion: satisfaction
        },
        operacion: {
          totalSolicitudes: total,
          nuevasEstaSemana: newThisWeek,
          pendientesAsignacion: unassigned,
          enProceso: inProcess,
          enRevision: inReview,
          completadas,
          rechazadas: rejected,
          backlogVencido: overdueBacklog,
          distribucionEstado: statusDistribution,
          distribucionUrgencia: urgencyDistribution,
          tendenciaMensual: monthlyTrend,
          tendenciaSemanal: weeklyTrend
        },
        desempeno: {
          solicitudesPorResponsable: byResponsible,
          solicitudesActivasPorResponsable: activeByResponsible,
          tiempoPromedioPorResponsable: averageByResponsible,
          cumplimientoPorResponsable: complianceByResponsible,
          solicitudesPorArea: byArea
        },
        calidadRiesgo: {
          aprobacionesPendientes: Number(pendingApprovals?.[0]?.pending || 0),
          tiempoPromedioAsignacionHoras: Number((avgAssignmentTime?.[0]?.averageHours || 0).toFixed(1)),
          tasaRetrabajoPorcentaje: Number((reworkRate?.[0]?.percentage || 0).toFixed(1)),
          alertasCriticas: {
            sinAsignar: unassigned,
            vencidas: overdueBacklog,
            revisionesEstancadas: inReview
          }
        }
      }
    });
  } catch (error) {
    console.error('Error en /reports/analytics/overview:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al construir la analítica de reportes'
    });
  }
};

router.get('/analytics/overview', getAnalyticsOverview);

// Alias corto para facilitar integración con frontend
router.get('/analytics', getAnalyticsOverview);

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
 * GET /api/reports/dashboard-summary
 * Resumen de métricas para tarjetas del dashboard (usuarios autenticados)
 * Estructura compatible con /api/admin/stats/dashboard
 */
router.get('/dashboard-summary', async (req, res) => {
  try {
    const completedStatuses = ['completed', 'completada'];
    const inProcessStatuses = ['in-process', 'en_proceso'];
    const pendingStatuses = ['pending', 'pendiente'];
    const urgentLevels = ['urgent', 'urgente', 'express'];

    const totalRequests = await Request.countDocuments();
    const completedRequests = await Request.countDocuments({
      status: { $in: completedStatuses }
    });
    const inProcessRequests = await Request.countDocuments({
      status: { $in: inProcessStatuses }
    });
    const pendingRequests = await Request.countDocuments({
      status: { $in: pendingStatuses }
    });
    const urgentRequests = await Request.countDocuments({
      urgency: { $in: urgentLevels }
    });

    const urgentPercentage = totalRequests > 0
      ? Math.round((urgentRequests / totalRequests) * 100)
      : 0;

    const completionPercentage = totalRequests > 0
      ? Math.round((completedRequests / totalRequests) * 100)
      : 0;

    const completedWithDates = await Request.find({
      status: { $in: completedStatuses }
    }).select('requestDate completedDate createdAt completedAt');

    let averageTime = 0;
    if (completedWithDates.length > 0) {
      const totalDays = completedWithDates.reduce((sum, currentRequest) => {
        const startDate = currentRequest.requestDate || currentRequest.createdAt;
        const endDate = currentRequest.completedDate || currentRequest.completedAt;

        if (!startDate || !endDate) {
          return sum;
        }

        const days = (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24);
        return days > 0 ? sum + days : sum;
      }, 0);

      const validCompletedCount = completedWithDates.filter((currentRequest) => {
        const startDate = currentRequest.requestDate || currentRequest.createdAt;
        const endDate = currentRequest.completedDate || currentRequest.completedAt;
        return Boolean(startDate && endDate && new Date(endDate) > new Date(startDate));
      }).length;

      averageTime = validCompletedCount > 0 ? totalDays / validCompletedCount : 0;
    }

    const satisfaction = 92;

    res.json({
      totalRequests,
      completedRequests,
      inProcessRequests,
      pendingRequests,
      urgentRequests,
      urgentPercentage,
      completionPercentage,
      averageTime: parseFloat(averageTime.toFixed(1)),
      satisfaction,
      scope: {
        mode: 'global'
      }
    });
  } catch (error) {
    console.error('Error en /reports/dashboard-summary:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener resumen del dashboard'
    });
  }
});

/**
 * GET /api/reports/monthly-performance
 * Performance mensual global para usuarios autenticados
 */
router.get('/monthly-performance', async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    const monthlyData = [];

    for (let month = 0; month < 12; month++) {
      const startDate = new Date(currentYear, month, 1);
      const endDate = new Date(currentYear, month + 1, 0, 23, 59, 59);

      const completed = await Request.countDocuments({
        status: { $in: ['completed', 'completada'] },
        $or: [
          { completedDate: { $gte: startDate, $lte: endDate } },
          { completedAt: { $gte: startDate, $lte: endDate } }
        ]
      });

      monthlyData.push(completed);
    }

    res.json({
      success: true,
      data: monthlyData,
      year: currentYear
    });
  } catch (error) {
    console.error('Error en /reports/monthly-performance:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener performance mensual'
    });
  }
});

/**
 * GET /api/reports/urgency-distribution
 * Distribución global por urgencia para usuarios autenticados
 */
router.get('/urgency-distribution', async (req, res) => {
  try {
    const normal = await Request.countDocuments({ urgency: 'normal' });
    const urgent = await Request.countDocuments({ urgency: { $in: ['urgent', 'urgente'] } });
    const express = await Request.countDocuments({ urgency: 'express' });

    res.json({
      success: true,
      data: {
        normal,
        urgent,
        express
      }
    });
  } catch (error) {
    console.error('Error en /reports/urgency-distribution:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener distribución por urgencia'
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
