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

  // Obtener asignaciones activas para un guardia específico
  findActivasByGuardiaUsuario: async (idUsuario) => {
    try {
      const [rows] = await db.query(
        `SELECT
          a.ID_ASI     AS id,
          a.ID_INC_PER AS idIncidente,
          a.ID_EST_PER AS idEstadoGuardia,
          e.EST_EST    AS estadoGuardia,
          e.HOR_SER_EST AS horarioGuardia,
          e.ID_USU_REF  AS idUsuarioGuardia,
          i.MOT_INC     AS motivoIncidente,
          i.EST_INC     AS estadoIncidente,
          i.ID_ZON_PER  AS idZona,
          z.NOM_ZON     AS nombreZona,
          i.ID_USU_REF  AS idUsuarioReporta,
          u.COR_INS_REF_USU AS emailUsuarioReporta,
          LTRIM(RTRIM(CONCAT(
            COALESCE(p.NOM1_PER, ''), ' ',
            COALESCE(p.NOM2_PER, ''), ' ',
            COALESCE(p.APE1_PER, ''), ' ',
            COALESCE(p.APE2_PER, '')
          ))) AS nombreUsuarioReporta
        FROM ASIGNACION_ALERTAS a
        INNER JOIN ESTADO_GUARDIAS e ON e.ID_EST = a.ID_EST_PER
        INNER JOIN [BD_INCIDENTES].dbo.INCIDENTES i ON i.ID_INC = a.ID_INC_PER
        LEFT JOIN [BD_INCIDENTES].dbo.ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
        LEFT JOIN [BD_UTA].dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU
        WHERE e.ID_USU_REF = ? AND i.EST_INC = 'Activo'
        ORDER BY a.ID_ASI`,
        [idUsuario]
      );
      return rows;
    } catch {
      const [rows] = await db.query(
        `SELECT
          a.ID_ASI     AS id,
          a.ID_INC_PER AS idIncidente,
          a.ID_EST_PER AS idEstadoGuardia,
          e.EST_EST    AS estadoGuardia,
          e.HOR_SER_EST AS horarioGuardia,
          e.ID_USU_REF  AS idUsuarioGuardia
        FROM ASIGNACION_ALERTAS a
        INNER JOIN ESTADO_GUARDIAS e ON e.ID_EST = a.ID_EST_PER
        WHERE e.ID_USU_REF = ?
        ORDER BY a.ID_ASI`,
        [idUsuario]
      );
      return rows;
    }
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
