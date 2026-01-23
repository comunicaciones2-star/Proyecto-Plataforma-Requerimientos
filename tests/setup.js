// tests/setup.js - Configuración global para tests
require('dotenv').config({ path: '.env.test' });

// Mock del logger global
global.logger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn()
};

// Timeout global para tests
jest.setTimeout(10000);
