const express = require('express');
const { authenticate } = require('../middleware/auth');
const Request = require('../models/Request');
const {
  ACTIVE_QUEUE_STATUSES,
  attachQueueInfoToRequests,
  getQueueInfoForRequest,
  getQueueScope,
  getQueueStage,
  isQueueActiveStatus
} = require('../utils/queue');

const router = express.Router();

router.use(authenticate);

async function getActiveQueueRequests() {
  return Request.find({ status: { $in: ACTIVE_QUEUE_STATUSES } })
    .select('requestNumber title area preferredExecutorRole urgency status queuedAt assignedAt assignedTo requester createdAt updatedAt')
    .lean();
}

router.get('/tickets/:id/position', async (req, res) => {
  try {
    const request = await Request.findById(req.params.id)
      .populate('requester', 'firstName lastName email')
      .populate('assignedTo', 'firstName lastName email')
      .lean();

    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Ticket no encontrado'
      });
    }

    const currentUserId = req.user.id?.toString?.() || req.user.id;
    const requesterId = request.requester?._id?.toString?.() || request.requester?.toString?.() || request.requester;
    const assignedId = request.assignedTo?._id?.toString?.() || request.assignedTo?.toString?.() || request.assignedTo;
    const isAdmin = req.user.role === 'admin';

    if (!isAdmin && currentUserId !== requesterId && currentUserId !== assignedId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para consultar la cola de este ticket'
      });
    }

    if (!isQueueActiveStatus(request.status)) {
      return res.json({
        success: true,
        queueInfo: null,
        message: 'El ticket está fuera de la cola activa'
      });
    }

    const activeRequests = await getActiveQueueRequests();
    const queueInfo = getQueueInfoForRequest(request, activeRequests);

    res.json({
      success: true,
      queueInfo
    });
  } catch (error) {
    console.error('Error al consultar posición de cola:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar posición de cola'
    });
  }
});

router.get('/my', async (req, res) => {
  try {
    const currentUserId = req.user.id?.toString?.() || req.user.id;
    const activeRequests = await getActiveQueueRequests();

    const userRelatedRequests = activeRequests.filter((request) => {
      const requesterId = request.requester?.toString?.() || request.requester;
      const assignedId = request.assignedTo?.toString?.() || request.assignedTo;
      return requesterId === currentUserId || assignedId === currentUserId;
    });

    const enriched = attachQueueInfoToRequests(userRelatedRequests, activeRequests);

    const asRequester = enriched.filter((request) => {
      const requesterId = request.requester?.toString?.() || request.requester;
      return requesterId === currentUserId;
    });

    const asExecutor = enriched.filter((request) => {
      const assignedId = request.assignedTo?.toString?.() || request.assignedTo;
      return assignedId === currentUserId;
    });

    res.json({
      success: true,
      asRequester,
      asExecutor
    });
  } catch (error) {
    console.error('Error al consultar cola del usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar cola del usuario'
    });
  }
});

router.get('/scope', async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Solo administradores pueden consultar la cola por alcance'
      });
    }

    const departmentFilter = String(req.query.department || req.query.departmentId || req.query.area || '').trim();
    const executorTypeFilter = String(req.query.executorType || '').trim().toLowerCase();
    const stageFilter = String(req.query.stage || '').trim().toLowerCase();
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 200);

    const activeRequests = await getActiveQueueRequests();
    const enriched = attachQueueInfoToRequests(activeRequests, activeRequests);

    let filtered = enriched.filter((request) => !!request.queueInfo);

    if (departmentFilter) {
      filtered = filtered.filter((request) => request.queueInfo.scope.department === departmentFilter);
    }

    if (executorTypeFilter) {
      filtered = filtered.filter((request) => request.queueInfo.scope.executorType === executorTypeFilter);
    }

    if (stageFilter && ['pending', 'assigned'].includes(stageFilter)) {
      filtered = filtered.filter((request) => request.queueInfo.stage === stageFilter);
    }

    filtered.sort((left, right) => {
      if (left.queueInfo.stage !== right.queueInfo.stage) {
        return left.queueInfo.stage.localeCompare(right.queueInfo.stage);
      }

      const leftScope = `${left.queueInfo.scope.department}|${left.queueInfo.scope.executorType}`;
      const rightScope = `${right.queueInfo.scope.department}|${right.queueInfo.scope.executorType}`;
      if (leftScope !== rightScope) {
        return leftScope.localeCompare(rightScope, 'es');
      }

      return left.queueInfo.position - right.queueInfo.position;
    });

    const total = filtered.length;
    const start = (page - 1) * limit;
    const items = filtered.slice(start, start + limit);

    res.json({
      success: true,
      filters: {
        department: departmentFilter || null,
        executorType: executorTypeFilter || null,
        stage: stageFilter || null
      },
      pagination: {
        page,
        limit,
        total,
        pages: Math.max(Math.ceil(total / limit), 1)
      },
      queue: items
    });
  } catch (error) {
    console.error('Error al consultar cola por alcance:', error);
    res.status(500).json({
      success: false,
      message: 'Error al consultar cola por alcance'
    });
  }
});

module.exports = router;
