
import { useCallback, useEffect, useState } from 'react';
import httpClient from '../api/httpClient';
import { useAuth } from '../auth/AuthContext';

const normalizar = (valor) =>
  String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim();

const obtenerLista = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.$values)) return data.$values;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.solicitudes)) return data.solicitudes;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const esInsumo = (item) => {
  const tipo = normalizar(item.tipo || item.tipoSolicitud || item.categoria);
  return tipo.includes('INSUMO') || tipo.includes('CONSUMIBLE');
};

const obtenerEstado = (item) =>
  normalizar(item.estado || item.estadoActual || item.estatus || 'RECIBIDA');

const obtenerPasos = (item) => {
  if (esInsumo(item)) {
    return [
      { nombre: 'Pedido recibido', claves: ['RECIB', 'REGISTR', 'NUEVA', 'PENDIENTE'] },
      { nombre: 'En revisión', claves: ['REVISION', 'REVISANDO', 'APROBACION', 'APROBADO'] },
      { nombre: 'Preparando entrega', claves: ['PREPAR', 'PROCESO', 'ATENDIENDO', 'AUTORIZADO'] },
      { nombre: 'Pedido entregado', claves: ['ENTREG', 'COMPLET', 'FINALIZ', 'CERRAD'] }
    ];
  }

  return [
    { nombre: 'Solicitud recibida', claves: ['RECIB', 'REGISTR', 'NUEVA', 'PENDIENTE'] },
    { nombre: 'En revisión', claves: ['REVISION', 'DIAGNOST', 'EVALUACION', 'ASIGNAD'] },
    { nombre: 'Reparación en proceso', claves: ['PROCESO', 'REPARACION', 'TRABAJANDO', 'ESPERA'] },
    { nombre: 'Proceso finalizado', claves: ['ENTREG', 'COMPLET', 'FINALIZ', 'CERRAD', 'RESUELT'] }
  ];
};

const calcularPaso = (estado, pasos) => {
  const estadoNormalizado = normalizar(estado);

  if (estadoNormalizado.includes('CANCEL')) return -1;
  if (estadoNormalizado.includes('RECHAZ')) return -1;
  if (estadoNormalizado.includes('BAJA')) return 3;

  for (let i = pasos.length - 1; i >= 0; i--) {
    if (pasos[i].claves.some((clave) => estadoNormalizado.includes(clave))) {
      return i;
    }
  }

  return 0;
};

