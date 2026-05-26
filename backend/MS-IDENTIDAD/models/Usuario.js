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
      u.ID_USU        AS id,
      u.COR_INS_REF_USU AS email,
      u.CON_USU       AS password,
      u.ID_ROL_PER    AS rolCodigo,
      r.NOM_ROL       AS rol
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
      p.CED_PER   AS idPersona,
      p.NOM1_PER  AS nombre1,
      p.NOM2_PER  AS nombre2,
      p.APE1_PER  AS apellido1,
      p.APE2_PER  AS apellido2,
      p.COR_PER   AS email,
      p.CON_PER   AS password,
      p.ID_ROL_PER AS rolCodigo,
      r.NOM_ROL   AS rol
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
    } catch {
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

  ensureIdentityUserFromUta,

  // ── Gestión de usuarios (Administrador) ────────────────────────────────────

  /** Devuelve todos los usuarios de BD_IDENTIDAD enriquecidos con nombre de BD_UTA y contactos */
  findAll: async () => {
    const utaDb = process.env.DB_UTA_NAME || 'BD_UTA';
    let rows = [];

    // Intento 1: con JOIN cross-database a BD_UTA para obtener nombres
    try {
      [rows] = await identidadDb.query(
        `SELECT u.ID_USU AS id, u.COR_INS_REF_USU AS email, u.ID_ROL_PER AS rolCodigo, r.NOM_ROL AS rolNombre, RTRIM(ISNULL(p.NOM1_PER,'') + ' ' + ISNULL(p.NOM2_PER,'') + ' ' + ISNULL(p.APE1_PER,'') + ' ' + ISNULL(p.APE2_PER,'')) AS nombre FROM USUARIOS u LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL_PER LEFT JOIN ${utaDb}.dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU ORDER BY u.ID_USU`
      );
      console.log(`[findAll] Con nombres, rows: ${rows?.length}`);
    } catch (e) {
      console.warn(`[findAll] JOIN BD_UTA falló (${e.message.slice(0,200)}), reintentando sin nombres...`);
      try {
        [rows] = await identidadDb.query(
          `SELECT u.ID_USU AS id, u.COR_INS_REF_USU AS email, u.ID_ROL_PER AS rolCodigo, r.NOM_ROL AS rolNombre FROM USUARIOS u LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL_PER ORDER BY u.ID_USU`
        );
        console.log(`[findAll] Sin nombres, rows: ${rows?.length}`);
        rows = rows.map(r => ({ ...r, nombre: '' }));
      } catch (e2) {
        console.error(`[findAll] Fallback también falló: ${e2.message}`);
        throw e2;
      }
    }

    // Para cada usuario, obtener contactos y grupos de confianza
    const resultado = await Promise.all(rows.map(async (row) => {
      let contactos = [];
      let grupos = [];
      try {
        const [cRows] = await identidadDb.query(
          `SELECT ID_CON AS id, COR_PER_REF AS email, ALIAS_CON AS alias FROM CONTACTOS_CONFIANZA WHERE ID_USU_DUEÑO = ?`,
          [row.id]
        );
        contactos = cRows || [];
      } catch { /* sin contactos */ }
      try {
        const [gRows] = await identidadDb.query(
          `SELECT ID_GRU AS id, NOM_GRU AS nombre FROM GRUPOS_CONFIANZA WHERE ID_USU_DUEÑO = ?`,
          [row.id]
        );
        grupos = gRows || [];
      } catch { /* sin grupos */ }

      return {
        id: row.id,
        email: row.email,
        rolCodigo: row.rolCodigo,
        rol: USER_FACING_ROLE_BY_NAME[row.rolNombre] || row.rolNombre || 'Desconocido',
        nombre: (row.nombre || '').trim(),
        bloqueado: false,
        contactos,
        grupos
      };
    }));

    return resultado;
  },

  /** Elimina un usuario por ID */
  deleteById: async (id) => {
    // Primero eliminar registros dependientes (contactos y grupos)
    try {
      await identidadDb.query(`DELETE FROM INTEGRANTES_GRUPO WHERE ID_GRU_REF IN (SELECT ID_GRU FROM GRUPOS_CONFIANZA WHERE ID_USU_DUEÑO = ?)`, [id]);
      await identidadDb.query(`DELETE FROM GRUPOS_CONFIANZA WHERE ID_USU_DUEÑO = ?`, [id]);
      await identidadDb.query(`DELETE FROM CONTACTOS_CONFIANZA WHERE ID_USU_DUEÑO = ?`, [id]);
    } catch (e) {
      console.warn(`[deleteById] No se pudieron limpiar dependencias: ${e.message}`);
    }
    await identidadDb.query(`DELETE FROM USUARIOS WHERE ID_USU = ?`, [id]);
    return true;
  },

  /** Actualiza email y/o rol de un usuario */
  update: async (id, { email, rolCodigo }) => {
    const fields = [];
    const params = [];
    if (email)     { fields.push('COR_INS_REF_USU = ?'); params.push(email); }
    if (rolCodigo) { fields.push('ID_ROL_PER = ?');       params.push(rolCodigo); }
    if (fields.length === 0) return null;
    params.push(id);
    await identidadDb.query(`UPDATE USUARIOS SET ${fields.join(', ')} WHERE ID_USU = ?`, params);
    const [rows] = await identidadDb.query(
      `SELECT u.ID_USU AS id, u.COR_INS_REF_USU AS email, r.NOM_ROL AS rol
       FROM USUARIOS u LEFT JOIN ROLES r ON r.ID_ROL = u.ID_ROL_PER WHERE u.ID_USU = ?`, [id]
    );
    return rows[0] || null;
  },

  /** Bloquea o desbloquea un usuario (campo BLOQUEADO BIT en USUARIOS) */
  setBloqueado: async (id, bloqueado) => {
    try {
      await identidadDb.query('UPDATE USUARIOS SET BLOQUEADO = ? WHERE ID_USU = ?', [bloqueado ? 1 : 0, id]);
      return { id, bloqueado };
    } catch (e) {
      // Si la columna no existe, informa al llamador
      throw new Error('CAMPO_BLOQUEADO_NO_EXISTE');
    }
  }
};

module.exports = Usuario;
