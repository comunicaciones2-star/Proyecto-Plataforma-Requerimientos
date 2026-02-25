require('dotenv').config();
require('dotenv').config({ path: '.env.local', override: true });
const http = require('http');

const BASE_URL = process.env.TEST_BASE_URL || process.env.BASE_URL || 'http://localhost:5000';
const REQUESTER_EMAIL = process.env.TEST_QUEUE_REQUESTER_EMAIL || 'asistentedireccion@fenalcosantander.com.co';
const REQUESTER_PASSWORD = process.env.TEST_QUEUE_REQUESTER_PASSWORD || 'password123';
const ADMIN_EMAIL = process.env.TEST_QUEUE_ADMIN_EMAIL || 'comunicaciones2@fenalcosantander.com.co';
const ADMIN_PASSWORD = process.env.TEST_QUEUE_ADMIN_PASSWORD || 'password123';

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

function isQueueInfoShapeValid(queueInfo) {
  if (!queueInfo || typeof queueInfo !== 'object') return false;
  const hasScope = queueInfo.scope && typeof queueInfo.scope === 'object';
  return Boolean(
    queueInfo.ticketId &&
    ['pending', 'assigned'].includes(queueInfo.stage) &&
    hasScope &&
    typeof queueInfo.scope.department === 'string' &&
    typeof queueInfo.scope.executorType === 'string' &&
    typeof queueInfo.position === 'number' &&
    typeof queueInfo.total === 'number' &&
    typeof queueInfo.ahead === 'number'
  );
}

async function login(email, password) {
  return makeRequest('POST', '/api/auth/login', { email, password });
}

async function runQueueSmoke() {
  console.log(`\n${colors.cyan}${colors.bold}=== SMOKE TEST COLA DE TICKETS ===${colors.reset}`);
  console.log(`${colors.cyan}Servidor: ${BASE_URL}${colors.reset}`);
  console.log(`${colors.cyan}Requester: ${REQUESTER_EMAIL}${colors.reset}`);
  console.log(`${colors.cyan}Admin: ${ADMIN_EMAIL}\n${colors.reset}`);

  let passed = 0;
  let failed = 0;

  try {
    logStep('1', 'Health check');
    const health = await makeRequest('GET', '/api/health');
    if (assertCheck(health.status === 200, 'Health OK', `Health falló (status ${health.status})`)) passed++;
    else failed++;

    logStep('2', 'Login requester');
    const requesterLogin = await login(REQUESTER_EMAIL, REQUESTER_PASSWORD);
    const requesterToken = requesterLogin?.data?.token;
    const requesterRole = requesterLogin?.data?.user?.role;
    if (assertCheck(Boolean(requesterToken), `Login requester OK (${requesterRole || 'sin rol'})`, `Login requester falló (${requesterLogin.status})`)) passed++;
    else failed++;

    if (!requesterToken) {
      throw new Error('No se obtuvo token requester');
    }

    logStep('3', 'Requests devuelve queueInfo');
    const requestsResponse = await makeRequest('GET', '/api/requests?page=1&limit=20', null, requesterToken);
    const requests = requestsResponse?.data?.requests || [];
    const sampleRequest = requests[0] || null;
    const requestsOk = requestsResponse.status === 200 && Array.isArray(requests);
    if (assertCheck(requestsOk, `Requests OK (${requests.length} elementos)`, `Requests falló (${requestsResponse.status})`)) passed++;
    else failed++;

    logStep('4', 'Queue my');
    const myQueue = await makeRequest('GET', '/api/queue/my', null, requesterToken);
    const myQueueOk = myQueue.status === 200 && myQueue.data && myQueue.data.success && Array.isArray(myQueue.data.asRequester) && Array.isArray(myQueue.data.asExecutor);
    if (assertCheck(myQueueOk, 'queue/my OK', `queue/my falló (${myQueue.status})`)) passed++;
    else failed++;

    const requesterTicket = (myQueue.data?.asRequester || [])[0] || null;
    const ticketToValidate = requesterTicket || sampleRequest;

    if (ticketToValidate && ticketToValidate._id) {
      logStep('5', 'Queue position por ticket');
      const ticketQueue = await makeRequest('GET', `/api/queue/tickets/${ticketToValidate._id}/position`, null, requesterToken);
      const detail = await makeRequest('GET', `/api/requests/${ticketToValidate._id}`, null, requesterToken);

      const positionOk = ticketQueue.status === 200 && ticketQueue.data && ticketQueue.data.success;
      if (assertCheck(positionOk, 'queue/tickets/:id/position OK', `queue/tickets/:id/position falló (${ticketQueue.status})`)) passed++;
      else failed++;

      const detailQueueInfo = detail?.data?.request?.queueInfo || null;
      const ticketQueueInfo = ticketQueue?.data?.queueInfo || null;

      const shapeOk = (!ticketQueueInfo && !detailQueueInfo) || (isQueueInfoShapeValid(ticketQueueInfo) && isQueueInfoShapeValid(detailQueueInfo));
      if (assertCheck(shapeOk, 'Shape queueInfo válida en detalle/posición', 'Shape queueInfo inválida')) passed++;
      else failed++;
    } else {
      logStep('5', 'Queue position por ticket');
      console.log(`${colors.yellow}   ⚠️ Omitido: no hay solicitudes para validar ticket puntual${colors.reset}`);
    }

    logStep('6', 'Login admin');
    const adminLogin = await login(ADMIN_EMAIL, ADMIN_PASSWORD);
    const adminToken = adminLogin?.data?.token;
    const adminRole = adminLogin?.data?.user?.role;
    const adminLoginOk = Boolean(adminToken) && adminRole === 'admin';
    if (assertCheck(adminLoginOk, `Login admin OK (${adminLogin?.data?.user?.email || ADMIN_EMAIL})`, `Login admin falló (${adminLogin.status})`)) passed++;
    else failed++;

    if (!adminToken) {
      throw new Error('No se obtuvo token admin');
    }

    logStep('7', 'Queue scope (admin)');
    const queueScope = await makeRequest('GET', '/api/queue/scope?page=1&limit=10', null, adminToken);
    const queueScopeOk = queueScope.status === 200 && queueScope.data && queueScope.data.success && queueScope.data.pagination && Array.isArray(queueScope.data.queue);
    if (assertCheck(queueScopeOk, 'queue/scope OK', `queue/scope falló (${queueScope.status})`)) passed++;
    else failed++;

    console.log(`\n${colors.bold}Resumen:${colors.reset}`);
    console.log(`${colors.green}   Pasadas: ${passed}${colors.reset}`);
    if (failed > 0) {
      console.log(`${colors.red}   Fallidas: ${failed}${colors.reset}`);
      process.exit(1);
    }
    console.log(`${colors.green}   Fallidas: 0${colors.reset}`);
    console.log(`\n${colors.green}${colors.bold}Smoke test de cola completado correctamente.${colors.reset}`);
  } catch (error) {
    console.error(`\n${colors.red}Error fatal en smoke test de cola: ${error.message}${colors.reset}`);
    process.exit(1);
  }
}

runQueueSmoke();
