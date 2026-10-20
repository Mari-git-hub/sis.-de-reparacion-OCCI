
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import httpClient from '../api/httpClient';
import './RegistroInventario.css';

const formularioInicial = {
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
};

function obtenerLista(respuesta) {
  if (!respuesta) return [];
  if (Array.isArray(respuesta)) return respuesta;
  if (Array.isArray(respuesta.data)) return respuesta.data;
  if (Array.isArray(respuesta.data?.data)) return respuesta.data.data;
  if (Array.isArray(respuesta.data?.result)) return respuesta.data.result;
  return [];
}

export default function RegistrarEquipo() {
  const navigate = useNavigate();

  const [formulario, setFormulario] = useState(formularioInicial);
  const [departamentos, setDepartamentos] = useState([]);
  const [oficinas, setOficinas] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [nombreTienda, setNombreTienda] = useState('');

  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(false);
  const [cargandoOficinas, setCargandoOficinas] = useState(false);
  const [cargandoTiendas, setCargandoTiendas] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // Cargar tiendas
  useEffect(() => {
    let activo = true;

    const cargarTiendas = async () => {
      setCargandoTiendas(true);

      try {
        const respuesta = await httpClient.get('/tiendas');

        if (activo) {
          setTiendas(
            obtenerLista(respuesta).map((tienda) => ({
              ...tienda,
              id: String(tienda.id ?? tienda.Id ?? ''),
              nombre: String(tienda.nombre ?? tienda.Nombre ?? '')
            }))
          );
        }
      } catch (err) {
        console.error('Error al cargar tiendas:', err);

        if (activo) {
          setTiendas([]);
          setError(
            'No se pudieron cargar las tiendas. Comprueba la API.'
          );
        }
      } finally {
        if (activo) setCargandoTiendas(false);
      }
    };

    cargarTiendas();

    return () => {
      activo = false;
    };
  }, []);

  // Cargar oficinas reales desde la API
  useEffect(() => {
    let activo = true;

    const cargarOficinas = async () => {
      setCargandoOficinas(true);

      try {
        const respuesta = await httpClient.get('/equipos/oficinas');

        if (activo) {
          const lista = obtenerLista(respuesta)
            .map((oficina) => ({
              id: String(oficina.id ?? oficina.Id ?? ''),
              nombre: String(oficina.nombre ?? oficina.Nombre ?? '')
            }))
            .filter((oficina) => oficina.id && oficina.nombre);

          setOficinas(lista);
        }
      } catch (err) {
        console.error('Error al cargar oficinas:', err);

        if (activo) {
          setOficinas([]);
          setError(
            'No se pudieron cargar las oficinas. Comprueba la API.'
          );
        }
      } finally {
        if (activo) setCargandoOficinas(false);
      }
    };

    cargarOficinas();

    return () => {
      activo = false;
    };
  }, []);

  // Cargar departamentos de la oficina seleccionada
  useEffect(() => {
    let activo = true;

    const cargarDepartamentos = async () => {
      setDepartamentos([]);

      if (
        formulario.ubicacionTipo !== 'OFICINA' ||
        !formulario.oficinaId
      ) {
        setCargandoDepartamentos(false);
        return;
      }

      setCargandoDepartamentos(true);

      try {
        const respuesta = await httpClient.get(
          `/equipos/departamentos?oficinaId=${encodeURIComponent(
            formulario.oficinaId
          )}`
        );

        if (activo) {
          const lista = obtenerLista(respuesta)
            .map((dep) => ({
              id: String(
                dep.id ??
                dep.Id ??
                dep.departamentoId ??
                dep.DepartamentoId ??
                ''
              ),
              nombre: String(
                dep.nombre ??
                dep.Nombre ??
                dep.nombreDepartamento ??
                ''
              ),
              oficinaId:
                dep.oficinaId ??
                dep.OficinaId ??
                dep.oficina_id ??
                dep.oficinaID ??
                null
            }))
            .filter((dep) => {
              if (!dep.id || !dep.nombre) return false;

              // Si la API devuelve oficinaId, comprobarlo.
              // Si no lo devuelve, confiamos en el filtro del endpoint
              // que recibió el oficinaId seleccionado.
              return (
                dep.oficinaId == null ||
                String(dep.oficinaId) ===
                  String(formulario.oficinaId)
              );
            });

          setDepartamentos(lista);

          if (lista.length === 0) {
            setError(
              'Esta oficina no tiene departamentos disponibles en la API. Comprueba los datos y el endpoint.'
            );
          }
        }
      } catch (err) {
        console.error('Error al cargar departamentos:', err);

        if (activo) {
          setDepartamentos([]);
          setError(
            'No se pudieron cargar los departamentos de esta oficina.'
          );
        }
      } finally {
        if (activo) setCargandoDepartamentos(false);
      }
    };

    cargarDepartamentos();

    return () => {
      activo = false;
    };
  }, [formulario.ubicacionTipo, formulario.oficinaId]);

  const cambiarCampo = (e) => {
    const { name, value } = e.target;

    setMensaje('');
    setError('');

    setFormulario((anterior) => ({
      ...anterior,
      [name]: value,
      ...(name === 'ubicacionTipo'
        ? {
            tiendaId: '',
            oficinaId: '',
            departamentoId: ''
          }
        : {}),
      ...(name === 'oficinaId'
        ? {
            departamentoId: ''
          }
        : {})
    }));

    if (name === 'ubicacionTipo') {
      setNombreTienda('');
      setDepartamentos([]);
    }
  };

  // Buscar tienda por nombre y guardar su ID real
  const cambiarNombreTienda = (e) => {
    const nombre = e.target.value;

    setNombreTienda(nombre);
    setMensaje('');
    setError('');

    const nombreNormalizado = nombre.trim().toLocaleLowerCase();

    const encontrada = tiendas.find(
      (tienda) =>
        String(tienda.nombre ?? '')
          .trim()
          .toLocaleLowerCase() === nombreNormalizado
    );

    setFormulario((anterior) => ({
      ...anterior,
      tiendaId: encontrada ? String(encontrada.id) : ''
    }));
  };

  const guardarEquipo = async (e) => {
    e.preventDefault();

    setMensaje('');
    setError('');

    if (!formulario.marca.trim()) {
      setError('Debes escribir la marca del equipo.');
      return;
    }

    if (!formulario.serie.trim()) {
      setError('Debes escribir el número de serie.');
      return;
    }

    if (!formulario.responsableNombre.trim()) {
      setError('Debes escribir el nombre del responsable.');
      return;
    }

    if (formulario.ubicacionTipo === 'TIENDA') {
      if (!nombreTienda.trim()) {
        setError('Debes escribir o seleccionar una tienda.');
        return;
      }

      if (!formulario.tiendaId) {
        setError(
          'La tienda ingresada no coincide con una tienda existente. Selecciona una de la lista.'
        );
        return;
      }
    }

    if (formulario.ubicacionTipo === 'OFICINA') {
      if (!formulario.oficinaId) {
        setError('Debes seleccionar una oficina.');
        return;
      }

      if (!formulario.departamentoId) {
        setError(
          'Debes seleccionar un departamento de la oficina elegida.'
        );
        return;
      }

      const departamentoSeleccionado = departamentos.find(
        (dep) => String(dep.id) === String(formulario.departamentoId)
      );

      if (!departamentoSeleccionado) {
        setError(
          'El departamento seleccionado ya no está disponible. Selecciona nuevamente la oficina y el departamento.'
        );
        return;
      }

      if (
        departamentoSeleccionado.oficinaId != null &&
        String(departamentoSeleccionado.oficinaId) !==
          String(formulario.oficinaId)
      ) {
        setError(
          'El departamento seleccionado no corresponde a la oficina elegida.'
        );
        return;
      }
    }

    const detalleObservaciones =
      `Responsable: ${formulario.responsableNombre.trim()}` +
      (formulario.observaciones.trim()
        ? ` | Observaciones: ${formulario.observaciones.trim()}`
        : '');

    const datos = {
      tipo: formulario.tipo,
      marca: formulario.marca.trim(),
      modelo: formulario.modelo.trim() || null,
      serie: formulario.serie.trim(),

      tiendaId:
        formulario.ubicacionTipo === 'TIENDA'
          ? Number(formulario.tiendaId)
          : null,

      oficinaId:
        formulario.ubicacionTipo === 'OFICINA'
          ? Number(formulario.oficinaId)
          : null,

      departamentoId:
        formulario.ubicacionTipo === 'OFICINA'
          ? Number(formulario.departamentoId)
          : null,

      propietarioId: null,
      observaciones: detalleObservaciones
    };

    console.log('Payload enviado al servidor:', datos);

    try {
      setGuardando(true);

      const respuesta = await httpClient.post('/equipos', datos);

      setMensaje(
        respuesta.data?.message ||
          respuesta.data?.mensaje ||
          'El equipo se registró correctamente.'
      );

      setFormulario({ ...formularioInicial });
      setNombreTienda('');
      setDepartamentos([]);
    } catch (err) {
      console.error(
        'Error al registrar el equipo:',
        err.response?.data || err
      );

      if (err.response?.status === 401) {
        setError(
          'Tu sesión ha expirado. Inicia sesión nuevamente.'
        );
        return;
      }

      const detalleError = err.response?.data;

      if (
        typeof detalleError === 'object' &&
        detalleError !== null
      ) {
        const textoMensaje =
          detalleError.message ||
          detalleError.mensaje ||
          detalleError.detail ||
          (detalleError.errors
            ? Object.values(detalleError.errors).flat().join(' | ')
            : JSON.stringify(detalleError));

        setError(`Error (${err.response?.status}): ${textoMensaje}`);
      } else {
        setError(
          typeof detalleError === 'string'
            ? `Error (${err.response?.status}): ${detalleError}`
            : 'No se pudo registrar el equipo. Revisa la consola del navegador.'
        );
      }
    } finally {
      setGuardando(false);
    }
  };

  return (
    <section className="pagina-registro">
      <div className="tarjeta-registro">
        <h1>Registrar equipo</h1>

        <p>
          Completa los datos para agregar un equipo al inventario.
        </p>

        {mensaje && (
          <div className="mensaje-exito" role="status">
            {mensaje}
          </div>
        )}

        {error && (
          <div className="mensaje-error" role="alert">
            {error}
          </div>
        )}

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
                <option value="Impresora normal">
                  Impresora normal
                </option>
                <option value="Impresora de caja">
                  Impresora de caja
                </option>
                <option value="Impresora de etiquetas">
                  Impresora de etiquetas
                </option>
                <option value="Reloj marcador">
                  Reloj marcador
                </option>
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
                Nombre de la tienda *
                <input
                  list="lista-tiendas"
                  name="nombreTienda"
                  value={nombreTienda}
                  onChange={cambiarNombreTienda}
                  placeholder={
                    cargandoTiendas
                      ? 'Cargando tiendas...'
                      : 'Escribe o selecciona una tienda'
                  }
                  required
                  autoComplete="off"
                />

                <datalist id="lista-tiendas">
                  {tiendas.map((tienda) => (
                    <option
                      key={tienda.id}
                      value={tienda.nombre}
                    />
                  ))}
                </datalist>
              </label>
            ) : (
              <>
                <label>
                  Nombre de la oficina *
                  <select
                    name="oficinaId"
                    value={formulario.oficinaId}
                    onChange={cambiarCampo}
                    required
                    disabled={cargandoOficinas}
                  >
                    <option value="">
                      {cargandoOficinas
                        ? 'Cargando oficinas...'
                        : 'Seleccione una oficina'}
                    </option>

                    {oficinas.map((oficina) => (
                      <option key={oficina.id} value={oficina.id}>
                        {oficina.nombre}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Nombre del departamento *
                  <select
                    name="departamentoId"
                    value={formulario.departamentoId}
                    onChange={cambiarCampo}
                    required
                    disabled={
                      cargandoDepartamentos ||
                      !formulario.oficinaId
                    }
                  >
                    <option value="">
                      {!formulario.oficinaId
                        ? 'Primero seleccione una oficina'
                        : cargandoDepartamentos
                          ? 'Cargando departamentos...'
                          : 'Seleccione un departamento'}
                    </option>

                    {departamentos.map((departamento) => (
                      <option
                        key={departamento.id}
                        value={departamento.id}
                      >
                        {departamento.nombre}
                      </option>
                    ))}
                  </select>
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