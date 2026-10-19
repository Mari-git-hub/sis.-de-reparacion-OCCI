import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Navbar() {
  const { usuario, logout } = useAuth();

  if (!usuario) {
    return null;
  }

  const rol = (usuario.rol || '').trim();
  const esAdmin = rol === 'Admin IT';
  const esTecnico = rol === 'Técnico IT';
  const esSolicitante = rol === 'Solicitante';
  const puedeGestionar = esAdmin || esTecnico;

  const estiloEnlace = {
    color: '#ffffff',
    textDecoration: 'none',
    padding: '8px',
    borderRadius: '4px'
  };

  return (
    <nav
      style={{
        padding: '14px 20px',
        background: '#1e293b',
        color: '#ffffff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px'
      }}
    >
      <div>
        <strong style={{ fontSize: '18px' }}>
          Gestión IT Multi-Tienda
        </strong>

        <div style={{ fontSize: '12px', marginTop: '5px' }}>
          {usuario.nombreCompleto || usuario.email || 'Usuario'} — {rol}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px'
        }}
      >
        {puedeGestionar && (
          <>
            <Link to="/inventario" style={estiloEnlace}>
              Inventario
            </Link>

            <Link to="/reparaciones" style={estiloEnlace}>
              Órdenes
            </Link>

            <Link to="/reportes" style={estiloEnlace}>
              Reportes
            </Link>
          </>
        )}

        {esAdmin && (
          <Link to="/usuarios" style={estiloEnlace}>
            Usuarios
          </Link>
        )}

        {(esSolicitante || puedeGestionar) && (
          <Link to="/ingreso" style={estiloEnlace}>
            Formato de ingreso
          </Link>
        )}

        {puedeGestionar && (
          <Link to="/salida" style={estiloEnlace}>
            Formato de salida
          </Link>
        )}

        <Link to="/alertas" style={estiloEnlace}>
          Alertas y avance
        </Link>

        <button
          type="button"
          onClick={logout}
          style={{
            background: '#dc2626',
            color: '#ffffff',
            border: 'none',
            padding: '9px 12px',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </nav>
  );
}
