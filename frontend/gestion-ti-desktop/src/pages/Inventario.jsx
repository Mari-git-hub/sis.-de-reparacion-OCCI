import { useState, useEffect } from 'react';
import httpClient from '../api/httpClient';

export default function Inventario() {
  const [equipos, setEquipos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [filtroTienda, setFiltroTienda] = useState('');
  const [busqueda, setBusqueda] = useState('');

  const cargarInventario = async () => {
    try {
      const res = await httpClient.get('/equipos');
      setEquipos(res.data || []);
    } catch (err) {
      console.error('Error al cargar inventario:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarInventario();
  }, []);

  const equiposFiltrados = equipos.filter((item) => {
    const coincideTienda = filtroTienda ? item.tiendaId === parseInt(filtroTienda) : true;
    const coincideBusqueda = 
      item.codigoInterno?.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.serie?.toLowerCase().includes(busqueda.toLowerCase()) ||
      item.nombreEquipo?.toLowerCase().includes(busqueda.toLowerCase());
    return coincideTienda && coincideBusqueda;
  });

  return (
    <div style={{ maxWidth: '1000px', margin: '30px auto', padding: '25px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ borderBottom: '2px solid #2563eb', paddingBottom: '10px', color: '#1e293b' }}>
        Inventario General de Activos IT
      </h2>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '15px', marginBottom: '20px' }}>
        <input 
          type="text" 
          placeholder="Buscar por Código, Serie o Nombre..." 
          value={busqueda} 
          onChange={(e) => setBusqueda(e.target.value)} 
          style={{ flex: 2, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        />
        <select 
          value={filtroTienda} 
          onChange={(e) => setFiltroTienda(e.target.value)} 
          style={{ flex: 1, padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
        >
          <option value="">Todas las Tiendas (1-14)</option>
          {[...Array(14)].map((_, i) => (
            <option key={i + 1} value={i + 1}>Tienda {i + 1}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {cargando ? (
        <p>Cargando inventario...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Código</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Equipo / Marca</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Tipo</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Serie</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Tienda</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {equiposFiltrados.length === 0 ? (
              <tr>
                <td colSpan="6" style={{ padding: '15px', textAlign: 'center', color: '#64748b' }}>
                  No se encontraron activos registrados.
                </td>
              </tr>
            ) : (
              equiposFiltrados.map((eq) => (
                <tr key={eq.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold' }}>{eq.codigoInterno}</td>
                  <td style={{ padding: '10px' }}>{eq.nombreEquipo} {eq.marca && `(${eq.marca})`}</td>
                  <td style={{ padding: '10px' }}>{eq.tipoEquipo}</td>
                  <td style={{ padding: '10px', fontSize: '13px' }}>{eq.serie}</td>
                  <td style={{ padding: '10px' }}>Tienda {eq.tiendaId}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '3px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      background: eq.estado === 'OPERATIVO' ? '#dcfce7' : '#fef2f2',
                      color: eq.estado === 'OPERATIVO' ? '#166534' : '#991b1b'
                    }}>
                      {eq.estado || 'OPERATIVO'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}