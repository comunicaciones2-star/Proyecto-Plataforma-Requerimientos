// scripts/smoke-test.js
require('dotenv').config();
const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:5000';
const TEST_LOGIN_EMAIL = process.env.TEST_LOGIN_EMAIL || process.env.ADMIN_EMAIL || 'admin@fenalcosantander.com.co';
const TEST_LOGIN_PASSWORD = process.env.TEST_LOGIN_PASSWORD || process.env.ADMIN_PASSWORD || 'admin123456';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function makeRequest(method, path, data = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers.Authorization = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(responseData) });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

function logStep(step, title) {
  console.log(`${colors.blue}${step}. ${title}${colors.reset}`);
}

function assertCheck(ok, passMessage, failMessage) {
  if (ok) {
    console.log(`${colors.green}   ✅ ${passMessage}${colors.reset}`);
    return true;
  }
  console.log(`${colors.red}   ❌ ${failMessage}${colors.reset}`);
  return false;
}

async function requestFirstAvailable(paths, token) {
  let last = null;
  for (const path of paths) {
    const response = await makeRequest('GET', path, null, token);
    if (response.status !== 404) {
      return { path, response };
    }
    last = { path, response };
  }
  return last;
}

async function runSmokeTest() {
  console.log(`\n${colors.cyan}${colors.bold}=== SMOKE TEST PLATAFORMA ===${colors.reset}`);
  console.log(`${colors.cyan}Servidor: ${BASE_URL}${colors.reset}\n`);

  let passed = 0;
  let failed = 0;
  let token = null;
  let createdRequestId = null;

  try {
    logStep('1', 'Health check');
    const health = await makeRequest('GET', '/api/health');
    if (assertCheck(health.status === 200, 'Health OK', `Health falló (status ${health.status})`)) passed++;
    else failed++;

    logStep('2', 'Login');
    const login = await makeRequest('POST', '/api/auth/login', {
      email: TEST_LOGIN_EMAIL,
      password: TEST_LOGIN_PASSWORD
    });

    if (login.status === 200 && login.data && login.data.success && login.data.token) {
      token = login.data.token;
      console.log(`${colors.green}   ✅ Login OK: ${login.data.user.email}${colors.reset}`);
      passed++;
    } else {
      console.log(`${colors.red}   ❌ Login falló (${login.status})${colors.reset}`);
      console.log(`${colors.yellow}   Credenciales usadas: ${TEST_LOGIN_EMAIL}${colors.reset}`);
      failed++;
    }

    if (!token) {
      throw new Error('No se obtuvo token. Smoke test detenido.');
    }

    logStep('3', 'Dashboard stats');
    const stats = await makeRequest('GET', '/api/admin/requests/stats', null, token);
    if (assertCheck(stats.status === 200 && stats.data && stats.data.success, 'Stats OK', `Stats falló (${stats.status})`)) passed++;
    else failed++;

    logStep('4', 'Monthly chart data');
    const monthlyResult = await requestFirstAvailable([
      '/api/admin/stats/monthly',
      '/api/admin/stats/monthly-performance'
    ], token);
    const monthly = monthlyResult.response;
    const monthlyBody = monthly.data;
    const monthlyData = Array.isArray(monthlyBody)
      ? monthlyBody
      : (monthlyBody && Array.isArray(monthlyBody.data) ? monthlyBody.data : null);
    const monthlyShapeOk = monthly.status === 200 && Array.isArray(monthlyData);
    if (assertCheck(monthlyShapeOk, `Monthly shape OK (${monthlyResult.path})`, `Monthly falló (${monthly.status})`)) passed++;
    else failed++;

    logStep('5', 'Urgency chart data');
    const urgencyResult = await requestFirstAvailable([
      '/api/admin/stats/urgency',
      '/api/admin/stats/urgency-distribution'
    ], token);
    const urgency = urgencyResult.response;
    const urgencyBody = urgency.data;
    const urgencyData = urgencyBody && urgencyBody.data ? urgencyBody.data : urgencyBody;
    const urgencyShapeOk = urgency.status === 200 && urgencyData && typeof urgencyData === 'object';
    if (assertCheck(urgencyShapeOk, `Urgency shape OK (${urgencyResult.path})`, `Urgency falló (${urgency.status})`)) passed++;
    else failed++;

    logStep('6', 'Crear solicitud de prueba');
    const now = Date.now();
    const createPayload = {
      area: 'Comunicaciones',
      type: 'redes',
      title: `Smoke Test ${new Date(now).toISOString()}`,
      description: 'Solicitud temporal para validar create/delete en smoke test.',
      urgency: 'normal',
      preferredExecutorRole: 'gerente',
      deliveryDate: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      targetAudience: 'Interno',
      categoryDetails: {
        digital: {
          channels: ['Instagram'],
          channelConfigs: {
            Instagram: {
              format: 'Post',
              publication: 'Feed',
              size: '1080x1080 - 1:1'
            }
          },
          objective: 'informativo',
          copyTitle: 'Smoke test',
          copyBody: 'Validación automática post-deploy'
        }
      }
    };

    const create = await makeRequest('POST', '/api/requests', createPayload, token);
    if (create.status === 201 && create.data && create.data.success && create.data.request && create.data.request._id) {
      createdRequestId = create.data.request._id;
      console.log(`${colors.green}   ✅ Solicitud creada: ${create.data.request.requestNumber}${colors.reset}`);
      passed++;
    } else {
      console.log(`${colors.red}   ❌ Crear solicitud falló (${create.status})${colors.reset}`);
      failed++;
    }

    if (createdRequestId) {
      logStep('7', 'Eliminar solicitud de prueba');
      const deletion = await makeRequest('DELETE', `/api/requests/${createdRequestId}`, null, token);
      if (assertCheck(deletion.status === 200 && deletion.data && deletion.data.success, 'Solicitud eliminada', `Delete falló (${deletion.status})`)) passed++;
      else failed++;
    } else {
      logStep('7', 'Eliminar solicitud de prueba');
      console.log(`${colors.yellow}   ⚠️ Omitido: no se creó solicitud${colors.reset}`);
    }

    console.log(`\n${colors.bold}Resumen:${colors.reset}`);
    console.log(`${colors.green}   Pasadas: ${passed}${colors.reset}`);
    if (failed > 0) {
      console.log(`${colors.red}   Fallidas: ${failed}${colors.reset}`);
    } else {
      console.log(`${colors.green}   Fallidas: 0${colors.reset}`);
    }

    if (failed > 0) {
      process.exit(1);
    }

    console.log(`\n${colors.green}${colors.bold}Smoke test completado correctamente.${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}Error fatal en smoke test: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

runSmokeTest();
