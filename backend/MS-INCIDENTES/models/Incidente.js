const { getDb } = require('../config/db');

const db = getDb('incidentes');

// Añadir columna FEC_INI_INC a INCIDENTES si no existe (para registrar fecha/hora de la alerta)
const ensureFechaInicioColumn = async () => {
  try {
    await db.query(
      `IF NOT EXISTS (
         SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = 'INCIDENTES'
           AND COLUMN_NAME = 'FEC_INI_INC'
       )
       ALTER TABLE INCIDENTES ADD FEC_INI_INC DATETIME NULL`
    );
  } catch (e) {
    console.warn('[Incidente] No se pudo añadir FEC_INI_INC:', e.message);
  }
};
ensureFechaInicioColumn();

// Añadir columnas de coordenadas si no existen (ubicación exacta de la alerta)
const ensureUbicacionColumns = async () => {
  try {
    await db.query(
      `IF NOT EXISTS (
         SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = 'INCIDENTES'
           AND COLUMN_NAME = 'LAT_INC'
       )
       ALTER TABLE INCIDENTES ADD LAT_INC FLOAT NULL`
    );

    await db.query(
      `IF NOT EXISTS (
         SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_NAME = 'INCIDENTES'
           AND COLUMN_NAME = 'LNG_INC'
       )
       ALTER TABLE INCIDENTES ADD LNG_INC FLOAT NULL`
    );
  } catch (e) {
    console.warn('[Incidente] No se pudieron añadir columnas LAT_INC/LNG_INC:', e.message);
  }
};
ensureUbicacionColumns();

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
  // Obtener todos los incidentes con nombre de zona
  findAll: async () => {
    try {
      const [rows] = await db.query(
        `SELECT
          i.ID_INC      AS id,
          i.MOT_INC     AS motivo,
          i.EST_INC     AS estado,
          i.ID_ZON_PER  AS idZona,
          i.LAT_INC     AS lat,
          i.LNG_INC     AS lng,
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
          i.LAT_INC     AS lat,
          i.LNG_INC     AS lng,
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
          i.LAT_INC     AS lat,
          i.LNG_INC     AS lng,
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
          i.LAT_INC     AS lat,
          i.LNG_INC     AS lng,
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
    try {
      const [rows] = await db.query(
        `SELECT
          i.ID_INC      AS id,
          i.MOT_INC     AS motivo,
          i.EST_INC     AS estado,
          i.ID_ZON_PER  AS idZona,
          i.LAT_INC     AS lat,
          i.LNG_INC     AS lng,
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
    } catch {
      try {
        // Fallback cuando columnas opcionales o JOINs externos no existen.
        const [rows] = await db.query(
          `SELECT
            i.ID_INC      AS id,
            i.MOT_INC     AS motivo,
            i.EST_INC     AS estado,
            i.ID_ZON_PER  AS idZona,
            i.LAT_INC     AS lat,
            i.LNG_INC     AS lng,
            z.NOM_ZON     AS nombreZona,
            i.ID_USU_REF  AS idUsuario,
            u.COR_INS_REF_USU AS emailUsuario
          FROM INCIDENTES i
          LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
          LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
          WHERE i.EST_INC = 'Activo'
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
            i.LAT_INC     AS lat,
            i.LNG_INC     AS lng,
            z.NOM_ZON     AS nombreZona,
            i.ID_USU_REF  AS idUsuario
          FROM INCIDENTES i
          LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
          WHERE i.EST_INC = 'Activo'
          ORDER BY i.ID_INC`
        );
        return rows;
      }
    }
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
        i.LAT_INC     AS lat,
        i.LNG_INC     AS lng,
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

  saveHistorialCierre: async ({ idIncidente, acciones, idGuardia }) => {
    console.log(`[saveHistorialCierre] Iniciando para incidente=${idIncidente}, guardia=${idGuardia}`);

    // idAsignacion puede ser null si el guardia cerró sin haber sido asignado formalmente
    let idAsignacion = null;
    try {
      idAsignacion = await Incidente.getAsignacionIdByIncidente(idIncidente);
      console.log(`[saveHistorialCierre] idAsignacion encontrado: ${idAsignacion}`);
    } catch (e) {
      console.warn(`[saveHistorialCierre] Error buscando asignacion: ${e.message}`);
    }

    let idHistorial;
    try {
      idHistorial = await getNextHistorialId();
      console.log(`[saveHistorialCierre] idHistorial generado: ${idHistorial}`);
    } catch (e) {
      console.error(`[saveHistorialCierre] Error generando ID historial: ${e.message}`);
      throw e;
    }

    const fechaInicio = await getFechaInicioIncidente(idIncidente);
    const fechaCierre = toSqlDateTime(new Date());
    const resultadoGuardia = idGuardia ? String(idGuardia).trim() : null;
    const datosJsonValue = acciones ? JSON.stringify({ acciones }) : null;

    console.log(`[saveHistorialCierre] Insertando: id=${idHistorial} ini=${fechaInicio} cie=${fechaCierre} gua=${resultadoGuardia} asi=${idAsignacion}`);

    await db.query(
      `INSERT INTO [BD_ESTADISTICAS].dbo.HISTORIAL
        (ID_HIS, FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [idHistorial, fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJsonValue]);

    console.log(`[saveHistorialCierre] INSERT exitoso: ${idHistorial}`);

    return {
      saved: true,
      idHistorial,
      idAsignacion,
      fechaInicio,
      fechaCierre
    };
  },

  // Crear un nuevo incidente (guarda FEC_INI_INC para uso en HISTORIAL)
  create: async ({ motivo, estado = 'Activo', idZona, idUsuario, lat = null, lng = null }) => {
    const id = await getNextIncidenteId();
    const fechaInicio = toSqlDateTime(new Date());
    const latNum = Number(lat);
    const lngNum = Number(lng);
    const latSafe = Number.isFinite(latNum) ? latNum : null;
    const lngSafe = Number.isFinite(lngNum) ? lngNum : null;
    try {
      await db.query(
        `INSERT INTO INCIDENTES (ID_INC, MOT_INC, EST_INC, ID_ZON_PER, ID_USU_REF, FEC_INI_INC, LAT_INC, LNG_INC)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, motivo, estado, idZona, idUsuario, fechaInicio, latSafe, lngSafe]
      );
    } catch {
      // Fallback: columna FEC_INI_INC aún no existe
      await db.query(
        `INSERT INTO INCIDENTES (ID_INC, MOT_INC, EST_INC, ID_ZON_PER, ID_USU_REF)
         VALUES (?, ?, ?, ?, ?)`,
        [id, motivo, estado, idZona, idUsuario]
      );
    }
    return { id, motivo, estado, idZona, idUsuario, lat: latSafe, lng: lngSafe };
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
  },

  // Estadísticas para Administrador (T5.1 / T5.2)
  getEstadisticas: async () => {
    // Totales generales
    const [totalesRows] = await db.query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN EST_INC = 'Cerrado' THEN 1 ELSE 0 END) AS cerradas,
        SUM(CASE WHEN EST_INC = 'Activo'  THEN 1 ELSE 0 END) AS activas
       FROM INCIDENTES`
    );

    // Agrupado por motivo (todos los incidentes)
    const [porMotivoRows] = await db.query(
      `SELECT MOT_INC AS motivo, COUNT(*) AS cantidad
       FROM INCIDENTES
       GROUP BY MOT_INC
       ORDER BY cantidad DESC`
    );

    // Agrupado por zona (todos los incidentes)
    const [porZonaRows] = await db.query(
      `SELECT
        COALESCE(z.NOM_ZON, 'Sin zona') AS zona,
        COUNT(*) AS cantidad
       FROM INCIDENTES i
       LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
       GROUP BY z.NOM_ZON
       ORDER BY cantidad DESC`
    );

    // Últimas 10 alertas cerradas con detalle
    const [cerradasRows] = await db.query(
      `SELECT TOP 10
        i.ID_INC         AS id,
        i.MOT_INC        AS motivo,
        i.ACCIONES_INC   AS acciones,
        i.ID_ZON_PER     AS idZona,
        COALESCE(z.NOM_ZON, 'Sin zona') AS nombreZona,
        u.COR_INS_REF_USU AS emailUsuario
       FROM INCIDENTES i
       LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
       LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
       WHERE i.EST_INC = 'Cerrado'
       ORDER BY i.ID_INC DESC`
    );

    const { total, cerradas, activas } = totalesRows[0] || { total: 0, cerradas: 0, activas: 0 };

    return {
      total: Number(total) || 0,
      cerradas: Number(cerradas) || 0,
      activas: Number(activas) || 0,
      porMotivo: porMotivoRows.map(r => ({ motivo: r.motivo, cantidad: Number(r.cantidad) })),
      porZona: porZonaRows.map(r => ({ zona: r.zona, cantidad: Number(r.cantidad) })),
      ultimasCerradas: cerradasRows
    };
  }
};

module.exports = Incidente;
