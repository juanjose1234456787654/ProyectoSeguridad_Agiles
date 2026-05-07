const { getDb } = require('../config/db');

const identidadDb = getDb('identidad');
const utaDb = getDb('uta');

const IDENTITY_ROLE_BY_UTA_ROLE_NAME = {
  'Guardia de Seguridad': 'ROL02',
  Estudiante: 'ROL03',
  Docente: 'ROL04',
  Personal: 'ROL05'
};

const USER_FACING_ROLE_BY_NAME = {
  'Guardia de Seguridad': 'Guardia',
  Estudiante: 'Estudiante',
  Docente: 'Docente',
  Personal: 'Personal',
  Administrador: 'Administrador'
};

const isTableMissingError = (error) => {
  const message = String(error?.message || '').toLowerCase();
  return (
    error && (
      error.code === 'ER_NO_SUCH_TABLE' ||
      error.code === 'ER_BAD_DB_ERROR' ||
      message.includes('invalid object name') ||
      message.includes('cannot open database')
    )
  );
};

const findUserInLegacySchema = async (email) => {
  const [rows] = await identidadDb.query(
    `SELECT TOP 1
      u.ID_USU AS id,
      u.COR_INS_REF_USU AS email,
      u.CON_USU AS password,
      u.ID_ROL_PER AS rolCodigo,
      r.NOM_ROL AS rol
    FROM USUARIOS u
    LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL_PER
    WHERE u.COR_INS_REF_USU = ?`,
    [email]
  );

  return rows[0];
};

const findUserInSimpleSchema = async (email) => {
  const [rows] = await identidadDb.query(
    'SELECT TOP 1 * FROM usuarios WHERE email = ?',
    [email]
  );

  return rows[0];
};

const findRoleNameInIdentity = async (roleCode) => {
  const [rows] = await identidadDb.query(
    'SELECT TOP 1 NOM_ROL FROM ROLES WHERE ID_ROL = ?',
    [roleCode]
  );

  return rows[0]?.NOM_ROL;
};

const findUtaUserByEmail = async (email) => {
  const [rows] = await utaDb.query(
    `SELECT TOP 1
      p.CED_PER AS idPersona,
      p.NOM1_PER AS nombre1,
      p.NOM2_PER AS nombre2,
      p.APE1_PER AS apellido1,
      p.APE2_PER AS apellido2,
      p.COR_PER AS email,
      p.CON_PER AS password,
      p.ID_ROL_PER AS rolCodigo,
      r.NOM_ROL AS rol
    FROM PERSONAS_UTA p
    LEFT JOIN ROLES_UTA r ON r.ID_ROL = p.ID_ROL_PER
    WHERE p.COR_PER = ?`,
    [email]
  );

  if (!rows[0]) return null;

  const row = rows[0];
  return {
    id: row.idPersona,
    email: row.email,
    password: row.password,
    rolCodigo: row.rolCodigo,
    rol: USER_FACING_ROLE_BY_NAME[row.rol] || row.rol,
    rolOriginal: row.rol,
    nombre: [row.nombre1, row.nombre2, row.apellido1, row.apellido2].filter(Boolean).join(' ')
  };
};

const getNextIdentityUserId = async () => {
  const [rows] = await identidadDb.query(
    `SELECT
      COALESCE(MAX(CAST(SUBSTRING(ID_USU, 4, LEN(ID_USU) - 3) AS INT)), 0) AS maxId
    FROM USUARIOS`
  );

  const next = Number(rows[0]?.maxId || 0) + 1;
  return `USU${String(next).padStart(2, '0')}`;
};

const ensureIdentityUserFromUta = async (utaUser) => {
  const existing = await findUserInLegacySchema(utaUser.email);
  if (existing) {
    return {
      ...existing,
      rol: USER_FACING_ROLE_BY_NAME[existing.rol] || existing.rol
    };
  }

  const roleCode = IDENTITY_ROLE_BY_UTA_ROLE_NAME[utaUser.rolOriginal] || utaUser.rolCodigo;
  const identityUserId = await getNextIdentityUserId();

  await identidadDb.query(
    `INSERT INTO USUARIOS (ID_USU, COR_INS_REF_USU, CON_USU, ID_ROL_PER)
     VALUES (?, ?, ?, ?)`,
    [identityUserId, utaUser.email, utaUser.password, roleCode]
  );

  const roleName = (await findRoleNameInIdentity(roleCode)) || utaUser.rolOriginal;

  return {
    id: identityUserId,
    email: utaUser.email,
    password: utaUser.password,
    rolCodigo: roleCode,
    rol: USER_FACING_ROLE_BY_NAME[roleName] || roleName,
    nombre: utaUser.nombre
  };
};

const Usuario = {
  findByEmailInIdentity: async (email) => {
    try {
      const user = await findUserInLegacySchema(email);
      if (user) {
        return {
          ...user,
          rol: USER_FACING_ROLE_BY_NAME[user.rol] || user.rol
        };
      }
    } catch (legacyError) {
      if (!isTableMissingError(legacyError)) throw legacyError;
    }

    try {
      return await findUserInSimpleSchema(email);
    } catch (simpleError) {
      return null;
    }
  },

  findByEmailInUta: async (email) => {
    try {
      return await findUtaUserByEmail(email);
    } catch (error) {
      if (!isTableMissingError(error)) throw error;
      return null;
    }
  },

  ensureIdentityUserFromUta
};

module.exports = Usuario;