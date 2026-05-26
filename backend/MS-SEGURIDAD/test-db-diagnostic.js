const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileAsync = promisify(execFile);

async function test() {
  try {
    const selectArgs = ['-S', 'localhost\\SQLEXPRESS', '-E', '-C', '-d', 'BD_SEGURIDAD', '-Q', 'SET NOCOUNT ON; SELECT ID_EST, EST_EST, ID_USU_REF FROM ESTADO_GUARDIAS;', '-y', '0'];
    const r1 = await execFileAsync('sqlcmd', selectArgs, { maxBuffer: 1024*1024 });
    console.log('SELECT stdout:', JSON.stringify(r1.stdout.substring(0,500)));
    console.log('SELECT stderr:', JSON.stringify(r1.stderr));
  } catch(e) {
    console.error('SELECT ERROR:', e.message);
  }

  try {
    const insertArgs = ['-S', 'localhost\\SQLEXPRESS', '-E', '-C', '-d', 'BD_SEGURIDAD', '-Q', 'SET NOCOUNT ON; INSERT INTO ESTADO_GUARDIAS (ID_EST, EST_EST, HOR_SER_EST, ID_USU_REF) VALUES ("TEST99", "En Servicio", "TEST", "USU01");', '-y', '0'];
    const r2 = await execFileAsync('sqlcmd', insertArgs, { maxBuffer: 1024*1024 });
    console.log('INSERT stdout:', JSON.stringify(r2.stdout));
    console.log('INSERT stderr:', JSON.stringify(r2.stderr));
  } catch(e) {
    console.error('INSERT ERROR:', e.message);
  }

  try {
    const delArgs = ['-S', 'localhost\\SQLEXPRESS', '-E', '-C', '-d', 'BD_SEGURIDAD', '-Q', 'SET NOCOUNT ON; DELETE FROM ESTADO_GUARDIAS WHERE ID_EST = "TEST99";', '-y', '0'];
    const r3 = await execFileAsync('sqlcmd', delArgs, { maxBuffer: 1024*1024 });
    console.log('DELETE stdout:', JSON.stringify(r3.stdout));
  } catch(e) {
    console.error('DELETE ERROR:', e.message);
  }
}

test();
