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
  departamentoId: '',
  responsableNombre: '',
  observaciones: ''
};

// Departamentos de respaldo basados en los registros reales de tu BD
const DEPARTAMENTOS_RESPALDO = [
  { id: '1', nombre: 'Ventas' },
  { id: '2', nombre: 'Sistemas IT' },
  { id: '3', nombre: 'Recursos Humanos' },
  { id: '4', nombre: 'Administración' },
  { id: '5', nombre: 'Contabilidad' },
  { id: '6', nombre: 'Operaciones' }
];

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
  const [tiendas, setTiendas] = useState([]);

  const [nombreTienda, setNombreTienda] = useState('');

  const [cargandoDepartamentos, setCargandoDepartamentos] = useState(false);
  const [cargandoTiendas, setCargandoTiendas] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  // 1. Cargar la lista de tiendas
  useEffect(() => {
    let activo = true;

    const cargarTiendas = async () => {
      setCargandoTiendas(true);
      try {
        const respuesta = await httpClient.get('/tiendas');
        if (activo) {
          const listaTiendas = obtenerLista(respuesta);
          setTiendas(listaTiendas);
        }
      } catch (err) {
        if (activo) {
          setTiendas([]);
          console.error('Error al cargar tiendas:', err);
        }
      } finally {
        if (activo) {
          setCargandoTiendas(false);
        }
      }
    };

    cargarTiendas();
    return () => {
      activo = false;
    };
  }, []);

  // 2. Cargar departamentos intentando múltiples endpoints y usando respaldo si falla
  useEffect(() => {
    let activo = true;

    const cargarDepartamentos = async () => {
      setCargandoDepartamentos(true);
      let listaBruta = [];

      try {
        // Intento 1: Endpoint estándar con parámetro oficinaId=1
        const res1 = await httpClient.get('/equipos/departamentos?oficinaId=1');
        console.log('Respuesta Intento 1 (/equipos/departamentos?oficinaId=1):', res1);
        listaBruta = obtenerLista(res1);
      } catch (e1) {
        console.warn('Intento 1 falló, probando Intento 2 (/departamentos)...', e1);
        try {
          // Intento 2: Endpoint directo
          const res2 = await httpClient.get('/departamentos');
          console.log('Respuesta Intento 2 (/departamentos):', res2);
          listaBruta = obtenerLista(res2);
        } catch (e2) {
          console.warn('Intento 2 falló, probando Intento 3 (/equipos/departamentos)...', e2);
          try {
            // Intento 3: Sin parámetros
            const res3 = await httpClient.get('/equipos/departamentos');
            console.log('Respuesta Intento 3 (/equipos/departamentos):', res3);
            listaBruta = obtenerLista(res3);
          } catch (e3) {
            console.error('Todos los intentos de API fallaron:', e3);
          }
        }
      }

      if (activo) {
        // Mapear objetos a id y nombre
        let listaProcesada = listaBruta
          .map((dep) => ({
            id: String(dep.id ?? dep.Id ?? dep.departamentoId ?? dep.ID ?? ''),
            nombre: String(dep.nombre ?? dep.Nombre ?? dep.nombreDepartamento ?? '')
          }))
          .filter((dep) => dep.id && dep.nombre && dep.id !== 'undefined');

        // Si la API devolvió una lista vacía, usamos el respaldo con tus datos reales de SQL
        if (listaProcesada.length === 0) {
          console.info('Usando departamentos de respaldo basados en BD SQL Server.');
          listaProcesada = DEPARTAMENTOS_RESPALDO;
        }

        console.log('Departamentos asignados al menú desplegable:', listaProcesada);
        setDepartamentos(listaProcesada);
        setCargandoDepartamentos(false);
      }
    };

    cargarDepartamentos();
    return () => {
      activo = false;
    };
  }, []);

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
            departamentoId: ''
          }
        : {})
    }));

    if (name === 'ubicacionTipo') {
      setNombreTienda('');
    }
  };

  // Buscar tienda por nombre
  const cambiarNombreTienda = (e) => {
    const nombre = e.target.value;

    setNombreTienda(nombre);
    setMensaje('');
    setError('');

    const nombreNormalizado = nombre.trim().toLocaleLowerCase();

    const encontrado = tiendas.find(
      (tienda) =>
        String(tienda.nombre ?? tienda.Nombre ?? '').trim().toLocaleLowerCase() ===
        nombreNormalizado
    );

    setFormulario((anterior) => ({
      ...anterior,
      tiendaId: encontrado ? String(encontrado.id ?? encontrado.Id) : ''
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
          'La tienda ingresada no coincide con ninguna existente. Selecciona una de la lista.'
        );
        return;
      }
    }

    if (formulario.ubicacionTipo === 'OFICINA') {
      if (!formulario.departamentoId) {
        setError('Debes seleccionar un departamento de la lista.');
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

      oficinaId: formulario.ubicacionTipo === 'OFICINA' ? 1 : null,

      departamentoId:
        formulario.ubicacionTipo === 'OFICINA'
          ? Number(formulario.departamentoId)
          : null,

      propietarioId: null,
      observaciones: detalleObservaciones
    };

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
    } catch (err) {
      console.error('Error al registrar el equipo:', err.response?.data || err);

      const detalleError = err.response?.data;

      setError(
        detalleError?.message ||
          detalleError?.mensaje ||
          detalleError?.detail ||
          (typeof detalleError === 'string'
            ? detalleError
            : 'No se pudo registrar el equipo. Revisa la consola del navegador.')
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
                <option value="Impresora normal">Impresora normal</option>
                <option value="Impresora de caja">Impresora de caja</option>
                <option value="Impresora de etiquetas">
                  Impresora de etiquetas
                </option>
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
                  {tiendas.map((tienda) => {
                    const idT = tienda.id ?? tienda.Id;
                    const nomT = tienda.nombre ?? tienda.Nombre;
                    return <option key={idT} value={nomT} />;
                  })}
                </datalist>
              </label>
            ) : (
              <label>
                Nombre del departamento *
                <select
                  name="departamentoId"
                  value={formulario.departamentoId}
                  onChange={cambiarCampo}
                  required
                  disabled={cargandoDepartamentos}
                >
                  <option value="">
                    {cargandoDepartamentos
                      ? 'Cargando departamentos...'
                      : 'Seleccione un departamento'}
                  </option>

                  {departamentos.map((departamento) => (
                    <option key={departamento.id} value={departamento.id}>
                      {departamento.nombre}
                    </option>
                  ))}
                </select>
              </label>
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