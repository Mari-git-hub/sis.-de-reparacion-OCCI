import { useState, useEffect } from 'react';
import httpClient from '../api/httpClient';

export default function Reparaciones() {
  const [ordenes, setOrdenes] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargarOrdenes = async () => {
      try {
        const res = await httpClient.get('/formatos/reparaciones');
        setOrdenes(res.data || []);
      } catch (err) {
        console.error('Error al cargar órdenes de reparación:', err);
      } finally {
        setCargando(false);
      }
    };

    cargarOrdenes();
  }, []);

  return (
    <div style={{ maxWidth: '1000px', margin: '30px auto', padding: '25px', background: '#fff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ borderBottom: '2px solid #2563eb', paddingBottom: '10px', color: '#1e293b' }}>
        Historial y Estado de Órdenes de Reparación
      </h2>

      {cargando ? (
        <p>Cargando lista de reparaciones...</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Folio</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Equipo</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Falla Reportada</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Fecha Recepción</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Estado Orden</th>
            </tr>
          </thead>
          <tbody>
            {ordenes.length === 0 ? (
              <tr>
                <td colSpan="5" style={{ padding: '15px', textAlign: 'center', color: '#64748b' }}>
                  No hay órdenes de reparación registradas.
                </td>
              </tr>
            ) : (
              ordenes.map((ord) => (
                <tr key={ord.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: '#2563eb' }}>{ord.folio}</td>
                  <td style={{ padding: '10px' }}>{ord.nombreEquipo}</td>
                  <td style={{ padding: '10px', fontSize: '13px' }}>{ord.fallaReportada}</td>
                  <td style={{ padding: '10px', fontSize: '13px' }}>{new Date(ord.fechaIngreso).toLocaleDateString()}</td>
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      fontSize: '12px', 
                      fontWeight: 'bold',
                      background: ord.estado === 'RECIBIDO' ? '#fef3c7' : ord.estado === 'EN_REPARACION' ? '#dbeafe' : '#dcfce7',
                      color: ord.estado === 'RECIBIDO' ? '#92400e' : ord.estado === 'EN_REPARACION' ? '#1e40af' : '#166534'
                    }}>
                      {ord.estado}
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