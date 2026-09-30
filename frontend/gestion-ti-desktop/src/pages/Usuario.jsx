import { useCallback, useEffect, useState } from 'react';
import httpClient from '../api/httpClient';

const formularioInicial = {
  nombreCompleto: '',
  email: '',
  password: '',
  rolId: '',
  tiendaId: ''
};

export default function Usuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [tiendas, setTiendas] = useState([]);

  const [formulario, setFormulario] = useState(formularioInicial);

  const [usuarioEditando, setUsuarioEditando] = useState(null);

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cargarDatos = useCallback(async () => {
    try {
      setCargando(true);
      setError('');

      const [usuariosRes, rolesRes, tiendasRes] =
        await Promise.all([
          httpClient.get('/usuarios'),
          httpClient.get('/usuarios/roles'),
          httpClient.get('/usuarios/tiendas')
        ]);

      setUsuarios(
        Array.isArray(usuariosRes.data)
          ? usuariosRes.data
          : []
      );

      setRoles(
        Array.isArray(rolesRes.data)
          ? rolesRes.data
          : []
      );

      setTiendas(
        Array.isArray(tiendasRes.data)
          ? tiendasRes.data
          : []
      );
    } catch (err) {
      console.error('Error al cargar usuarios:', err);

      setError(
        err.response?.data?.message ||
        'No se pudieron cargar los usuarios.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const cargar = async () => {
      await cargarDatos();
    };

    cargar();
  }, [cargarDatos]);


  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    setFormulario((actual) => ({
      ...actual,
      [name]: value
    }));
  };

  const limpiarFormulario = () => {
    setFormulario(formularioInicial);
    setUsuarioEditando(null);
  };

  const guardarUsuario = async (e) => {
    e.preventDefault();

    setMensaje('');
    setError('');

    if (!formulario.nombreCompleto.trim()) {
      setError('Escribe el nombre completo.');
      return;
    }

    if (!formulario.email.trim()) {
      setError('Escribe el correo electrónico.');
      return;
    }

    if (!formulario.rolId) {
      setError('Selecciona un rol.');
      return;
    }

    const rolSeleccionado = roles.find(
      (r) => String(r.id) === String(formulario.rolId)
    );

    const esAdmin = rolSeleccionado?.nombre === 'Admin IT';

    if (!esAdmin && !formulario.tiendaId) {
      setError(
        'Los usuarios Técnico IT y Solicitante deben tener una tienda.'
      );
      return;
    }

    if (!usuarioEditando && !formulario.password) {
      setError('Escribe una contraseña.');
      return;
    }

    if (
      formulario.password &&
      formulario.password.length < 8
    ) {
      setError(
        'La contraseña debe tener al menos 8 caracteres.'
      );
      return;
    }

    try {
      setGuardando(true);

      const datos = {
        nombreCompleto: formulario.nombreCompleto,
        email: formulario.email,
        password: formulario.password || null,
        rolId: Number(formulario.rolId),
        tiendaId: formulario.tiendaId
          ? Number(formulario.tiendaId)
          : null
      };

      if (usuarioEditando) {
        await httpClient.put(
          `/usuarios/${usuarioEditando.id}`,
          {
            ...datos,
            activo: usuarioEditando.activo
          }
        );

        setMensaje('Usuario actualizado correctamente.');
      } else {
        await httpClient.post('/usuarios', datos);

        setMensaje('Usuario creado correctamente.');
      }

      limpiarFormulario();
      await cargarDatos();

    } catch (err) {
      setError(
        err.response?.data?.message ||
        'No se pudo guardar el usuario.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const editarUsuario = (usuario) => {
    setUsuarioEditando(usuario);

    setFormulario({
      nombreCompleto: usuario.nombreCompleto || '',
      email: usuario.email || '',
      password: '',
      rolId: String(usuario.rolId || ''),
      tiendaId: usuario.tiendaId
        ? String(usuario.tiendaId)
        : ''
    });

    setMensaje('');
    setError('');

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };

  const desactivarUsuario = async (usuario) => {
    if (!usuario.activo) {
      return;
    }

    const confirmar = window.confirm(
      `¿Deseas desactivar al usuario ${usuario.email}?`
    );

    if (!confirmar) {
      return;
    }

    try {
      setError('');
      setMensaje('');

      await httpClient.delete(`/usuarios/${usuario.id}`);

      setMensaje('Usuario desactivado correctamente.');

      await cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'No se pudo desactivar el usuario.'
      );
    }
  };

  const reactivarUsuario = async (usuario) => {
    try {
      setError('');
      setMensaje('');

      await httpClient.put(`/usuarios/${usuario.id}`, {
        nombreCompleto: usuario.nombreCompleto,
        email: usuario.email,
        password: null,
        rolId: usuario.rolId,
        tiendaId: usuario.tiendaId,
        activo: true
      });

      setMensaje('Usuario reactivado correctamente.');

      await cargarDatos();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        'No se pudo reactivar el usuario.'
      );
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: '30px' }}>
        <h2>Usuarios</h2>
        <p>Cargando usuarios...</p>
      </div>
    );
  }

  return (
    <div
      style={{
        maxWidth: '1200px',
        margin: '0 auto',
        padding: '20px'
      }}
    >
      <div style={{ marginBottom: '25px' }}>
        <h1 style={{ marginBottom: '5px' }}>
          Gestión de Usuarios
        </h1>

        <p style={{ color: '#64748b' }}>
          Crea y administra los usuarios del sistema,
          sus roles y tiendas.
        </p>
      </div>

      {mensaje && (
        <div
          style={{
            background: '#dcfce7',
            color: '#166534',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}
        >
          {mensaje}
        </div>
      )}

      {error && (
        <div
          style={{
            background: '#fee2e2',
            color: '#991b1b',
            padding: '12px',
            borderRadius: '8px',
            marginBottom: '15px'
          }}
        >
          {error}
        </div>
      )}

      {/* FORMULARIO */}

      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '25px',
          marginBottom: '30px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)'
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          {usuarioEditando
            ? 'Editar usuario'
            : 'Crear nuevo usuario'}
        </h2>

        <form onSubmit={guardarUsuario}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '18px'
            }}
          >
            <div>
              <label>Nombre completo</label>

              <input
                name="nombreCompleto"
                value={formulario.nombreCompleto}
                onChange={cambiarCampo}
                placeholder="Ej. Juan Pérez"
                required
                style={estiloInput}
              />
            </div>

            <div>
              <label>Correo electrónico</label>

              <input
                type="email"
                name="email"
                value={formulario.email}
                onChange={cambiarCampo}
                placeholder="usuario@empresa.com"
                required
                style={estiloInput}
              />
            </div>

            <div>
              <label>Rol</label>

              <select
                name="rolId"
                value={formulario.rolId}
                onChange={cambiarCampo}
                required
                style={estiloInput}
              >
                <option value="">
                  Seleccionar rol
                </option>

                {roles.map((rol) => (
                  <option
                    key={rol.id}
                    value={rol.id}
                  >
                    {rol.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Tienda</label>

              <select
                name="tiendaId"
                value={formulario.tiendaId}
                onChange={cambiarCampo}
                style={estiloInput}
              >
                <option value="">
                  Sin tienda
                </option>

                {tiendas.map((tienda) => (
                  <option
                    key={tienda.id}
                    value={tienda.id}
                  >
                    {tienda.codigo} - {tienda.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>
                {usuarioEditando
                  ? 'Nueva contraseña (opcional)'
                  : 'Contraseña'}
              </label>

              <input
                type="password"
                name="password"
                value={formulario.password}
                onChange={cambiarCampo}
                placeholder="Mínimo 8 caracteres"
                style={estiloInput}
              />
            </div>
          </div>

          <div
            style={{
              marginTop: '20px',
              display: 'flex',
              gap: '10px'
            }}
          >
            <button
              type="submit"
              disabled={guardando}
              style={botonPrincipal}
            >
              {guardando
                ? 'Guardando...'
                : usuarioEditando
                  ? 'Guardar cambios'
                  : 'Crear usuario'}
            </button>

            {usuarioEditando && (
              <button
                type="button"
                onClick={limpiarFormulario}
                style={botonSecundario}
              >
                Cancelar edición
              </button>
            )}
          </div>
        </form>
      </div>

      {/* TABLA */}

      <div
        style={{
          background: '#fff',
          border: '1px solid #e2e8f0',
          borderRadius: '12px',
          padding: '25px',
          boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
          overflowX: 'auto'
        }}
      >
        <h2 style={{ marginTop: 0 }}>
          Usuarios registrados
        </h2>

        <table
          style={{
            width: '100%',
            borderCollapse: 'collapse'
          }}
        >
          <thead>
            <tr>
              <th style={estiloTh}>Nombre</th>
              <th style={estiloTh}>Correo</th>
              <th style={estiloTh}>Rol</th>
              <th style={estiloTh}>Tienda</th>
              <th style={estiloTh}>Estado</th>
              <th style={estiloTh}>Acciones</th>
            </tr>
          </thead>

          <tbody>
            {usuarios.map((usuario) => (
              <tr key={usuario.id}>
                <td style={estiloTd}>
                  {usuario.nombreCompleto}
                </td>

                <td style={estiloTd}>
                  {usuario.email}
                </td>

                <td style={estiloTd}>
                  {usuario.rol}
                </td>

                <td style={estiloTd}>
                  {usuario.tienda || '—'}
                </td>

                <td style={estiloTd}>
                  <span
                    style={{
                      padding: '5px 9px',
                      borderRadius: '20px',
                      background: usuario.activo
                        ? '#dcfce7'
                        : '#fee2e2',
                      color: usuario.activo
                        ? '#166534'
                        : '#991b1b'
                    }}
                  >
                    {usuario.activo
                      ? 'Activo'
                      : 'Inactivo'}
                  </span>
                </td>

                <td style={estiloTd}>
                  <div
                    style={{
                      display: 'flex',
                      gap: '8px',
                      flexWrap: 'wrap'
                    }}
                  >
                    <button
                      onClick={() =>
                        editarUsuario(usuario)
                      }
                      style={botonEditar}
                    >
                      Editar
                    </button>

                    {usuario.activo ? (
                      <button
                        onClick={() =>
                          desactivarUsuario(usuario)
                        }
                        style={botonEliminar}
                      >
                        Desactivar
                      </button>
                    ) : (
                      <button
                        onClick={() =>
                          reactivarUsuario(usuario)
                        }
                        style={botonReactivar}
                      >
                        Reactivar
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {usuarios.length === 0 && (
          <p style={{ color: '#64748b' }}>
            No hay usuarios registrados.
          </p>
        )}
      </div>
    </div>
  );
}

const estiloInput = {
  width: '100%',
  padding: '10px',
  marginTop: '6px',
  border: '1px solid #cbd5e1',
  borderRadius: '7px',
  boxSizing: 'border-box'
};

const estiloTh = {
  textAlign: 'left',
  padding: '12px',
  borderBottom: '2px solid #e2e8f0'
};

const estiloTd = {
  padding: '12px',
  borderBottom: '1px solid #e2e8f0'
};

const botonPrincipal = {
  background: '#2563eb',
  color: '#fff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '7px',
  cursor: 'pointer',
  fontWeight: 'bold'
};

const botonSecundario = {
  background: '#e2e8f0',
  color: '#334155',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '7px',
  cursor: 'pointer'
};

const botonEditar = {
  background: '#dbeafe',
  color: '#1d4ed8',
  border: 'none',
  padding: '7px 12px',
  borderRadius: '6px',
  cursor: 'pointer'
};

const botonEliminar = {
  background: '#fee2e2',
  color: '#b91c1c',
  border: 'none',
  padding: '7px 12px',
  borderRadius: '6px',
  cursor: 'pointer'
};

const botonReactivar = {
  background: '#dcfce7',
  color: '#166534',
  border: 'none',
  padding: '7px 12px',
  borderRadius: '6px',
  cursor: 'pointer'
};