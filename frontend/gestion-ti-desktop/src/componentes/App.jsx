import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Navbar from './componentes/Navbar';
import Login from './pages/Login';
import FormatoIngreso from './pages/FormatoIngreso';
import FormatoSalida from './pages/FormatoSalida';
import AlertasInsumos from './pages/AlertasInsumos';
import Inventario from './pages/Inventario';
import Reparaciones from './pages/Reparaciones';
import Usuarios from './pages/Usuarios';

function RutaProtegida({ children }) {
  const { usuario } = useAuth();
  return usuario ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/inventario" element={<RutaProtegida><Inventario /></RutaProtegida>} />
          <Route path="/reparaciones" element={<RutaProtegida><Reparaciones /></RutaProtegida>} />
          <Route path="/ingreso" element={<RutaProtegida><FormatoIngreso /></RutaProtegida>} />
          <Route path="/salida" element={<RutaProtegida><FormatoSalida /></RutaProtegida>} />
          <Route path="/alertas" element={<RutaProtegida><AlertasInsumos /></RutaProtegida>} />
          <Route path="/usuarios" element={<RutaProtegida><Usuarios /></RutaProtegida>} />
          <Route path="*" element={<Navigate to="/inventario" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}