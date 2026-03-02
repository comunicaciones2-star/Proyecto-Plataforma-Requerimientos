// utils/websocket.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss = null;
let pingInterval = null;
let fallbackTimeout = null;
const clients = new Map(); // userId -> ws

const DEFAULT_AUTH_TIMEOUT_MS = 5000;
const DEFAULT_MAX_PAYLOAD_KB = 32;
const DEFAULT_RATE_LIMIT_MESSAGES = 10;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 1000;

function getLogger() {
  return global.logger || console;
}

function parsePositiveInt(rawValue, fallbackValue) {
  const parsed = Number.parseInt(rawValue, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackValue;
}

function getAllowedOrigins() {
  const configured = String(process.env.ALLOWED_ORIGINS || '').trim();
  if (!configured) {
    return null;
  }

  const origins = configured
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return origins.length > 0 ? origins : null;
}

function initializeWebSocket(server) {
  if (wss) return wss;

  const logger = getLogger();
  const authTimeoutMs = parsePositiveInt(process.env.WS_AUTH_TIMEOUT_MS, DEFAULT_AUTH_TIMEOUT_MS);
  const maxPayloadKb = parsePositiveInt(process.env.WS_MAX_PAYLOAD_KB, DEFAULT_MAX_PAYLOAD_KB);
  const maxPayloadBytes = maxPayloadKb * 1024;
  const maxMessagesPerWindow = parsePositiveInt(process.env.WS_MAX_MESSAGES_PER_SECOND, DEFAULT_RATE_LIMIT_MESSAGES);
  const rateLimitWindowMs = parsePositiveInt(process.env.WS_RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS);
  const allowedOrigins = getAllowedOrigins();

  if (!allowedOrigins && process.env.NODE_ENV === 'production') {
    logger.warn('WS sin ALLOWED_ORIGINS definido en producción; no se validará origin', {
      component: 'websocket'
    });
  }

  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws, req) => {
    const origin = req?.headers?.origin || null;
    const clientIp = req?.socket?.remoteAddress || null;

    if (allowedOrigins && (!origin || !allowedOrigins.includes(origin))) {
      logger.warn('WS origin rechazado', {
        component: 'websocket',
        origin,
        clientIp
      });
      ws.close(1008, 'Origin not allowed');
      return;
    }

    logger.info('Cliente WebSocket conectado', {
      component: 'websocket',
      origin,
      clientIp
    });

    ws.isAlive = true;
    ws.userId = null;
    ws.isAuthenticated = false;
    ws.rateLimitWindowStart = Date.now();
    ws.rateLimitMessageCount = 0;
    ws.rateLimitWarned = false;

    ws.authTimeout = setTimeout(() => {
      if (!ws.isAuthenticated && ws.readyState === WebSocket.OPEN) {
        logger.warn('WS cerrado por timeout de autenticación', {
          component: 'websocket',
          origin,
          clientIp
        });
        ws.close(1008, 'Authentication timeout');
      }
    }, authTimeoutMs);

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const payloadBytes = Buffer.isBuffer(data)
          ? data.length
          : Buffer.byteLength(String(data || ''), 'utf8');

        if (payloadBytes > maxPayloadBytes) {
          logger.warn('WS payload excede tamaño máximo', {
            component: 'websocket',
            payloadBytes,
            maxPayloadBytes,
            userId: ws.userId || null
          });
          ws.close(1009, 'Payload too large');
          return;
        }

        const now = Date.now();
        if (now - ws.rateLimitWindowStart >= rateLimitWindowMs) {
          ws.rateLimitWindowStart = now;
          ws.rateLimitMessageCount = 0;
          ws.rateLimitWarned = false;
        }

        ws.rateLimitMessageCount += 1;
        if (ws.rateLimitMessageCount > maxMessagesPerWindow) {
          if (!ws.rateLimitWarned && ws.readyState === WebSocket.OPEN) {
            ws.rateLimitWarned = true;
            try {
              ws.send(JSON.stringify({
                type: 'RATE_LIMIT_WARNING',
                message: 'Demasiados mensajes por segundo. Se cerrará la conexión.'
              }));
            } catch (e) {
              // ignore send warning errors
            }
          }

          logger.warn('WS rate limit excedido; cerrando conexión', {
            component: 'websocket',
            userId: ws.userId || null,
            messageCount: ws.rateLimitMessageCount,
            windowMs: rateLimitWindowMs,
            maxMessagesPerWindow
          });
          ws.close(1008, 'Rate limit exceeded');
          return;
        }

        const message = JSON.parse(data.toString());

        if (message.type === 'AUTH') {
          const token = message.token;
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            ws.userId = decoded.id;
            ws.userEmail = decoded.email;
            ws.isAuthenticated = true;
            if (ws.authTimeout) {
              clearTimeout(ws.authTimeout);
              ws.authTimeout = null;
            }
            clients.set(decoded.id.toString(), ws);
            logger.info('Usuario autenticado WS', {
              component: 'websocket',
              userEmail: decoded.email,
              userId: decoded.id
            });
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
          } catch (err) {
            logger.warn('WebSocket AUTH token inválido', {
              component: 'websocket',
              error: err.message
            });
            ws.send(JSON.stringify({ type: 'AUTH_FAILED' }));
          }
        }
      } catch (err) {
        logger.error('Error procesando mensaje WebSocket', {
          component: 'websocket',
          error: err.message
        });
      }
    });

    ws.on('close', () => {
      if (ws.authTimeout) {
        try { clearTimeout(ws.authTimeout); } catch (e) {}
        ws.authTimeout = null;
      }
      if (ws.userId) {
        clients.delete(ws.userId.toString());
        logger.info('Cliente WS desconectado', {
          component: 'websocket',
          user: ws.userEmail || ws.userId
        });
      }
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error', {
        component: 'websocket',
        error: err.message || String(err)
      });
    });
  });

  // Heartbeat: guardamos el interval en variable del módulo para poder limpiarlo con facilidad
  pingInterval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      try {
        if (!ws.isAlive) return ws.terminate();
        ws.isAlive = false;
        ws.ping(() => {});
      } catch (e) {
        // ignore individual client errors
      }
    });
  }, 30000);

  // Si el servidor WSS cierra por cualquier razón, limpiamos el interval
  wss.on('close', () => {
    if (pingInterval) {
      try { clearInterval(pingInterval); } catch (e) {}
      pingInterval = null;
    }
    if (fallbackTimeout) {
      try { clearTimeout(fallbackTimeout); } catch (e) {}
      fallbackTimeout = null;
    }
  });

  logger.info('WebSocket inicializado', {
    component: 'websocket',
    authTimeoutMs,
    maxPayloadKb,
    maxMessagesPerWindow,
    rateLimitWindowMs,
    originValidation: Boolean(allowedOrigins)
  });
  return wss;
}

