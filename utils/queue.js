const ACTIVE_QUEUE_STATUSES = ['pending', 'in-process', 'review'];

const URGENCY_WEIGHT = {
  express: 3,
  urgent: 2,
  normal: 1
};

function normalizeExecutorType(value) {
  const map = {
    manager: 'gerente',
    designer: 'diseñador',
    disenador: 'diseñador'
  };

  const normalized = String(value || '').trim().toLowerCase();
  const resolved = map[normalized] || normalized;
  return ['gerente', 'diseñador', 'practicante'].includes(resolved) ? resolved : 'diseñador';
}

function normalizeArea(value) {
  const area = String(value || '').trim();
  return area || 'Sin área';
}

function getRequestId(request) {
  return (request && (request._id?.toString?.() || request._id || request.id?.toString?.() || request.id)) || '';
}

function isQueueActiveStatus(status) {
  return ACTIVE_QUEUE_STATUSES.includes(String(status || '').trim());
}

function getQueueStage(request) {
  return request?.assignedTo ? 'assigned' : 'pending';
}

function getQueueTimestamp(request) {
  if (getQueueStage(request) === 'assigned') {
    return request?.assignedAt || request?.updatedAt || request?.createdAt || null;
  }
  return request?.queuedAt || request?.createdAt || null;
}

function getUrgencyWeight(urgency) {
  return URGENCY_WEIGHT[String(urgency || '').trim()] || 1;
}

function getQueueScope(request) {
  return {
    department: normalizeArea(request?.area),
    executorType: normalizeExecutorType(request?.preferredExecutorRole)
  };
}

function getQueueGroupKey(request) {
  const scope = getQueueScope(request);
  return `${getQueueStage(request)}|${scope.department}|${scope.executorType}`;
}

function queueComparator(left, right) {
  const urgencyDiff = getUrgencyWeight(right?.urgency) - getUrgencyWeight(left?.urgency);
  if (urgencyDiff !== 0) return urgencyDiff;

  const leftTimestamp = new Date(getQueueTimestamp(left) || 0).getTime();
  const rightTimestamp = new Date(getQueueTimestamp(right) || 0).getTime();
  if (leftTimestamp !== rightTimestamp) return leftTimestamp - rightTimestamp;

  const leftCreatedAt = new Date(left?.createdAt || 0).getTime();
  const rightCreatedAt = new Date(right?.createdAt || 0).getTime();
  if (leftCreatedAt !== rightCreatedAt) return leftCreatedAt - rightCreatedAt;

  return getRequestId(left).localeCompare(getRequestId(right));
}

function buildQueueIndex(requests = []) {
  const queueIndex = new Map();
  const grouped = new Map();

  requests
    .filter((request) => isQueueActiveStatus(request?.status))
    .forEach((request) => {
      const key = getQueueGroupKey(request);
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push(request);
    });

  grouped.forEach((groupRequests) => {
    const ordered = [...groupRequests].sort(queueComparator);
    const total = ordered.length;

    ordered.forEach((request, index) => {
      const requestId = getRequestId(request);
      if (!requestId) return;

      const position = index + 1;
      const stage = getQueueStage(request);
      const scope = getQueueScope(request);

      queueIndex.set(requestId, {
        ticketId: requestId,
        stage,
        scope,
        position,
        total,
        ahead: Math.max(position - 1, 0),
        urgency: request?.urgency || 'normal',
        queueTimestamp: getQueueTimestamp(request)
      });
    });
  });

  return queueIndex;
}

function attachQueueInfoToRequests(requests = [], allRequests = requests) {
  const queueIndex = buildQueueIndex(allRequests);

  return requests.map((request) => {
    const requestId = getRequestId(request);
    const queueInfo = queueIndex.get(requestId) || null;
    return {
      ...request,
      queueInfo,
      queuePosition: queueInfo?.position || null
    };
  });
}

function getQueueInfoForRequest(request, allRequests = []) {
  const requestId = getRequestId(request);
  if (!requestId || !isQueueActiveStatus(request?.status)) {
    return null;
  }

  const queueIndex = buildQueueIndex(allRequests);
  return queueIndex.get(requestId) || null;
}

module.exports = {
  ACTIVE_QUEUE_STATUSES,
  attachQueueInfoToRequests,
  buildQueueIndex,
  getQueueInfoForRequest,
  getQueueScope,
  getQueueStage,
  getQueueTimestamp,
  isQueueActiveStatus
};
