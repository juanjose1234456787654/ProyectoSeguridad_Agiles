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
  // Obtener todos los estados de guardias con nombre y casos asignados
  findAll: async () => {
    try {
      const [rows] = await db.query(
        `SELECT
          e.ID_EST      AS id,
          e.EST_EST     AS estado,
          e.HOR_SER_EST AS horario,
          e.ID_USU_REF  AS idUsuario,
          u.COR_INS_REF_USU AS email,
          LTRIM(RTRIM(CONCAT(
            COALESCE(p.NOM1_PER, ''), ' ',
            COALESCE(p.NOM2_PER, ''), ' ',
            COALESCE(p.APE1_PER, ''), ' ',
            COALESCE(p.APE2_PER, '')
          ))) AS nombre,
          (SELECT COUNT(*) FROM ASIGNACION_ALERTAS a WHERE a.ID_EST_PER = e.ID_EST) AS casosAsignados
        FROM ESTADO_GUARDIAS e
        LEFT JOIN [BD_IDENTIDAD].dbo.USUARIOS u ON u.ID_USU = e.ID_USU_REF
        LEFT JOIN [BD_UTA].dbo.PERSONAS_UTA p ON p.COR_PER = u.COR_INS_REF_USU
        ORDER BY e.EST_EST, e.ID_EST`
      );
      return rows;
    } catch {
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
    }
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
    console.log(`[ESTADO_GUARDIAS model.create] INSERT id=${id} estado=${estado} horario=${horario} idUsuario=${idUsuario}`);
    await db.query(
      `INSERT INTO ESTADO_GUARDIAS (ID_EST, EST_EST, HOR_SER_EST, ID_USU_REF)
       VALUES (?, ?, ?, ?)`,
      [id, estado, horario, idUsuario]
    );
    // Verificar que el INSERT realmente persitió
    const verificado = await EstadoGuardia.findById(id);
    console.log('[ESTADO_GUARDIAS model.create] Verificacion post-INSERT:', verificado);
    if (!verificado) {
      throw new Error(`INSERT en ESTADO_GUARDIAS no persistió para ID ${id}. Verifica permisos y constraints en BD_SEGURIDAD.`);
    }
    return verificado;
  },

  // Actualizar estado de guardia
  update: async (id, { estado, horario, idUsuario }) => {
    console.log(`[ESTADO_GUARDIAS model.update] UPDATE id=${id} estado=${estado}`);
    await db.query(
      `UPDATE ESTADO_GUARDIAS
       SET EST_EST = ?, HOR_SER_EST = ?, ID_USU_REF = ?
       WHERE ID_EST = ?`,
      [estado, horario, idUsuario, id]
    );
    const verificado = await EstadoGuardia.findById(id);
    console.log('[ESTADO_GUARDIAS model.update] Verificacion post-UPDATE:', verificado);
    return verificado;
  },

  // Eliminar estado de guardia
  delete: async (id) => {
    await db.query('DELETE FROM ESTADO_GUARDIAS WHERE ID_EST = ?', [id]);
  }
};

module.exports = EstadoGuardia;
