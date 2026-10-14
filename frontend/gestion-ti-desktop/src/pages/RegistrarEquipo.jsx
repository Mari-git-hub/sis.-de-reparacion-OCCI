import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import httpClient from '../api/httpClient';
import './RegistroInventario.css';

export default function RegistrarEquipo() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState({
    tipo: 'Laptop',
    marca: '',
    modelo: '',
    serie: '',
    ubicacionTipo: 'TIENDA',
    tiendaId: '',
    oficinaId: '',
    departamentoId: '',
    responsableNombre: '',
    observaciones: ''
  });

  const [departamentos, setDepartamentos] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Cargar departamentos automáticamente si se selecciona una oficina
  useEffect(() => {
    if (formulario.ubicacionTipo === 'OFICINA' && formulario.oficinaId) {
      httpClient.get(`/equipos/departamentos?oficinaId=${formulario.oficinaId}`)
        .then((res) => setDepartamentos(res.data))
        .catch(() => setDepartamentos([]));
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDepartamentos([]);
    }
  }, [formulario.ubicacionTipo, formulario.oficinaId]);

  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
      ...(name === 'ubicacionTipo'
        ? { tiendaId: '', oficinaId: '', departamentoId: '' }
        : {})
    }));
  };

  const guardarEquipo = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!formulario.marca.trim() || !formulario.serie.trim()) {
      setError('La marca y el número de serie son obligatorios.');
      return;
    }

    if (!formulario.responsableNombre.trim()) {
      setError('Debes escribir el nombre del responsable.');
      return;
    }

    if (formulario.ubicacionTipo === 'TIENDA' && !formulario.tiendaId) {
      setError('Debes seleccionar una tienda.');
      return;
    }

    if (formulario.ubicacionTipo === 'OFICINA') {
      if (!formulario.oficinaId) {
        setError('Debes seleccionar una oficina.');
        return;
      }
      if (!formulario.departamentoId) {
        setError('Debes seleccionar un departamento de oficina.');
        return;
      }
    }

    // Concatenar el nombre del responsable con las observaciones
    const detalleObservaciones = `Responsable: ${formulario.responsableNombre.trim()}${
      formulario.observaciones.trim() ? ` | Observaciones: ${formulario.observaciones.trim()}` : ''
    }`;

    const datos = {
      tipo: formulario.tipo,
      marca: formulario.marca.trim(),
      modelo: formulario.modelo.trim() || null,
      serie: formulario.serie.trim(),
      tiendaId: formulario.ubicacionTipo === 'TIENDA' ? Number(formulario.tiendaId) : null,
      oficinaId: formulario.ubicacionTipo === 'OFICINA' ? Number(formulario.oficinaId) : null,
      departamentoId: formulario.ubicacionTipo === 'OFICINA' ? Number(formulario.departamentoId) : null,
      propietarioId: null, // Se envía null al no requerir un ID existente en USUARIOS
      observaciones: detalleObservaciones
    };

    try {
      setGuardando(true);

      await httpClient.post('/equipos', datos);

      setMensaje('El equipo se registró correctamente.');

      setFormulario({
        tipo: 'Laptop',
        marca: '',
        modelo: '',
        serie: '',
        ubicacionTipo: 'TIENDA',
        tiendaId: '',
        oficinaId: '',
        departamentoId: '',
        responsableNombre: '',
        observaciones: ''
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
        err.response?.data?.mensaje ||
        err.response?.data?.detail ||
        'No se pudo registrar el equipo. Verifica los datos y la API.'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="pagina-registro">
      <div className="tarjeta-registro">
        <h1>Registrar equipo</h1>
        <p>Completa los datos para agregar un equipo al inventario.</p>

        {mensaje && <div className="mensaje-exito">{mensaje}</div>}
        {error && <div className="mensaje-error">{error}</div>}

        <form onSubmit={guardarEquipo}>
          <div className="rejilla-formulario">
            <label>
              Tipo de equipo *
              <select
                name="tipo"
                value={formulario.tipo}
                onChange={cambiarCampo}
                required
              >
                <option value="CPU">CPU</option>
                <option value="Laptop">Laptop</option>
                <option value="Impresora normal">Impresora normal</option>
                <option value="Impresora de caja">Impresora de caja</option>
                <option value="Impresora de etiquetas">Impresora de etiquetas</option>
                <option value="Reloj marcador">Reloj marcador</option>
              </select>
            </label>

            <label>
              Marca *
              <input
                name="marca"
                value={formulario.marca}
                onChange={cambiarCampo}
                required
                maxLength={100}
              />
            </label>

            <label>
              Modelo
              <input
                name="modelo"
                value={formulario.modelo}
                onChange={cambiarCampo}
                maxLength={100}
              />
            </label>

            <label>
              Número de serie *
              <input
                name="serie"
                value={formulario.serie}
                onChange={cambiarCampo}
                required
                maxLength={100}
              />
            </label>

            <label>
              Ubicación *
              <select
                name="ubicacionTipo"
                value={formulario.ubicacionTipo}
                onChange={cambiarCampo}
                required
              >
                <option value="TIENDA">Tienda</option>
                <option value="OFICINA">Oficina</option>
              </select>
            </label>

            {formulario.ubicacionTipo === 'TIENDA' ? (
              <label>
                Número o ID de tienda *
                <input
                  name="tiendaId"
                  type="number"
                  min="1"
                  value={formulario.tiendaId}
                  onChange={cambiarCampo}
                  required
                />
              </label>
            ) : (
              <>
                <label>
                  Número o ID de oficina *
                  <input
                    name="oficinaId"
                    type="number"
                    min="1"
                    value={formulario.oficinaId}
                    onChange={cambiarCampo}
                    required
                  />
                </label>

                <label>
                  ID o Selección de Departamento *
                  {departamentos.length > 0 ? (
                    <select
                      name="departamentoId"
                      value={formulario.departamentoId}
                      onChange={cambiarCampo}
                      required
                    >
                      <option value="">Seleccione un departamento</option>
                      {departamentos.map((dep) => (
                        <option key={dep.id} value={dep.id}>
                          {dep.nombre}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      name="departamentoId"
                      type="number"
                      min="1"
                      placeholder="Ej. 1"
                      value={formulario.departamentoId}
                      onChange={cambiarCampo}
                      required
                    />
                  )}
                </label>
              </>
            )}

            <label className="campo-completo">
              Nombre del responsable *
              <input
                name="responsableNombre"
                type="text"
                placeholder="Ej. Juan Pérez"
                value={formulario.responsableNombre}
                onChange={cambiarCampo}
                required
                maxLength={150}
              />
            </label>

            <label className="campo-completo">
              Observaciones
              <textarea
                name="observaciones"
                value={formulario.observaciones}
                onChange={cambiarCampo}
                rows={3}
                maxLength={1000}
              />
            </label>
          </div>

          <div className="acciones-formulario">
            <button
              type="button"
              className="boton-secundario"
              onClick={() => navigate('/inventario')}
            >
              Volver al inventario
            </button>

            <button
              type="submit"
              className="boton-principal"
              disabled={guardando}
            >
              {guardando ? 'Guardando...' : 'Guardar equipo'}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}