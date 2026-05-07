const { getDb } = require('../config/db');

const db = getDb('seguridad');

const getNextEstadoId = async () => {
  const [rows] = await db.query(
    `SELECT
      COALESCE(MAX(CAST(SUBSTRING(ID_EST, 4, LEN(ID_EST) - 3) AS INT)), 0) AS maxId
    FROM ESTADO_GUARDIAS`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `EST${String(next).padStart(2, '0')}`;
};

const EstadoGuardia = {
  // Obtener todos los estados de guardias
  findAll: async () => {
    const [rows] = await db.query(
      `SELECT
        ID_EST      AS id,
        EST_EST     AS estado,
        HOR_SER_EST AS horario,
        ID_USU_REF  AS idUsuario
      FROM ESTADO_GUARDIAS
      ORDER BY ID_EST`
    );
    return rows;
  },

  // Obtener estado de guardia por ID
  findById: async (id) => {
    const [rows] = await db.query(
      `SELECT
        ID_EST      AS id,
        EST_EST     AS estado,
        HOR_SER_EST AS horario,
        ID_USU_REF  AS idUsuario
      FROM ESTADO_GUARDIAS
      WHERE ID_EST = ?`,
      [id]
    );
    return rows[0] || null;
  },

  // Obtener estado de guardia por usuario
  findByUsuario: async (idUsuario) => {
    const [rows] = await db.query(
      `SELECT
        ID_EST      AS id,
        EST_EST     AS estado,
        HOR_SER_EST AS horario,
        ID_USU_REF  AS idUsuario
      FROM ESTADO_GUARDIAS
      WHERE ID_USU_REF = ?`,
      [idUsuario]
    );
    return rows;
  },

  // Registrar estado de guardia
  create: async ({ estado, horario, idUsuario }) => {
    const id = await getNextEstadoId();
    await db.query(
      `INSERT INTO ESTADO_GUARDIAS (ID_EST, EST_EST, HOR_SER_EST, ID_USU_REF)
       VALUES (?, ?, ?, ?)`,
      [id, estado, horario, idUsuario]
    );
    return { id, estado, horario, idUsuario };
  },

  // Actualizar estado de guardia
  update: async (id, { estado, horario, idUsuario }) => {
    await db.query(
      `UPDATE ESTADO_GUARDIAS
       SET EST_EST = ?, HOR_SER_EST = ?, ID_USU_REF = ?
       WHERE ID_EST = ?`,
      [estado, horario, idUsuario, id]
    );
    return EstadoGuardia.findById(id);
  },

  // Eliminar estado de guardia
  delete: async (id) => {
    await db.query('DELETE FROM ESTADO_GUARDIAS WHERE ID_EST = ?', [id]);
  }
};

module.exports = EstadoGuardia;
