const { getDb } = require('../config/db');

const db = getDb('incidentes');

const getNextIncidenteId = async () => {
  const [rows] = await db.query(
    `SELECT
      COALESCE(MAX(CAST(SUBSTRING(ID_INC, 4, LEN(ID_INC) - 3) AS INT)), 0) AS maxId
    FROM INCIDENTES`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `INC${String(next).padStart(2, '0')}`;
};

const getNextHistorialId = async () => {
  const [rows] = await db.query(
    `SELECT
      COALESCE(MAX(CAST(SUBSTRING(ID_HIS, 4, LEN(ID_HIS) - 3) AS INT)), 0) AS maxId
    FROM [BD_ESTADISTICAS].dbo.HISTORIAL`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `HIS${String(next).padStart(2, '0')}`;
};

const toSqlDateTime = (value) => {
  const d = value ? new Date(value) : new Date();
  return d.toISOString().slice(0, 19).replace('T', ' ');
};

const getFechaInicioIncidente = async (idIncidente) => {
  const candidateColumns = ['FEC_INI_INC', 'FEC_CRE_INC', 'FEC_REG_INC'];

  for (const columnName of candidateColumns) {
    try {
      const [rows] = await db.query(
        `SELECT TOP 1 ${columnName} AS fechaInicio
         FROM INCIDENTES
         WHERE ID_INC = ?`,
        [idIncidente]
      );

      if (rows[0]?.fechaInicio) {
        return toSqlDateTime(rows[0].fechaInicio);
      }
    } catch {
      // Ignorar columna inexistente y probar la siguiente.
    }
  }

  return toSqlDateTime(new Date());
};

const Incidente = {
  getConfianzaByUserId: async (idUsuario) => {
    const [rows] = await db.query(
      `SELECT TOP 1 GRU_CON_USU AS confianza
       FROM [BD_IDENTIDAD].dbo.USUARIOS
       WHERE ID_USU = ?`,
      [idUsuario]
    );
    return rows[0]?.confianza || null;
  },

  // Obtener todos los incidentes con nombre de zona
  findAll: async () => {
    try {
      const [rows] = await db.query(
        `SELECT
          i.ID_INC      AS id,
          i.MOT_INC     AS motivo,
          i.EST_INC     AS estado,
          i.ID_ZON_PER  AS idZona,
          z.NOM_ZON     AS nombreZona,
          i.ID_USU_REF  AS idUsuario,
          u.COR_INS_REF_USU AS emailUsuario,
          LTRIM(RTRIM(CONCAT(
            COALESCE(p.NOM1_PER, ''), ' ',
            COALESCE(p.NOM2_PER, ''), ' ',
            COALESCE(p.APE1_PER, ''), ' ',
            COALESCE(p.APE2_PER, '')
          ))) AS nombreUsuario
        FROM INCIDENTES i
        LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
        LEFT JOIN [BD_UTA].dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU
        ORDER BY i.ID_INC`
      );
      return rows;
    } catch {
      const [rows] = await db.query(
        `SELECT
          i.ID_INC      AS id,
          i.MOT_INC     AS motivo,
          i.EST_INC     AS estado,
          i.ID_ZON_PER  AS idZona,
          z.NOM_ZON     AS nombreZona,
          i.ID_USU_REF  AS idUsuario
        FROM INCIDENTES i
        LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        ORDER BY i.ID_INC`
      );
      return rows;
    }
  },

  // Obtener un incidente por ID
  findById: async (id) => {
    try {
      const [rows] = await db.query(
        `SELECT
          i.ID_INC      AS id,
          i.MOT_INC     AS motivo,
          i.EST_INC     AS estado,
          i.ID_ZON_PER  AS idZona,
          z.NOM_ZON     AS nombreZona,
          i.ID_USU_REF  AS idUsuario,
          u.COR_INS_REF_USU AS emailUsuario,
          LTRIM(RTRIM(CONCAT(
            COALESCE(p.NOM1_PER, ''), ' ',
            COALESCE(p.NOM2_PER, ''), ' ',
            COALESCE(p.APE1_PER, ''), ' ',
            COALESCE(p.APE2_PER, '')
          ))) AS nombreUsuario
        FROM INCIDENTES i
        LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
        LEFT JOIN [BD_UTA].dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU
        WHERE i.ID_INC = ?`,
        [id]
      );
      return rows[0] || null;
    } catch {
      const [rows] = await db.query(
        `SELECT
          i.ID_INC      AS id,
          i.MOT_INC     AS motivo,
          i.EST_INC     AS estado,
          i.ID_ZON_PER  AS idZona,
          z.NOM_ZON     AS nombreZona,
          i.ID_USU_REF  AS idUsuario
        FROM INCIDENTES i
        LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        WHERE i.ID_INC = ?`,
        [id]
      );
      return rows[0] || null;
    }
  },

  findActivos: async () => {
    const [rows] = await db.query(
      `SELECT
        i.ID_INC      AS id,
        i.MOT_INC     AS motivo,
        i.EST_INC     AS estado,
        i.ID_ZON_PER  AS idZona,
        z.NOM_ZON     AS nombreZona,
        i.ID_USU_REF  AS idUsuario,
        u.COR_INS_REF_USU AS emailUsuario,
        i.ACCIONES_INC AS acciones
      FROM INCIDENTES i
      LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
      LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
      WHERE i.EST_INC = 'Activo'
      ORDER BY i.ID_INC`
    );
    return rows;
  },

  findByUsuario: async (idUsuario) => {
    // Convertir a string y limpiar
    const usuarioID = String(idUsuario).trim().toUpperCase();
    
    console.log(`[Incidente.findByUsuario] Buscando alertas de usuario: "${usuarioID}"`);
    
    const [rows] = await db.query(
      `SELECT
        i.ID_INC      AS id,
        i.MOT_INC     AS motivo,
        i.EST_INC     AS estado,
        i.ID_ZON_PER  AS idZona,
        z.NOM_ZON     AS nombreZona,
        i.ID_USU_REF  AS idUsuario,
        u.COR_INS_REF_USU AS emailUsuario,
        i.ACCIONES_INC AS acciones
      FROM INCIDENTES i
      LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
      LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
      WHERE UPPER(LTRIM(RTRIM(i.ID_USU_REF))) = ? AND i.EST_INC = 'Activo'
      ORDER BY i.ID_INC DESC`,
      [usuarioID]
    );
    
    console.log(`[Incidente.findByUsuario] Se encontraron ${rows.length} alertas`);
    return rows;
  },

  getAsignacionIdByIncidente: async (idIncidente) => {
    const [rows] = await db.query(
      `SELECT TOP 1 ID_ASI AS idAsignacion
       FROM [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS
       WHERE ID_INC_PER = ?
       ORDER BY ID_ASI DESC`,
      [idIncidente]
    );

    return rows[0]?.idAsignacion || null;
  },

  saveHistorialCierre: async ({ idIncidente, acciones }) => {
    const idAsignacion = await Incidente.getAsignacionIdByIncidente(idIncidente);
    if (!idAsignacion) {
      return { saved: false, reason: 'missing-asignacion' };
    }

    const idHistorial = await getNextHistorialId();
    const fechaInicio = await getFechaInicioIncidente(idIncidente);
    const fechaCierre = toSqlDateTime(new Date());
    const resultadoGuardia = `Acciones Realizadas: ${String(acciones || 'Sin detalle').trim()}`;

    await db.query(
      `INSERT INTO [BD_ESTADISTICAS].dbo.HISTORIAL
        (ID_HIS, FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idHistorial, fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, null]
    );

    return {
      saved: true,
      idHistorial,
      idAsignacion,
      fechaInicio,
      fechaCierre
    };
  },

  // Crear un nuevo incidente
  create: async ({ motivo, estado = 'Activo', idZona, idUsuario }) => {
    const id = await getNextIncidenteId();
    await db.query(
      `INSERT INTO INCIDENTES (ID_INC, MOT_INC, EST_INC, ID_ZON_PER, ID_USU_REF)
       VALUES (?, ?, ?, ?, ?)`,
      [id, motivo, estado, idZona, idUsuario]
    );
    return { id, motivo, estado, idZona, idUsuario };
  },

  // Actualizar un incidente
  update: async (id, { motivo, estado, idZona, idUsuario }) => {
    await db.query(
      `UPDATE INCIDENTES
       SET MOT_INC = ?, EST_INC = ?, ID_ZON_PER = ?, ID_USU_REF = ?
       WHERE ID_INC = ?`,
      [motivo, estado, idZona, idUsuario, id]
    );
    return Incidente.findById(id);
  },

  // Eliminar un incidente
  delete: async (id) => {
    await db.query('DELETE FROM INCIDENTES WHERE ID_INC = ?', [id]);
  },

  // Cerrar incidente (cambio de estado + acciones)
  close: async (id, acciones = null) => {
    await db.query(
      `UPDATE INCIDENTES
       SET EST_INC = 'Cerrado', ACCIONES_INC = ?
       WHERE ID_INC = ?`,
      [acciones, id]
    );
    return Incidente.findById(id);
  }
};

module.exports = Incidente;
