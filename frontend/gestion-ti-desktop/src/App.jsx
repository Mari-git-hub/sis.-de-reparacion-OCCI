import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth/AuthContext';
import Navbar from './componentes/Navbar';
import Login from './pages/Login';
import FormatoIngreso from './pages/FormatoIngreso';
import FormatoSalida from './pages/FormatoSalida';
import AlertasInsumos from './pages/AlertaInsumos';
import Inventario from './pages/Inventario';
import Reparaciones from './pages/Reparaciones';
import Tableros from './pages/Tableros';
import './App.css';

// Componente para proteger las rutas privadas
function RutaProtegida({ children }) {
  const auth = useAuth();
  const usuario = auth ? auth.usuario : null;

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <main style={{ padding: '20px' }}>
          <Routes>
            {/* Ruta pública */}
            <Route path="/login" element={<Login />} />

            {/* Rutas protegidas */}
            <Route 
              path="/inventario" 
              element={<RutaProtegida><Inventario /></RutaProtegida>} 
            />
            <Route 
              path="/reparaciones" 
              element={<RutaProtegida><Reparaciones /></RutaProtegida>} 
            />
            <Route 
              path="/ingreso" 
              element={<RutaProtegida><FormatoIngreso /></RutaProtegida>} 
            />
            <Route 
              path="/salida" 
              element={<RutaProtegida><FormatoSalida /></RutaProtegida>} 
            />
            <Route 
              path="/alertas" 
              element={<RutaProtegida><AlertasInsumos /></RutaProtegida>} 
            />
            <Route 
              path="/reportes" 
              element={<RutaProtegida><Tableros /></RutaProtegida>} 
            />

            {/* Redirección por defecto */}
            <Route path="/" element={<Navigate to="/inventario" replace />} />
            <Route path="*" element={<Navigate to="/inventario" replace />} />
          </Routes>
        </main>
      </BrowserRouter>
    </AuthProvider>
  );
}