import { useState, useEffect, useCallback } from 'react';
import httpClient from '../api/httpClient';

export default function InventarioAdmin() {
  const [inventario, setInventario] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('Todos');
  const [cargando, setCargando] = useState(true);
  const [edicion, setEdicion] = useState(null);

  // ============================================================
  // CARGAR INVENTARIO
  // ============================================================
  const cargarInventario = useCallback(async () => {
    setCargando(true);

    try {
      const res = await httpClient.get('/inventario-admin');

      setInventario(
        Array.isArray(res.data) ? res.data : []
      );
    } catch (error) {
      console.error(
        'Error al cargar inventario:',
        error
      );

      setInventario([]);
    } finally {
      setCargando(false);
    }
  }, []);

  // ============================================================
  // CARGAR AL ABRIR LA PANTALLA
  // ============================================================
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarInventario();
  }, [cargarInventario]);

  // ============================================================
  // GUARDAR EDICIÓN
  // ============================================================
  const guardarEdicion = async (id) => {
    if (!edicion) {
      return;
    }

    const stockActual = parseInt(
      edicion.stockActual,
      10
    );

    const stockMinimo = parseInt(
      edicion.stockMinimo,
      10
    );

    if (
      Number.isNaN(stockActual) ||
      stockActual < 0
    ) {
      alert(
        'El stock actual debe ser un número mayor o igual a 0.'
      );
      return;
    }

    if (
      Number.isNaN(stockMinimo) ||
      stockMinimo < 0
    ) {
      alert(
        'El stock mínimo debe ser un número mayor o igual a 0.'
      );
      return;
    }

    try {
      await httpClient.put(
        `/inventario-admin/${id}`,
        {
          stockActual,
          stockMinimo,
          marca: edicion.marca || '',
          modelo: edicion.modelo || ''
        }
      );

      alert(
        'Inventario actualizado correctamente.'
      );

      setEdicion(null);

      await cargarInventario();
    } catch (error) {
      console.error(
        'Error al actualizar el inventario:',
        error
      );

      alert(
        'Error al actualizar el inventario.'
      );
    }
  };

  // ============================================================
  // FILTRADO
  // ============================================================
  const textoBusqueda =
    busqueda.toLowerCase().trim();

  const inventarioFiltrado =
    inventario.filter((item) => {
      const codigo = String(
        item.codigo ?? ''
      ).toLowerCase();

      const marca = String(
        item.marca ?? ''
      ).toLowerCase();

      const modelo = String(
        item.modelo ?? ''
      ).toLowerCase();

      const coincideTexto =
        codigo.includes(textoBusqueda) ||
        marca.includes(textoBusqueda) ||
        modelo.includes(textoBusqueda);

      const coincideTipo =
        filtroTipo === 'Todos' ||
        item.tipo === filtroTipo;

      return (
        coincideTexto &&
        coincideTipo
      );
    });

  // ============================================================
  // MÉTRICAS
  // ============================================================
  const totalItems =
    inventario.length;

  const stockCriticoCount =
    inventario.filter((item) => {
      const stockActual = Number(
        item.stockActual ?? 0
      );

      const stockMinimo = Number(
        item.stockMinimo ?? 0
      );

      return stockActual <= stockMinimo;
    }).length;

  const alertasDespachoCount =
    inventario.filter((item) => {
      if (
        item.diasSinDespacho === null ||
        item.diasSinDespacho === undefined
      ) {
        return false;
      }

      return (
        Number(item.diasSinDespacho) >= 15
      );
    }).length;

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <div
      style={{
        padding: '20px',
        maxWidth: '1200px',
        margin: '0 auto',
        color: '#f8fafc',
        fontFamily: 'sans-serif'
      }}
    >
      {/* ======================================================
          CABECERA
      ====================================================== */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: '#38bdf8'
            }}
          >
            Panel de Control de Inventario
          </h2>

          <p
            style={{
              margin: '5px 0 0 0',
              color: '#94a3b8',
              fontSize: '14px'
            }}
          >
            Gestión global, monitoreo de stock y
            alertas preventivas.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarInventario}
          disabled={cargando}
          style={{
            padding: '10px 16px',
            background: cargando
              ? '#475569'
              : '#0284c7',
            color: '#fff',
            border: 'none',
            borderRadius: '6px',
            cursor: cargando
              ? 'not-allowed'
              : 'pointer',
            fontWeight: 'bold'
          }}
        >
          {cargando
            ? '⏳ Cargando...'
            : '🔄 Actualizar'}
        </button>
      </div>

      {/* ======================================================
          MÉTRICAS
      ====================================================== */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns:
            'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '15px',
          marginBottom: '25px'
        }}
      >
        {/* TOTAL */}
        <div
          style={{
            background: '#1e293b',
            padding: '15px',
            borderRadius: '8px',
            borderLeft:
              '4px solid #38bdf8'
          }}
        >
          <span
            style={{
              color: '#94a3b8',
              fontSize: '13px'
            }}
          >
            Total Insumos
          </span>

          <h3
            style={{
              margin: '5px 0 0 0',
              fontSize: '24px'
            }}
          >
            {totalItems}
          </h3>
        </div>

        {/* STOCK CRÍTICO */}
        <div
          style={{
            background: '#1e293b',
            padding: '15px',
            borderRadius: '8px',
            borderLeft:
              '4px solid #ef4444'
          }}
        >
          <span
            style={{
              color: '#94a3b8',
              fontSize: '13px'
            }}
          >
            Stock Crítico
          </span>

          <h3
            style={{
              margin: '5px 0 0 0',
              fontSize: '24px',
              color: '#f87171'
            }}
          >
            {stockCriticoCount}
          </h3>
        </div>

        {/* SIN DESPACHO */}
        <div
          style={{
            background: '#1e293b',
            padding: '15px',
            borderRadius: '8px',
            borderLeft:
              '4px solid #f59e0b'
          }}
        >
          <span
            style={{
              color: '#94a3b8',
              fontSize: '13px'
            }}
          >
            Sin Despacho (&gt;15 días)
          </span>

          <h3
            style={{
              margin: '5px 0 0 0',
              fontSize: '24px',
              color: '#fbbf24'
            }}
          >
            {alertasDespachoCount}
          </h3>
        </div>
      </div>

      {/* ======================================================
          FILTROS
      ====================================================== */}
      <div
        style={{
          background: '#1e293b',
          padding: '15px',
          borderRadius: '8px',
          marginBottom: '20px',
          display: 'flex',
          gap: '15px',
          flexWrap: 'wrap'
        }}
      >
        <input
          type="text"
          placeholder="🔍 Buscar por código, marca o modelo..."
          value={busqueda}
          onChange={(e) =>
            setBusqueda(e.target.value)
          }
          style={{
            flex: 1,
            minWidth: '250px',
            padding: '10px',
            background: '#0f172a',
            border:
              '1px solid #475569',
            borderRadius: '6px',
            color: '#fff'
          }}
        />

        <select
          value={filtroTipo}
          onChange={(e) =>
            setFiltroTipo(e.target.value)
          }
          style={{
            padding: '10px',
            background: '#0f172a',
            border:
              '1px solid #475569',
            borderRadius: '6px',
            color: '#fff',
            minWidth: '150px'
          }}
        >
          <option value="Todos">
            Todos los tipos
          </option>

          <option value="Tinta">
            Tinta
          </option>

          <option value="Toner">
            Tóner
          </option>

          <option value="Tambor">
            Tambor
          </option>

          <option value="Cinta">
            Cinta
          </option>
        </select>
      </div>

      {/* ======================================================
          TABLA
      ====================================================== */}
      <div
        style={{
          background: '#1e293b',
          borderRadius: '8px',
          overflow: 'hidden',
          border:
            '1px solid #334155'
        }}
      >
        <div
          style={{
            overflowX: 'auto'
          }}
        >
          <table
            style={{
              width: '100%',
              borderCollapse:
                'collapse',
              textAlign: 'left',
              fontSize: '14px'
            }}
          >
            <thead>
              <tr
                style={{
                  background: '#0f172a',
                  color: '#94a3b8',
                  borderBottom:
                    '1px solid #334155'
                }}
              >
                <th
                  style={{
                    padding: '12px'
                  }}
                >
                  Código
                </th>

                <th
                  style={{
                    padding: '12px'
                  }}
                >
                  Tipo / Detalles
                </th>

                <th
                  style={{
                    padding: '12px'
                  }}
                >
                  Stock Actual
                </th>

                <th
                  style={{
                    padding: '12px'
                  }}
                >
                  Mínimo
                </th>

                <th
                  style={{
                    padding: '12px'
                  }}
                >
                  Última Salida
                </th>

                <th
                  style={{
                    padding: '12px'
                  }}
                >
                  Estado
                </th>

                <th
                  style={{
                    padding: '12px',
                    textAlign:
                      'center'
                  }}
                >
                  Acción
                </th>
              </tr>
            </thead>

            <tbody>
              {/* CARGANDO */}
              {cargando ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign:
                        'center',
                      padding: '20px'
                    }}
                  >
                    Cargando inventario...
                  </td>
                </tr>
              ) : inventarioFiltrado.length ===
                0 ? (
                /* SIN RESULTADOS */
                <tr>
                  <td
                    colSpan="7"
                    style={{
                      textAlign:
                        'center',
                      padding: '20px',
                      color:
                        '#94a3b8'
                    }}
                  >
                    No se encontraron
                    consumibles.
                  </td>
                </tr>
              ) : (
                /* LISTADO */
                inventarioFiltrado.map(
                  (item) => {
                    const esModoEdicion =
                      edicion?.id ===
                      item.id;

                    const stockActual =
                      Number(
                        item.stockActual ??
                          0
                      );

                    const stockMinimo =
                      Number(
                        item.stockMinimo ??
                          0
                      );

                    const esStockBajo =
                      stockActual <=
                      stockMinimo;

                    return (
                      <tr
                        key={item.id}
                        style={{
                          borderBottom:
                            '1px solid #334155'
                        }}
                      >
                        {/* CÓDIGO */}
                        <td
                          style={{
                            padding:
                              '12px',
                            fontWeight:
                              'bold',
                            color:
                              '#38bdf8'
                          }}
                        >
                          {item.codigo ||
                            'Sin código'}
                        </td>

                        {/* TIPO / DETALLES */}
                        <td
                          style={{
                            padding:
                              '12px'
                          }}
                        >
                          {esModoEdicion ? (
                            <>
                              <input
                                type="text"
                                value={
                                  edicion.marca ??
                                  ''
                                }
                                onChange={(
                                  e
                                ) =>
                                  setEdicion(
                                    {
                                      ...edicion,
                                      marca:
                                        e
                                          .target
                                          .value
                                    }
                                  )
                                }
                                placeholder="Marca"
                                style={{
                                  width:
                                    '80px',
                                  background:
                                    '#0f172a',
                                  color:
                                    '#fff',
                                  border:
                                    '1px solid #475569',
                                  padding:
                                    '4px',
                                  marginRight:
                                    '4px'
                                }}
                              />

                              <input
                                type="text"
                                value={
                                  edicion.modelo ??
                                  ''
                                }
                                onChange={(
                                  e
                                ) =>
                                  setEdicion(
                                    {
                                      ...edicion,
                                      modelo:
                                        e
                                          .target
                                          .value
                                    }
                                  )
                                }
                                placeholder="Modelo"
                                style={{
                                  width:
                                    '80px',
                                  background:
                                    '#0f172a',
                                  color:
                                    '#fff',
                                  border:
                                    '1px solid #475569',
                                  padding:
                                    '4px'
                                }}
                              />
                            </>
                          ) : (
                            <div>
                              <strong>
                                {item.tipo ||
                                  'Sin tipo'}
                              </strong>{' '}
                              -{' '}
                              {item.marca ||
                                ''}{' '}
                              {item.modelo ||
                                ''}

                              {item.color && (
                                <small
                                  style={{
                                    display:
                                      'block',
                                    color:
                                      '#94a3b8'
                                  }}
                                >
                                  Color:{' '}
                                  {
                                    item.color
                                  }
                                </small>
                              )}
                            </div>
                          )}
                        </td>

                        {/* STOCK ACTUAL */}
                        <td
                          style={{
                            padding:
                              '12px'
                          }}
                        >
                          {esModoEdicion ? (
                            <input
                              type="number"
                              min="0"
                              value={
                                edicion.stockActual ??
                                ''
                              }
                              onChange={(
                                e
                              ) =>
                                setEdicion(
                                  {
                                    ...edicion,
                                    stockActual:
                                      e
                                        .target
                                        .value
                                  }
                                )
                              }
                              style={{
                                width:
                                  '60px',
                                background:
                                  '#0f172a',
                                color:
                                  '#fff',
                                border:
                                  '1px solid #475569',
                                padding:
                                  '4px'
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                fontWeight:
                                  'bold',
                                fontSize:
                                  '15px',
                                color:
                                  esStockBajo
                                    ? '#f87171'
                                    : '#4ade80'
                              }}
                            >
                              {
                                stockActual
                              }
                            </span>
                          )}
                        </td>

                        {/* STOCK MÍNIMO */}
                        <td
                          style={{
                            padding:
                              '12px'
                          }}
                        >
                          {esModoEdicion ? (
                            <input
                              type="number"
                              min="0"
                              value={
                                edicion.stockMinimo ??
                                ''
                              }
                              onChange={(
                                e
                              ) =>
                                setEdicion(
                                  {
                                    ...edicion,
                                    stockMinimo:
                                      e
                                        .target
                                        .value
                                  }
                                )
                              }
                              style={{
                                width:
                                  '60px',
                                background:
                                  '#0f172a',
                                color:
                                  '#fff',
                                border:
                                  '1px solid #475569',
                                padding:
                                  '4px'
                              }}
                            />
                          ) : (
                            <span>
                              {
                                stockMinimo
                              }
                            </span>
                          )}
                        </td>

                        {/* ÚLTIMA SALIDA */}
                        <td
                          style={{
                            padding:
                              '12px',
                            color:
                              '#94a3b8'
                          }}
                        >
                          {item.ultimaSalida ||
                            'Sin registros'}

                          {item.diasSinDespacho !==
                            null &&
                            item.diasSinDespacho !==
                              undefined && (
                              <small
                                style={{
                                  display:
                                    'block',
                                  color:
                                    Number(
                                      item.diasSinDespacho
                                    ) >=
                                    15
                                      ? '#fbbf24'
                                      : '#64748b'
                                }}
                              >
                                (hace{' '}
                                {
                                  item.diasSinDespacho
                                }{' '}
                                días)
                              </small>
                            )}
                        </td>

                        {/* ESTADO */}
                        <td
                          style={{
                            padding:
                              '12px'
                          }}
                        >
                          {esStockBajo ? (
                            <span
                              style={{
                                background:
                                  '#991b1b',
                                color:
                                  '#fecaca',
                                padding:
                                  '4px 8px',
                                borderRadius:
                                  '4px',
                                fontSize:
                                  '12px'
                              }}
                            >
                              ⚠️ Stock
                              Bajo
                            </span>
                          ) : (
                            <span
                              style={{
                                background:
                                  '#065f46',
                                color:
                                  '#a7f3d0',
                                padding:
                                  '4px 8px',
                                borderRadius:
                                  '4px',
                                fontSize:
                                  '12px'
                              }}
                            >
                              ✓ Ok
                            </span>
                          )}
                        </td>

                        {/* ACCIÓN */}
                        <td
                          style={{
                            padding:
                              '12px',
                            textAlign:
                              'center'
                          }}
                        >
                          {esModoEdicion ? (
                            <div
                              style={{
                                display:
                                  'flex',
                                gap: '5px',
                                justifyContent:
                                  'center'
                              }}
                            >
                              <button
                                type="button"
                                onClick={() =>
                                  guardarEdicion(
                                    item.id
                                  )
                                }
                                style={{
                                  background:
                                    '#16a34a',
                                  color:
                                    '#fff',
                                  border:
                                    'none',
                                  padding:
                                    '5px 10px',
                                  borderRadius:
                                    '4px',
                                  cursor:
                                    'pointer'
                                }}
                              >
                                💾
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  setEdicion(
                                    null
                                  )
                                }
                                style={{
                                  background:
                                    '#475569',
                                  color:
                                    '#fff',
                                  border:
                                    'none',
                                  padding:
                                    '5px 10px',
                                  borderRadius:
                                    '4px',
                                  cursor:
                                    'pointer'
                                }}
                              >
                                ❌
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() =>
                                setEdicion(
                                  {
                                    ...item
                                  }
                                )
                              }
                              style={{
                                background:
                                  '#334155',
                                color:
                                  '#38bdf8',
                                border:
                                  '1px solid #38bdf8',
                                padding:
                                  '5px 10px',
                                borderRadius:
                                  '4px',
                                cursor:
                                  'pointer'
                              }}
                            >
                              ✏️ Editar
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  }
                )
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}