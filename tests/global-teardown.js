// tests/global-teardown.js
// Este archivo se ejecuta una vez después de TODOS los tests

module.exports = async () => {
  console.log('\n🧹 Ejecutando limpieza global después de tests...');
  
  // Dar un pequeño tiempo para que se cierren todos los recursos
  await new Promise(resolve => setTimeout(resolve, 500));
  
  console.log('✅ Limpieza global completada\n');
};
