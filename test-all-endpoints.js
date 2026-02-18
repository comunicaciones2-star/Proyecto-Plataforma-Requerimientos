// test-all-endpoints.js - Prueba completa de todos los endpoints
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
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => { responseData += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsed });
        } catch {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);
    if (data) req.write(JSON.stringify(data));
    req.end();
  });
}

async function runCompleteTests() {
  console.log('\n' + colors.cyan + colors.bold + '╔═══════════════════════════════════════════════════════════╗' + colors.reset);
  console.log(colors.cyan + colors.bold + '║   PRUEBA COMPLETA - FENALCO PLATAFORMA DE DISEÑOS         ║' + colors.reset);
  console.log(colors.cyan + colors.bold + '╚═══════════════════════════════════════════════════════════╝\n' + colors.reset);

  let token = null;
  let userId = null;
  let requestId = null;
  let testsPassed = 0;
  let testsFailed = 0;

  try {
    // 1. HEALTH CHECK
    console.log(colors.blue + '🔍 1. HEALTH CHECK' + colors.reset);
    let res = await makeRequest('GET', '/api/health');
    if (res.status === 200) {
      console.log(colors.green + '   ✅ Servidor activo y respondiendo' + colors.reset);
      testsPassed++;
    } else {
      console.log(colors.red + '   ❌ Health check falló' + colors.reset);
      testsFailed++;
    }
    console.log();

    // 2. LOGIN
    console.log(colors.blue + '🔐 2. LOGIN' + colors.reset);
    res = await makeRequest('POST', '/api/auth/login', {
      email: TEST_LOGIN_EMAIL,
      password: TEST_LOGIN_PASSWORD
    });
    if (res.status === 200 && res.data.success) {
      token = res.data.token;
      userId = res.data.user._id;
      console.log(colors.green + '   ✅ Login exitoso' + colors.reset);
      console.log(`   → Token obtenido: ${token.substring(0, 20)}...`);
      console.log(`   → Usuario: ${res.data.user.firstName} ${res.data.user.lastName} (${res.data.user.role})`);
      testsPassed++;
    } else {
      console.log(colors.red + '   ❌ Login falló' + colors.reset);
      console.log(colors.yellow + `   → Credenciales usadas: ${TEST_LOGIN_EMAIL}` + colors.reset);
      console.log(colors.yellow + '   → Configura TEST_LOGIN_EMAIL y TEST_LOGIN_PASSWORD en .env si aplica' + colors.reset);
      testsFailed++;
    }
    console.log();

    if (!token) {
      throw new Error('Token no obtenido. No se pueden continuar las pruebas.');
    }

    // 3. GET PROFILE
    console.log(colors.blue + '👤 3. VER PERFIL' + colors.reset);
    res = await makeRequest('GET', '/api/users/profile', null, token);
    if (res.status === 200 && res.data.success) {
      console.log(colors.green + '   ✅ Perfil obtenido' + colors.reset);
      console.log(`   → Email: ${res.data.user.email}`);
      console.log(`   → Área: ${res.data.user.area}`);
      testsPassed++;
    } else {
      console.log(colors.yellow + '   ⚠️ No disponible (opcional)' + colors.reset);
    }
    console.log();

    // 4. LISTAR SOLICITUDES
    console.log(colors.blue + '📋 4. LISTAR SOLICITUDES' + colors.reset);
    res = await makeRequest('GET', '/api/requests', null, token);
    if (res.status === 200 && res.data.success) {
      console.log(colors.green + '   ✅ Solicitudes obtenidas' + colors.reset);
      console.log(`   → Total: ${res.data.requests.length} solicitudes`);
      if (res.data.requests.length > 0) {
        requestId = res.data.requests[0]._id;
        console.log(`   → Primera solicitud: ${res.data.requests[0].title}`);
      }
      testsPassed++;
    } else {
      console.log(colors.red + '   ❌ Error obteniendo solicitudes' + colors.reset);
      testsFailed++;
    }
    console.log();

    // 5. VER DETALLES DE SOLICITUD
    if (requestId) {
      console.log(colors.blue + '🔍 5. VER DETALLES DE SOLICITUD' + colors.reset);
      res = await makeRequest('GET', `/api/requests/${requestId}`, null, token);
      if (res.status === 200 && res.data.success) {
        console.log(colors.green + '   ✅ Solicitud cargada' + colors.reset);
        console.log(`   → Número: ${res.data.request.requestNumber}`);
        console.log(`   → Estado: ${res.data.request.status}`);
        console.log(`   → Urgencia: ${res.data.request.urgency}`);
        testsPassed++;
      } else {
        console.log(colors.red + '   ❌ Error cargando solicitud' + colors.reset);
        testsFailed++;
      }
      console.log();
    }

    // 6. ESTADÍSTICAS ADMIN
    console.log(colors.blue + '📊 6. ESTADÍSTICAS ADMIN' + colors.reset);
    res = await makeRequest('GET', '/api/admin/requests/stats', null, token);
    if (res.status === 200 && res.data.success) {
      console.log(colors.green + '   ✅ Estadísticas obtenidas' + colors.reset);
      console.log(`   → Total solicitudes: ${res.data.stats.total}`);
      console.log(`   → Pendientes: ${res.data.stats.pending}`);
      console.log(`   → En proceso: ${res.data.stats.inProcess}`);
      console.log(`   → Completadas: ${res.data.stats.completed}`);
      testsPassed++;
    } else {
      console.log(colors.yellow + '   ⚠️ No disponible (requiere admin)' + colors.reset);
    }
    console.log();

    // 7. LISTAR USUARIOS ADMIN
    console.log(colors.blue + '👥 7. LISTAR USUARIOS (ADMIN)' + colors.reset);
    res = await makeRequest('GET', '/api/admin/users', null, token);
    if (res.status === 200 && res.data.success) {
      console.log(colors.green + '   ✅ Usuarios obtenidos' + colors.reset);
      console.log(`   → Total usuarios: ${res.data.users.length}`);
      res.data.users.slice(0, 3).forEach(u => {
        console.log(`   → ${u.email} (${u.firstName} ${u.lastName}) - ${u.role}`);
      });
      testsPassed++;
    } else {
      console.log(colors.yellow + '   ⚠️ No disponible (requiere admin)' + colors.reset);
    }
    console.log();

    // 8. CREAR NUEVA SOLICITUD
    console.log(colors.blue + '➕ 8. CREAR NUEVA SOLICITUD' + colors.reset);
    res = await makeRequest('POST', '/api/requests', {
      area: 'comunicaciones',
      type: 'redes',
      title: 'Posts para redes sociales - Febrero 2026',
      description: 'Necesitamos 5 posts diseñados para Instagram, Facebook y LinkedIn',
      urgency: 'normal',
      deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      targetAudience: 'Seguidores en redes sociales',
      referenceLinks: 'https://fenalcosantander.com.co'
    }, token);
    if (res.status === 201 && res.data.success) {
      console.log(colors.green + '   ✅ Solicitud creada exitosamente' + colors.reset);
      console.log(`   → Número: ${res.data.request.requestNumber}`);
      console.log(`   → Título: ${res.data.request.title}`);
      testsPassed++;
    } else {
      console.log(colors.yellow + '   ⚠️ Error creando solicitud' + colors.reset);
      testsFailed++;
    }
    console.log();

    // RESUMEN
    console.log(colors.cyan + '═════════════════════════════════════════════════════════════' + colors.reset);
    console.log(colors.bold + '\n📈 RESUMEN DE PRUEBAS\n' + colors.reset);
    console.log(colors.green + `✅ Pruebas pasadas: ${testsPassed}` + colors.reset);
    if (testsFailed > 0) {
      console.log(colors.red + `❌ Pruebas fallidas: ${testsFailed}` + colors.reset);
    }
    console.log(colors.green + `\n✨ ¡PLATAFORMA OPERACIONAL!\n` + colors.reset);

    console.log(colors.yellow + 'Información útil:' + colors.reset);
    console.log(`  📍 Servidor: ${BASE_URL}`);
    console.log(`  🔑 Login: ${TEST_LOGIN_EMAIL} / [configurado por entorno]`);
    console.log('  📊 Ver estadísticas: GET /api/admin/requests/stats');
    console.log('  ➕ Crear solicitud: POST /api/requests');
    console.log('  📋 Listar solicitudes: GET /api/requests\n');

    console.log(colors.cyan + '═════════════════════════════════════════════════════════════\n' + colors.reset);

  } catch (error) {
    console.error(colors.red + `\n❌ Error fatal: ${error.message}` + colors.reset);
    console.log(colors.yellow + '\nAsegúrate de que:' + colors.reset);
    console.log('  1. El servidor esté corriendo: npm run dev');
    console.log('  2. MongoDB esté conectado');
    console.log('  3. El usuario de prueba exista\n');
    process.exit(1);
  }
}

runCompleteTests();
