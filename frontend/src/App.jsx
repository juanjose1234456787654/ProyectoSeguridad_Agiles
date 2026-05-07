import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './components/Login';
import PrivateRoute from './utils/PrivateRoute';
import DashboardEstudiante from './pages/DashboardEstudiante';
import DashboardGuardia from './pages/DashboardGuardia';
import DashboardAdmin from './pages/DashboardAdmin';
import Unauthorized from './pages/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          <Route path="/estudiante" element={
            <PrivateRoute allowedRoles={['Estudiante', 'Docente', 'Personal']}>
              <DashboardEstudiante />
            </PrivateRoute>
          } />
          <Route path="/guardia" element={
            <PrivateRoute allowedRoles={['Guardia']}>
              <DashboardGuardia />
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute allowedRoles={['Administrador']}>
              <DashboardAdmin />
            </PrivateRoute>
          } />
          
          <Route path="/" element={<Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;