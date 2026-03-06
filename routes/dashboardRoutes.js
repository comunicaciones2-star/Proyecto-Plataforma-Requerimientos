const express = require('express');
const { authenticate, authorize } = require('../middleware/auth');
const Request = require('../models/Request');

const router = express.Router();

const STATUS_GROUPS = {
  pending: ['pending', 'pendiente'],
  assigned: ['assigned', 'asignada'],
  inProcess: ['in-process', 'in_process', 'en_proceso'],
  inReview: ['review', 'revision', 'en_revision'],
  completed: ['completed', 'completada'],
  cancelled: ['rejected', 'cancelled', 'cancelada', 'rechazada']
};

function getWeekStartMonday(date = new Date()) {
  const normalized = new Date(date);
  const day = normalized.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  normalized.setDate(normalized.getDate() + diffToMonday);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function buildStatusMatch(groupKey) {
  return { $in: STATUS_GROUPS[groupKey] || [] };
}

function mapStatusToCanonical(statusValue) {
  const status = String(statusValue || '').trim().toLowerCase();

  if (STATUS_GROUPS.pending.includes(status)) return 'pendiente';
  if (STATUS_GROUPS.assigned.includes(status)) return 'asignada';
  if (STATUS_GROUPS.inProcess.includes(status)) return 'en_proceso';
  if (STATUS_GROUPS.inReview.includes(status)) return 'en_revision';
  if (STATUS_GROUPS.completed.includes(status)) return 'completada';
  if (STATUS_GROUPS.cancelled.includes(status)) return 'cancelada';

  return 'pendiente';
}

function getIsoWeekParts(dateValue) {
  const date = new Date(Date.UTC(dateValue.getFullYear(), dateValue.getMonth(), dateValue.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
  return { year: date.getUTCFullYear(), week: weekNo };
}

function buildCanonicalStatusProjection() {
  return {
    $switch: {
      branches: [
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.pending] },
          then: 'pendiente'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.assigned] },
          then: 'asignada'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.inProcess] },
          then: 'en_proceso'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.inReview] },
          then: 'en_revision'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.completed] },
          then: 'completada'
        },
        {
          case: { $in: [{ $toLower: { $ifNull: ['$status', ''] } }, STATUS_GROUPS.cancelled] },
          then: 'cancelada'
        }
      ],
      default: 'pendiente'
    }
  };
}

router.use(authenticate, authorize(['admin']));

