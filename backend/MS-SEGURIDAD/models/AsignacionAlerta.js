const { getDb } = require('../config/db');

const db = getDb('seguridad');

const getNextAsignacionId = async () => {
  const [rows] = await db.query(
    `SELECT
      COALESCE(MAX(CAST(SUBSTRING(ID_ASI, 5, LEN(ID_ASI) - 4) AS INT)), 0) AS maxId
    FROM ASIGNACION_ALERTAS`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `ASIG${String(next).padStart(2, '0')}`;
};

const AsignacionAlerta = {
  // Obtener todas las asignaciones con datos relacionados
  findAll: async () => {
    const [rows] = await db.query(
      `SELECT
        a.ID_ASI     AS id,
        a.ID_INC_PER AS idIncidente,
        a.ID_EST_PER AS idEstadoGuardia,
        e.EST_EST    AS estadoGuardia,
        e.HOR_SER_EST AS horarioGuardia,
        e.ID_USU_REF  AS idUsuarioGuardia
      FROM ASIGNACION_ALERTAS a
      LEFT JOIN ESTADO_GUARDIAS e ON e.ID_EST = a.ID_EST_PER
      ORDER BY a.ID_ASI`
    );
    return rows;
  },

  // Obtener una asignación por ID
  findById: async (id) => {
    const [rows] = await db.query(
      `SELECT
        a.ID_ASI     AS id,
        a.ID_INC_PER AS idIncidente,
        a.ID_EST_PER AS idEstadoGuardia,
        e.EST_EST    AS estadoGuardia,
        e.HOR_SER_EST AS horarioGuardia,
        e.ID_USU_REF  AS idUsuarioGuardia
      FROM ASIGNACION_ALERTAS a
      LEFT JOIN ESTADO_GUARDIAS e ON e.ID_EST = a.ID_EST_PER
      WHERE a.ID_ASI = ?`,
      [id]
    );
    return rows[0] || null;
  },

  // Crear una nueva asignación de alerta
  create: async ({ idIncidente, idEstadoGuardia }) => {
    const id = await getNextAsignacionId();
    await db.query(
      `INSERT INTO ASIGNACION_ALERTAS (ID_ASI, ID_INC_PER, ID_EST_PER)
       VALUES (?, ?, ?)`,
      [id, idIncidente, idEstadoGuardia]
    );
    return { id, idIncidente, idEstadoGuardia };
  },

  // Eliminar una asignación
  delete: async (id) => {
    await db.query('DELETE FROM ASIGNACION_ALERTAS WHERE ID_ASI = ?', [id]);
  }
};

module.exports = AsignacionAlerta;
