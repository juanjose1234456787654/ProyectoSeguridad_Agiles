const { getDb } = require('../config/db');

const db = getDb('estadisticas');

const getNextHistorialId = async () => {
  const [rows] = await db.query(
    `SELECT
      COALESCE(MAX(CAST(SUBSTRING(ID_HIS, 4, LEN(ID_HIS) - 3) AS INT)), 0) AS maxId
    FROM HISTORIAL`
  );
  const next = Number(rows[0]?.maxId || 0) + 1;
  return `HIS${String(next).padStart(2, '0')}`;
};

const Historial = {
  findAll: async () => {
    const [rows] = await db.query(
      `SELECT
        ID_HIS AS id,
        FEC_INI_HIS AS fechaInicio,
        FEC_CIE_HIS AS fechaCierre,
        RES_GUA_HIS AS resultadoGuardia,
        ID_ASI_REF AS idAsignacion,
        DATOS_JSON AS datosJson
      FROM HISTORIAL
      ORDER BY FEC_INI_HIS DESC`
    );
    return rows;
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
