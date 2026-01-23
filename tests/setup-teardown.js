// tests/setup-teardown.js
const mongoose = require('mongoose');

let mongoServer = null;
try {
  // Ajusta la ruta si tu helper está en otro lugar
  mongoServer = require('./helpers/mongoServer').mongoServer;
} catch (e) {
  mongoServer = null;
}

let stopServer = null;
try {
  stopServer = require('../server').stopServer;
} catch (e) {
  stopServer = null;
}

let closeWebSocket = null;
try {
  closeWebSocket = require('../utils/websocket').closeWebSocket;
} catch (e) {
  closeWebSocket = null;
}

afterAll(async () => {
  console.log('[TEARDOWN] afterAll start');
  
  if (process.env.DEBUG_OPEN_HANDLES) {
    try {
      const why = require('why-is-node-running');
      setTimeout(() => {
        console.log('----- why-is-node-running -----');
        why();
        console.log('-------------------------------');
      }, 2000);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log('why-is-node-running no instalado. Instala con: npm i -D why-is-node-running');
    }
  }

  // Disconnect mongoose
  try {
    await mongoose.disconnect();
    // eslint-disable-next-line no-console
    console.log('Mongoose disconnected');
    console.log('[TEARDOWN] mongoose.disconnect done');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('Error disconnecting mongoose:', err && err.message);
  }

  // Stop mongodb-memory-server
  if (mongoServer && typeof mongoServer.stop === 'function') {
    try {
      await mongoServer.stop();
      // eslint-disable-next-line no-console
      console.log('[TEARDOWN] mongoServer.stop done');
      console.log('Mongo memory server stopped');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Error stopping mongoServer:', err && err.message);
    }
  }

  // Close WebSocket server
  if (closeWebSocket && typeof closeWebSocket === 'function') {
    try {
      await closeWebSocket();
      // eslint-disable-next-line no-console
      console.log('[TEARDOWN] closeWebSocket done');
      console.log('WebSocket server closed');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Error closing websocket:', err && err.message);
    }
  }

  // Stop HTTP server
  if (stopServer && typeof stopServer === 'function') {
    try {
      await stopServer();
      console.log('[TEARDOWN] stopServer done');
      // eslint-disable-next-line no-console
      console.log('HTTP server stopped via stopServer()');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('Error stopping HTTP server:', err && err.message);
    }
  }

  // Clear timers
  try {
    if (typeof jest !== 'undefined' && jest.clearAllTimers) {
      jest.clearAllTimers();
    }
  } catch (e) {
  
  console.log('[TEARDOWN] afterAll finished');
    // ignore
  }
});
