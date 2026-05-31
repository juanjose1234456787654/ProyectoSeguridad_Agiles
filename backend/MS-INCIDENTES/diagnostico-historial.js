/**
 * Diagnóstico de la tabla HISTORIAL en BD_ESTADISTICAS
 * Ejecutar: node diagnostico-historial.js
 */
require('dotenv').config();
const { execFileSync } = require('child_process');

const INSTANCE = process.env.DB_SQL_INSTANCE || 'localhost\\SQLEXPRESS';

function runQuery(database, query) {
  try {
    const result = execFileSync('sqlcmd', [
      '-S', INSTANCE, '-E', '-C', '-d', database, '-Q', query, '-y', '0'
    ]);
    return result.toString().trim();
  } catch (e) {
    return `ERROR: ${e.message}`;
  }
}

console.log('\n=== DIAGNÓSTICO HISTORIAL ===\n');

// 1. Estructura de la tabla
console.log('1) Columnas y nullabilidad de HISTORIAL:');
console.log(runQuery('BD_ESTADISTICAS',
  "SELECT COLUMN_NAME, IS_NULLABLE, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'HISTORIAL'"
));

// 2. Restricciones FK
console.log('\n2) Restricciones FK de HISTORIAL:');
console.log(runQuery('BD_ESTADISTICAS',
  "SELECT fk.name AS fk_name, col.name AS col_name, ref_tab.name AS ref_table FROM sys.foreign_keys fk JOIN sys.foreign_key_columns fkc ON fk.object_id = fkc.constraint_object_id JOIN sys.columns col ON col.object_id = fkc.parent_object_id AND col.column_id = fkc.parent_column_id JOIN sys.tables ref_tab ON ref_tab.object_id = fkc.referenced_object_id WHERE OBJECT_NAME(fk.parent_object_id) = 'HISTORIAL'"
));

// 3. Restricciones CHECK/DEFAULT
console.log('\n3) Constraints de HISTORIAL:');
console.log(runQuery('BD_ESTADISTICAS',
  "SELECT tc.CONSTRAINT_NAME, tc.CONSTRAINT_TYPE FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc WHERE tc.TABLE_NAME = 'HISTORIAL'"
));

// 4. Datos actuales
console.log('\n4) Datos actuales en HISTORIAL (últimos 5):');
console.log(runQuery('BD_ESTADISTICAS', 'SELECT TOP 5 * FROM HISTORIAL ORDER BY ID_HIS DESC'));

// 5. Test INSERT
console.log('\n5) Test INSERT con ID_ASI_REF = NULL:');
const testId = 'HIS_TEST_99';
const insertResult = runQuery('BD_ESTADISTICAS',
  `INSERT INTO HISTORIAL (ID_HIS, FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON) VALUES ('${testId}', GETDATE(), GETDATE(), 'USU01', NULL, NULL)`
);
if (insertResult.includes('ERROR') || insertResult.toLowerCase().includes('msg')) {
  console.log('FALLO INSERT con NULL:', insertResult);
} else {
  console.log('INSERT con NULL exitoso');
  // limpiar
  runQuery('BD_ESTADISTICAS', `DELETE FROM HISTORIAL WHERE ID_HIS = '${testId}'`);
}

// 6. Ver tabla ASIGNACION_ALERTAS
console.log('\n6) Últimas ASIGNACION_ALERTAS:');
console.log(runQuery('BD_SEGURIDAD', 'SELECT TOP 5 * FROM ASIGNACION_ALERTAS ORDER BY ID_ASI DESC'));

// 7. Ver últimos INCIDENTES
console.log('\n7) Últimos INCIDENTES:');
console.log(runQuery('BD_INCIDENTES', 'SELECT TOP 5 ID_INC, MOT_INC, EST_INC, ID_USU_REF FROM INCIDENTES ORDER BY ID_INC DESC'));

console.log('\n=== FIN DIAGNÓSTICO ===\n');
