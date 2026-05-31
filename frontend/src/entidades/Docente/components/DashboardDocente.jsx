import { useRef, useState } from 'react';
import AlertasUsuario from '../../Guardia/components/AlertasUsuario';
import ContactosConfianza from '../../Guardia/components/ContactosConfianza';
import '../styles/DashboardDocente.css';

const MENU_OPCIONES = [
  { id: 'alertas', label: 'Alertas Activas' },
  { id: 'contactos', label: 'Contactos de Confianza' }
];

const DashboardDocente = () => {
  const [seccion, setSeccion] = useState('alertas');
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef(null);

  const cerrarMenuAlClickFuera = (e) => {
    if (menuRef.current && !menuRef.current.contains(e.target)) setMenuAbierto(false);
  };

  return (
    <section className="dashboard-docente" onClick={cerrarMenuAlClickFuera}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="dashboard-docente__title" style={{ margin: 0 }}>Panel del Docente</h1>

        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuAbierto(v => !v); }}
            style={{
              padding: '0.5rem 1rem',
              background: menuAbierto ? '#21335b' : '#f1f5f9',
              color: menuAbierto ? '#fff' : '#21335b',
              border: '1px solid #21335b',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}
          >
            Menu {menuAbierto ? '▲' : '▼'}
          </button>
          {menuAbierto && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              right: 0,
              background: '#fff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
              minWidth: '210px',
              zIndex: 200,
              overflow: 'hidden'
            }}>
              {MENU_OPCIONES.map(op => (
                <button
                  key={op.id}
                  onClick={() => { setSeccion(op.id); setMenuAbierto(false); }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.6rem',
                    width: '100%',
                    padding: '0.7rem 1rem',
                    border: 'none',
                    background: seccion === op.id ? '#eff6ff' : '#fff',
                    color: seccion === op.id ? '#1d4ed8' : '#374151',
                    fontWeight: seccion === op.id ? '700' : '400',
                    cursor: 'pointer',
                    fontSize: '0.9rem',
                    textAlign: 'left',
                    borderBottom: '1px solid #f1f5f9'
                  }}
                >
                  {op.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {seccion === 'alertas'   && <AlertasUsuario />}
      {seccion === 'contactos' && <ContactosConfianza />}
    </section>
  );
};

export default DashboardDocente;