const mongoose = require('mongoose');

let mongoServer = null;
try {
  // Ajusta la ruta si tu helper está en otro lugar
  // Intenta obtener la instancia si tu suite crea mongodb-memory-server y la exporta
  // Ejemplo: module.exports = { mongoServer } en tests/helpers/mongoServer.js
  mongoServer = require('./helpers/mongoServer').mongoServer;
} catch (e) {
  mongoServer = null;
}

let stopServer = null;
try {
  // stopServer lo exporta tu server.js (ya lo tienes)
  stopServer = require('../server').stopServer;
} catch (e) {
  stopServer = null;
}

let closeWebSocket = null;
try {
  // closeWebSocket lo exportará el módulo websocket propuesto abajo
  closeWebSocket = require('../utils/websocket').closeWebSocket;
} catch (e) {
  closeWebSocket = null;
}

afterAll(async () => {
  // Si quieres inspeccionar handles abiertos, activa DEBUG_OPEN_HANDLES=1 antes de correr los tests.
  if (process.env.DEBUG_OPEN_HANDLES) {
    try {
      const why = require('why-is-node-running');
      // esperamos un poco para que aparezcan handles residuales
      setTimeout(() => {
        console.log('----- why-is-node-running -----');
        why();
        console.log('-------------------------------');
      }, 2000);
    } catch (err) {
      // why-is-node-running no está instalado
      // eslint-disable-next-line no-console
      console.log('why-is-node-running no instalado. Instala con: npm i -D why-is-node-running');
    }
  }

  // Cerrar conexiones mongoose
  try {
    await mongoose.disconnect();
    // eslint-disable-next-line no-console
    console.log('Mongoose disconnected');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Error disconnecting mongoose:', err && err.message);
  }

  // Detener mongodb-memory-server (si aplica)
  if (mongoServer && typeof mongoServer.stop === 'function') {
    try {
      await mongoServer.stop();
      // eslint-disable-next-line no-console
      console.log('Mongo memory server stopped');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Error stopping mongoServer:', err && err.message);
    }
  }

  // Cerrar WebSocket server y clientes
  if (closeWebSocket && typeof closeWebSocket === 'function') {
    try {
      await closeWebSocket();
      // eslint-disable-next-line no-console
      console.log('WebSocket server closed');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Error closing websocket:', err && err.message);
    }
  }

  // Cerrar HTTP server
  if (stopServer && typeof stopServer === 'function') {
    try {
      await stopServer();
      // eslint-disable-next-line no-console
      console.log('HTTP server stopped via stopServer()');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Error stopping HTTP server:', err && err.message);
    }
  }

  // Limpiar timers de Jest
  try {
    // Si usas timers fake de Jest, limpia
    if (typeof jest !== 'undefined' && jest.clearAllTimers) {
      jest.clearAllTimers();
    }
  } catch (e) {
    // ignore
  }
});