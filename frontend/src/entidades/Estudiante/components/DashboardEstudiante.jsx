import AlertasUsuario from '../../Guardia/components/AlertasUsuario';
import ContactosConfianza from '../../Guardia/components/ContactosConfianza';
import '../styles/DashboardEstudiante.css';

const DashboardEstudiante = () => {
  return (
    <section className="dashboard-estudiante">
      <h1 className="dashboard-estudiante__title">Panel del Estudiante</h1>
      <AlertasUsuario />
      <ContactosConfianza />
    </section>
  );
};

export default DashboardEstudiante;