import {
  BrowserRouter,
  Routes,
  Route,
  Navigate
} from 'react-router-dom';

import {
  AuthProvider,
  useAuth
} from './auth/AuthContext';

import Navbar from './componentes/Navbar';

import Login from './pages/Login';
import FormatoIngreso from './pages/FormatoIngreso';
import FormatoSalida from './pages/FormatoSalida';
import AlertasInsumos from './pages/AlertaInsumos';
import Inventario from './pages/Inventario';
import Reparaciones from './pages/Reparaciones';
import Tableros from './pages/Tableros';
import Usuarios from './pages/Usuario';

import './App.css';


// ============================================================
// RUTA PROTEGIDA
// ============================================================
function RutaProtegida({ children, roles = null }) {
  const auth = useAuth();

  const usuario = auth?.usuario;

  // Si no hay usuario autenticado
  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Si la ruta tiene roles permitidos,
  // comprobar que el usuario tenga uno de ellos.
  if (
    roles &&
    roles.length > 0 &&
    !roles.includes(usuario.rol)
  ) {
    return (
      <Navigate
        to="/inventario"
        replace
      />
    );
  }

  return children;
}


// ============================================================
// APP PRINCIPAL
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>

        {/* BARRA DE NAVEGACIÓN */}
        <Navbar />

        <main
          style={{
            padding: '20px'
          }}
        >
          <Routes>

            {/* ==================================================
                RUTA PÚBLICA
            ================================================== */}
            <Route
              path="/login"
              element={<Login />}
            />


            {/* ==================================================
                INVENTARIO
            ================================================== */}
            <Route
              path="/inventario"
              element={
                <RutaProtegida>
                  <Inventario />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                REPARACIONES
            ================================================== */}
            <Route
              path="/reparaciones"
              element={
                <RutaProtegida>
                  <Reparaciones />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                FORMATO DE INGRESO
            ================================================== */}
            <Route
              path="/ingreso"
              element={
                <RutaProtegida>
                  <FormatoIngreso />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                FORMATO DE SALIDA
            ================================================== */}
            <Route
              path="/salida"
              element={
                <RutaProtegida>
                  <FormatoSalida />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                ALERTAS
            ================================================== */}
            <Route
              path="/alertas"
              element={
                <RutaProtegida>
                  <AlertasInsumos />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                REPORTES
            ================================================== */}
            <Route
              path="/reportes"
              element={
                <RutaProtegida>
                  <Tableros />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                USUARIOS
                SOLO ADMIN IT
            ================================================== */}
            <Route
              path="/usuarios"
              element={
                <RutaProtegida
                  roles={['Admin IT']}
                >
                  <Usuarios />
                </RutaProtegida>
              }
            />


            {/* ==================================================
                RUTA PRINCIPAL
            ================================================== */}
            <Route
              path="/"
              element={
                <Navigate
                  to="/inventario"
                  replace
                />
              }
            />


            {/* ==================================================
                RUTAS NO EXISTENTES
            ================================================== */}
            <Route
              path="*"
              element={
                <Navigate
                  to="/inventario"
                  replace
                />
              }
            />

          </Routes>
        </main>

      </BrowserRouter>
    </AuthProvider>
  );
}