const { getDb } = require('../config/db');
const { getDb: getEstadisticasDb } = require('../../MS-ESTADISTICAS/config/db');

const db = getDb('incidentes');
const dbEstadisticas = getEstadisticasDb('estadisticas');

// Cuadrantes del campus (alineados con MapaCampus en frontend).
const CAMPUS_LAT_N = -1.2664169;
const CAMPUS_LAT_S = -1.2709772;
const CAMPUS_LNG_W = -78.6263824;
const CAMPUS_LNG_E = -78.6223047;
const CAMPUS_LAT_M = (CAMPUS_LAT_N + CAMPUS_LAT_S) / 2;
const CAMPUS_LNG_M = (CAMPUS_LNG_W + CAMPUS_LNG_E) / 2;

const inferZonaIdByCoords = (lat, lng) => {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat >= CAMPUS_LAT_M && lng >= CAMPUS_LNG_M) return '1';
  if (lat >= CAMPUS_LAT_M && lng < CAMPUS_LNG_M) return '2';
  if (lat < CAMPUS_LAT_M && lng >= CAMPUS_LNG_M) return '3';
  return '4';
};

const normalizarZonaId = (idZona) => {
  if (idZona === undefined || idZona === null) return null;
  const raw = String(idZona).trim().toLowerCase();
  if (!raw) return null;

  if (raw === 'z1' || raw === 'zona1' || raw === 'zona 1') return '1';
  if (raw === 'z2' || raw === 'zona2' || raw === 'zona 2') return '2';
  if (raw === 'z3' || raw === 'zona3' || raw === 'zona 3') return '3';
  if (raw === 'z4' || raw === 'zona4' || raw === 'zona 4') return '4';

  if (raw === '1' || raw === '2' || raw === '3' || raw === '4') return raw;
  return String(idZona).trim();
};

const ensureDefaultZonas = async () => {
  try {
    const [rows] = await db.query('SELECT COUNT(*) AS total FROM ZONAS');
    const total = Number(rows?.[0]?.total || 0);
    if (total > 0) return;

    await db.query(
      `INSERT INTO ZONAS (ID_ZON, NOM_ZON, COO_POL_ZONX, COO_POL_ZONY)
       VALUES
        ('1', 'Zona1', -1.267556975, -78.623324125),
        ('2', 'Zona2', -1.267556975, -78.625362975),
        ('3', 'Zona3', -1.269837125, -78.623324125),
        ('4', 'Zona4', -1.269837125, -78.625362975)`
    );

    console.log('[Incidente] Tabla ZONAS estaba vacia. Se insertaron zonas base 1..4.');
  } catch (e) {
    console.warn('[Incidente] No se pudieron inicializar zonas base:', e.message);
  }
};

const backfillZonaEnIncidentes = async () => {
  try {
    await db.query(
      `UPDATE INCIDENTES
       SET ID_ZON_PER = CASE
         WHEN LAT_INC >= ? AND LNG_INC >= ? THEN '1'
         WHEN LAT_INC >= ? AND LNG_INC <  ? THEN '2'
         WHEN LAT_INC <  ? AND LNG_INC >= ? THEN '3'
         ELSE '4'
       END
       WHERE ID_ZON_PER IS NULL
         AND LAT_INC IS NOT NULL
         AND LNG_INC IS NOT NULL`,
      [CAMPUS_LAT_M, CAMPUS_LNG_M, CAMPUS_LAT_M, CAMPUS_LNG_M, CAMPUS_LAT_M, CAMPUS_LNG_M]
    );
  } catch (e) {
    console.warn('[Incidente] No se pudo completar backfill de zonas en INCIDENTES:', e.message);
  }
};

const initZonasYBackfill = async () => {
  try {
    await ensureDefaultZonas();
    await backfillZonaEnIncidentes();
  } catch (e) {
    console.warn('[Incidente] Inicializacion de zonas incompleta:', e.message);
  }
};
initZonasYBackfill();

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
  const [rows] = await dbEstadisticas.query(
    `SELECT
      COALESCE(MAX(TRY_CAST(SUBSTRING(ID_HIS, 4, LEN(ID_HIS) - 3) AS INT)), 0) AS maxId
    FROM [BD_ESTADISTICAS].dbo.HISTORIAL
    WHERE ID_HIS LIKE 'HIS%'`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `HIS${String(next).padStart(2, '0')}`;
};

const toSqlDateTime = (value) => {
  const d = value ? new Date(value) : new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Guayaquil',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(d);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day} ${map.hour}:${map.minute}:${map.second}`;
};

