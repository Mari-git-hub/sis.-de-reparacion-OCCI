import { useState, useEffect, useCallback } from 'react';

import { useNavigate } from 'react-router-dom';

import httpClient from '../api/httpClient';

import './RegistroInventario.css';

export default function InventarioAdmin() {

  const navigate = useNavigate();

  const [insumos, setInsumos] = useState([]);

  const [equipos, setEquipos] = useState([]);

  const [busquedaInsumos, setBusquedaInsumos] = useState('');

  const [busquedaEquipos, setBusquedaEquipos] = useState('');

  const [filtroTipo, setFiltroTipo] = useState('Todos');

  const [cargandoInsumos, setCargandoInsumos] = useState(true);

  const [cargandoEquipos, setCargandoEquipos] = useState(true);

  const [errorInsumos, setErrorInsumos] = useState('');

  const [errorEquipos, setErrorEquipos] = useState('');

  const [edicion, setEdicion] = useState(null);

  // CONSULTAR INSUMOS

  const cargarInsumos = useCallback(async () => {

    setCargandoInsumos(true);

    setErrorInsumos('');

    try {

      const respuesta = await httpClient.get('/inventario-admin');

      const datos = respuesta.data;

      const lista = Array.isArray(datos)
        ? datos
        : Array.isArray(datos?.$values)
          ? datos.$values
          : Array.isArray(datos?.items)
            ? datos.items
            : Array.isArray(datos?.insumos)
              ? datos.insumos
              : Array.isArray(datos?.consumibles)
                ? datos.consumibles
                : null;

      if (!lista) {
        throw new Error('La API no devolvió una lista de insumos.');
      }

      setInsumos(lista);

    } catch (error) {

      console.error('Error al consultar insumos:', error);

      setErrorInsumos(

        'No fue posible consultar los insumos. Verifica la API.'

      );

    } finally {

      setCargandoInsumos(false);

    }

  }, []);

  // CONSULTAR EQUIPOS

  const cargarEquipos = useCallback(async () => {

    setCargandoEquipos(true);

    setErrorEquipos('');

    try {

      const respuesta = await httpClient.get('/equipos');

      const datos = respuesta.data;

      // Acepta una lista directa o algunas respuestas comunes de API.

      const lista = Array.isArray(datos)

        ? datos

        : Array.isArray(datos?.$values)

          ? datos.$values

          : Array.isArray(datos?.items)

            ? datos.items

            : Array.isArray(datos?.equipos)

              ? datos.equipos

              : null;

      if (!lista) {

        throw new Error('La API no devolvió una lista de equipos.');

      }

      setEquipos(lista);

    } catch (error) {

      console.error('Error al consultar equipos:', error);

      setErrorEquipos(

        'No fue posible consultar los equipos. Comprueba el endpoint GET /equipos y la autorización.'

      );

    } finally {

      setCargandoEquipos(false);

    }

  }, []);

  // CARGAR AMBOS INVENTARIOS

  const actualizarTodo = useCallback(() => {

    cargarInsumos();

    cargarEquipos();

  }, [cargarInsumos, cargarEquipos]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    actualizarTodo();

  }, [actualizarTodo]);

  // GUARDAR CAMBIOS DE UN INSUMO

  const guardarEdicion = async (id) => {

    if (!edicion) return;

    const stockActual = Number(edicion.stockActual);

    const stockMinimo = Number(edicion.stockMinimo);

    if (!Number.isInteger(stockActual) || stockActual < 0) {

      alert('El stock actual debe ser un número entero igual o mayor que cero.');

      return;

    }

    if (!Number.isInteger(stockMinimo) || stockMinimo < 0) {

      alert('El stock mínimo debe ser un número entero igual o mayor que cero.');

      return;

    }

    try {

      await httpClient.put(`/inventario-admin/${id}`, {

        stockActual,

        stockMinimo,

        marca: edicion.marca || '',

        modelo: edicion.modelo || ''

      });

      alert('Insumo actualizado correctamente.');

      setEdicion(null);

      await cargarInsumos();

    } catch (error) {

      console.error('Error al actualizar insumo:', error);

      alert(

        error.response?.data?.message ||

        'No se pudo actualizar el insumo.'

      );

    }

  };

  // FILTRAR INSUMOS

  const textoInsumos = busquedaInsumos.trim().toLowerCase();

  const insumosFiltrados = insumos.filter((item) => {

    const codigo = String(item.codigo ?? '').toLowerCase();

    const marca = String(item.marca ?? '').toLowerCase();

    const modelo = String(item.modelo ?? '').toLowerCase();

    const tipo = String(item.tipo ?? '').trim().toLocaleUpperCase('es-HN');

    const coincideTexto =

      codigo.includes(textoInsumos) ||

      marca.includes(textoInsumos) ||

      modelo.includes(textoInsumos);

    const coincideTipo =

      filtroTipo === 'Todos' || tipo === filtroTipo;

    return coincideTexto && coincideTipo;

  });

  // FILTRAR EQUIPOS

  const textoEquipos = busquedaEquipos.trim().toLowerCase();

  const equiposFiltrados = equipos.filter((equipo) => {

    const campos = [

      equipo.codigoInterno,

      equipo.codigo_interno,

      equipo.nombre,

      equipo.tipo,

      equipo.marca,

      equipo.modelo,

      equipo.serie,

      equipo.estadoActual,

      equipo.estado_actual,

      equipo.ubicacionTipo,

      equipo.ubicacionNombre,

      equipo.tiendaNombre,

      equipo.oficinaNombre

    ];

    return campos.some((campo) =>

      String(campo ?? '').toLowerCase().includes(textoEquipos)

    );

  });

  // ESTILOS

  const boton = (color) => ({

    padding: '10px 14px',

    backgroundColor: color,

    color: '#ffffff',

    border: 'none',

    borderRadius: '7px',

    cursor: 'pointer',

    fontWeight: '600',

    fontSize: '13px'

  });

  const campo = {

    padding: '10px',

    width: '100%',

    boxSizing: 'border-box',

    borderRadius: '6px',

    border: '1px solid #475569',

    backgroundColor: '#0f172a',

    color: '#f8fafc'

  };

  const tarjeta = {

    backgroundColor: '#1e293b',

    padding: '18px',

    borderRadius: '10px',

    border: '1px solid #334155'

  };

  const celda = {

    padding: '12px 10px',

    borderBottom: '1px solid #334155',

    textAlign: 'left',

    verticalAlign: 'middle',

    color: '#e2e8f0'

  };

  const obtenerUbicacion = (equipo) => {

    const oficina =

      equipo.oficinaNombre ??

      equipo.oficina_nombre;

    const tienda =

      equipo.tiendaNombre ??

      equipo.tienda_nombre;

    const tipoUbicacion =

      equipo.ubicacionTipo ??

      equipo.ubicacion_tipo;

    const nombreUbicacion =

      equipo.ubicacionNombre ??

      equipo.ubicacion_nombre;

    if (oficina) return `Oficina: ${oficina}`;

    if (tienda) return `Tienda: ${tienda}`;

    if (tipoUbicacion && nombreUbicacion) {

      return `${tipoUbicacion}: ${nombreUbicacion}`;

    }

    if (tipoUbicacion) return String(tipoUbicacion);

    if (nombreUbicacion) return String(nombreUbicacion);

    // Alternativa si la API aún no devuelve los nombres.

    if (equipo.oficinaId ?? equipo.oficina_id) return 'Oficina';

    if (equipo.tiendaId ?? equipo.tienda_id) return 'Tienda';

    return 'Sin ubicación asignada';

  };

  const formatoFecha = (fecha) => {

    if (!fecha) return '—';

    const valor = new Date(fecha);

    if (Number.isNaN(valor.getTime())) return '—';

    return valor.toLocaleDateString('es-HN');

  };

  const stockCritico = insumos.filter(

    (item) =>

      Number(item.stockActual ?? 0) <=

      Number(item.stockMinimo ?? 0)

  ).length;

  const sinDespacho = insumos.filter(

    (item) =>

      item.diasSinDespacho != null &&

      Number(item.diasSinDespacho) >= 15

  ).length;

  return (

    <div

      style={{

        maxWidth: '1500px',

        margin: '0 auto',

        padding: '20px',

        color: '#f8fafc',

        fontFamily: 'Arial, sans-serif'

      }}

    >

      {/* ENCABEZADO */}

      <header

        style={{

          display: 'flex',

          justifyContent: 'space-between',

          alignItems: 'center',

          flexWrap: 'wrap',

          gap: '15px',

          marginBottom: '25px'

        }}

      >

        <div>

          <h2 style={{ color: '#38bdf8', margin: 0 }}>

            Inventario general

          </h2>

          <p style={{ color: '#94a3b8' }}>

            Consulta los equipos y los insumos registrados.

          </p>

        </div>

        <div

          style={{

            display: 'flex',

            flexWrap: 'wrap',

            gap: '10px'

          }}

        >

          <button

            type="button"

            onClick={() => navigate('/inventario/registrar-insumo')}

            style={boton('#15803d')}

          >

            + Agregar insumo

          </button>

          <button

            type="button"

            onClick={() => navigate('/inventario/registrar-equipo')}

            style={boton('#0369a1')}

          >

            + Agregar equipo

          </button>

          <button

            type="button"

            onClick={actualizarTodo}

            style={boton('#475569')}

          >

            Actualizar inventario

          </button>

        </div>

      </header>

      {/* INDICADORES */}

      <div

        style={{

          display: 'grid',

          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',

          gap: '15px',

          marginBottom: '30px'

        }}

      >

        <div style={tarjeta}>

          <p style={{ color: '#94a3b8', margin: 0 }}>

            Equipos registrados

          </p>

          <h2 style={{ color: '#38bdf8', marginBottom: 0 }}>

            {equipos.length}

          </h2>

        </div>

        <div style={tarjeta}>

          <p style={{ color: '#94a3b8', margin: 0 }}>

            Insumos registrados

          </p>

          <h2 style={{ color: '#4ade80', marginBottom: 0 }}>

            {insumos.length}

          </h2>

        </div>

        <div style={tarjeta}>

          <p style={{ color: '#94a3b8', margin: 0 }}>

            Insumos con stock crítico

          </p>

          <h2 style={{ color: '#f87171', marginBottom: 0 }}>

            {stockCritico}

          </h2>

        </div>

        <div style={tarjeta}>

          <p style={{ color: '#94a3b8', margin: 0 }}>

            Sin despacho por 15 días o más

          </p>

          <h2 style={{ color: '#fbbf24', marginBottom: 0 }}>

            {sinDespacho}

          </h2>

        </div>

      </div>

      {/* TABLA DE EQUIPOS */}

      <section style={{ marginBottom: '35px' }}>

        <h3 style={{ color: '#38bdf8' }}>

          Equipos registrados

        </h3>

        <p style={{ color: '#94a3b8' }}>

          Aquí aparecen los equipos de oficina y de tienda con sus características.

        </p>

        <input

          type="text"

          value={busquedaEquipos}

          onChange={(e) => setBusquedaEquipos(e.target.value)}

          placeholder="Buscar equipo por código, tipo, marca, modelo, serie o ubicación..."

          style={{ ...campo, marginBottom: '15px' }}

        />

        {cargandoEquipos ? (

          <p>Cargando equipos...</p>

        ) : errorEquipos ? (

          <div

            style={{

              ...tarjeta,

              color: '#fca5a5',

              marginBottom: '15px'

            }}

          >

            {errorEquipos}

            <p style={{ fontSize: '13px' }}>

              Los insumos pueden seguir consultándose aunque falle esta petición.

              Revisa el endpoint GET /api/v1/equipos y los permisos de acceso.

            </p>

            <button

              type="button"

              onClick={cargarEquipos}

              style={boton('#0369a1')}

            >

              Reintentar

            </button>

          </div>

        ) : (

          <div

            style={{

              overflowX: 'auto',

              border: '1px solid #334155',

              borderRadius: '10px'

            }}

          >

            <table

              style={{

                width: '100%',

                minWidth: '1050px',

                borderCollapse: 'collapse',

                backgroundColor: '#0f172a'

              }}

            >

              <thead>

                <tr style={{ backgroundColor: '#1e293b' }}>

                  {[

                    'Código',

                    'Tipo de equipo',

                    'Marca',

                    'Modelo',

                    'Número de serie',

                    'Ubicación',

                    'Estado',

                    'Fecha de registro'

                  ].map((titulo) => (

                    <th key={titulo} style={celda}>

                      {titulo}

                    </th>

                  ))}

                </tr>

              </thead>

              <tbody>

                {equiposFiltrados.length === 0 ? (

                  <tr>

                    <td

                      colSpan={8}

                      style={{

                        ...celda,

                        textAlign: 'center',

                        padding: '25px',

                        color: '#94a3b8'

                      }}

                    >

                      No hay equipos para mostrar. Si ya registraste equipos,

                      verifica que el endpoint GET /equipos los esté devolviendo.

                    </td>

                  </tr>

                ) : (

                  equiposFiltrados.map((equipo, indice) => (

                    <tr key={equipo.id ?? equipo.codigoInterno ?? indice}>

                      <td style={celda}>

                        {equipo.codigoInterno ??

                          equipo.codigo_interno ??

                          equipo.nombre ??

                          '—'}

                      </td>

                      <td style={celda}>

                        {equipo.tipo ?? '—'}

                      </td>

                      <td style={celda}>

                        {equipo.marca ?? '—'}

                      </td>

                      <td style={celda}>

                        {equipo.modelo ?? '—'}

                      </td>

                      <td style={celda}>

                        {equipo.serie ?? '—'}

                      </td>

                      <td style={celda}>

                        {obtenerUbicacion(equipo)}

                      </td>

                      <td style={celda}>

                        {equipo.estadoActual ??

                          equipo.estado_actual ??

                          'Sin estado'}

                      </td>

                      <td style={celda}>

                        {formatoFecha(

                          equipo.fechaAlta ?? equipo.fecha_alta

                        )}

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

      {/* TABLA DE INSUMOS */}

      <section>

        <h3 style={{ color: '#4ade80' }}>

          Insumos registrados

        </h3>

        <p style={{ color: '#94a3b8' }}>

          Consulta y edita las existencias de tus insumos.

        </p>

        <div

          style={{

            display: 'flex',

            flexWrap: 'wrap',

            gap: '10px',

            marginBottom: '15px'

          }}

        >

          <input

            type="text"

            value={busquedaInsumos}

            onChange={(e) => setBusquedaInsumos(e.target.value)}

            placeholder="Buscar por código, marca o modelo..."

            style={{ ...campo, flex: '1 1 250px' }}

          />

          <select

            value={filtroTipo}

            onChange={(e) => setFiltroTipo(e.target.value)}

            style={{ ...campo, flex: '0 1 200px' }}

          >

            <option value="Todos">Todos los tipos</option>

            <option value="Tinta">Tinta</option>

            <option value="TINTA">TINTA</option>

            <option value="Toner">Tóner</option>

            <option value="TONER">TONER</option>

            <option value="Tambor">Tambor</option>

            <option value="TAMBOR">TAMBOR</option>

            <option value="Cinta">Cinta</option>

            <option value="CINTA">CINTA</option>

            <option value="ROLLO_TERMICO">Rollo térmico</option>

          </select>

        </div>

        {cargandoInsumos ? (

          <p>Cargando insumos...</p>

        ) : errorInsumos ? (

          <div style={{ ...tarjeta, color: '#fca5a5' }}>

            {errorInsumos}

            <button

              type="button"

              onClick={cargarInsumos}

              style={{ ...boton('#0369a1'), marginLeft: '10px' }}

            >

              Reintentar

            </button>

          </div>

        ) : (

          <div

            style={{

              overflowX: 'auto',

              border: '1px solid #334155',

              borderRadius: '10px'

            }}

          >

            <table

              style={{

                width: '100%',

                minWidth: '950px',

                borderCollapse: 'collapse',

                backgroundColor: '#0f172a'

              }}

            >

              <thead>

                <tr style={{ backgroundColor: '#1e293b' }}>

                  {[

                    'Código',

                    'Tipo',

                    'Marca',

                    'Modelo',

                    'Stock actual',

                    'Stock mínimo',

                    'Último despacho',

                    'Estado',

                    'Acciones'

                  ].map((titulo) => (

                    <th key={titulo} style={celda}>

                      {titulo}

                    </th>

                  ))}

                </tr>

              </thead>

              <tbody>

                {insumosFiltrados.length === 0 ? (

                  <tr>

                    <td

                      colSpan={9}

                      style={{

                        ...celda,

                        textAlign: 'center',

                        padding: '25px',

                        color: '#94a3b8'

                      }}

                    >

                      No se encontraron insumos.

                    </td>

                  </tr>

                ) : (

                  insumosFiltrados.map((item, indice) => {

                    const stockActual = Number(item.stockActual ?? 0);

                    const stockMinimo = Number(item.stockMinimo ?? 0);

                    const critico = stockActual <= stockMinimo;

                    const editando = edicion?.id === item.id;

                    return (

                      <tr key={item.id ?? indice}>

                        <td style={celda}>

                          {item.codigo ?? '—'}

                        </td>

                        <td style={celda}>

                          {item.tipo ?? '—'}

                        </td>

                        <td style={celda}>

                          {editando ? (

                            <input

                              value={edicion.marca}

                              onChange={(e) =>

                                setEdicion({

                                  ...edicion,

                                  marca: e.target.value

                                })

                              }

                              style={{ ...campo, minWidth: '100px' }}

                            />

                          ) : (

                            item.marca || '—'

                          )}

                        </td>

                        <td style={celda}>

                          {editando ? (

                            <input

                              value={edicion.modelo}

                              onChange={(e) =>

                                setEdicion({

                                  ...edicion,

                                  modelo: e.target.value

                                })

                              }

                              style={{ ...campo, minWidth: '100px' }}

                            />

                          ) : (

                            item.modelo || '—'

                          )}

                        </td>

                        <td style={celda}>

                          {editando ? (

                            <input

                              type="number"

                              min="0"

                              value={edicion.stockActual}

                              onChange={(e) =>

                                setEdicion({

                                  ...edicion,

                                  stockActual: e.target.value

                                })

                              }

                              style={{ ...campo, minWidth: '85px' }}

                            />

                          ) : (

                            stockActual

                          )}

                        </td>

                        <td style={celda}>

                          {editando ? (

                            <input

                              type="number"

                              min="0"

                              value={edicion.stockMinimo}

                              onChange={(e) =>

                                setEdicion({

                                  ...edicion,

                                  stockMinimo: e.target.value

                                })

                              }

                              style={{ ...campo, minWidth: '85px' }}

                            />

                          ) : (

                            stockMinimo

                          )}

                        </td>

                        <td style={celda}>

                          {item.diasSinDespacho == null

                            ? 'Sin registro'

                            : `Hace ${item.diasSinDespacho} días`}

                        </td>

                        <td style={celda}>

                          <span

                            style={{

                              color: critico ? '#f87171' : '#4ade80',

                              fontWeight: 'bold'

                            }}

                          >

                            {critico ? 'Stock crítico' : 'Disponible'}

                          </span>

                        </td>

                        <td style={celda}>

                          {editando ? (

                            <div style={{ display: 'flex', gap: '6px' }}>

                              <button

                                type="button"

                                onClick={() => guardarEdicion(item.id)}

                                style={boton('#15803d')}

                              >

                                Guardar

                              </button>

                              <button

                                type="button"

                                onClick={() => setEdicion(null)}

                                style={boton('#475569')}

                              >

                                Cancelar

                              </button>

                            </div>

                          ) : (

                            <button

                              type="button"

                              onClick={() =>

                                setEdicion({

                                  id: item.id,

                                  stockActual: String(item.stockActual ?? 0),

                                  stockMinimo: String(item.stockMinimo ?? 0),

                                  marca: item.marca ?? '',

                                  modelo: item.modelo ?? ''

                                })

                              }

                              style={boton('#0369a1')}

                            >

                              Editar

                            </button>

                          )}

                        </td>

                      </tr>

                    );

                  })

                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>

  );

}