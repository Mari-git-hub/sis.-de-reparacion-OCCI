import { useState, useEffect } from 'react';
import httpClient from '../api/httpClient';

export default function NotificacionesSolicitudes() {
  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [permisoPush, setPermisoPush] = useState(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'denied'
  );

  // Solicitar permiso de Notificaciones Push
  const solicitarPermisoPush = async () => {
    if ('Notification' in window) {
      const res = await Notification.requestPermission();
      setPermisoPush(res);
    }
  };

  // Función para disparar la notificación Push del Navegador
  const lanzarNotificacionPush = (titulo, cuerpo) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, {
        body: cuerpo,
        icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827504.png'
      });
    }
  };

  const obtenerSolicitudesRecientes = async () => {
    try {
      setCargando(true);
      // Endpoint para obtener las solicitudes de insumos y reparaciones
      const res = await httpClient.get('/solicitudes/recientes');
      const datos = res.data || [];
      
      // Si hay una solicitud muy reciente (ej. hace menos de 1 minuto), se dispara Push
      if (datos.length > 0 && solicitudes.length > 0 && datos.length > solicitudes.length) {
        const ultima = datos[0];
        lanzarNotificacionPush(
          `🚨 Nueva Solicitud de ${ultima.tipo || 'Servicio'}`,
          `Ingresada por: ${ultima.usuario || 'Usuario'} - ${ultima.departamento || ''}`
        );
      }

      setSolicitudes(datos);
    } catch (err) {
      console.error('Error al cargar notificaciones de solicitudes:', err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    obtenerSolicitudesRecientes();
  }, []);

  return (
    <div style={{ maxWidth: '900px', margin: '30px auto', padding: '25px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      
      {/* Encabezado con Botón de Notificaciones Push */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0284c7', paddingBottom: '10px' }}>
        <h2 style={{ color: '#1e293b', margin: 0, fontSize: '20px' }}>
          🔔 Centro de Notificaciones y Nuevas Solicitudes
        </h2>
        
        {permisoPush !== 'granted' && (
          <button 
            onClick={solicitarPermisoPush} 
            style={{ background: '#0284c7', color: '#fff', border: 'none', padding: '8px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px', fontWeight: 'bold' }}
          >
            Activar Alertas Push 📲
          </button>
        )}
      </div>

      <p style={{ color: '#64748b', fontSize: '14px', marginTop: '10px' }}>
        Aviso en tiempo real de nuevas solicitudes de <strong>Insumos</strong> y <strong>Equipos de Reparación</strong> ingresados.
      </p>

      {/* Estado del Listado */}
      {cargando ? (
        <p style={{ marginTop: '20px' }}>Cargando notificaciones recientes...</p>
      ) : solicitudes.length === 0 ? (
        <div style={{ background: '#f0fdf4', color: '#166534', padding: '15px', borderRadius: '6px', marginTop: '15px' }}>
          No hay nuevas solicitudes registradas por el momento.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '15px' }}>
          <thead>
            <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Tipo</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Detalle / Descripción</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Departamento / Oficina</th>
              <th style={{ padding: '10px', borderBottom: '2px solid #cbd5e1' }}>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((item, index) => {
              const esInsumo = String(item.tipo).toUpperCase() === 'INSUMO';
              return (
                <tr key={item.id || index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                  {/* Badge de Tipo */}
                  <td style={{ padding: '10px' }}>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      color: '#fff', 
                      background: esInsumo ? '#10b981' : '#f97316', // Verde = Insumo, Naranja = Reparación
                      fontSize: '11px',
                      fontWeight: 'bold',
                      textTransform: 'uppercase'
                    }}>
                      {esInsumo ? '📦 INSUMO' : '🔧 REPARACIÓN'}
                    </span>
                  </td>

                  {/* Mensaje o Descripción */}
                  <td style={{ padding: '10px' }}>
                    <strong>{item.usuario || 'Usuario'}:</strong> {item.descripcion || item.mensaje || 'Nueva solicitud registrada'}
                  </td>

                  {/* Departamento / Oficina */}
                  <td style={{ padding: '10px', color: '#334155', fontSize: '13px' }}>
                    {item.departamento || 'General'} {item.oficina ? `- ${item.oficina}` : ''}
                  </td>

                  {/* Fecha */}
                  <td style={{ padding: '10px', fontSize: '13px', color: '#64748b' }}>
                    {item.fechaGenerada ? new Date(item.fechaGenerada).toLocaleString('es-HN') : 'Reciente'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Botón manual para refrescar */}
      <div style={{ marginTop: '20px', textAlign: 'right' }}>
        <button 
          onClick={obtenerSolicitudesRecientes} 
          style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
        >
          🔄 Actualizar Notificaciones
        </button>
      </div>
    </div>
  );
}