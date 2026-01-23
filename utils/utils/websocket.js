// utils/websocket.js
const WebSocket = require('ws');
const jwt = require('jsonwebtoken');

let wss = null;
const clients = new Map(); // userId -> ws

function initializeWebSocket(server) {
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

  // Heartbeat
  const interval = setInterval(() => {
    if (!wss) return;
    wss.clients.forEach((ws) => {
      if (!ws.isAlive) return ws.terminate();
      ws.isAlive = false;
      ws.ping(() => {});
    });
  }, 30000);

  wss.on('close', () => clearInterval(interval));

  console.log('🔌 WebSocket inicializado');
}

function broadcast(message) {
  if (!wss) return;
  const payload = JSON.stringify(message);
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(payload);
  });
}

function notifyUser(userId, message) {
  const client = clients.get(userId.toString());
  if (client && client.readyState === WebSocket.OPEN) {
    client.send(JSON.stringify(message));
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
  notifyStatusChange,
  notifyNewRequest,
  notifyNewComment,
  notifyUser,
  broadcast
};
