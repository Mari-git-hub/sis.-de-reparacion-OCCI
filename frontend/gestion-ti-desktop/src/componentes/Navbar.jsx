import { Link } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';

export default function Navbar() {
  const { usuario, logout } = useAuth();

  if (!usuario) return null;

  return (
    <nav style={{ padding: '12px 20px', background: '#1e293b', color: '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <strong style={{ fontSize: '18px' }}>Gestión IT Multi-Tienda</strong> 
        <span style={{ marginLeft: '15px', background: '#334155', padding: '4px 8px', borderRadius: '4px', fontSize: '12px' }}>
          {usuario.nombreCompleto || usuario.email} ({usuario.rol || 'Usuario'})
        </span>
      </div>
      <div style={{ display: 'flex', gap: '15px', alignItems: 'center' }}>
        <Link to="/inventario" style={{ color: '#93c5fd', textDecoration: 'none' }}>Inventario</Link>
        <Link to="/reparaciones" style={{ color: '#93c5fd', textDecoration: 'none' }}>Ordenes</Link>
        <Link to="/ingreso" style={{ color: '#93c5fd', textDecoration: 'none' }}>Formato Ingreso</Link>
        <Link to="/salida" style={{ color: '#93c5fd', textDecoration: 'none' }}>Formato Salida</Link>
        <Link to="/alertas" style={{ color: '#93c5fd', textDecoration: 'none' }}>Alertas Insumos</Link>
        <Link to="/reportes" style={{ color: '#93c5fd', textDecoration: 'none' }}>Reportes</Link>
        <button 
          onClick={logout} 
          style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer' }}
        >
          Cerrar Sesión
        </button>
      </div>
    </nav>
  );
}
