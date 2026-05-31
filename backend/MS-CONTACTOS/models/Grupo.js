const { getDb } = require('../config/db');

const identidadDb = getDb('identidad');

const MAX_INTEGRANTES = 5;

// ─── Grupos (GRUPOS_CONFIANZA) ────────────────────────────────────────────────

const generateIdGrupo = () => {
  // VARCHAR(10): 'GRU' + 7 chars de timestamp en base-36
  return ('GRU' + Date.now().toString(36).slice(-7)).toUpperCase();
};

const findGruposByUsuario = async (idUsuario) => {
  const [grupos] = await identidadDb.query(
    `SELECT g.ID_GRU AS id, g.NOM_GRU AS nombre
     FROM GRUPOS_CONFIANZA g
     WHERE g.ID_USU_DUEÑO = ?`,
    [idUsuario]
  );

  if (!grupos.length) return [];

  // Cargar integrantes de cada grupo
  const resultado = await Promise.all(
    grupos.map(async (grupo) => {
      const [integrantes] = await identidadDb.query(
        `SELECT ID_INT AS id, COR_PER_REF AS correo
         FROM INTEGRANTES_GRUPO
         WHERE ID_GRU_REF = ?`,
        [grupo.id]
      );
      return { ...grupo, integrantes };
    })
  );

  return resultado;
};

const findGrupoById = async (idGrupo, idUsuario) => {
  const [rows] = await identidadDb.query(
    `SELECT TOP 1 ID_GRU AS id, NOM_GRU AS nombre
     FROM GRUPOS_CONFIANZA
     WHERE ID_GRU = ? AND ID_USU_DUEÑO = ?`,
    [idGrupo, idUsuario]
  );
  if (!rows[0]) return null;

  const [integrantes] = await identidadDb.query(
    `SELECT ID_INT AS id, COR_PER_REF AS correo
     FROM INTEGRANTES_GRUPO
     WHERE ID_GRU_REF = ?`,
    [idGrupo]
  );

  return { ...rows[0], integrantes };
};

const createGrupo = async ({ idUsuario, nombre, correos }) => {
  const idGrupo = generateIdGrupo();

  // Insertar cabecera
  await identidadDb.query(
    `INSERT INTO GRUPOS_CONFIANZA (ID_GRU, NOM_GRU, ID_USU_DUEÑO)
     VALUES (?, ?, ?)`,
    [idGrupo, nombre, idUsuario]
  );

  // Insertar integrantes
  await Promise.all(
    correos.map((correo) =>
      identidadDb.query(
        `INSERT INTO INTEGRANTES_GRUPO (ID_GRU_REF, COR_PER_REF)
         VALUES (?, ?)`,
        [idGrupo, correo]
      )
    )
  );

  return idGrupo;
};

/**
 * Actualiza el nombre del grupo y reemplaza todos sus integrantes.
 */
const updateGrupo = async ({ idGrupo, idUsuario, nombre, correos }) => {
  // Verificar propiedad
  const [rows] = await identidadDb.query(
    'SELECT TOP 1 ID_GRU AS id FROM GRUPOS_CONFIANZA WHERE ID_GRU = ? AND ID_USU_DUEÑO = ?',
    [idGrupo, idUsuario]
  );
  if (!rows[0]) return false;

  if (nombre) {
    await identidadDb.query(
      'UPDATE GRUPOS_CONFIANZA SET NOM_GRU = ? WHERE ID_GRU = ?',
      [nombre, idGrupo]
    );
  }

  if (correos) {
    // Eliminar integrantes anteriores y reinsertar
    await identidadDb.query(
      'DELETE FROM INTEGRANTES_GRUPO WHERE ID_GRU_REF = ?',
      [idGrupo]
    );

    await Promise.all(
      correos.map((correo) =>
        identidadDb.query(
          'INSERT INTO INTEGRANTES_GRUPO (ID_GRU_REF, COR_PER_REF) VALUES (?, ?)',
          [idGrupo, correo]
        )
      )
    );
  }

  return true;
};

const deleteGrupo = async (idGrupo, idUsuario) => {
  // Verificar propiedad
  const [rows] = await identidadDb.query(
    'SELECT TOP 1 ID_GRU AS id FROM GRUPOS_CONFIANZA WHERE ID_GRU = ? AND ID_USU_DUEÑO = ?',
    [idGrupo, idUsuario]
  );
  if (!rows[0]) return false;

  // Eliminar integrantes primero (FK)
  await identidadDb.query(
    'DELETE FROM INTEGRANTES_GRUPO WHERE ID_GRU_REF = ?',
    [idGrupo]
  );

  await identidadDb.query(
    'DELETE FROM GRUPOS_CONFIANZA WHERE ID_GRU = ?',
    [idGrupo]
  );

  return true;
};

/**
 * Recupera todos los correos de integrantes de todos los grupos del usuario.
 */
const findCorreosGrupos = async (idUsuario) => {
  const [rows] = await identidadDb.query(
    `SELECT i.COR_PER_REF AS correo, g.NOM_GRU AS grupo
     FROM INTEGRANTES_GRUPO i
     INNER JOIN GRUPOS_CONFIANZA g ON g.ID_GRU = i.ID_GRU_REF
     WHERE g.ID_USU_DUEÑO = ?`,
    [idUsuario]
  );
  return rows;
};

module.exports = {
  MAX_INTEGRANTES,
  findGruposByUsuario,
  findGrupoById,
  createGrupo,
  updateGrupo,
  deleteGrupo,
  findCorreosGrupos
};
