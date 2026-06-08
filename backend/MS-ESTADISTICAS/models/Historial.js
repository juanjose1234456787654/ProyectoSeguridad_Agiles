const { getDb } = require('../config/db');

const db = getDb('estadisticas');

const getNextHistorialId = async () => {
  const [rows] = await db.query(
    `SELECT
      COALESCE(MAX(TRY_CAST(SUBSTRING(ID_HIS, 4, LEN(ID_HIS) - 3) AS INT)), 0) AS maxId
    FROM HISTORIAL
    WHERE ID_HIS LIKE 'HIS%'`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `HIS${String(next).padStart(2, '0')}`;
};

const normalizarTexto = (value) => String(value || '')
  .trim()
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '');

const escapeLike = (value) => value.replace(/[\[%_]/g, (match) => `\\${match}`);

const Historial = {
  findAll: async ({ inicio, fin } = {}) => {
    const hasRango = Boolean(inicio && fin);
    const [rows] = await db.query(
      `SELECT
        ID_HIS AS id,
        FEC_INI_HIS AS fechaInicio,
        FEC_CIE_HIS AS fechaCierre,
        RES_GUA_HIS AS resultadoGuardia,
        ID_ASI_REF AS idAsignacion,
        DATOS_JSON AS datosJson
      FROM HISTORIAL
      ${hasRango ? 'WHERE COALESCE(FEC_CIE_HIS, FEC_INI_HIS) BETWEEN ? AND ?' : ''}
      ORDER BY COALESCE(FEC_CIE_HIS, FEC_INI_HIS) DESC`,
      hasRango ? [inicio, fin] : []
    );
    return rows;
  },

  findDetailed: async ({ search = '', page = 1, limit = 8 } = {}) => {
    const termino = normalizarTexto(search);
    const pagina = Math.max(1, Number(page) || 1);
    const tamano = Math.max(1, Math.min(50, Number(limit) || 8));
    const offset = (pagina - 1) * tamano;

    const filtros = ['h.FEC_CIE_HIS IS NOT NULL'];
    const params = [];

    if (termino) {
      const like = `%${escapeLike(termino)}%`;
      filtros.push(`(
        LOWER(COALESCE(TRY_CONVERT(NVARCHAR(100), i.ID_INC), '')) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(TRY_CONVERT(NVARCHAR(255), i.MOT_INC), '')) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(TRY_CONVERT(NVARCHAR(255), z.NOM_ZON), 'Sin zona')) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(TRY_CONVERT(NVARCHAR(255), h.RES_GUA_HIS), '')) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(TRY_CONVERT(NVARCHAR(255), u.COR_INS_REF_USU), '')) LIKE ? ESCAPE '\\' OR
        LOWER(COALESCE(TRY_CONVERT(NVARCHAR(400), LTRIM(RTRIM(CONCAT(
          COALESCE(TRY_CONVERT(NVARCHAR(100), p.NOM1_PER), ''), ' ',
          COALESCE(TRY_CONVERT(NVARCHAR(100), p.NOM2_PER), ''), ' ',
          COALESCE(TRY_CONVERT(NVARCHAR(100), p.APE1_PER), ''), ' ',
          COALESCE(TRY_CONVERT(NVARCHAR(100), p.APE2_PER), '')
        )))), '')) LIKE ? ESCAPE '\\'
      )`);
      params.push(like, like, like, like, like, like);
    }

    const baseQuery = `
      FROM HISTORIAL h
      LEFT JOIN [BD_SEGURIDAD].dbo.ASIGNACION_ALERTAS a ON a.ID_ASI = h.ID_ASI_REF
      LEFT JOIN [BD_INCIDENTES].dbo.INCIDENTES i ON i.ID_INC = a.ID_INC_PER
      LEFT JOIN [BD_INCIDENTES].dbo.ZONAS z ON z.ID_ZON = i.ID_ZON_PER
      LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = i.ID_USU_REF
      LEFT JOIN [BD_UTA].dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU
      WHERE ${filtros.join(' AND ')}
    `;

    const [countRows] = await db.query(
      `SELECT COUNT(*) AS total ${baseQuery}`,
      params
    );

    const [rows] = await db.query(
      `SELECT
        i.ID_INC AS id,
        COALESCE(LTRIM(RTRIM(CONCAT(
          COALESCE(p.NOM1_PER, ''), ' ',
          COALESCE(p.NOM2_PER, ''), ' ',
          COALESCE(p.APE1_PER, ''), ' ',
          COALESCE(p.APE2_PER, '')
        ))), u.COR_INS_REF_USU, i.ID_USU_REF) AS usuarioAfectado,
        i.MOT_INC AS motivoIncidente,
        COALESCE(z.NOM_ZON, 'Sin zona') AS zona,
        h.FEC_CIE_HIS AS fechaCierre,
        h.RES_GUA_HIS AS motivoResolucion,
        h.DATOS_JSON AS datosJson,
        h.ID_HIS AS idHistorial
      ${baseQuery}
      ORDER BY h.FEC_CIE_HIS DESC, h.ID_HIS DESC
      OFFSET ? ROWS FETCH NEXT ? ROWS ONLY`,
      [...params, offset, tamano]
    );

    const total = Number(countRows?.[0]?.total || 0);

    return {
      items: rows,
      pagination: {
        page: pagina,
        limit: tamano,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / tamano)
      }
    };
  },

  findById: async (id) => {
    const [rows] = await db.query(
      `SELECT
        ID_HIS AS id,
        FEC_INI_HIS AS fechaInicio,
        FEC_CIE_HIS AS fechaCierre,
        RES_GUA_HIS AS resultadoGuardia,
        ID_ASI_REF AS idAsignacion,
        DATOS_JSON AS datosJson
      FROM HISTORIAL
      WHERE ID_HIS = ?`,
      [id]
    );
    return rows[0] || null;
  },

  create: async ({ fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson }) => {
    const id = await getNextHistorialId();
    await db.query(
      `INSERT INTO HISTORIAL (ID_HIS, FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson]
    );
    return { id, fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson };
  },

  update: async (id, { fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson }) => {
    await db.query(
      `UPDATE HISTORIAL
       SET FEC_INI_HIS = ?,
           FEC_CIE_HIS = ?,
           RES_GUA_HIS = ?,
           ID_ASI_REF = ?,
           DATOS_JSON = ?
       WHERE ID_HIS = ?`,
      [fechaInicio, fechaCierre, resultadoGuardia, idAsignacion, datosJson, id]
    );

    return Historial.findById(id);
  },

  delete: async (id) => {
    await db.query('DELETE FROM HISTORIAL WHERE ID_HIS = ?', [id]);
  }
};

module.exports = Historial;
