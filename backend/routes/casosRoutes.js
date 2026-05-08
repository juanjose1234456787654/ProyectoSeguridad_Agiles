// Historia de Usuario #4 - Gestión de Casos
// T5.2 - Endpoint backend para cerrar caso y almacenar resolución con timestamp
// T5.3 - Lógica para actualizar estado del incidente y vincularlo al módulo de estadísticas
// Responsable: Alan Peñaloza
//
// BDs involucradas:
//   BD_INCIDENTES  → tabla INCIDENTES  (EST_INC, MOT_INC, ID_ZON_PER, ID_USU_REF)
//   BD_ESTADISTICAS → tabla HISTORIAL  (FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON)
//   BD_SEGURIDAD   → tabla ASIGNACION_ALERTAS (ID_ASI, ID_INC_PER, ID_EST_PER)

const express = require("express");
const router = express.Router();

// ── T5.2 - PUT /api/casos/:id/cerrar ─────────────────────────────────────────
router.put("/casos/:id/cerrar", async (req, res) => {
  const { id } = req.params; // ID_INC de BD_INCIDENTES
  const { resolucionGuardia, accionesRealizadas, estadoCaso } = req.body;

  // db_inc  → pool de BD_INCIDENTES
  // db_seg  → pool de BD_SEGURIDAD
  // db_est  → pool de BD_ESTADISTICAS
  const db_inc = req.app.get("db_inc");
  const db_seg = req.app.get("db_seg");
  const db_est = req.app.get("db_est");
  const io     = req.app.get("io");

  // Validación de campos obligatorios
  if (!resolucionGuardia?.trim() || !accionesRealizadas?.trim()) {
    return res.status(400).json({ success: false, error: "Todos los campos son obligatorios." });
  }

  try {
    // 1. Verificar que el incidente existe en BD_INCIDENTES y está Activo
    const [rows] = await db_inc.query(
      "SELECT * FROM INCIDENTES WHERE ID_INC = ?", [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Caso no encontrado." });
    }
    if (rows[0].EST_INC === "Cerrado") {
      return res.status(409).json({ success: false, error: "El caso ya fue cerrado." });
    }

    // T5.2 - Timestamps generados en el backend
    const fechaCierre = new Date(); // FEC_CIE_HIS
    const fechaInicio = new Date(rows[0].FEC_INI_INC || fechaCierre); // FEC_INI_HIS

    // T5.2 - Actualizar EST_INC en BD_INCIDENTES.INCIDENTES → 'Cerrado'
    await db_inc.query(
      "UPDATE INCIDENTES SET EST_INC = ? WHERE ID_INC = ?",
      [estadoCaso || "Cerrado", id]
    );

    // T5.3 - Buscar ID_ASI en BD_SEGURIDAD.ASIGNACION_ALERTAS para este incidente
    const [asignacion] = await db_seg.query(
      "SELECT ID_ASI FROM ASIGNACION_ALERTAS WHERE ID_INC_PER = ?", [id]
    );
    const idAsi = asignacion.length ? asignacion[0].ID_ASI : null;

    // T5.3 - Insertar en BD_ESTADISTICAS.HISTORIAL con timestamp y resolución
    // Campos: ID_HIS, FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON
    const idHistorial = `HIS${Date.now()}`.substring(0, 10);
    await db_est.query(
      `INSERT INTO HISTORIAL (ID_HIS, FEC_INI_HIS, FEC_CIE_HIS, RES_GUA_HIS, ID_ASI_REF, DATOS_JSON)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        idHistorial,
        fechaInicio,
        fechaCierre,
        resolucionGuardia,   // RES_GUA_HIS — motivo de resolución del guardia
        idAsi,               // ID_ASI_REF — referencia a ASIGNACION_ALERTAS
        JSON.stringify({     // DATOS_JSON — acciones adicionales
          accionesRealizadas,
          idIncidente: id,
          zona: rows[0].ID_ZON_PER,
        }),
      ]
    );

    // T5.4 - Emitir evento Socket.IO para actualizar lista en todos los guardias
    io.emit("caso:cerrado", { id, fechaCierre: fechaCierre.toISOString() });

    return res.status(200).json({
      success: true,
      message: "Caso cerrado correctamente.",
      data: {
        ID_INC: id,
        EST_INC: estadoCaso || "Cerrado",
        FEC_CIE_HIS: fechaCierre.toISOString(),
        ID_HIS: idHistorial,
      },
    });

  } catch (error) {
    console.error("Error al cerrar caso:", error);
    return res.status(500).json({ success: false, error: "Error interno del servidor." });
  }
});

// ── GET /api/casos/activos ────────────────────────────────────────────────────
// Trae incidentes con EST_INC = 'Activo' desde BD_INCIDENTES
// JOIN con ZONAS para mostrar NOM_ZON en el frontend
router.get("/casos/activos", async (req, res) => {
  try {
    const db_inc = req.app.get("db_inc");
    const [rows] = await db_inc.query(
      `SELECT I.ID_INC, I.MOT_INC, I.EST_INC, I.ID_ZON_PER, I.ID_USU_REF,
              Z.NOM_ZON
       FROM INCIDENTES I
       LEFT JOIN ZONAS Z ON I.ID_ZON_PER = Z.ID_ZON
       WHERE I.EST_INC = 'Activo'
       ORDER BY I.ID_INC DESC`
    );
    return res.status(200).json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({ success: false, error: "Error interno del servidor." });
  }
});

module.exports = router;