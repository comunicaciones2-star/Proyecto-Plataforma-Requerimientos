const Request = require('../models/Request');
const User = require('../models/User');
const { notifyUser } = require('./websocket');

const ACTIVE_STATUSES = ['pending', 'in-process', 'review'];
const CHECK_INTERVAL_MS = 15 * 60 * 1000;

const ALERT_RULES = {
  normal: {
    key: 'normal_24h',
    thresholdMs: 24 * 60 * 60 * 1000,
    label: '1 día'
  },
  urgent: {
    key: 'urgent_12h',
    thresholdMs: 12 * 60 * 60 * 1000,
    label: '12 horas'
  },
  express: {
    key: 'express_3h',
    thresholdMs: 3 * 60 * 60 * 1000,
    label: '3 horas'
  }
};

let deadlineAlertInterval = null;

function getAlertRule(urgency) {
  return ALERT_RULES[String(urgency || '').trim().toLowerCase()] || ALERT_RULES.normal;
}

function getTargetProfilesFilter() {
  return {
    isActive: true,
    'notificationPreferences.web': { $ne: false },
    $or: [
      { role: { $in: ['gerente', 'diseñador', 'practicante', 'manager', 'designer'] } },
      { 'executorProfile.executorType': { $in: ['gerente', 'diseñador', 'practicante'] } }
    ]
  };
}

function buildDeadlineAlertPayload(request, rule, remainingMs) {
  const remainingHours = Math.max(1, Math.ceil(remainingMs / (60 * 60 * 1000)));
  return {
    type: 'DEADLINE_ALERT',
    requestId: request._id,
    requestNumber: request.requestNumber,
    title: request.title,
    urgency: request.urgency,
    area: request.area,
    status: request.status,
    deliveryDate: request.deliveryDate,
    thresholdLabel: rule.label,
    remainingHours,
    message: `La solicitud ${request.requestNumber} está a ${rule.label} o menos de su fecha de entrega.`,
    timestamp: new Date()
  };
}

async function processDeadlineAlerts() {
  const logger = global.logger || console;
  const now = Date.now();
  const maxWindowMs = ALERT_RULES.normal.thresholdMs;

  const candidates = await Request.find({
    status: { $in: ACTIVE_STATUSES },
    deliveryDate: {
      $gt: new Date(now),
      $lte: new Date(now + maxWindowMs)
    }
  })
    .select('_id requestNumber title urgency area status deliveryDate deadlineAlertsSent')
    .lean();

  if (candidates.length === 0) return;

  const targetUsers = await User.find(getTargetProfilesFilter())
    .select('_id')
    .lean();

  if (targetUsers.length === 0) return;

  const targetUserIds = targetUsers.map((user) => user._id?.toString()).filter(Boolean);
  if (targetUserIds.length === 0) return;

  for (const request of candidates) {
    const rule = getAlertRule(request.urgency);
    const deliveryMs = new Date(request.deliveryDate).getTime();
    if (Number.isNaN(deliveryMs)) continue;

    const remainingMs = deliveryMs - now;
    if (remainingMs <= 0 || remainingMs > rule.thresholdMs) continue;

    const alreadySent = Array.isArray(request.deadlineAlertsSent) && request.deadlineAlertsSent.includes(rule.key);
    if (alreadySent) continue;

    const updated = await Request.findOneAndUpdate(
      { _id: request._id, deadlineAlertsSent: { $ne: rule.key } },
      { $push: { deadlineAlertsSent: rule.key } },
      { new: false }
    ).lean();

    if (!updated) continue;

    const payload = buildDeadlineAlertPayload(request, rule, remainingMs);
    targetUserIds.forEach((userId) => notifyUser(userId, payload));

    logger.info('Alerta de entrega enviada', {
      requestId: String(request._id),
      requestNumber: request.requestNumber,
      urgency: request.urgency,
      alertKey: rule.key,
      recipients: targetUserIds.length
    });
  }
}

function startDeadlineAlertsMonitor() {
  if (deadlineAlertInterval) return;

  processDeadlineAlerts().catch((error) => {
    const logger = global.logger || console;
    logger.error('Error ejecutando validación inicial de alertas de entrega', { error: error.message });
  });

  deadlineAlertInterval = setInterval(() => {
    processDeadlineAlerts().catch((error) => {
      const logger = global.logger || console;
      logger.error('Error ejecutando monitor de alertas de entrega', { error: error.message });
    });
  }, CHECK_INTERVAL_MS);
}

function stopDeadlineAlertsMonitor() {
  if (!deadlineAlertInterval) return;
  clearInterval(deadlineAlertInterval);
  deadlineAlertInterval = null;
}

module.exports = {
  processDeadlineAlerts,
  startDeadlineAlertsMonitor,
  stopDeadlineAlertsMonitor
};
