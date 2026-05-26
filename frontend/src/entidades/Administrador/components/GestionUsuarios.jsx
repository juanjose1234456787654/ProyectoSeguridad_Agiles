import { useCallback, useEffect, useState } from 'react';
import { getUsuarios, updateUsuario, bloquearUsuario, deleteUsuario } from '../services/adminService';
import '../styles/GestionUsuarios.css';

const ROLES = [
  { codigo: 'ROL01', nombre: 'Administrador' },
  { codigo: 'ROL02', nombre: 'Guardia' },
  { codigo: 'ROL03', nombre: 'Estudiante' },
  { codigo: 'ROL04', nombre: 'Docente' },
  { codigo: 'ROL05', nombre: 'Personal' }
];

const GestionUsuarios = () => {
  const [usuarios, setUsuarios] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [editando, setEditando] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState('');

  const cargar = useCallback(async () => {
    setCargando(true);
    setError('');
    try {
      const data = await getUsuarios();
      setUsuarios(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Error al cargar usuarios');
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const mostrarAviso = (msg) => {
    setAviso(msg);
    setTimeout(() => setAviso(''), 3500);
  };

  const iniciarEdicion = (u) => setEditando({ id: u.id, email: u.email, rolCodigo: u.rolCodigo });

  const guardarEdicion = async () => {
    if (!editando) return;
    setGuardando(true);
    try {
      await updateUsuario(editando.id, { email: editando.email, rolCodigo: editando.rolCodigo });
      mostrarAviso('Usuario actualizado correctamente.');
      setEditando(null);
      await cargar();
    } catch (e) {
      mostrarAviso(`Error: ${e.message}`);
    } finally {
      setGuardando(false);
    }
  };

  const toggleBloqueo = async (u) => {
    const accion = u.bloqueado ? 'desbloquear' : 'bloquear';
    if (!window.confirm(`¿Deseas ${accion} al usuario ${u.nombre || u.email}?`)) return;
    try {
      await bloquearUsuario(u.id, !u.bloqueado);
      mostrarAviso(`Usuario ${u.bloqueado ? 'desbloqueado' : 'bloqueado'} correctamente.`);
      await cargar();
    } catch (e) {
      mostrarAviso(`Error: ${e.message}`);
    }
  };

  const eliminarUsuario = async (u) => {
    if (!window.confirm(`¿Eliminar al usuario ${u.nombre || u.email}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteUsuario(u.id);
      mostrarAviso('Usuario eliminado correctamente.');
      await cargar();
    } catch (e) {
      mostrarAviso(`Error: ${e.message}`);
    }
  };

  const filtrados = usuarios.filter(u => {
    const q = busqueda.toLowerCase();
    return (
      u.email?.toLowerCase().includes(q) ||
      u.nombre?.toLowerCase().includes(q) ||
      u.rol?.toLowerCase().includes(q)
    );
  });

  const renderConfianza = (u) => {
    const items = [];
    (u.contactos || []).forEach(c => items.push(c.alias || c.email));
    (u.grupos || []).forEach(g => items.push(`Grupo: ${g.nombre}`));
    if (items.length === 0) return <span className="gu-sin-confianza">Sin asignar</span>;
    return <span className="gu-confianza-lista">{items.join(', ')}</span>;
  };

  return (
    <div className="gu-root">
      <div className="gu-header">
        <h2 className="gu-title">Gestión de Usuarios</h2>
        <button className="gu-btn-refresh" onClick={cargar} title="Recargar">↻</button>
      </div>

      {aviso && <div className="gu-aviso">{aviso}</div>}
      {error && <div className="gu-error">{error} <button onClick={cargar}>Reintentar</button></div>}

      <input
        className="gu-busqueda"
        type="text"
        placeholder="Buscar por email, nombre o rol…"
        value={busqueda}
        onChange={e => setBusqueda(e.target.value)}
      />

      {cargando ? (
        <p className="gu-loading">Cargando usuarios…</p>
      ) : (
        <div className="gu-lista">
          {filtrados.length === 0 ? (
            <p className="gu-vacio">No se encontraron usuarios.</p>
          ) : (
            filtrados.map(u => (
              <div key={u.id} className={`gu-fila ${u.bloqueado ? 'gu-fila--bloqueado' : ''}`}>
                <div className="gu-fila__info">
                  <div className="gu-fila__avatar">
                    {(u.nombre || u.email || '?')[0].toUpperCase()}
                  </div>
                  <div className="gu-fila__datos">
                    <p className="gu-fila__nombre">{u.nombre || '(sin nombre)'}</p>
                    <p className="gu-fila__email">{u.email}</p>
                    <span className={`gu-rol gu-rol--${u.rol?.toLowerCase()}`}>{u.rol}</span>
                    {u.bloqueado && <span className="gu-bloqueado-tag">🔒 Bloqueado</span>}
                    <div className="gu-fila__confianza">
                      <span className="gu-confianza-label">Confianza:</span> {renderConfianza(u)}
                    </div>
                  </div>
                </div>

                <div className="gu-fila__acciones">
                  <button
                    className="gu-btn gu-btn--editar"
                    onClick={() => iniciarEdicion(u)}
                    title="Editar usuario"
                  >
                    ✏️ Editar
                  </button>
                  <button
                    className={`gu-btn ${u.bloqueado ? 'gu-btn--desbloquear' : 'gu-btn--bloquear'}`}
                    onClick={() => toggleBloqueo(u)}
                  >
                    {u.bloqueado ? '🔓 Desbloquear' : '🔒 Bloquear'}
                  </button>
                  <button
                    className="gu-btn gu-btn--eliminar"
                    onClick={() => eliminarUsuario(u)}
                    title="Eliminar usuario"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {editando && (
        <div className="gu-modal-overlay" onClick={() => setEditando(null)}>
          <div className="gu-modal" onClick={e => e.stopPropagation()}>
            <h3 className="gu-modal__title">Editar Usuario</h3>
            <label className="gu-modal__label">
              Email institucional
              <input
                className="gu-modal__input"
                type="email"
                value={editando.email}
                onChange={e => setEditando(prev => ({ ...prev, email: e.target.value }))}
              />
            </label>
            <label className="gu-modal__label">
              Rol
              <select
                className="gu-modal__input"
                value={editando.rolCodigo || ''}
                onChange={e => setEditando(prev => ({ ...prev, rolCodigo: e.target.value }))}
              >
                <option value="">— Seleccionar —</option>
                {ROLES.map(r => (
                  <option key={r.codigo} value={r.codigo}>{r.nombre}</option>
                ))}
              </select>
            </label>
            <div className="gu-modal__botones">
              <button className="gu-btn gu-btn--cancelar" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button
                className="gu-btn gu-btn--guardar"
                onClick={guardarEdicion}
                disabled={guardando}
              >
                {guardando ? 'Guardando…' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GestionUsuarios;