function closeWebSocket() {
  const logger = getLogger();
  if (!wss) return Promise.resolve();

  return new Promise((resolve) => {
    // Limpiar interval de heartbeat
    if (pingInterval) {
      try { clearInterval(pingInterval); } catch (e) {}
      pingInterval = null;
    }

    // Terminar todas las conexiones
    try {
      wss.clients.forEach((client) => {
        try {
          if (client.readyState === WebSocket.OPEN || client.readyState === 1) {
            client.terminate();
          }
        } catch (e) {
          // ignore per-client errors
        }
      });
    } catch (e) {
      // ignore
    }

    // Limpiar el mapa de clientes
    try { clients.clear(); } catch (e) {}

    // Cerrar el servidor WebSocket con callback y fallback
    let closed = false;
    try {
      // Limpiar cualquier fallback previo si existiera
      if (fallbackTimeout) {
        try { clearTimeout(fallbackTimeout); } catch (e) {}
        fallbackTimeout = null;
      }

      wss.close(() => {
        closed = true;
        // limpiar fallback si quedó
        if (fallbackTimeout) {
          try { clearTimeout(fallbackTimeout); } catch (e) {}
          fallbackTimeout = null;
        }
        wss = null;
        logger.info('WebSocket cerrado correctamente', {
          component: 'websocket'
        });
        resolve();
      });
    } catch (err) {
      // ignore error, pero intentamos limpiar referencias
      wss = null;
      resolve();
      return;
    }

    // Fallback: si close no llama al callback en X ms, forzamos limpiar y resolver
    fallbackTimeout = setTimeout(() => {
      if (!closed) {
        try {
          if (wss) {
            wss.clients.forEach((client) => { try { client.terminate(); } catch (e) {} });
          }
        } catch (e) {}
      }
      fallbackTimeout = null;
      wss = null;
      resolve();
    }, 2000);
  });
}

function broadcast(message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    try {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    } catch (e) {
      // ignore
    }
  });
}

function notifyUser(userId, message) {
  const client = clients.get(userId.toString());
  if (client && client.readyState === WebSocket.OPEN) {
    try {
      client.send(JSON.stringify(message));
    } catch (e) {
      // ignore
    }
  }
}

function notifyStatusChange(request) {
  const msg = {
    type: 'STATUS_CHANGE',
    requestId: request._id,
    requestNumber: request.requestNumber,
    title: request.title,
    newStatus: request.status,
    timestamp: new Date()
  };
  broadcast(msg);
  if (request.requester) notifyUser(request.requester, msg);
}

function notifyNewRequest(request) {
  const msg = {
    type: 'NEW_REQUEST',
    requestId: request._id,
    requestNumber: request.requestNumber,
    requestData: {
      title: request.title,
      area: request.area,
      urgency: request.urgency
    },
    timestamp: new Date()
  };
  broadcast(msg);
}

function notifyNewComment(request, comment) {
  const msg = {
    type: 'NEW_COMMENT',
    requestId: request._id,
    requestNumber: request.requestNumber,
    comment: comment.text,
    authorName: comment.authorName,
    timestamp: new Date()
  };
  broadcast(msg);
  if (request.requester) notifyUser(request.requester, msg);
}

function notifyRequestUpdated(action, request, actor = {}) {
  const msg = {
    type: 'REQUEST_UPDATED',
    action,
    requestId: request?._id,
    requestNumber: request?.requestNumber,
    title: request?.title,
    actor: {
      id: actor.id || null,
      name: actor.name || null,
      role: actor.role || null
    },
    timestamp: new Date()
  };
  broadcast(msg);
  if (request?.requester) notifyUser(request.requester, msg);
}

module.exports = {
  initializeWebSocket,
  closeWebSocket,
  notifyStatusChange,
  notifyNewRequest,
  notifyNewComment,
  notifyRequestUpdated,
  notifyUser,
  broadcast,
  // helpers para tests / debug
  _getWSS: () => wss,
  _getClientsMap: () => clients
};