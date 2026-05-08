// Historia de Usuario #4 - Gestión de Casos
// T5.1 - Formulario de cierre de caso en React con campo para motivo de resolución
// T5.4 - Integrar flujo de cierre: enviar petición al backend y eliminar caso de lista activa
// Responsable: Alan Peñaloza
// ESTILOS: usa las variables CSS del proyecto (--uta-blue, --uta-gold, --uta-dark)

import { useState, useEffect } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3000");

export default function GestionCasos() {
  const [casos, setCasos] = useState([]);
  const [casoSeleccionado, setCasoSeleccionado] = useState(null);
  const [toastVisible, setToastVisible] = useState(false);

  // Cargar casos activos — BD_INCIDENTES: EST_INC = 'Activo'
  useEffect(() => {
    fetch("http://localhost:3000/api/casos/activos")
      .then((r) => r.json())
      .then((data) => { if (data.success) setCasos(data.data); });
  }, []);

  // T5.4 - Socket.IO: eliminar caso cerrado de la lista en tiempo real
  useEffect(() => {
    socket.on("caso:cerrado", ({ id }) => {
      setCasos((prev) => prev.filter((c) => c.ID_INC !== id));
    });
    return () => socket.off("caso:cerrado");
  }, []);

  // T5.4 - Eliminar caso de lista activa localmente
  const handleCasoCerrado = (idCaso) => {
    setCasos((prev) => prev.filter((c) => c.ID_INC !== idCaso));
    setCasoSeleccionado(null);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  return (
    <>
      {/* Página principal */}
      <div style={{
        minHeight: "100vh",
        background: "radial-gradient(circle at 20% 30%, #0a2a44, var(--uta-dark, #021126))",
        fontFamily: "'Inter', sans-serif",
        padding: "2rem",
      }}>

        {/* Header */}
        <div style={{
          background: "rgba(255,255,255,0.05)",
          backdropFilter: "blur(8px)",
          borderRadius: "1.5rem",
          padding: "1rem 2rem",
          display: "flex",
          alignItems: "center",
          gap: "1rem",
          marginBottom: "2rem",
          borderLeft: "6px solid #F4B41A",
          maxWidth: 800,
          margin: "0 auto 2rem",
        }}>
          <div style={{
            background: "linear-gradient(145deg, #0B2A5D, #123e6b)",
            width: 50,
            height: 50,
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 22,
            flexShrink: 0,
          }}>🛡️</div>
          <div>
            <h1 style={{ fontSize: "1.3rem", fontWeight: 800, color: "#fff", margin: 0 }}>
              Sistema de Seguridad UTA
            </h1>
            <p style={{ fontSize: "0.8rem", color: "rgba(255,255,255,0.55)", margin: 0 }}>
              Interfaz Guardia de Seguridad — Gestión de Casos
            </p>
          </div>
          {/* Badge contador */}
          <div style={{
            marginLeft: "auto",
            background: "rgba(244,180,26,0.15)",
            border: "1px solid rgba(244,180,26,0.4)",
            borderRadius: 40,
            padding: "0.3rem 1rem",
            color: "#F4B41A",
            fontSize: "0.8rem",
            fontWeight: 700,
          }}>
            {casos.length} caso{casos.length !== 1 ? "s" : ""} activo{casos.length !== 1 ? "s" : ""}
          </div>
        </div>

        {/* Lista de casos activos */}
        <div style={{ maxWidth: 800, margin: "0 auto" }}>

          {!casos.length ? (
            <div style={{
              background: "rgba(255,255,255,0.06)",
              borderRadius: "2rem",
              padding: "3rem",
              textAlign: "center",
              color: "rgba(255,255,255,0.5)",
              fontSize: "0.95rem",
              border: "1px dashed rgba(255,255,255,0.15)",
            }}>
              ✅ No hay casos activos en este momento.
            </div>
          ) : (
            casos.map((c) => (
              <div key={c.ID_INC} style={{
                background: "rgba(255,255,255,0.97)",
                borderRadius: "1.5rem",
                padding: "1.2rem 1.5rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: "1rem",
                borderLeft: "5px solid #F4B41A",
                boxShadow: "0 20px 35px -12px rgba(0,0,0,0.35)",
                transition: "all 0.25s ease",
              }}>
                <div>
                  <div style={{ fontSize: "0.75rem", color: "#8a9bb0", marginBottom: 3 }}>
                    #{c.ID_INC} · {c.NOM_ZON}
                  </div>
                  <div style={{ fontSize: "1rem", fontWeight: 700, color: "#0B2A5D" }}>
                    {c.MOT_INC}
                  </div>
                  <div style={{
                    display: "inline-block",
                    marginTop: 6,
                    background: "rgba(244,180,26,0.15)",
                    borderRadius: 40,
                    padding: "0.2rem 0.8rem",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#0B2A5D",
                  }}>
                    🔴 Activo
                  </div>
                </div>
                <button
                  onClick={() => setCasoSeleccionado(c)}
                  style={{
                    background: "linear-gradient(105deg, #0B2A5D, #153d6b)",
                    color: "#fff",
                    border: "none",
                    borderRadius: "2rem",
                    padding: "0.6rem 1.4rem",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: "pointer",
                    transition: "all 0.25s ease",
                    flexShrink: 0,
                  }}
                >
                  Gestionar
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* T5.1 - Modal de cierre de caso */}
      {casoSeleccionado && (
        <FormularioCierre
          caso={casoSeleccionado}
          onCerrado={handleCasoCerrado}
          onCancelar={() => setCasoSeleccionado(null)}
        />
      )}

      {/* Toast — mismo estilo que el proyecto */}
      <div className={`toast-notification success ${toastVisible ? "show" : ""}`}>
        ✅ Caso cerrado y registrado en historial
      </div>
    </>
  );
}

// ── T5.1 - Formulario de cierre (fiel al mockup + estilos del proyecto) ────────
function FormularioCierre({ caso, onCerrado, onCancelar }) {
  const [resolucionGuardia, setResolucionGuardia] = useState("");
  const [accionesRealizadas, setAccionesRealizadas] = useState(
    "• Guardia intervino en el lugar.\n• "
  );
  const [estadoCaso, setEstadoCaso] = useState("Cerrado");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  // T5.4 - Enviar petición PUT al backend
  const handleCerrar = async () => {
    if (!resolucionGuardia.trim() || !accionesRealizadas.trim()) {
      setError("Todos los campos son obligatorios.");
      return;
    }
    setError("");
    setCargando(true);
    try {
      const res = await fetch(`http://localhost:3000/api/casos/${caso.ID_INC}/cerrar`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolucionGuardia, accionesRealizadas, estadoCaso }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Error al cerrar el caso."); return; }
      onCerrado(caso.ID_INC);
    } catch {
      setError("Error de conexión con el servidor.");
    } finally {
      setCargando(false);
    }
  };

  return (
    // Usa clase .modal y .modal.active del CSS del proyecto
    <div className="modal active">
      <div className="modal-content" style={{
        maxWidth: 480,
        borderRadius: "2rem",
        padding: "0",
        overflow: "hidden",
        textAlign: "left",
        borderLeft: "6px solid #F4B41A",
      }}>

        {/* Header del modal — fiel al mockup */}
        <div style={{
          background: "linear-gradient(105deg, #0B2A5D, #153d6b)",
          padding: "1.2rem 1.8rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 20 }}>📋</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: "1rem" }}>
              Cierre de Caso
            </span>
          </div>
          <span style={{
            background: "rgba(244,180,26,0.2)",
            color: "#F4B41A",
            fontSize: "0.75rem",
            fontWeight: 700,
            padding: "0.2rem 0.8rem",
            borderRadius: 40,
          }}>
            #{caso.ID_INC}
          </span>
        </div>

        <div style={{ padding: "1.5rem 1.8rem", background: "#fff" }}>

          {/* ID del Caso - solo lectura */}
          <div className="input-field" style={{ marginBottom: "1.2rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2c4b6e", display: "block", marginBottom: 6 }}>
              ID del Caso:
            </label>
            <input
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                border: "2px solid #e9edf2",
                borderRadius: "2rem",
                fontSize: "0.9rem",
                background: "#f5f7fa",
                color: "#555",
                outline: "none",
                boxSizing: "border-box",
              }}
              value={caso.ID_INC}
              readOnly
            />
          </div>

          {/* Descripción del Evento — MOT_INC de BD_INCIDENTES */}
          <div style={{ marginBottom: "1.2rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2c4b6e", display: "block", marginBottom: 6 }}>
              Descripción del Evento:
            </label>
            <input
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                border: "2px solid #e9edf2",
                borderRadius: "2rem",
                fontSize: "0.9rem",
                background: "#f5f7fa",
                color: "#555",
                outline: "none",
                boxSizing: "border-box",
              }}
              value={caso.MOT_INC}
              readOnly
            />
          </div>

          {/* Acciones Realizadas — RES_GUA_HIS + DATOS_JSON en BD_ESTADISTICAS */}
          <div style={{ marginBottom: "1.2rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2c4b6e", display: "block", marginBottom: 6 }}>
              Acciones Realizadas:
            </label>
            <textarea
              style={{
                width: "100%",
                padding: "0.8rem 1rem",
                border: "2px solid #e9edf2",
                borderRadius: "1.2rem",
                fontSize: "0.9rem",
                background: "#fff",
                outline: "none",
                minHeight: 80,
                resize: "none",
                lineHeight: 1.6,
                boxSizing: "border-box",
                fontFamily: "'Inter', sans-serif",
                transition: "all 0.25s ease",
              }}
              value={accionesRealizadas}
              onChange={(e) => setAccionesRealizadas(e.target.value)}
              onFocus={(e) => { e.target.style.borderColor = "#F4B41A"; e.target.style.boxShadow = "0 0 0 4px rgba(244,180,26,0.2)"; }}
              onBlur={(e) => { e.target.style.borderColor = "#e9edf2"; e.target.style.boxShadow = "none"; }}
            />
          </div>

          {/* Estado del Caso — EST_INC en BD_INCIDENTES */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#2c4b6e", whiteSpace: "nowrap" }}>
              Estado del Caso:
            </label>
            <select
              style={{
                padding: "0.7rem 1rem",
                border: "2px solid #e9edf2",
                borderRadius: "2rem",
                fontSize: "0.85rem",
                background: "#fff",
                color: "#2c4b6e",
                fontWeight: 600,
                outline: "none",
                minWidth: 160,
              }}
              value={estadoCaso}
              onChange={(e) => setEstadoCaso(e.target.value)}
            >
              <option value="Cerrado">Cerrado</option>
              <option value="En Proceso">En Proceso</option>
            </select>
          </div>

          {/* Error */}
          {error && (
            <p style={{ fontSize: "0.8rem", color: "#c0392b", marginBottom: 8, fontWeight: 600 }}>
              ⚠️ {error}
            </p>
          )}
        </div>

        {/* Footer botones — usa clases .modal-buttons del CSS del proyecto */}
        <div style={{
          padding: "1rem 1.8rem",
          borderTop: "1px solid #f0f0f0",
          background: "#fafbfc",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          {/* Cancelar — usa estilo .cancel del CSS */}
          <button
            className="cancel"
            onClick={onCancelar}
            style={{
              padding: "0.7rem 1.6rem",
              border: "none",
              borderRadius: "2rem",
              background: "#e0e0e0",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>

          {/* Cerrar Caso — usa estilo .btn-login del CSS */}
          <button
            className="btn-login"
            onClick={handleCerrar}
            disabled={cargando}
            style={{
              width: "auto",
              padding: "0.7rem 1.8rem",
              marginBottom: 0,
              opacity: cargando ? 0.7 : 1,
            }}
          >
            {cargando ? "⏳ Cerrando..." : "🔒 Cerrar Caso"}
          </button>
        </div>
      </div>
    </div>
  );
}