// utils/websocket.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss = null;
let pingInterval = null;
let fallbackTimeout = null;
const clients = new Map(); // userId -> ws

function initializeWebSocket(server) {
  if (wss) return wss;

  wss = new WebSocket.Server({ server });

  wss.on('connection', (ws) => {
    console.log('📡 Cliente WebSocket conectado');

    ws.isAlive = true;
    ws.userId = null;

    ws.on('pong', () => {
      ws.isAlive = true;
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());

        if (message.type === 'AUTH') {
          const token = message.token;
          try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            ws.userId = decoded.id;
            ws.userEmail = decoded.email;
            clients.set(decoded.id.toString(), ws);
            console.log(`✅ Usuario autenticado WS: ${decoded.email}`);
            ws.send(JSON.stringify({ type: 'AUTH_SUCCESS' }));
          } catch (err) {
            console.warn('WebSocket AUTH token inválido:', err.message);
            ws.send(JSON.stringify({ type: 'AUTH_FAILED' }));
          }
        }
      } catch (err) {
        console.error('Error procesando mensaje WebSocket:', err.message);
      }
    });

    ws.on('close', () => {
      if (ws.userId) {
        clients.delete(ws.userId.toString());
        console.log(`❌ Cliente WS desconectado: ${ws.userEmail || ws.userId}`);
      }
    });

    ws.on('error', (err) => {
      console.error('WebSocket error:', err.message || err);
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

  console.log('🔌 WebSocket inicializado');
  return wss;
}

function closeWebSocket() {
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
        console.log('🔌 WebSocket cerrado correctamente');
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

module.exports = {
  initializeWebSocket,
  closeWebSocket,
  notifyStatusChange,
  notifyNewRequest,
  notifyNewComment,
  notifyUser,
  broadcast,
  // helpers para tests / debug
  _getWSS: () => wss,
  _getClientsMap: () => clients
};