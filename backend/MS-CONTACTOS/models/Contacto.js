const { getDb } = require('../config/db');

const identidadDb = getDb('identidad');
const utaDb = getDb('uta');

// ─── Búsqueda de personas en BD_UTA ───────────────────────────────────────────

/**
 * Busca personas en PERSONAS_UTA por nombre, apellido o correo.
 * Excluye al propio usuario autenticado de los resultados.
 */
const buscarPersonas = async (termino, emailExcluir = '') => {
  const like = `%${termino}%`;
  const [rows] = await utaDb.query(
    `SELECT TOP 20
      p.CED_PER     AS cedula,
      RTRIM(ISNULL(p.NOM1_PER,'') + ' ' + ISNULL(p.NOM2_PER,'') + ' ' +
            ISNULL(p.APE1_PER,'') + ' ' + ISNULL(p.APE2_PER,'')) AS nombreCompleto,
      p.COR_PER     AS correo,
      r.NOM_ROL     AS rol
    FROM PERSONAS_UTA p
    LEFT JOIN ROLES_UTA r ON r.ID_ROL = p.ID_ROL_PER
    WHERE (
      p.NOM1_PER LIKE ?
      OR p.APE1_PER LIKE ?
      OR p.COR_PER   LIKE ?
    )
    AND p.COR_PER <> ?`,
    [like, like, like, emailExcluir]
  );
  return rows;
};

/**
 * Verifica que un correo exista en PERSONAS_UTA.
 */
const existePersona = async (correo) => {
  const [rows] = await utaDb.query(
    'SELECT TOP 1 COR_PER AS correo FROM PERSONAS_UTA WHERE COR_PER = ?',
    [correo]
  );
  return rows.length > 0;
};

// ─── Contactos Individuales (CONTACTOS_CONFIANZA) ─────────────────────────────

const findContactosByUsuario = async (idUsuario) => {
  const [rows] = await identidadDb.query(
    `SELECT
      c.ID_CON      AS id,
      c.COR_PER_REF AS correo,
      c.ALIAS_CON   AS alias
    FROM CONTACTOS_CONFIANZA c
    WHERE c.ID_USU_DUEÑO = ?`,
    [idUsuario]
  );
  return rows;
};

const createContacto = async ({ idUsuario, correo, alias }) => {
  await identidadDb.query(
    `INSERT INTO CONTACTOS_CONFIANZA (ID_USU_DUEÑO, COR_PER_REF, ALIAS_CON)
     VALUES (?, ?, ?)`,
    [idUsuario, correo, alias || null]
  );
};

const deleteContacto = async (idContacto, idUsuario) => {
  await identidadDb.query(
    `DELETE FROM CONTACTOS_CONFIANZA
     WHERE ID_CON = ? AND ID_USU_DUEÑO = ?`,
    [idContacto, idUsuario]
  );
};

const findContactoById = async (idContacto, idUsuario) => {
  const [rows] = await identidadDb.query(
    `SELECT TOP 1 ID_CON AS id, COR_PER_REF AS correo, ALIAS_CON AS alias
     FROM CONTACTOS_CONFIANZA
     WHERE ID_CON = ? AND ID_USU_DUEÑO = ?`,
    [idContacto, idUsuario]
  );
  return rows[0] || null;
};

const countContactosByUsuario = async (idUsuario) => {
  const [rows] = await identidadDb.query(
    'SELECT COUNT(*) AS total FROM CONTACTOS_CONFIANZA WHERE ID_USU_DUEÑO = ?',
    [idUsuario]
  );
  return Number(rows[0]?.total || 0);
};

/**
 * Recupera todos los correos de contactos individuales para envío de alertas.
 */
const findCorreosIndividuales = async (idUsuario) => {
  const [rows] = await identidadDb.query(
    `SELECT COR_PER_REF AS correo, ALIAS_CON AS alias
     FROM CONTACTOS_CONFIANZA
     WHERE ID_USU_DUEÑO = ?`,
    [idUsuario]
  );
  return rows;
};

module.exports = {
  buscarPersonas,
  existePersona,
  findContactosByUsuario,
  createContacto,
  deleteContacto,
  findContactoById,
  countContactosByUsuario,
  findCorreosIndividuales
};
