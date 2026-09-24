import { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import httpClient from '../api/httpClient';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setCargando(true);

    try {
      const res = await httpClient.post('/auth/login', { email, password });
      
      // Estructuramos el objeto usuario con los datos reales que devuelve tu API C#
      const usuario = {
        email: email,
        rol: res.data.rol,
        tiendaId: res.data.tiendaId
      };

      // Iniciamos sesión pasando el usuario y el token
      login(usuario, res.data.token, res.data.token);
    } catch (err) {
      // Capturamos el mensaje de error exacto devuelto por C# (o un mensaje genérico)
      const msg = err.response?.data?.message || err.response?.data?.mensaje || 'Error al iniciar sesión. Verifica tus credenciales.';
      setError(msg);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: '380px', margin: '80px auto', padding: '25px', border: '1px solid #cbd5e1', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px', color: '#0f172a' }}>Sistema de Gestión TI</h2>
      {error && <div style={{ color: '#dc2626', background: '#fef2f2', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '14px' }}>{error}</div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Correo Electrónico:</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #94a3b8', boxSizing: 'border-box' }} 
          />
        </div>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontSize: '14px' }}>Contraseña:</label>
          <input 
            type="password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #94a3b8', boxSizing: 'border-box' }} 
          />
        </div>
        <button 
          type="submit" 
          disabled={cargando}
          style={{ width: '100%', padding: '10px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
        >
          {cargando ? 'Cargando...' : 'Ingresar'}
        </button>
      </form>
    </div>
  );
}