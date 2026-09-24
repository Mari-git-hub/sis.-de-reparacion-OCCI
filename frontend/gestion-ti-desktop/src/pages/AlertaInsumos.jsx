import { useState, useEffect } from 'react';
import httpClient from '../api/httpClient';

export default function AlertasInsumos() {
  const [alertas, setAlertas] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Declaramos la función primero
  const obtenerAlertas = async () => {
    try {
      const res = await httpClient.get('/alertas');
      setAlertas(res.data || []);
    } catch (err) {
      console.error('Error al cargar alertas', err);
    } finally {
      setCargando(false);
    }
  };

  // Luego la llamamos dentro del useEffect
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    obtenerAlertas();
  }, []);

  return (
    <div style={{ maxWidth: '850px', margin: '30px auto', padding: '25px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ borderBottom: '2px solid #eab308', paddingBottom: '10px', color: '#1e293b' }}>
        Panel de Alertas y Consumibles Críticos (14 Tiendas)
      </h2>

      {cargando ? (
        <p>Cargando alertas de stock...</p>
      ) : alertas.length === 0 ? (
        <div style={{ background: '#f0fdf4', color: '#166534', padding: '15px', borderRadius: '6px' }}>
          No hay alertas de stock mínimo ni agotamiento en este momento.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Nivel</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Tienda / Mensaje</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((alerta, index) => (
              <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                <td style={{ padding: '10px' }}>
                  <span style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px', 
                    color: '#fff', 
                    background: alerta.nivel === 'CRITICA' ? '#ef4444' : '#f59e0b',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}>
                    {alerta.nivel || 'ADVERTENCIA'}
                  </span>
                </td>
                <td style={{ padding: '10px' }}>{alerta.mensaje}</td>
                <td style={{ padding: '10px', fontSize: '13px', color: '#64748b' }}>
                  {alerta.fechaGenerada ? new Date(alerta.fechaGenerada).toLocaleString() : 'Reciente'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}