const fechaLegible = (fecha) => {
  if (!fecha) return 'Pendiente de actualización';

  const valor = new Date(fecha);
  if (Number.isNaN(valor.getTime())) return 'Fecha no disponible';

  return valor.toLocaleString('es-HN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
};

const estilos = {
  pagina: {
    maxWidth: 1000,
    margin: '25px auto',
    padding: 20,
    color: '#1e293b'
  },
  tarjeta: {
    background: '#fff',
    border: '1px solid #e2e8f0',
    borderRadius: 12,
    padding: 20,
    marginTop: 16,
    boxShadow: '0 3px 10px rgba(15,23,42,0.05)'
  },
  boton: {
    background: '#0369a1',
    color: '#fff',
    border: 0,
    borderRadius: 7,
    padding: '10px 14px',
    cursor: 'pointer',
    fontWeight: 600
  },
  textoSecundario: {
    color: '#64748b',
    fontSize: 14
  }
};

function Seguimiento({ item }) {
  const pasos = obtenerPasos(item);
  const estado = obtenerEstado(item);
  const pasoActual = calcularPaso(estado, pasos);
  const cancelada = pasoActual === -1;

  const titulo = esInsumo(item)
    ? 'Pedido de insumos'
    : 'Solicitud de reparación';

  const descripcion =
    item.equipo ||
    item.descripcion ||
    item.mensaje ||
    item.codigoInterno ||
    item.detalle ||
    'Solicitud registrada';

  const fecha =
    item.fechaActualizacion ||
    item.fechaGenerada ||
    item.fechaRegistro ||
    item.fecha;

  const comentario =
    item.comentario ||
    item.observaciones ||
    item.mensajeEstado ||
    '';

  return (
    <article style={estilos.tarjeta}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          flexWrap: 'wrap',
          gap: 12
        }}
      >
        <div>
          <span
            style={{
              display: 'inline-block',
              padding: '5px 9px',
              borderRadius: 20,
              background: esInsumo(item) ? '#d1fae5' : '#ffedd5',
              color: esInsumo(item) ? '#065f46' : '#9a3412',
              fontSize: 12,
              fontWeight: 700
            }}
          >
            {esInsumo(item) ? '📦 PEDIDO DE INSUMOS' : '🔧 REPARACIÓN'}
          </span>

          <h3 style={{ margin: '12px 0 5px' }}>
            {titulo} {item.folio ? `· ${item.folio}` : item.id ? `· #${item.id}` : ''}
          </h3>

          <p style={{ margin: 0, ...estilos.textoSecundario }}>
            {descripcion}
          </p>
        </div>

        <div
          style={{
            background: cancelada ? '#fee2e2' : '#e0f2fe',
            color: cancelada ? '#991b1b' : '#075985',
            borderRadius: 8,
            padding: '8px 11px',
            fontWeight: 700,
            fontSize: 13
          }}
        >
          {estado.replaceAll('_', ' ')}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${pasos.length}, minmax(0, 1fr))`,
            gap: 8
          }}
        >
          {pasos.map((paso, index) => {
            const completado = !cancelada && index < pasoActual;
            const actual = !cancelada && index === pasoActual;

            return (
              <div key={paso.nombre} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 30,
                    height: 30,
                    margin: '0 auto 8px',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: completado || actual ? '#0284c7' : '#e2e8f0',
                    color: completado || actual ? '#fff' : '#475569',
                    fontWeight: 700
                  }}
                >
                  {completado ? '✓' : index + 1}
                </div>

                <div
                  style={{
                    fontSize: 12,
                    color: actual ? '#0369a1' : '#64748b',
                    fontWeight: actual ? 700 : 400
                  }}
                >
                  {paso.nombre}
                </div>
              </div>
            );
          })}
        </div>

        <div
          style={{
            height: 6,
            background: '#e2e8f0',
            borderRadius: 10,
            marginTop: 15,
            overflow: 'hidden'
          }}
        >
          <div
            style={{
              height: '100%',
              width: cancelada
                ? '100%'
                : `${Math.max(8, (pasoActual / (pasos.length - 1)) * 100)}%`,
              background: cancelada ? '#dc2626' : '#0284c7',
              transition: 'width 0.3s ease'
            }}
          />
        </div>

        {cancelada && (
          <p style={{ color: '#b91c1c', fontWeight: 600 }}>
            Esta solicitud aparece como cancelada o rechazada. Consulta la observación para conocer el motivo.
          </p>
        )}
      </div>

      <div
        style={{
          marginTop: 20,
          paddingTop: 14,
          borderTop: '1px solid #e2e8f0',
          display: 'grid',
          gap: 8
        }}
      >
        <div style={estilos.textoSecundario}>
          <strong>Última actualización:</strong> {fechaLegible(fecha)}
        </div>

        {comentario && (
          <div
            style={{
              background: '#f8fafc',
              borderRadius: 8,
              padding: 12,
              fontSize: 14
            }}
          >
            <strong>Observación del proceso:</strong>
            <p style={{ margin: '6px 0 0' }}>{comentario}</p>
          </div>
        )}
      </div>
    </article>
  );
}

export default function NotificacionesSolicitudes() {
  const { usuario } = useAuth();

  const rol = normalizar(usuario?.rol || usuario?.role || '');
  const esSolicitante =
    rol.includes('SOLICITANTE') ||
    rol === 'USUARIO';

  const [solicitudes, setSolicitudes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState('');
  const [permisoPush, setPermisoPush] = useState(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'denied'
  );

  const solicitarPermisoPush = async () => {
    if (!('Notification' in window)) {
      setError('Este navegador no permite notificaciones push.');
      return;
    }

    const resultado = await Notification.requestPermission();
    setPermisoPush(resultado);
  };

  const lanzarNotificacionPush = (titulo, cuerpo) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(titulo, {
        body: cuerpo,
        icon: 'https://cdn-icons-png.flaticon.com/512/1827/1827504.png'
      });
    }
  };

  const obtenerSolicitudes = useCallback(async () => {
    try {
      setCargando(true);
      setError('');

      const res = await httpClient.get('/solicitudes/recientes');
      const datos = obtenerLista(res.data);

      setSolicitudes((anteriores) => {
        // Las notificaciones de nuevas solicitudes solo son para Admin y Técnico.
        if (
          !esSolicitante &&
          anteriores.length > 0 &&
          datos.length > anteriores.length
        ) {
          lanzarNotificacionPush(
            'Nueva solicitud registrada',
            'Hay una nueva solicitud pendiente de revisión.'
          );
        }

        return datos;
      });
    } catch (err) {
      console.error('Error al cargar solicitudes:', err);
      setError(
        'No fue posible consultar el avance. Intenta actualizar o comunícate con soporte.'
      );
    } finally {
      setCargando(false);
    }
  }, [esSolicitante]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    obtenerSolicitudes();
  }, [obtenerSolicitudes]);

  const solicitudesVisibles = esSolicitante
    ? solicitudes
    : solicitudes;

  return (
    <main style={estilos.pagina}>
      {esSolicitante ? (
        <>
          <header
            style={{
              padding: 22,
              background: 'linear-gradient(135deg, #0c4a6e, #0284c7)',
              borderRadius: 14,
              color: '#fff'
            }}
          >
            <div style={{ fontSize: 28 }}>📍</div>
            <h2 style={{ margin: '8px 0' }}>Mis procesos</h2>
            <p style={{ margin: 0, lineHeight: 1.6 }}>
              Consulta cómo avanza la reparación de tu equipo y el estado de tus pedidos de insumos.
              Aquí puedes revisar la última actualización de cada proceso.
            </p>
          </header>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
              marginTop: 20
            }}
          >
            <div>
              <h3 style={{ margin: 0 }}>Seguimiento de mis solicitudes</h3>
              <p style={estilos.textoSecundario}>
                {solicitudesVisibles.length} proceso(s) registrados
              </p>
            </div>

            <button
              type="button"
              onClick={obtenerSolicitudes}
              style={estilos.boton}
              disabled={cargando}
            >
              {cargando ? 'Actualizando…' : '↻ Actualizar avance'}
            </button>
          </div>
        </>
      ) : (
        <header
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            borderBottom: '2px solid #0284c7',
            paddingBottom: 14
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>🔔 Centro de notificaciones</h2>
            <p style={estilos.textoSecundario}>
              Solicitudes recientes de insumos y reparaciones.
            </p>
          </div>

          {permisoPush !== 'granted' && (
            <button
              type="button"
              onClick={solicitarPermisoPush}
              style={estilos.boton}
            >
              Activar alertas push
            </button>
          )}

          <button
            type="button"
            onClick={obtenerSolicitudes}
            style={estilos.boton}
            disabled={cargando}
          >
            Actualizar
          </button>
        </header>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 18,
            padding: 14,
            background: '#fef2f2',
            color: '#991b1b',
            borderRadius: 8
          }}
        >
          {error}
        </div>
      )}

      {cargando ? (
        <p style={{ marginTop: 20 }}>Cargando información…</p>
      ) : solicitudesVisibles.length === 0 ? (
        <div
          style={{
            ...estilos.tarjeta,
            textAlign: 'center',
            padding: 30
          }}
        >
          <div style={{ fontSize: 36 }}>
            {esSolicitante ? '📭' : '🔔'}
          </div>
          <h3>
            {esSolicitante
              ? 'Todavía no tienes procesos para mostrar'
              : 'No hay solicitudes recientes'}
          </h3>
          <p style={estilos.textoSecundario}>
            {esSolicitante
              ? 'Cuando registres una reparación o un pedido de insumos, aquí podrás consultar su avance.'
              : 'Las nuevas solicitudes aparecerán aquí cuando sean registradas.'}
          </p>
        </div>
      ) : esSolicitante ? (
        solicitudesVisibles.map((item, index) => (
          <Seguimiento key={item.id || item.folio || index} item={item} />
        ))
      ) : (
        <div style={{ ...estilos.tarjeta, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f1f5f9', textAlign: 'left' }}>
                <th style={{ padding: 10 }}>Tipo</th>
                <th style={{ padding: 10 }}>Detalle</th>
                <th style={{ padding: 10 }}>Estado</th>
                <th style={{ padding: 10 }}>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {solicitudesVisibles.map((item, index) => (
                <tr
                  key={item.id || item.folio || index}
                  style={{ borderBottom: '1px solid #e2e8f0' }}
                >
                  <td style={{ padding: 10 }}>
                    {esInsumo(item) ? '📦 INSUMO' : '🔧 REPARACIÓN'}
                  </td>
                  <td style={{ padding: 10 }}>
                    {item.descripcion ||
                      item.equipo ||
                      item.mensaje ||
                      item.codigoInterno ||
                      item.folio ||
                      'Solicitud registrada'}
                  </td>
                  <td style={{ padding: 10 }}>
                    {item.estado || item.estadoActual || 'Pendiente'}
                  </td>
                  <td style={{ padding: 10 }}>
                    {fechaLegible(
                      item.fechaGenerada || item.fechaRegistro || item.fecha
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
