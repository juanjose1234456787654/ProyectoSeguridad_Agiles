const { getDb } = require('../config/db');

const db = getDb('incidentes');

const Zona = {
  // Obtener todas las zonas
  findAll: async () => {
    const [rows] = await db.query(
      `SELECT
        ID_ZON      AS id,
        NOM_ZON     AS nombre,
        COO_POL_ZONX AS coordX,
        COO_POL_ZONY AS coordY
      FROM ZONAS
      ORDER BY ID_ZON`
    );
    return rows;
  },

  // Obtener una zona por ID
  findById: async (id) => {
    const [rows] = await db.query(
      `SELECT
        ID_ZON      AS id,
        NOM_ZON     AS nombre,
        COO_POL_ZONX AS coordX,
        COO_POL_ZONY AS coordY
      FROM ZONAS
      WHERE ID_ZON = ?`,
      [id]
    );
    return rows[0] || null;
  }
};

module.exports = Zona;
