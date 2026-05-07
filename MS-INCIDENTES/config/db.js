const mysql = require('mysql2');
const { execFile } = require('child_process');
const { promisify } = require('util');
require('dotenv').config();

const execFileAsync = promisify(execFile);

// MS-INCIDENTES solo necesita BD_INCIDENTES
const DATABASE_NAMES = {
  incidentes: process.env.DB_INCIDENTES_NAME || 'BD_INCIDENTES'
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

  const args = ['-S', instance, '-E', '-C', '-d', database, '-Q', wrappedQuery, '-h', '-1', '-W'];

  const { stdout, stderr } = await execFileAsync('sqlcmd', args, {
    windowsHide: true,
    maxBuffer: 1024 * 1024
  });

  if (stderr && stderr.trim()) {
    throw new Error(stderr.trim());
  }

  if (!isSelect) {
    return [[], { affectedRows: 0 }];
  }

  const raw = (stdout || '').trim();
  if (!raw) return [[], {}];

  const jsonStart = raw.indexOf('[');
  if (jsonStart < 0) {
    throw new Error(`No se pudo parsear respuesta SQL Server: ${raw}`);
  }

  const jsonText = raw.slice(jsonStart);
  const rows = JSON.parse(jsonText);
  return [rows, {}];
};

const getDb = (dbKey = 'incidentes') => {
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
