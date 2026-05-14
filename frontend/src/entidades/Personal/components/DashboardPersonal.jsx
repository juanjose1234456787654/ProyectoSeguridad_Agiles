import AlertasUsuario from '../../Guardia/components/AlertasUsuario';
import '../styles/DashboardPersonal.css';

const DashboardPersonal = () => {
  return (
    <section className="dashboard-personal">
      <h1 className="dashboard-personal__title">Panel de Personal</h1>
      <AlertasUsuario />
    </section>
  );
};

export default DashboardPersonal;