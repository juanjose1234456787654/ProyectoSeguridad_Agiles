const mysql = require('mysql2');
const { execFile } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execFileAsync = promisify(execFile);

// MS-IDENTIDAD solo necesita BD_IDENTIDAD y BD_UTA
const DATABASE_NAMES = {
  identidad: process.env.DB_IDENTIDAD_NAME || 'BD_IDENTIDAD',
  uta: process.env.DB_UTA_NAME || 'BD_UTA'
};

const DB_CLIENT = (process.env.DB_CLIENT || 'sqlserver').toLowerCase();

const mysqlPools = (() => {
  if (DB_CLIENT !== 'mysql') return null;

  const sharedConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT || 10),
    queueLimit: 0
  };

  return Object.fromEntries(
    Object.entries(DATABASE_NAMES).map(([key, database]) => {
      const pool = mysql.createPool({ ...sharedConfig, database });
      return [key, pool.promise()];
    })
  );
})();

const escapeSqlValue = (value) => {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/'/g, "''")}'`;
};

const buildQuery = (sql, params) => {
  if (!params || params.length === 0) return sql;
  let index = 0;
  return sql.replace(/\?/g, () => {
    const value = params[index++];
    return escapeSqlValue(value);
  });
};

const runSqlServerQuery = async (database, sql, params = []) => {
  const instance = process.env.DB_SQL_INSTANCE || 'localhost\\SQLEXPRESS';
  // Normalizar: trim + colapsar newlines/tabs a un espacio para evitar problemas en Windows con args multilínea
  const query = buildQuery(sql, params).trim().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
  const isSelect = /^select\b/i.test(query);

  const wrappedQuery = isSelect
    ? `SET NOCOUNT ON; ${query} FOR JSON PATH, INCLUDE_NULL_VALUES;`
    : `SET NOCOUNT ON; ${query};`;

  // -y 0 = columnas de ancho ilimitado (evita truncar JSON en 255 chars)
  // No se puede combinar con -h ni -W, así que filtramos headers manualmente
  const args = ['-S', instance, '-E', '-C', '-d', database, '-Q', wrappedQuery, '-y', '0'];

  const { stdout, stderr } = await execFileAsync('sqlcmd', args, {
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024  // 10 MB
  });

  if (stderr && stderr.trim()) {
    throw new Error(stderr.trim());
  }

  if (!isSelect) {
    return [[], { affectedRows: 0 }];
  }

  // Con -y 0 (sin -h -1), sqlcmd incluye cabeceras. El JSON de FOR JSON PATH
  // aparece en la línea que empieza con '['. Unimos líneas consecutivas de JSON
  // por si el output se partiera en varias líneas.
  const lines = (stdout || '').split(/\r?\n/);
  const jsonLines = [];
  let capturing = false;
  for (const line of lines) {
    const t = line.trim();
    if (!capturing && t.startsWith('[')) { capturing = true; }
    if (capturing && t) { jsonLines.push(t); }
    // Dejamos de capturar al llegar a una línea vacía después de haber capturado algo
    if (capturing && !t && jsonLines.length > 0) break;
  }
  const raw = jsonLines.join('');
  console.log(`[DB ${database}] stdout_len=${stdout?.length} json_raw_len=${raw.length} preview=${raw.substring(0,200)}`);

  if (!raw) {
    // FOR JSON PATH devuelve NULL si no hay filas
    console.log(`[DB ${database}] Sin datos JSON en la salida`);
    return [[], {}];
  }

  // Detectar errores SQL en stdout (Msg XXXX)
  if (/Msg\s+\d+/.test(raw)) {
    throw new Error(raw.replace(/\s+/g, ' ').slice(0, 500));
  }

  const rows = JSON.parse(raw);
  console.log(`[DB ${database}] rows parsed: ${rows.length}`);
  return [rows, {}];
};

const getDb = (dbKey = 'identidad') => {
  const database = DATABASE_NAMES[dbKey];

  if (!database) {
    throw new Error(`Base de datos no configurada para la clave: ${dbKey}`);
  }

  if (DB_CLIENT === 'mysql') {
    return mysqlPools[dbKey];
  }

  return {
    query: (sql, params) => runSqlServerQuery(database, sql, params)
  };
};

const testConnections = async () => {
  const checks = Object.keys(DATABASE_NAMES).map(async (name) => {
    try {
      await getDb(name).query('SELECT 1 AS ok');
      return [name, { connected: true }];
    } catch (error) {
      return [name, { connected: false, error: error.message }];
    }
  });

  const results = await Promise.all(checks);
  return Object.fromEntries(results);
};

module.exports = {
  getDb,
  databaseNames: DATABASE_NAMES,
  testConnections
};
