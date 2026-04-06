#!/usr/bin/env node
/*
  Smoke test de dashboard analytics por rol.

  Uso (PowerShell):
  $env:SMOKE_BASE_URL='https://tu-dominio.com';
  $env:SMOKE_REQUESTER_EMAIL='requester@dominio.com';
  $env:SMOKE_REQUESTER_PASSWORD='***';
  $env:SMOKE_EXECUTOR_EMAIL='executor@dominio.com';
  $env:SMOKE_EXECUTOR_PASSWORD='***';
  npm run smoke:dashboard
*/

const http = require('http');
const https = require('https');

function env(name, fallback = '') {
  return String(process.env[name] || fallback).trim();
}

function fail(message, details) {
  console.error(`\n[SMOKE:DASHBOARD][FAIL] ${message}`);
  if (details) {
    console.error(details);
  }
  process.exit(1);
}

function ensureEnv(name) {
  const value = env(name);
  if (!value) {
    fail(`Falta variable de entorno obligatoria: ${name}`);
  }
  return value;
}

function requestJson(method, urlString, body, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const client = url.protocol === 'https:' ? https : http;

    const payload = body ? JSON.stringify(body) : null;
    const req = client.request(
      {
        method,
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: `${url.pathname}${url.search}`,
        headers: {
          Accept: 'application/json',
          ...(payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => {
          raw += chunk;
        });
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = raw ? JSON.parse(raw) : null;
          } catch (error) {
            return reject(new Error(`Respuesta no JSON (${urlString}): ${raw.slice(0, 300)}`));
          }

          resolve({
            status: res.statusCode || 0,
            data: parsed
          });
        });
      }
    );

    req.on('error', reject);

    if (payload) {
      req.write(payload);
    }

    req.end();
  });
}

async function login(baseUrl, email, password) {
  const response = await requestJson('POST', `${baseUrl}/api/auth/login`, { email, password });

  if (response.status < 200 || response.status >= 300 || !response.data?.success || !response.data?.token) {
    throw new Error(`Login fallido para ${email}. Status ${response.status}. Respuesta: ${JSON.stringify(response.data)}`);
  }

  return response.data.token;
}

function assertDefinedField(object, path) {
  const segments = path.split('.');
  let current = object;

  for (const segment of segments) {
    if (current == null || !(segment in current)) {
      throw new Error(`Campo faltante: ${path}`);
    }
    current = current[segment];
  }

  if (typeof current === 'undefined') {
    throw new Error(`Campo undefined: ${path}`);
  }
}

async function checkAnalytics(baseUrl, token, expectedRoleView, label) {
  const response = await requestJson('GET', `${baseUrl}/api/reports/analytics/overview`, null, {
    Authorization: `Bearer ${token}`
  });

  if (response.status < 200 || response.status >= 300 || !response.data?.success) {
    throw new Error(`analytics/overview falló (${label}). Status ${response.status}. Respuesta: ${JSON.stringify(response.data)}`);
  }

  const payload = response.data;

  if (payload.roleView !== expectedRoleView) {
    throw new Error(`roleView inesperado para ${label}. Esperado=${expectedRoleView}, recibido=${payload.roleView}`);
  }

  if (expectedRoleView === 'requester') {
    assertDefinedField(payload, 'data.servicio.volumenSolicitudesUsuario');
    assertDefinedField(payload, 'data.servicio.completadas');
    assertDefinedField(payload, 'data.operacion.pendientesAsignacion');
    assertDefinedField(payload, 'data.operacion.enProceso');
    assertDefinedField(payload, 'data.operacion.enRevision');
    assertDefinedField(payload, 'data.operacion.distribucionEstado');
  }

  if (expectedRoleView === 'executor') {
    assertDefinedField(payload, 'data.desempeno.solicitudesActivasAsignadas');
    assertDefinedField(payload, 'data.desempeno.enProceso');
    assertDefinedField(payload, 'data.desempeno.enRevision');
    assertDefinedField(payload, 'data.desempeno.completadas');
    assertDefinedField(payload, 'data.operacion.distribucionEstadoPropio');
  }

  return payload;
}

function summarizeRequester(payload) {
  return {
    roleView: payload.roleView,
    volumenSolicitudesUsuario: payload.data?.servicio?.volumenSolicitudesUsuario,
    completadas: payload.data?.servicio?.completadas,
    pendientesAsignacion: payload.data?.operacion?.pendientesAsignacion,
    enProceso: payload.data?.operacion?.enProceso,
    enRevision: payload.data?.operacion?.enRevision,
    distribucionEstadoItems: Array.isArray(payload.data?.operacion?.distribucionEstado)
      ? payload.data.operacion.distribucionEstado.length
      : 0
  };
}

function summarizeExecutor(payload) {
  return {
    roleView: payload.roleView,
    solicitudesActivasAsignadas: payload.data?.desempeno?.solicitudesActivasAsignadas,
    enProceso: payload.data?.desempeno?.enProceso,
    enRevision: payload.data?.desempeno?.enRevision,
    completadas: payload.data?.desempeno?.completadas,
    distribucionEstadoPropioItems: Array.isArray(payload.data?.operacion?.distribucionEstadoPropio)
      ? payload.data.operacion.distribucionEstadoPropio.length
      : 0
  };
}

(async () => {
  const baseUrl = env('SMOKE_BASE_URL', 'http://localhost:5000').replace(/\/$/, '');

  const requesterEmail = ensureEnv('SMOKE_REQUESTER_EMAIL');
  const requesterPassword = ensureEnv('SMOKE_REQUESTER_PASSWORD');
  const executorEmail = ensureEnv('SMOKE_EXECUTOR_EMAIL');
  const executorPassword = ensureEnv('SMOKE_EXECUTOR_PASSWORD');

  console.log('[SMOKE:DASHBOARD] Iniciando validación...');
  console.log(`[SMOKE:DASHBOARD] Base URL: ${baseUrl}`);

  const requesterToken = await login(baseUrl, requesterEmail, requesterPassword);
  const requesterPayload = await checkAnalytics(baseUrl, requesterToken, 'requester', 'requester');

  const executorToken = await login(baseUrl, executorEmail, executorPassword);
  const executorPayload = await checkAnalytics(baseUrl, executorToken, 'executor', 'executor');

  console.log('\n[SMOKE:DASHBOARD] Requester OK');
  console.table([summarizeRequester(requesterPayload)]);

  console.log('[SMOKE:DASHBOARD] Executor OK');
  console.table([summarizeExecutor(executorPayload)]);

  console.log('\n[SMOKE:DASHBOARD] PASS');
})().catch((error) => {
  fail(error.message, error.stack);
});
