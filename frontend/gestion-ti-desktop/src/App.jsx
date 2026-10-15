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
import ReportesFormatos from './pages/ReportesFormatos';
//import Tableros from './pages/Tableros';
import Usuarios from './pages/Usuario';

// NUEVOS FORMULARIOS DE REGISTRO
import RegistrarInsumo from './pages/RegistrarInsumo';
import RegistrarEquipo from './pages/RegistrarEquipo';

import './App.css';


// ============================================================
// RUTA PROTEGIDA
// ============================================================
function RutaProtegida({ children, roles = null }) {
  const auth = useAuth();
  const usuario = auth?.usuario;

  // Comprobar si el usuario inició sesión
  if (!usuario) {
    return (
      <Navigate
        to="/login"
        replace
      />
    );
  }

  // Comprobar los permisos por rol
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
// APLICACIÓN PRINCIPAL
// ============================================================
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>

        <Navbar />

        <main className="contenido-principal">
          <Routes>

            {/* ================================================
                INICIO DE SESIÓN
            ================================================ */}
            <Route
              path="/login"
              element={<Login />}
            />

            {/* ================================================
                INVENTARIO GENERAL
            ================================================ */}
            <Route
              path="/inventario"
              element={
                <RutaProtegida>
                  <Inventario />
                </RutaProtegida>
              }
            />

            {/* ================================================
                NUEVO: REGISTRAR INSUMO
            ================================================ */}
            <Route
              path="/inventario/registrar-insumo"
              element={
                <RutaProtegida>
                  <RegistrarInsumo />
                </RutaProtegida>
              }
            />

            {/* ================================================
                NUEVO: REGISTRAR EQUIPO
            ================================================ */}
            <Route
              path="/inventario/registrar-equipo"
              element={
                <RutaProtegida>
                  <RegistrarEquipo />
                </RutaProtegida>
              }
            />

            {/* ================================================
                REPARACIONES
            ================================================ */}
            <Route
              path="/reparaciones"
              element={
                <RutaProtegida>
                  <Reparaciones />
                </RutaProtegida>
              }
            />

            {/* ================================================
                FORMATO DE INGRESO EXISTENTE
            ================================================ */}
            <Route
              path="/ingreso"
              element={
                <RutaProtegida>
                  <FormatoIngreso />
                </RutaProtegida>
              }
            />

            {/* ================================================
                FORMATO DE SALIDA EXISTENTE
            ================================================ */}
            <Route
              path="/salida"
              element={
                <RutaProtegida>
                  <FormatoSalida />
                </RutaProtegida>
              }
            />

            {/* ================================================
                ALERTAS DE INSUMOS
            ================================================ */}
            <Route
              path="/alertas"
              element={
                <RutaProtegida>
                  <AlertasInsumos />
                </RutaProtegida>
              }
            />

            {/* ================================================
                REPORTES
            ================================================ */}
            <Route
              path="/reportes"
              element={
                <RutaProtegida>
                  <ReportesFormatos />
                </RutaProtegida>
              }
            />

            {/* ================================================
                ADMINISTRACIÓN DE USUARIOS
                SOLO ADMIN IT
            ================================================ */}
            <Route
              path="/usuarios"
              element={
                <RutaProtegida roles={['Admin IT']}>
                  <Usuarios />
                </RutaProtegida>
              }
            />

            {/* ================================================
                RUTA INICIAL
            ================================================ */}
            <Route
              path="/"
              element={
                <Navigate
                  to="/inventario"
                  replace
                />
              }
            />

            {/* ================================================
                RUTAS NO ENCONTRADAS
            ================================================ */}
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