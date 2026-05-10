// Historia de Usuario #4 - Gestión de Casos
// T5.5 - Pruebas del flujo completo con estructura real de BDs
// Responsable: Alan Peñaloza
// Ejecutar: npx jest casos.test.js
//
// BDs simuladas: BD_INCIDENTES, BD_SEGURIDAD, BD_ESTADISTICAS

const request = require("supertest");
const express = require("express");
const casosRoutes = require("./casosRoutes");

// ── Datos de prueba basados en la BD real ─────────────────────────────────────
function crearApp() {
  const app = express();
  app.use(express.json());

  // BD_INCIDENTES — tabla INCIDENTES + ZONAS
  const incidentes = [
    { ID_INC: "INC001", MOT_INC: "Robo de laptop", EST_INC: "Activo", ID_ZON_PER: "ZON91", ID_USU_REF: "USU01", NOM_ZON: "Sector FISEI" },
    { ID_INC: "INC002", MOT_INC: "Agresión verbal", EST_INC: "Activo", ID_ZON_PER: "ZON90", ID_USU_REF: "USU02", NOM_ZON: "Administración y Parqueaderos" },
    { ID_INC: "INC003", MOT_INC: "Accidente en cancha", EST_INC: "Activo", ID_ZON_PER: "ZON93", ID_USU_REF: "USU03", NOM_ZON: "Áreas Deportivas y Recreación" },
  ];

  // BD_SEGURIDAD — tabla ASIGNACION_ALERTAS
  const asignaciones = [
    { ID_ASI: "ASI001", ID_INC_PER: "INC001", ID_EST_PER: "EST001" },
    { ID_ASI: "ASI002", ID_INC_PER: "INC002", ID_EST_PER: "EST002" },
    { ID_ASI: "ASI003", ID_INC_PER: "INC003", ID_EST_PER: "EST003" },
  ];

  // BD_ESTADISTICAS — tabla HISTORIAL
  const historial = [];
  const socketEventos = [];

  // Mock DB BD_INCIDENTES
  const db_inc = {
    query: async (sql, params) => {
      if (sql.includes("SELECT") && sql.includes("WHERE ID_INC")) {
        return [incidentes.filter((i) => i.ID_INC === params[0])];
      }
      if (sql.includes("SELECT") && sql.includes("EST_INC = 'Activo'")) {
        return [incidentes.filter((i) => i.EST_INC === "Activo")];
      }
      if (sql.includes("UPDATE INCIDENTES SET EST_INC")) {
        const inc = incidentes.find((i) => i.ID_INC === params[1]);
        if (inc) inc.EST_INC = params[0];
        return [{ affectedRows: 1 }];
      }
      return [[]];
    },
  };

  // Mock DB BD_SEGURIDAD
  const db_seg = {
    query: async (sql, params) => {
      if (sql.includes("ASIGNACION_ALERTAS")) {
        return [asignaciones.filter((a) => a.ID_INC_PER === params[0])];
      }
      return [[]];
    },
  };

  // Mock DB BD_ESTADISTICAS
  const db_est = {
    query: async (sql, params) => {
      if (sql.includes("INSERT INTO HISTORIAL")) {
        historial.push({
          ID_HIS: params[0],
          FEC_INI_HIS: params[1],
          FEC_CIE_HIS: params[2],
          RES_GUA_HIS: params[3],
          ID_ASI_REF: params[4],
          DATOS_JSON: params[5],
        });
        return [{ insertId: historial.length }];
      }
      return [[]];
    },
  };

  // Mock Socket.IO
  const io = { emit: (evento, data) => socketEventos.push({ evento, data }) };

  app.set("db_inc", db_inc);
  app.set("db_seg", db_seg);
  app.set("db_est", db_est);
  app.set("io", io);
  app.use("/api", casosRoutes);

  // Exponer datos internos para assertions
  app._incidentes   = incidentes;
  app._historial    = historial;
  app._socketEventos = socketEventos;

  return app;
}

