import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Login from './auth/login/Login';
import PrivateRoute from './utils/PrivateRoute';
import DashboardEstudiante from './entidades/Estudiante/components/DashboardEstudiante';
import DashboardDocente from './entidades/Docente/components/DashboardDocente';
import DashboardPersonal from './entidades/Personal/components/DashboardPersonal';
import DashboardGuardia from './entidades/Guardia/components/DashboardGuardia';
import CerrarReporteGuardia from './entidades/Guardia/components/CerrarReporteGuardia';
import AlertasUsuario from './entidades/Guardia/components/AlertasUsuario';
import DashboardAdmin from './entidades/Administrador/components/DashboardAdmin';
import Unauthorized from './auth/Unauthorized';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          
          <Route path="/estudiante" element={
            <PrivateRoute allowedRoles={['Estudiante']}>
              <DashboardEstudiante />
            </PrivateRoute>
          } />
          <Route path="/docente" element={
            <PrivateRoute allowedRoles={['Docente']}>
              <DashboardDocente />
            </PrivateRoute>
          } />
          <Route path="/personal" element={
            <PrivateRoute allowedRoles={['Personal']}>
              <DashboardPersonal />
            </PrivateRoute>
          } />
          <Route path="/guardia" element={
            <PrivateRoute allowedRoles={['Guardia']}>
              <DashboardGuardia />
            </PrivateRoute>
          } />
          <Route path="/alertas" element={
            <PrivateRoute allowedRoles={['Guardia', 'Estudiante', 'Docente', 'Personal']}>
              <AlertasUsuario />
            </PrivateRoute>
          } />
          <Route path="/guardia/cerrar/:idIncidente" element={
            <PrivateRoute allowedRoles={['Guardia']}>
              <CerrarReporteGuardia />
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