router.get('/admin', async (req, res) => {
  try {
    const now = new Date();
    const startOfWeek = getWeekStartMonday(now);
    const lookbackWeeks = 8;

    const kpiPromises = [
      Request.countDocuments(),
      Request.countDocuments({ createdAt: { $gte: startOfWeek } }),
      Request.countDocuments({
        $and: [
          {
            $or: [
              { assignedTo: { $exists: false } },
              { assignedTo: null }
            ]
          },
          {
            status: {
              $nin: [...STATUS_GROUPS.completed, ...STATUS_GROUPS.cancelled]
            }
          }
        ]
      }),
      Request.countDocuments({ status: buildStatusMatch('inProcess') }),
      Request.countDocuments({ status: buildStatusMatch('inReview') }),
      Request.countDocuments({ status: buildStatusMatch('completed') }),
      Request.aggregate([
        {
          $match: {
            status: { $in: STATUS_GROUPS.completed },
            createdAt: { $exists: true },
            $or: [
              { completedAt: { $exists: true } },
              { updatedAt: { $exists: true } }
            ]
          }
        },
        {
          $project: {
            endedAt: { $ifNull: ['$completedAt', '$updatedAt'] },
            createdAt: 1
          }
        },
        {
          $project: {
            durationDays: {
              $divide: [
                { $subtract: ['$endedAt', '$createdAt'] },
                1000 * 60 * 60 * 24
              ]
            }
          }
        },
        {
          $group: {
            _id: null,
            promedioDias: { $avg: '$durationDays' }
          }
        }
      ])
    ];

    const [
      totalSolicitudes,
      nuevasEstaSemana,
      pendientesAsignacion,
      enProceso,
      enRevision,
      completadas,
      tiempoPromedioCierreRaw
    ] = await Promise.all(kpiPromises);

    const solicitudesPorEstadoRaw = await Request.aggregate([
      {
        $project: {
          canonicalStatus: buildCanonicalStatusProjection()
        }
      },
      {
        $group: {
          _id: '$canonicalStatus',
          total: { $sum: 1 }
        }
      }
    ]);

    const statusOrder = ['pendiente', 'asignada', 'en_proceso', 'en_revision', 'completada', 'cancelada'];
    const statusMap = new Map(
      solicitudesPorEstadoRaw.map((row) => [mapStatusToCanonical(row._id), Number(row.total) || 0])
    );
    const solicitudesPorEstado = statusOrder.map((status) => ({
      status,
      total: statusMap.get(status) || 0
    }));

    const solicitudesPorResponsable = await Request.aggregate([
      {
        $match: {
          assignedTo: { $ne: null }
        }
      },
      {
        $project: {
          assignedTo: 1,
          canonicalStatus: buildCanonicalStatusProjection()
        }
      },
      {
        $group: {
          _id: '$assignedTo',
          total: { $sum: 1 },
          activas: {
            $sum: {
              $cond: [
                { $in: ['$canonicalStatus', ['pendiente', 'asignada', 'en_proceso', 'en_revision']] },
                1,
                0
              ]
            }
          },
          completadas: {
            $sum: {
              $cond: [
                { $eq: ['$canonicalStatus', 'completada'] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'usuario'
        }
      },
      {
        $unwind: {
          path: '$usuario',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          _id: 0,
          responsableId: '$_id',
          responsable: {
            $trim: {
              input: {
                $concat: [
                  { $ifNull: ['$usuario.firstName', ''] },
                  ' ',
                  { $ifNull: ['$usuario.lastName', ''] }
                ]
              }
            }
          },
          total: 1,
          activas: 1,
          completadas: 1
        }
      },
      {
        $addFields: {
          responsable: {
            $cond: [
              { $or: [{ $eq: ['$responsable', ''] }, { $eq: ['$responsable', null] }] },
              'Sin nombre',
              '$responsable'
            ]
          }
        }
      },
      {
        $sort: { activas: -1, total: -1 }
      }
    ]);

    const solicitudesPorArea = await Request.aggregate([
      {
        $project: {
          area: {
            $ifNull: ['$area', '$department']
          }
        }
      },
      {
        $group: {
          _id: {
            $cond: [
              { $or: [{ $eq: ['$area', null] }, { $eq: ['$area', ''] }] },
              'Sin área',
              '$area'
            ]
          },
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

    const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const twentyFourHoursAhead = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const [sinAsignarCriticas, enRevisionLentas, proximasOVencidas] = await Promise.all([
      Request.find({
        createdAt: { $lte: fortyEightHoursAgo },
        $or: [{ assignedTo: { $exists: false } }, { assignedTo: null }],
        status: { $nin: [...STATUS_GROUPS.completed, ...STATUS_GROUPS.cancelled] }
      })
        .select('requestNumber title status createdAt deliveryDate')
        .sort({ createdAt: 1 })
        .limit(5)
        .lean(),
      Request.find({
        status: buildStatusMatch('inReview'),
        updatedAt: { $lte: threeDaysAgo }
      })
        .select('requestNumber title status updatedAt deliveryDate')
        .sort({ updatedAt: 1 })
        .limit(5)
        .lean(),
      Request.find({
        status: { $nin: [...STATUS_GROUPS.completed, ...STATUS_GROUPS.cancelled] },
        deliveryDate: { $lte: twentyFourHoursAhead }
      })
        .select('requestNumber title status deliveryDate assignedTo')
        .sort({ deliveryDate: 1 })
        .limit(5)
        .lean()
    ]);

    const newRequestsByWeekRaw = await Request.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startOfWeek.getTime() - (lookbackWeeks - 1) * 7 * 24 * 60 * 60 * 1000)
          }
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
          _id: {
            year: '$isoYear',
            week: '$isoWeek'
          },
          total: { $sum: 1 }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.week': 1 }
      }
    ]);

    const byWeekMap = new Map(
      newRequestsByWeekRaw.map((row) => [`${row._id.year}-${row._id.week}`, Number(row.total) || 0])
    );

    const solicitudesNuevasPorSemana = [];
    for (let i = lookbackWeeks - 1; i >= 0; i -= 1) {
      const date = new Date(startOfWeek.getTime() - i * 7 * 24 * 60 * 60 * 1000);
      const { year, week } = getIsoWeekParts(date);
      const key = `${year}-${week}`;
      solicitudesNuevasPorSemana.push({
        label: `Sem ${week}`,
        total: byWeekMap.get(key) || 0
      });
    }

    res.json({
      success: true,
      data: {
        kpis: {
          totalSolicitudes,
          nuevasEstaSemana,
          pendientesAsignacion,
          enProceso,
          enRevision,
          completadas,
          tiempoPromedioCierreDias: Number((tiempoPromedioCierreRaw?.[0]?.promedioDias || 0).toFixed(1))
        },
        solicitudesPorEstado,
        solicitudesPorResponsable,
        solicitudesPorArea,
        solicitudesNuevasPorSemana,
        alertas: {
          sinAsignarCriticas,
          enRevisionLentas,
          proximasOVencidas
        }
      }
    });
  } catch (error) {
    console.error('Error calculando dashboard admin:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cargar el dashboard administrativo'
    });
  }
});

module.exports = router;
