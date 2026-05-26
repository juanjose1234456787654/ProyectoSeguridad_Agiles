const mysql = require('mysql2');
const { execFile } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execFileAsync = promisify(execFile);

const DATABASE_NAMES = {
  estadisticas: process.env.DB_ESTADISTICAS_NAME || 'BD_ESTADISTICAS'
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
  const query = buildQuery(sql, params).trim();
  const isSelect = /^select\b/i.test(query);

  const wrappedQuery = isSelect
    ? `SET NOCOUNT ON; ${query} FOR JSON PATH, INCLUDE_NULL_VALUES;`
    : `SET NOCOUNT ON; ${query};`;

  const normalizedQuery = wrappedQuery.replace(/[\r\n\t]+/g, ' ');
  const args = ['-S', instance, '-E', '-C', '-d', database, '-Q', normalizedQuery, '-y', '0'];

  const { stdout, stderr } = await execFileAsync('sqlcmd', args, {
    windowsHide: true,
    maxBuffer: 4 * 1024 * 1024
  });

  const stderrClean = (stderr || '').trim();
  if (stderrClean && /error|failed/i.test(stderrClean)) {
    throw new Error(stderrClean);
  }

  const rawAll = (stdout || '').replace(/\r\n/g, '\n').trim();
  if (rawAll && /Msg\s+\d+/i.test(rawAll)) {
    throw new Error(`SQL Server error: ${rawAll.split('\n')[0]}`);
  }

  if (!isSelect) {
    return [[], { affectedRows: 0 }];
  }

  const raw = (stdout || '').replace(/\r\n/g, '\n').trim();
  if (!raw) return [[], {}];

  if (/Msg\s+\d+/.test(raw)) {
    throw new Error(`SQL Server error: ${raw.split('\n')[0]}`);
  }

  const jsonStart = raw.indexOf('[');
  if (jsonStart < 0) return [[], {}];

  const jsonText = raw.slice(jsonStart);
  const rows = JSON.parse(jsonText);
  return [rows, {}];
};

const getDb = (dbKey = 'estadisticas') => {
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
