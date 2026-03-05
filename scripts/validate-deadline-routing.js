const { _test } = require('../utils/deadlineAlerts');

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m'
};

function assertEqualSet(actualList, expectedList, testName) {
  const actual = new Set(actualList);
  const expected = new Set(expectedList);

  const sameSize = actual.size === expected.size;
  const sameMembers = sameSize && [...expected].every((value) => actual.has(value));

  if (!sameMembers) {
    console.log(`${colors.red}  FAIL ${testName}${colors.reset}`);
    console.log(`${colors.red}    Esperado: ${JSON.stringify([...expected])}${colors.reset}`);
    console.log(`${colors.red}    Actual:   ${JSON.stringify([...actual])}${colors.reset}`);
    return false;
  }

  console.log(`${colors.green}  OK   ${testName}${colors.reset}`);
  return true;
}

function run() {
  console.log(`\n${colors.cyan}${colors.bold}=== VALIDACION RUTEO ALERTAS DEADLINE ===${colors.reset}`);

  const users = [
    { _id: 'u1', role: 'gerente', executorProfile: { executorType: '' } },
    { _id: 'u2', role: 'manager', executorProfile: { executorType: '' } },
    { _id: 'u3', role: 'designer', executorProfile: { executorType: '' } },
    { _id: 'u4', role: 'usuario', executorProfile: { executorType: 'diseñador' } },
    { _id: 'u5', role: 'practicante', executorProfile: { executorType: '' } },
    { _id: 'u6', role: 'usuario', executorProfile: { executorType: '' } }
  ];

  const usersByProfile = _test.buildTargetUserIdsByProfile(users);

  let passed = 0;
  let failed = 0;

  if (assertEqualSet(_test.getRecipientsForRequest(usersByProfile, 'gerente'), ['u1', 'u2'], 'perfil gerente')) passed += 1;
  else failed += 1;

  if (assertEqualSet(_test.getRecipientsForRequest(usersByProfile, 'manager'), ['u1', 'u2'], 'alias manager -> gerente')) passed += 1;
  else failed += 1;

  if (assertEqualSet(_test.getRecipientsForRequest(usersByProfile, 'diseñador'), ['u3', 'u4'], 'perfil diseñador')) passed += 1;
  else failed += 1;

  if (assertEqualSet(_test.getRecipientsForRequest(usersByProfile, 'designer'), ['u3', 'u4'], 'alias designer -> diseñador')) passed += 1;
  else failed += 1;

  if (assertEqualSet(_test.getRecipientsForRequest(usersByProfile, 'practicante'), ['u5'], 'perfil practicante')) passed += 1;
  else failed += 1;

  if (assertEqualSet(_test.getRecipientsForRequest(usersByProfile, 'rol_invalido'), ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'], 'fallback a todos si perfil invalido')) passed += 1;
  else failed += 1;

  console.log(`\n${colors.blue}Resumen:${colors.reset}`);
  console.log(`${colors.green}  Pasadas: ${passed}${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}  Fallidas: ${failed}${colors.reset}`);
    process.exit(1);
  }

  console.log(`${colors.green}  Fallidas: 0${colors.reset}`);
  console.log(`${colors.green}${colors.bold}\nValidacion completada sin errores.${colors.reset}`);
}

run();
