import { Link } from 'react-router-dom';

const Unauthorized = () => {
  return (
    <div style={{ textAlign: 'center', marginTop: '50px' }}>
      <h1>Acceso No Autorizado</h1>
      <p>No tienes permiso para ver esta pagina.</p>
      <Link to="/login">Volver al inicio de sesion</Link>
    </div>
  );
};

export default Unauthorized;
