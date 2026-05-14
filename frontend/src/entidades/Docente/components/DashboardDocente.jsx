import AlertasUsuario from '../../Guardia/components/AlertasUsuario';
import '../styles/DashboardDocente.css';

const DashboardDocente = () => {
  return (
    <section className="dashboard-docente">
      <h1 className="dashboard-docente__title">Panel del Docente</h1>
      <AlertasUsuario />
    </section>
  );
};

export default DashboardDocente;