const PERIODOS_VALIDOS = new Set(['dia', 'semana', 'mes', 'anio']);

const normalizarPeriodo = (periodo) => {
  const valor = String(periodo || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  return PERIODOS_VALIDOS.has(valor) ? valor : 'mes';
};

const calcularRangoPeriodo = (periodo) => {
  const ahora = new Date();
  const inicio = new Date(ahora);
  const fin = new Date(ahora);

  if (periodo === 'dia') {
    inicio.setHours(0, 0, 0, 0);
    fin.setHours(23, 59, 59, 999);
    return { inicio: toSqlDateTime(inicio), fin: toSqlDateTime(fin) };
  }

  if (periodo === 'semana') {
    const dia = ahora.getDay();
    const ajuste = dia === 0 ? -6 : 1 - dia;
    inicio.setDate(ahora.getDate() + ajuste);
    inicio.setHours(0, 0, 0, 0);
    fin.setTime(inicio.getTime());
    fin.setDate(inicio.getDate() + 6);
    fin.setHours(23, 59, 59, 999);
    return { inicio: toSqlDateTime(inicio), fin: toSqlDateTime(fin) };
  }

  if (periodo === 'anio') {
    inicio.setMonth(0, 1);
    inicio.setHours(0, 0, 0, 0);
    fin.setMonth(11, 31);
    fin.setHours(23, 59, 59, 999);
    return { inicio: toSqlDateTime(inicio), fin: toSqlDateTime(fin) };
  }

  inicio.setDate(1);
  inicio.setHours(0, 0, 0, 0);
  fin.setMonth(inicio.getMonth() + 1, 0);
  fin.setHours(23, 59, 59, 999);
  return { inicio: toSqlDateTime(inicio), fin: toSqlDateTime(fin) };
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
          asi.ID_EST_PER AS idEstadoGuardia,
          eg.ID_USU_REF  AS idGuardiaAsignado,
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
        OUTER APPLY (
          SELECT TOP 1 a.ID_EST_PER
          FROM [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS a
          WHERE a.ID_INC_PER = i.ID_INC
          ORDER BY TRY_CAST(SUBSTRING(a.ID_ASI, 5, LEN(a.ID_ASI) - 4) AS INT) DESC, a.ID_ASI DESC
        ) asi
        LEFT JOIN [BD_SEGURIDAD].dbo.ESTADO_GUARDIAS eg ON eg.ID_EST = asi.ID_EST_PER
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
          i.ID_USU_REF  AS idUsuario,
          asi.ID_EST_PER AS idEstadoGuardia,
          eg.ID_USU_REF  AS idGuardiaAsignado
        FROM INCIDENTES i
        LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        OUTER APPLY (
          SELECT TOP 1 a.ID_EST_PER
          FROM [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS a
          WHERE a.ID_INC_PER = i.ID_INC
          ORDER BY TRY_CAST(SUBSTRING(a.ID_ASI, 5, LEN(a.ID_ASI) - 4) AS INT) DESC, a.ID_ASI DESC
        ) asi
        LEFT JOIN [BD_SEGURIDAD].dbo.ESTADO_GUARDIAS eg ON eg.ID_EST = asi.ID_EST_PER
        WHERE i.ID_INC = ?`,
        [id]
      );
      return rows[0] || null;
    }
  },

  getAsignacionActualByIncidente: async (idIncidente) => {
    const [rows] = await db.query(
      `SELECT TOP 1
        a.ID_ASI    AS idAsignacion,
        a.ID_INC_PER AS idIncidente,
        a.ID_EST_PER AS idEstadoGuardia,
        eg.ID_USU_REF AS idGuardiaAsignado
      FROM [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS a
      LEFT JOIN [BD_SEGURIDAD].dbo.ESTADO_GUARDIAS eg ON eg.ID_EST = a.ID_EST_PER
      WHERE a.ID_INC_PER = ?
      ORDER BY TRY_CAST(SUBSTRING(a.ID_ASI, 5, LEN(a.ID_ASI) - 4) AS INT) DESC, a.ID_ASI DESC`,
      [idIncidente]
    );

    return rows[0] || null;
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
          asi.ID_EST_PER AS idEstadoGuardia,
          eg.ID_USU_REF   AS idGuardiaAsignado,
          i.ACCIONES_INC AS acciones
        FROM INCIDENTES i
        LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
        LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
        OUTER APPLY (
          SELECT TOP 1 a.ID_EST_PER
          FROM [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS a
          WHERE a.ID_INC_PER = i.ID_INC
          ORDER BY TRY_CAST(SUBSTRING(a.ID_ASI, 5, LEN(a.ID_ASI) - 4) AS INT) DESC, a.ID_ASI DESC
        ) asi
        LEFT JOIN [BD_SEGURIDAD].dbo.ESTADO_GUARDIAS eg ON eg.ID_EST = asi.ID_EST_PER
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
            u.COR_INS_REF_USU AS emailUsuario,
            asi.ID_EST_PER AS idEstadoGuardia,
            eg.ID_USU_REF   AS idGuardiaAsignado
          FROM INCIDENTES i
          LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
          LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
          OUTER APPLY (
            SELECT TOP 1 a.ID_EST_PER
            FROM [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS a
            WHERE a.ID_INC_PER = i.ID_INC
            ORDER BY TRY_CAST(SUBSTRING(a.ID_ASI, 5, LEN(a.ID_ASI) - 4) AS INT) DESC, a.ID_ASI DESC
          ) asi
          LEFT JOIN [BD_SEGURIDAD].dbo.ESTADO_GUARDIAS eg ON eg.ID_EST = asi.ID_EST_PER
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
    // sqlcmd parsing of -Q breaks when the query contains embedded JSON quotes.
    // Persist the action detail as plain text in DATOS_JSON to keep compatibility.
    const datosJsonValue = acciones ? String(acciones) : null;

    console.log(`[saveHistorialCierre] Insertando: id=${idHistorial} ini=${fechaInicio} cie=${fechaCierre} gua=${resultadoGuardia} asi=${idAsignacion}`);

    await dbEstadisticas.query(
      `INSERT INTO HISTORIAL
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
    const zonaFinal = normalizarZonaId(idZona) || inferZonaIdByCoords(latSafe, lngSafe);
    try {
      await db.query(
        `INSERT INTO INCIDENTES (ID_INC, MOT_INC, EST_INC, ID_ZON_PER, ID_USU_REF, FEC_INI_INC, LAT_INC, LNG_INC)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, motivo, estado, zonaFinal, idUsuario, fechaInicio, latSafe, lngSafe]
      );
    } catch {
      // Fallback: columna FEC_INI_INC aún no existe
      await db.query(
        `INSERT INTO INCIDENTES (ID_INC, MOT_INC, EST_INC, ID_ZON_PER, ID_USU_REF)
         VALUES (?, ?, ?, ?, ?)`,
        [id, motivo, estado, zonaFinal, idUsuario]
      );
    }
    return { id, motivo, estado, idZona: zonaFinal, idUsuario, lat: latSafe, lng: lngSafe };
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
  getEstadisticas: async (periodo) => {
    const periodoNormalizado = normalizarPeriodo(periodo);
    const { inicio, fin } = calcularRangoPeriodo(periodoNormalizado);
    const wherePeriodo = 'WHERE i.FEC_INI_INC BETWEEN ? AND ?';
    const paramsPeriodo = [inicio, fin];

    // Totales generales
    const [totalesRows] = await db.query(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN EST_INC = 'Cerrado' THEN 1 ELSE 0 END) AS cerradas,
        SUM(CASE WHEN EST_INC = 'Activo'  THEN 1 ELSE 0 END) AS activas
       FROM INCIDENTES i
       ${wherePeriodo}`,
      paramsPeriodo
    );

    // Agrupado por motivo (todos los incidentes)
    const [porMotivoRows] = await db.query(
      `SELECT MOT_INC AS motivo, COUNT(*) AS cantidad
       FROM INCIDENTES i
       ${wherePeriodo}
       GROUP BY MOT_INC
       ORDER BY cantidad DESC`,
      paramsPeriodo
    );

    // Agrupado por zona (todos los incidentes)
    const [porZonaRows] = await db.query(
      `SELECT
        COALESCE(z.NOM_ZON, 'Sin zona') AS zona,
        COUNT(*) AS cantidad
       FROM INCIDENTES i
       LEFT JOIN ZONAS z ON z.ID_ZON = i.ID_ZON_PER
       ${wherePeriodo}
       GROUP BY z.NOM_ZON
       ORDER BY cantidad DESC`,
      paramsPeriodo
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
         AND i.FEC_INI_INC BETWEEN ? AND ?
       ORDER BY i.ID_INC DESC`,
      paramsPeriodo
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
