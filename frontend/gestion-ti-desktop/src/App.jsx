
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
import Usuarios from './pages/Usuario';

import RegistrarInsumo from './pages/RegistrarInsumo';
import RegistrarEquipo from './pages/RegistrarEquipo';

import './App.css';

const ROL_SOLICITANTE = 'Solicitante';
const ROLES_TECNICOS = ['Admin IT', 'Técnico IT'];

function obtenerInicio(usuario) {
  if (!usuario) return '/login';

  return usuario.rol === ROL_SOLICITANTE
    ? '/ingreso'
    : '/inventario';
}

function RutaProtegida({ children, roles = null }) {
  const { usuario } = useAuth();

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  // El solicitante solo puede entrar a Ingreso y Alertas.
  if (
    usuario.rol === ROL_SOLICITANTE &&
    !['/ingreso', '/alertas'].includes(
      window.location.pathname
    )
  ) {
    return <Navigate to="/ingreso" replace />;
  }

  if (roles && !roles.includes(usuario.rol)) {
    return (
      <Navigate
        to={obtenerInicio(usuario)}
        replace
      />
    );
  }

  return children;
}

function Inicio() {
  const { usuario } = useAuth();

  return (
    <Navigate
      to={obtenerInicio(usuario)}
      replace
    />
  );
}

function AplicacionRutas() {
  const { usuario } = useAuth();

  return (
    <>
      <Navbar />

      <main className="contenido-principal">
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route
            path="/inventario"
            element={
              <RutaProtegida roles={ROLES_TECNICOS}>
                <Inventario />
              </RutaProtegida>
            }
          />

          <Route
            path="/inventario/registrar-insumo"
            element={
              <RutaProtegida roles={ROLES_TECNICOS}>
                <RegistrarInsumo />
              </RutaProtegida>
            }
          />

          <Route
            path="/inventario/registrar-equipo"
            element={
              <RutaProtegida roles={ROLES_TECNICOS}>
                <RegistrarEquipo />
              </RutaProtegida>
            }
          />

          <Route
            path="/reparaciones"
            element={
              <RutaProtegida roles={ROLES_TECNICOS}>
                <Reparaciones />
              </RutaProtegida>
            }
          />

          <Route
            path="/ingreso"
            element={
              <RutaProtegida>
                <FormatoIngreso />
              </RutaProtegida>
            }
          />

          <Route
            path="/salida"
            element={
              <RutaProtegida roles={ROLES_TECNICOS}>
                <FormatoSalida />
              </RutaProtegida>
            }
          />

          <Route
            path="/alertas"
            element={
              <RutaProtegida>
                <AlertasInsumos />
              </RutaProtegida>
            }
          />

          <Route
            path="/reportes"
            element={
              <RutaProtegida roles={ROLES_TECNICOS}>
                <ReportesFormatos />
              </RutaProtegida>
            }
          />

          <Route
            path="/usuarios"
            element={
              <RutaProtegida roles={['Admin IT']}>
                <Usuarios />
              </RutaProtegida>
            }
          />

          <Route path="/" element={<Inicio />} />

          <Route
            path="*"
            element={
              <Navigate
                to={obtenerInicio(usuario)}
                replace
              />
            }
          />
        </Routes>
      </main>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AplicacionRutas />
      </BrowserRouter>
    </AuthProvider>
  );
}
