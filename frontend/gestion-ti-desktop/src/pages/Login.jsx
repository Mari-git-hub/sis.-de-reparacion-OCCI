
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import httpClient from '../api/httpClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const { login, usuario } = useAuth();
  const navigate = useNavigate();

  // Si ya inició sesión, no necesita volver a ver el login.
  if (usuario) {
    return <Navigate to="/inventario" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await httpClient.post('/auth/login', {
        email: email.trim(),
        password
      });

      if (!res.data?.token) {
        throw new Error('La API no devolvió el token de acceso.');
      }

      const usuarioAutenticado = {
        email: email.trim(),
        rol: res.data.rol,
        tiendaId: res.data.tiendaId
      };

      // Guardar la sesión y el token.
      login(
        usuarioAutenticado,
        res.data.token,
        res.data.refreshToken
      );

      // Ir al inventario  para los roles admin y tecnico.
      const destino =
        usuarioAutenticado.rol === 'Solicitante'
        ? '/ingreso'
        : '/inventario';

navigate(destino, { replace: true });
    } catch (err) {
      const mensaje =
        err.response?.data?.message ||
        err.response?.data?.mensaje ||
        err.message ||
        'Error al iniciar sesión. Verifica tus credenciales.';

      setError(mensaje);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div
      style={{
        maxWidth: '380px',
        margin: '80px auto',
        padding: '25px',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)',
        background: '#ffffff'
      }}
    >
      <h2
        style={{
          textAlign: 'center',
          marginBottom: '20px',
          color: '#0f172a'
        }}
      >
        Sistema de Gestión TI
      </h2>

      {error && (
        <div
          role="alert"
          style={{
            color: '#dc2626',
            background: '#fef2f2',
            padding: '10px',
            borderRadius: '4px',
            marginBottom: '15px',
            fontSize: '14px'
          }}
        >
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label
            htmlFor="correo"
            style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px'
            }}
          >
            Correo electrónico:
          </label>

          <input
            id="correo"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={cargando}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #94a3b8',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label
            htmlFor="contrasena"
            style={{
              display: 'block',
              marginBottom: '5px',
              fontSize: '14px'
            }}
          >
            Contraseña:
          </label>

          <input
            id="contrasena"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={cargando}
            style={{
              width: '100%',
              padding: '8px',
              borderRadius: '4px',
              border: '1px solid #94a3b8',
              boxSizing: 'border-box'
            }}
          />
        </div>

        <button
          type="submit"
          disabled={cargando}
          style={{
            width: '100%',
            padding: '10px',
            background: cargando ? '#94a3b8' : '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: cargando ? 'wait' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {cargando ? 'Ingresando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}
