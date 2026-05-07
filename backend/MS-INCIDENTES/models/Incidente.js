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

const Incidente = {
  // Obtener todos los incidentes con nombre de zona
  findAll: async () => {
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
  },

  // Obtener un incidente por ID
  findById: async (id) => {
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
  }
};

module.exports = Incidente;
