import { useCallback, useEffect, useRef, useState } from 'react';
import contactosService from '../services/contactosService';
import '../styles/ContactosConfianza.css';

const MAX_CONTACTOS = 5;
const MAX_MIEMBROS = 5;
const DEBOUNCE_MS = 350;

// ─── Sub-componente: Combobox de búsqueda de personas ────────────────────────

const PersonaCombobox = ({ onSelect, excluir = [], placeholder = 'Buscar persona…' }) => {
  const [query, setQuery] = useState('');
  const [sugerencias, setSugerencias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const wrapRef = useRef(null);

  // Cerrar dropdown al hacer click fuera
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const buscar = useCallback(async (q) => {
    if (q.length < 2) { setSugerencias([]); setOpen(false); return; }
    setCargando(true);
    try {
      const data = await contactosService.buscarPersonas(q);
      const filtrado = data.filter((p) => !excluir.includes(p.correo));
      setSugerencias(filtrado);
      setOpen(filtrado.length > 0);
    } catch {
      setSugerencias([]);
    } finally {
      setCargando(false);
    }
  }, [excluir]);

  const onChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => buscar(val), DEBOUNCE_MS);
  };

  const seleccionar = (persona) => {
    onSelect(persona);
    setQuery('');
    setSugerencias([]);
    setOpen(false);
  };

  return (
    <div className="cc-combobox" ref={wrapRef}>
      <div className="cc-combobox__input-wrap">
        <input
          type="text"
          className="cc-combobox__input"
          value={query}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete="off"
        />
        {cargando && <span className="cc-combobox__spinner" aria-hidden="true" />}
      </div>
      {open && (
        <ul className="cc-combobox__list" role="listbox">
          {sugerencias.map((p) => (
            <li
              key={p.correo}
              role="option"
              className="cc-combobox__item"
              onMouseDown={() => seleccionar(p)}
            >
              <span className="cc-combobox__nombre">{p.nombreCompleto}</span>
              <span className="cc-combobox__correo">{p.correo}</span>
              <span className="cc-combobox__rol">{p.rol}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

// ─── Sub-componente: Chip (etiqueta removible) ────────────────────────────────

const Chip = ({ label, onRemove }) => (
  <span className="cc-chip">
    {label}
    <button type="button" className="cc-chip__remove" onClick={onRemove} aria-label={`Quitar ${label}`}>×</button>
  </span>
);

// ─── Sub-componente: Formulario de grupo ─────────────────────────────────────

const GrupoForm = ({ inicial, onGuardar, onCancelar }) => {
  const [nombre, setNombre] = useState(inicial?.nombre || '');
  const [miembros, setMiembros] = useState(inicial?.integrantes || []);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  const correosMiembros = miembros.map((m) => m.correo || m.COR_PER_REF);

  const agregarMiembro = (persona) => {
    if (miembros.length >= MAX_MIEMBROS) { setError(`Máximo ${MAX_MIEMBROS} integrantes por grupo`); return; }
    if (correosMiembros.includes(persona.correo)) { setError('Esta persona ya está en el grupo'); return; }
    setError('');
    setMiembros((prev) => [...prev, persona]);
  };

  const quitarMiembro = (correo) => setMiembros((prev) => prev.filter((m) => (m.correo || m.COR_PER_REF) !== correo));

  const guardar = async () => {
    if (!nombre.trim()) { setError('El nombre del grupo es obligatorio'); return; }
    if (miembros.length === 0) { setError('Agrega al menos un integrante'); return; }
    setGuardando(true);
    setError('');
    try {
      await onGuardar({ nombre: nombre.trim(), correos: correosMiembros });
    } catch (e) {
      setError(e?.response?.data?.message || 'Error al guardar el grupo');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="cc-grupo-form">
      <label className="cc-label">
        Nombre del grupo
        <input
          type="text"
          className="cc-input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Ej: Familia, Amigos del trabajo…"
          maxLength={60}
        />
      </label>

      <label className="cc-label">
        Agregar integrantes ({miembros.length}/{MAX_MIEMBROS})
        <PersonaCombobox
          onSelect={agregarMiembro}
          excluir={correosMiembros}
          placeholder="Buscar persona para agregar…"
        />
      </label>

      {miembros.length > 0 && (
        <div className="cc-chips">
          {miembros.map((m) => {
            const correo = m.correo || m.COR_PER_REF;
            const etiqueta = m.nombreCompleto || correo;
            return <Chip key={correo} label={etiqueta} onRemove={() => quitarMiembro(correo)} />;
          })}
        </div>
      )}

      {error && <p className="cc-error">{error}</p>}

      <div className="cc-grupo-form__actions">
        <button type="button" className="cc-btn cc-btn--secondary" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </button>
        <button type="button" className="cc-btn cc-btn--primary" onClick={guardar} disabled={guardando}>
          {guardando ? 'Guardando…' : 'Guardar grupo'}
        </button>
      </div>
    </div>
  );
};

// ─── Componente principal ─────────────────────────────────────────────────────

const ContactosConfianza = () => {
  const [tab, setTab] = useState('contactos'); // 'contactos' | 'grupos'

  // Estado de contactos individuales
  const [contactos, setContactos] = useState([]);
  const [alias, setAlias] = useState('');
  const [personaSeleccionada, setPersonaSeleccionada] = useState(null);
  const [addError, setAddError] = useState('');
  const [addOk, setAddOk] = useState('');
  const [agregando, setAgregando] = useState(false);

  // Estado de grupos
  const [grupos, setGrupos] = useState([]);
  const [mostrarFormGrupo, setMostrarFormGrupo] = useState(false);
  const [grupoEditando, setGrupoEditando] = useState(null);

  // Estado de alerta de confianza
  const [alertando, setAlertando] = useState(false);
  const [alertaMsg, setAlertaMsg] = useState('');
  const [alertaResultado, setAlertaResultado] = useState(null);
  const [alertaError, setAlertaError] = useState('');

  // Carga general
  const [cargando, setCargando] = useState(true);
  const [errorGlobal, setErrorGlobal] = useState('');

  // ── Carga de datos ──────────────────────────────────────────────────────────

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorGlobal('');
    try {
      const [cs, gs] = await Promise.all([
        contactosService.getContactos(),
        contactosService.getGrupos()
      ]);
      setContactos(Array.isArray(cs) ? cs : []);
      setGrupos(Array.isArray(gs) ? gs : []);
    } catch {
      setErrorGlobal('No se pudieron cargar los datos. Intenta de nuevo.');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargarDatos(); }, [cargarDatos]);

  // ── Contactos individuales ──────────────────────────────────────────────────

  const seleccionarPersona = (persona) => {
    setPersonaSeleccionada(persona);
    setAlias('');
    setAddError('');
    setAddOk('');
  };

  const agregarContacto = async () => {
    if (!personaSeleccionada) { setAddError('Selecciona una persona primero'); return; }
    setAgregando(true);
    setAddError('');
    setAddOk('');
    try {
      await contactosService.addContacto({ correo: personaSeleccionada.correo, alias: alias.trim() || undefined });
      setAddOk(`${personaSeleccionada.nombreCompleto} agregado como contacto de confianza.`);
      setPersonaSeleccionada(null);
      setAlias('');
      await cargarDatos();
    } catch (e) {
      setAddError(e?.response?.data?.message || 'No se pudo agregar el contacto');
    } finally {
      setAgregando(false);
    }
  };

  const eliminarContacto = async (id) => {
    if (!window.confirm('¿Eliminar este contacto de confianza?')) return;
    try {
      await contactosService.removeContacto(id);
      await cargarDatos();
    } catch (e) {
      setAddError(e?.response?.data?.message || 'No se pudo eliminar el contacto');
    }
  };

  // ── Grupos ──────────────────────────────────────────────────────────────────

  const guardarGrupo = async ({ nombre, correos }) => {
    if (grupoEditando) {
      await contactosService.updateGrupo(grupoEditando.id, { nombre, correos });
    } else {
      await contactosService.createGrupo({ nombre, correos });
    }
    setMostrarFormGrupo(false);
    setGrupoEditando(null);
    await cargarDatos();
  };

  const eliminarGrupo = async (id, nombre) => {
    if (!window.confirm(`¿Eliminar el grupo "${nombre}"?`)) return;
    try {
      await contactosService.deleteGrupo(id);
      await cargarDatos();
    } catch {
      setErrorGlobal('No se pudo eliminar el grupo');
    }
  };

  const editarGrupo = (grupo) => {
    setGrupoEditando(grupo);
    setMostrarFormGrupo(true);
  };

  // ── Alertar a contactos ─────────────────────────────────────────────────────

  const enviarAlerta = async () => {
    setAlertando(true);
    setAlertaResultado(null);
    setAlertaError('');
    try {
      const resultado = await contactosService.alertarContactos(alertaMsg);
      setAlertaResultado(resultado);
    } catch (e) {
      setAlertaError(e?.response?.data?.message || 'No se pudo enviar la alerta');
    } finally {
      setAlertando(false);
    }
  };

  const totalContactos = contactos.length + grupos.reduce((s, g) => s + (g.integrantes?.length || 0), 0);
  const correosExistentes = contactos.map((c) => c.correo || c.COR_PER_REF);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <section className="cc-shell" aria-label="Gestión de contactos de confianza">
      <header className="cc-header">
        <div>
          <h2 className="cc-header__title">Contactos de Confianza</h2>
          <p className="cc-header__sub">
            Personas a quienes se notificará automáticamente si activas una alerta de emergencia.
          </p>
        </div>

        {/* Botón de alerta a contactos */}
        <button
          type="button"
          className="cc-btn-alerta"
          onClick={enviarAlerta}
          disabled={alertando || totalContactos === 0}
          title={totalContactos === 0 ? 'Agrega al menos un contacto para poder alertar' : ''}
        >
          {alertando ? 'Enviando…' : '🚨 Alertar a mis contactos'}
        </button>
      </header>

      {alertaResultado && (
        <div className="cc-alerta-resultado cc-alerta-resultado--ok">
          <strong>✓ Alerta enviada.</strong> {alertaResultado.enviados} notificacion{alertaResultado.enviados !== 1 ? 'es' : ''} entregada{alertaResultado.enviados !== 1 ? 's' : ''}.
          {alertaResultado.fallidos > 0 && ` (${alertaResultado.fallidos} fallida${alertaResultado.fallidos !== 1 ? 's' : ''})`}
        </div>
      )}
      {alertaError && <div className="cc-alerta-resultado cc-alerta-resultado--err">{alertaError}</div>}

      {/* Área de mensaje opcional para la alerta */}
      {totalContactos > 0 && (
        <div className="cc-alerta-msg-wrap">
          <input
            type="text"
            className="cc-input"
            value={alertaMsg}
            onChange={(e) => setAlertaMsg(e.target.value)}
            placeholder="Mensaje adicional (opcional)…"
            maxLength={200}
          />
        </div>
      )}

      {/* Pestañas */}
      <nav className="cc-tabs" role="tablist">
        <button
          role="tab"
          className={`cc-tab ${tab === 'contactos' ? 'cc-tab--active' : ''}`}
          onClick={() => setTab('contactos')}
          aria-selected={tab === 'contactos'}
        >
          Individuales
          {contactos.length > 0 && <span className="cc-badge">{contactos.length}</span>}
        </button>
        <button
          role="tab"
          className={`cc-tab ${tab === 'grupos' ? 'cc-tab--active' : ''}`}
          onClick={() => setTab('grupos')}
          aria-selected={tab === 'grupos'}
        >
          Grupos
          {grupos.length > 0 && <span className="cc-badge">{grupos.length}</span>}
        </button>
      </nav>

      {errorGlobal && <p className="cc-error">{errorGlobal}</p>}
      {cargando && <p className="cc-loading">Cargando…</p>}

      {/* ── Panel: Contactos individuales ── */}
      {!cargando && tab === 'contactos' && (
        <div className="cc-panel" role="tabpanel">
          {/* Formulario para agregar */}
          {contactos.length < MAX_CONTACTOS ? (
            <div className="cc-add-form">
              <p className="cc-add-form__label">Buscar persona ({contactos.length}/{MAX_CONTACTOS})</p>
              <PersonaCombobox
                onSelect={seleccionarPersona}
                excluir={correosExistentes}
                placeholder="Nombre, apellido o correo institucional…"
              />

              {personaSeleccionada && (
                <div className="cc-persona-seleccionada">
                  <div>
                    <strong>{personaSeleccionada.nombreCompleto}</strong>
                    <span className="cc-correo">{personaSeleccionada.correo}</span>
                  </div>
                  <button type="button" className="cc-btn-clear" onClick={() => setPersonaSeleccionada(null)} aria-label="Limpiar selección">×</button>
                </div>
              )}

              {personaSeleccionada && (
                <label className="cc-label cc-label--inline">
                  Alias (opcional)
                  <input
                    type="text"
                    className="cc-input"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                    placeholder="Ej: Mamá, Tutor, etc."
                    maxLength={40}
                  />
                </label>
              )}

              {addError && <p className="cc-error">{addError}</p>}
              {addOk && <p className="cc-ok">{addOk}</p>}

              <button
                type="button"
                className="cc-btn cc-btn--primary"
                onClick={agregarContacto}
                disabled={!personaSeleccionada || agregando}
              >
                {agregando ? 'Agregando…' : 'Agregar contacto'}
              </button>
            </div>
          ) : (
            <p className="cc-info">Has alcanzado el límite de {MAX_CONTACTOS} contactos individuales.</p>
          )}

          {/* Lista de contactos */}
          {contactos.length > 0 ? (
            <ul className="cc-list">
              {contactos.map((c) => (
                <li key={c.id} className="cc-list__item">
                  <div className="cc-list__info">
                    <span className="cc-list__nombre">{c.alias || c.correo || c.COR_PER_REF}</span>
                    {c.alias && <span className="cc-correo">{c.correo || c.COR_PER_REF}</span>}
                  </div>
                  <button
                    type="button"
                    className="cc-btn cc-btn--danger"
                    onClick={() => eliminarContacto(c.id)}
                  >
                    Eliminar
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="cc-empty">Aún no tienes contactos individuales. Busca una persona arriba para agregar.</p>
          )}
        </div>
      )}

      {/* ── Panel: Grupos ── */}
      {!cargando && tab === 'grupos' && (
        <div className="cc-panel" role="tabpanel">
          {!mostrarFormGrupo && (
            <button
              type="button"
              className="cc-btn cc-btn--primary cc-btn--new"
              onClick={() => { setGrupoEditando(null); setMostrarFormGrupo(true); }}
            >
              + Nuevo grupo
            </button>
          )}

          {mostrarFormGrupo && (
            <GrupoForm
              inicial={grupoEditando}
              onGuardar={guardarGrupo}
              onCancelar={() => { setMostrarFormGrupo(false); setGrupoEditando(null); }}
            />
          )}

          {grupos.length > 0 ? (
            <ul className="cc-list cc-list--grupos">
              {grupos.map((g) => (
                <li key={g.id} className="cc-list__item cc-list__item--grupo">
                  <div className="cc-list__info">
                    <span className="cc-list__nombre">{g.nombre}</span>
                    <span className="cc-correo">
                      {(g.integrantes || []).length} integrante{(g.integrantes || []).length !== 1 ? 's' : ''}
                    </span>
                    {(g.integrantes || []).length > 0 && (
                      <div className="cc-chips cc-chips--sm">
                        {(g.integrantes || []).map((i) => (
                          <span key={i.correo || i.COR_PER_REF} className="cc-chip cc-chip--readonly">
                            {i.correo || i.COR_PER_REF}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="cc-list__actions">
                    <button type="button" className="cc-btn cc-btn--secondary" onClick={() => editarGrupo(g)}>
                      Editar
                    </button>
                    <button type="button" className="cc-btn cc-btn--danger" onClick={() => eliminarGrupo(g.id, g.nombre)}>
                      Eliminar
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            !mostrarFormGrupo && <p className="cc-empty">No tienes grupos de confianza. Crea uno arriba.</p>
          )}
        </div>
      )}
    </section>
  );
};

export default ContactosConfianza;