// ── TESTS ─────────────────────────────────────────────────────────────────────
describe("HU#4 – Gestión de Casos con BDs reales", () => {

  let app;
  beforeEach(() => { app = crearApp(); });

  // T5.1 - Validación de campos del formulario
  describe("T5.1 – Validación del formulario de cierre", () => {
    test("Rechaza cierre sin resolucionGuardia (RES_GUA_HIS vacío)", async () => {
      const res = await request(app).put("/api/casos/INC001/cerrar").send({
        resolucionGuardia: "",
        accionesRealizadas: "Guardia intervino.",
        estadoCaso: "Cerrado",
      });
      expect(res.statusCode).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("Rechaza cierre sin accionesRealizadas (DATOS_JSON vacío)", async () => {
      const res = await request(app).put("/api/casos/INC001/cerrar").send({
        resolucionGuardia: "Objeto recuperado.",
        accionesRealizadas: "",
        estadoCaso: "Cerrado",
      });
      expect(res.statusCode).toBe(400);
    });
  });

  // T5.2 - Endpoint con timestamp real
  describe("T5.2 – Cierre con timestamp en BD_ESTADISTICAS.HISTORIAL", () => {
    test("Cierra el caso y genera FEC_CIE_HIS válido", async () => {
      const res = await request(app).put("/api/casos/INC001/cerrar").send({
        resolucionGuardia: "Objeto recuperado y entregado al dueño.",
        accionesRealizadas: "• Guardia intervino.\n• Objeto devuelto.",
        estadoCaso: "Cerrado",
      });
      expect(res.statusCode).toBe(200);
      expect(res.body.success).toBe(true);
      // Verificar timestamp ISO válido (FEC_CIE_HIS)
      expect(new Date(res.body.data.FEC_CIE_HIS).toISOString()).toBeTruthy();
    });

    test("EST_INC cambia a 'Cerrado' en BD_INCIDENTES", async () => {
      await request(app).put("/api/casos/INC001/cerrar").send({
        resolucionGuardia: "Resuelto.",
        accionesRealizadas: "Acción tomada.",
      });
      const inc = app._incidentes.find((i) => i.ID_INC === "INC001");
      expect(inc.EST_INC).toBe("Cerrado");
    });

    test("Retorna 404 si ID_INC no existe en BD_INCIDENTES", async () => {
      const res = await request(app).put("/api/casos/INC999/cerrar").send({
        resolucionGuardia: "x", accionesRealizadas: "x",
      });
      expect(res.statusCode).toBe(404);
    });

    test("Retorna 409 si EST_INC ya es 'Cerrado'", async () => {
      await request(app).put("/api/casos/INC001/cerrar").send({ resolucionGuardia: "x", accionesRealizadas: "x" });
      const res = await request(app).put("/api/casos/INC001/cerrar").send({ resolucionGuardia: "x", accionesRealizadas: "x" });
      expect(res.statusCode).toBe(409);
    });
  });

  // T5.3 - Vinculación con BD_ESTADISTICAS.HISTORIAL
  describe("T5.3 – Registro en BD_ESTADISTICAS.HISTORIAL", () => {
    test("Inserta registro en HISTORIAL con RES_GUA_HIS y DATOS_JSON", async () => {
      await request(app).put("/api/casos/INC002/cerrar").send({
        resolucionGuardia: "Mediación entre estudiantes realizada.",
        accionesRealizadas: "• Guardia medió el conflicto.",
        estadoCaso: "Cerrado",
      });
      expect(app._historial.length).toBe(1);
      expect(app._historial[0].RES_GUA_HIS).toBe("Mediación entre estudiantes realizada.");
      // DATOS_JSON debe ser un JSON válido con accionesRealizadas
      const datos = JSON.parse(app._historial[0].DATOS_JSON);
      expect(datos.accionesRealizadas).toBeTruthy();
      expect(datos.zona).toBe("ZON90");
    });

    test("ID_ASI_REF apunta a ASIGNACION_ALERTAS de BD_SEGURIDAD", async () => {
      await request(app).put("/api/casos/INC002/cerrar").send({
        resolucionGuardia: "Resuelto.", accionesRealizadas: "Acción.",
      });
      expect(app._historial[0].ID_ASI_REF).toBe("ASI002");
    });
  });

  // T5.4 - Socket.IO y lista activa
  describe("T5.4 – Socket.IO y eliminación de lista activa", () => {
    test("Emite evento 'caso:cerrado' con ID_INC correcto", async () => {
      await request(app).put("/api/casos/INC003/cerrar").send({
        resolucionGuardia: "Traslado a enfermería.", accionesRealizadas: "Primeros auxilios.",
      });
      expect(app._socketEventos[0].evento).toBe("caso:cerrado");
      expect(app._socketEventos[0].data.id).toBe("INC003");
    });

    test("El caso cerrado no aparece en GET /api/casos/activos", async () => {
      await request(app).put("/api/casos/INC001/cerrar").send({
        resolucionGuardia: "Resuelto.", accionesRealizadas: "Acción.",
      });
      const res = await request(app).get("/api/casos/activos");
      const ids = res.body.data.map((c) => c.ID_INC);
      expect(ids).not.toContain("INC001");
    });
  });

  // T5.5 - Flujo completo end-to-end
  describe("T5.5 – Flujo completo end-to-end", () => {
    test("Cierre → RES_GUA_HIS → HISTORIAL → Socket.IO → lista vacía", async () => {
      // 1. Los 3 casos están activos en BD_INCIDENTES
      const activos1 = await request(app).get("/api/casos/activos");
      expect(activos1.body.data.length).toBe(3);

      // 2. Cerrar los 3 casos
      for (const { id, res } of [
        { id: "INC001", res: "Objeto recuperado y devuelto." },
        { id: "INC002", res: "Mediación realizada exitosamente." },
        { id: "INC003", res: "Trasladado a enfermería del campus." },
      ]) {
        const r = await request(app).put(`/api/casos/${id}/cerrar`).send({
          resolucionGuardia: res,
          accionesRealizadas: "• Guardia intervino en el lugar.",
          estadoCaso: "Cerrado",
        });
        expect(r.statusCode).toBe(200);
        // Verificar que FEC_CIE_HIS fue generado
        expect(r.body.data.FEC_CIE_HIS).toBeTruthy();
      }

      // 3. BD_ESTADISTICAS.HISTORIAL tiene 3 registros con RES_GUA_HIS
      expect(app._historial.length).toBe(3);
      app._historial.forEach((h) => {
        expect(h.RES_GUA_HIS).toBeTruthy();
        expect(h.FEC_CIE_HIS).toBeTruthy();
      });

      // 4. Socket.IO emitió 3 eventos "caso:cerrado"
      expect(app._socketEventos.length).toBe(3);

      // 5. Lista activa en BD_INCIDENTES vacía
      const activos2 = await request(app).get("/api/casos/activos");
      expect(activos2.body.data.length).toBe(0);
    });
  });
});