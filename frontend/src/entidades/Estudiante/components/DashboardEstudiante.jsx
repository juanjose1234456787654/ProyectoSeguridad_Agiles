import AlertasUsuario from '../../Guardia/components/AlertasUsuario';
import '../styles/DashboardEstudiante.css';

const DashboardEstudiante = () => {
  return (
    <section className="dashboard-estudiante">
      <h1 className="dashboard-estudiante__title">Panel del Estudiante</h1>
      <AlertasUsuario />
    </section>
  );
};

export default DashboardEstudiante;