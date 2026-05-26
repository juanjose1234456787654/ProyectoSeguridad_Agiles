/**
 * Script de diagnóstico temporal — ejecutar con: node test_query.js
 * Prueba la consulta de usuarios directamente sin pasar por Express
 */
require('dotenv').config();
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

const instance = process.env.DB_SQL_INSTANCE || 'localhost\\SQLEXPRESS';

async function runQuery(db, sql) {
  const wrapped = `SET NOCOUNT ON; ${sql} FOR JSON PATH, INCLUDE_NULL_VALUES;`;
  const args = ['-S', instance, '-E', '-C', '-d', db, '-Q', wrapped, '-h', '-1', '-W'];
  console.log(`\n>>> sqlcmd ${args.join(' ')}\n`);
  const { stdout, stderr } = await execFileAsync('sqlcmd', args, { windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  console.log('STDERR:', JSON.stringify(stderr));
  console.log('STDOUT length:', stdout?.length);
  console.log('STDOUT raw:', JSON.stringify(stdout?.substring(0, 500)));
  return stdout;
}

async function main() {
  // 1. Contar usuarios
  try {
    const { stdout: cnt } = await execFileAsync('sqlcmd', ['-S', instance, '-E', '-C', '-d', 'BD_IDENTIDAD', '-Q', 'SELECT COUNT(*) AS cnt FROM USUARIOS;'], { windowsHide: true });
    console.log('COUNT USUARIOS:', cnt.trim());
  } catch (e) {
    console.error('Error contando usuarios:', e.message);
  }

  // 2. Query simple sin JOIN
  try {
    const raw = await runQuery('BD_IDENTIDAD', 'SELECT u.ID_USU AS id, u.COR_INS_REF_USU AS email, u.ID_ROL_PER AS rolCodigo FROM USUARIOS u');
    const joined = (raw || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('');
    if (/Msg\s+\d+/.test(joined)) {
      console.error('SQL ERROR EN STDOUT:', joined.substring(0, 500));
    } else {
      const start = joined.indexOf('['), end = joined.lastIndexOf(']');
      if (start >= 0 && end > start) {
        const parsed = JSON.parse(joined.slice(start, end + 1));
        console.log('\n✅ Usuarios encontrados:', parsed.length);
        console.log('Primer usuario:', parsed[0]);
      } else {
        console.log('⚠️  No hay datos o no es JSON válido. joined:', joined);
      }
    }
  } catch (e) {
    console.error('Error en query simple:', e.message);
  }

  // 3. Query con JOIN a BD_UTA
  try {
    const raw2 = await runQuery('BD_IDENTIDAD',
      `SELECT u.ID_USU AS id, u.COR_INS_REF_USU AS email, u.ID_ROL_PER AS rolCodigo,
        RTRIM(CONCAT(ISNULL(p.NOM1_PER,''),' ',ISNULL(p.NOM2_PER,''),' ',ISNULL(p.APE1_PER,''),' ',ISNULL(p.APE2_PER,''))) AS nombre
       FROM USUARIOS u
       LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL_PER
       LEFT JOIN BD_UTA.dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU
       ORDER BY u.ID_USU`);
    const joined2 = (raw2 || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).join('');
    if (/Msg\s+\d+/.test(joined2)) {
      console.error('SQL ERROR EN STDOUT (join UTA):', joined2.substring(0, 500));
    } else {
      const s = joined2.indexOf('['), e2 = joined2.lastIndexOf(']');
      if (s >= 0 && e2 > s) {
        const parsed = JSON.parse(joined2.slice(s, e2 + 1));
        console.log('\n✅ Usuarios con nombre UTA:', parsed.length);
        console.log('Primero:', parsed[0]);
      } else {
        console.log('⚠️  join UTA: no JSON. joined:', joined2);
      }
    }
  } catch (e) {
    console.error('Error en query con JOIN UTA:', e.message);
  }
}

main().catch(console.error);
