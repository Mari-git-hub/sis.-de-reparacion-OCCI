
import { useCallback, useEffect, useState } from 'react';
import httpClient from '../api/httpClient';
import './FormatoIngreso.css';

const formularioInicial = {
  tiendaId: '',
  codigoInterno: '',
  nombreEquipo: '',
  tipoEquipo: 'CPU',
  marca: '',
  modelo: '',
  serie: '',
  estadoFisico: '',
  accesorios: '',
  fallaReportada: ''
};

function obtenerLista(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.$values)) return data.$values;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.data)) return data.data;
  if (Array.isArray(data?.reparaciones)) return data.reparaciones;
  return [];
}

function texto(valor) {
  return valor == null || valor === '' ? 'No indicado' : String(valor);
}

function escapar(valor) {
  return String(valor ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function fechaLocal(valor) {
  if (!valor) return 'No indicada';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime())
    ? 'No indicada'
    : fecha.toLocaleString('es-HN');
}

function imprimirFormato(item) {
  const ventana = window.open('', '_blank', 'width=900,height=750');

  if (!ventana) {
    alert(
      'El navegador bloqueó la ventana. Permite ventanas emergentes para este sitio.'
    );
    return;
  }

  const tienda =
    [item.tiendaCodigo, item.tiendaNombre].filter(Boolean).join(' - ') ||
    `Tienda ${item.tiendaId ?? ''}`;

  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Formato de ingreso ${escapar(item.folio || item.id)}</title>
<style>
@page { size: A4; margin: 16mm; }
* { box-sizing: border-box; }
body { font-family: Arial, sans-serif; color: #172033; font-size: 12px; }
header { border-bottom: 3px solid #075985; padding-bottom: 12px; margin-bottom: 20px; }
h1 { font-size: 22px; margin: 0 0 6px; }
h2 { font-size: 14px; background: #eff6ff; padding: 9px; margin-top: 20px; }
.sub { color: #526176; }
.folio { float: right; font-weight: bold; }
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px 20px; }
.campo { border-bottom: 1px solid #dbe3ed; padding: 8px 0; min-height: 35px; }
.etiqueta { font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: bold; margin-bottom: 4px; }
.valor { white-space: pre-wrap; overflow-wrap: anywhere; }
.ancho { grid-column: 1 / -1; }
.firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 50px; margin-top: 65px; text-align: center; }
.firma { border-top: 1px solid #475569; padding-top: 8px; }
footer { margin-top: 25px; color: #64748b; font-size: 10px; text-align: center; }
@media print { .no-print { display: none; } }
</style>
</head>
<body>
<header>
  <span class="folio">Folio: ${escapar(item.folio || `REG-${item.id}`)}</span>
  <h1>Formato de ingreso / recepción de equipo</h1>
  <p class="sub">Sistema de Gestión IT</p>
</header>

<div class="grid">
  <div class="campo">
    <div class="etiqueta">Fecha de ingreso</div>
    <div class="valor">${escapar(fechaLocal(item.fechaIngreso || item.fechaRegistro))}</div>
  </div>
  <div class="campo">
    <div class="etiqueta">Tienda / sucursal</div>
    <div class="valor">${escapar(tienda)}</div>
  </div>
</div>

<h2>Datos del equipo</h2>
<div class="grid">
  <div class="campo"><div class="etiqueta">Nombre del equipo</div><div class="valor">${escapar(texto(item.nombreEquipo))}</div></div>
  <div class="campo"><div class="etiqueta">Tipo</div><div class="valor">${escapar(texto(item.tipoEquipo))}</div></div>
  <div class="campo"><div class="etiqueta">Marca</div><div class="valor">${escapar(texto(item.marca))}</div></div>
  <div class="campo"><div class="etiqueta">Modelo</div><div class="valor">${escapar(texto(item.modelo))}</div></div>
  <div class="campo"><div class="etiqueta">Número de serie</div><div class="valor">${escapar(texto(item.serie))}</div></div>
  <div class="campo"><div class="etiqueta">Código interno</div><div class="valor">${escapar(texto(item.codigoInterno))}</div></div>
</div>

<h2>Condiciones de recepción</h2>
<div class="grid">
  <div class="campo ancho"><div class="etiqueta">Estado físico</div><div class="valor">${escapar(texto(item.estadoFisico))}</div></div>
  <div class="campo ancho"><div class="etiqueta">Accesorios incluidos</div><div class="valor">${escapar(texto(item.accesorios))}</div></div>
  <div class="campo ancho"><div class="etiqueta">Falla reportada</div><div class="valor">${escapar(texto(item.fallaReportada))}</div></div>
</div>

<div class="firmas">
  <div class="firma">Firma de quien entrega</div>
  <div class="firma">Firma de quien recibe</div>
</div>

<footer>Formato generado desde el Sistema de Gestión IT.</footer>
<script>
window.onload = () => setTimeout(() => window.print(), 300);
</script>
</body>
</html>`;

  ventana.document.open();
  ventana.document.write(html);
  ventana.document.close();
}

export default function FormatoIngreso() {
  const [form, setForm] = useState(formularioInicial);
  const [tiendas, setTiendas] = useState([]);
  const [registros, setRegistros] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const cargarRegistros = useCallback(async () => {
    setCargando(true);

    try {
      const respuesta = await httpClient.get('/formatos/reparaciones');
      setRegistros(obtenerLista(respuesta.data));
      setError('');
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'No se pudieron consultar los formatos. Revisa la API.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarRegistros();

    httpClient.get('/tiendas')
      .then((respuesta) => {
        setTiendas(obtenerLista(respuesta.data));
      })
      .catch(() => {
        setTiendas([]);
      });
  }, [cargarRegistros]);

  function cambiarCampo(event) {
    const { name, value } = event.target;
    setForm((anterior) => ({ ...anterior, [name]: value }));
  }

  async function guardar(event) {
    event.preventDefault();
    setMensaje('');
    setError('');

    if (
      !form.tiendaId ||
      !form.nombreEquipo.trim() ||
      !form.tipoEquipo ||
      !form.marca.trim() ||
      !form.serie.trim() ||
      !form.estadoFisico.trim() ||
      !form.fallaReportada.trim()
    ) {
      setError(
        'Completa tienda, nombre, tipo, marca, serie, estado físico y falla reportada.'
      );
      return;
    }

    const datos = {
      tiendaId: Number(form.tiendaId),
      codigoInterno: form.codigoInterno.trim(),
      nombreEquipo: form.nombreEquipo.trim(),
      tipoEquipo: form.tipoEquipo,
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      serie: form.serie.trim(),
      estadoFisico: form.estadoFisico.trim(),
      accesorios: form.accesorios.trim(),
      fallaReportada: form.fallaReportada.trim()
    };

    setGuardando(true);

    try {
      const respuesta = await httpClient.post('/formatos/ingreso', datos);

      const folio = respuesta.data?.folio;
      setMensaje(
        `${respuesta.data?.mensaje || 'Formato guardado correctamente.'}${
          folio ? ` Folio: ${folio}.` : ''
        }`
      );

      setForm(formularioInicial);
      await cargarRegistros();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        err.response?.data?.detail ||
        'No se pudo guardar el formato. Revisa el error de la API.'
      );
    } finally {
      setGuardando(false);
    }
  }

  const filtro = busqueda.trim().toLowerCase();

  const registrosFiltrados = registros.filter((item) =>
    [
      item.folio,
      item.nombreEquipo,
      item.serie,
      item.codigoInterno,
      item.tiendaNombre,
      item.tiendaCodigo
    ].some((valor) => String(valor ?? '').toLowerCase().includes(filtro))
  );

  return (
    <main className="formato-ingreso-page">
      <section className="formato-ingreso-card">
        <div className="formato-ingreso-header">
          <div>
            <p className="formato-kicker">RECEPCIÓN DE EQUIPO</p>
            <h1>Formato de ingreso de equipo</h1>
            <p>Completa los datos y guarda el comprobante en el sistema.</p>
          </div>
        </div>

        {mensaje && <div className="fi-alert fi-alert-success">{mensaje}</div>}
        {error && <div className="fi-alert fi-alert-error">{error}</div>}

        <form onSubmit={guardar}>
          <h2>Datos generales</h2>

          <div className="fi-form-grid">
            <label>
              Tienda / sucursal *
              <select
                name="tiendaId"
                value={form.tiendaId}
                onChange={cambiarCampo}
                required
              >
                <option value="">Selecciona una tienda</option>
                {tiendas.map((tienda) => (
                  <option key={tienda.id} value={tienda.id}>
                    {[tienda.codigo, tienda.nombre].filter(Boolean).join(' - ')}
                  </option>
                ))}
              </select>
              {tiendas.length === 0 && (
                <small>No hay tiendas disponibles. Verifica el endpoint GET /tiendas.</small>
              )}
            </label>

            <label>
              Tipo de equipo *
              <select
                name="tipoEquipo"
                value={form.tipoEquipo}
                onChange={cambiarCampo}
                required
              >
                <option value="CPU">CPU</option>
                <option value="LAPTOP">Laptop</option>
                <option value="IMPRESORA_NORMAL">Impresora normal</option>
                <option value="IMPRESORA_CAJA">Impresora de caja</option>
                <option value="IMPRESORA_ETIQUETAS">Impresora de etiquetas</option>
                <option value="RELOJ_MARCADOR">Reloj marcador</option>
              </select>
            </label>

            <label>
              Código interno
              <input
                name="codigoInterno"
                value={form.codigoInterno}
                onChange={cambiarCampo}
                maxLength={50}
                placeholder="Ej. EQ-0001"
              />
            </label>

            <label>
              Número de serie *
              <input
                name="serie"
                value={form.serie}
                onChange={cambiarCampo}
                required
                maxLength={80}
                placeholder="Serie del equipo"
              />
            </label>

            <label className="fi-full">
              Nombre / descripción del equipo *
              <input
                name="nombreEquipo"
                value={form.nombreEquipo}
                onChange={cambiarCampo}
                required
                maxLength={100}
                placeholder="Ej. Laptop HP ProBook"
              />
            </label>

            <label>
              Marca *
              <input
                name="marca"
                value={form.marca}
                onChange={cambiarCampo}
                required
                maxLength={60}
                placeholder="Ej. HP, Epson, Zebra"
              />
            </label>

            <label>
              Modelo
              <input
                name="modelo"
                value={form.modelo}
                onChange={cambiarCampo}
                maxLength={60}
              />
            </label>
          </div>

          <h2>Condiciones de recepción</h2>

          <div className="fi-form-grid">
            <label className="fi-full">
              Estado físico del equipo *
              <textarea
                name="estadoFisico"
                value={form.estadoFisico}
                onChange={cambiarCampo}
                required
                rows={3}
                maxLength={255}
                placeholder="Describe golpes, rayones, daños o condición visual."
              />
            </label>

            <label className="fi-full">
              Accesorios incluidos
              <textarea
                name="accesorios"
                value={form.accesorios}
                onChange={cambiarCampo}
                rows={2}
                maxLength={255}
                placeholder="Cargador, cables, adaptador u otros accesorios."
              />
            </label>

            <label className="fi-full">
              Falla reportada *
              <textarea
                name="fallaReportada"
                value={form.fallaReportada}
                onChange={cambiarCampo}
                required
                rows={4}
                placeholder="Describe el problema reportado."
              />
            </label>
          </div>

          <div className="fi-actions">
            <button
              className="fi-btn fi-btn-primary"
              type="submit"
              disabled={guardando || tiendas.length === 0}
            >
              {guardando ? 'Guardando...' : 'Guardar formato'}
            </button>

            <button
              className="fi-btn fi-btn-light"
              type="button"
              onClick={() => setForm(formularioInicial)}
              disabled={guardando}
            >
              Limpiar formulario
            </button>
          </div>
        </form>
      </section>

      <section className="formato-ingreso-card fi-list-card">
        <div className="fi-list-heading">
          <div>
            <h2>Formatos registrados</h2>
            <p>Los registros guardados en la base de datos aparecerán aquí.</p>
          </div>

          <button
            className="fi-btn fi-btn-light"
            type="button"
            onClick={cargarRegistros}
            disabled={cargando}
          >
            {cargando ? 'Actualizando...' : 'Actualizar lista'}
          </button>
        </div>

        <label className="fi-search">
          Buscar por folio, serie, equipo o tienda
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Escribe para filtrar..."
          />
        </label>

        {cargando && registros.length === 0 ? (
          <p>Cargando registros...</p>
        ) : registrosFiltrados.length === 0 ? (
          <p className="fi-empty">
            No hay formatos para mostrar. Después de guardar uno, actualiza esta lista.
          </p>
        ) : (
          <div className="fi-table-wrap">
            <table className="fi-table">
              <thead>
                <tr>
                  <th>Folio</th>
                  <th>Equipo / serie</th>
                  <th>Tienda</th>
                  <th>Fecha</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {registrosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.folio || `REG-${item.id}`}</strong></td>
                    <td>
                      {item.nombreEquipo || 'Equipo'}
                      <small>{item.serie || 'Sin serie'}</small>
                    </td>
                    <td>
                      {[item.tiendaCodigo, item.tiendaNombre]
                        .filter(Boolean)
                        .join(' - ') || item.tiendaId || '—'}
                    </td>
                    <td>{fechaLocal(item.fechaIngreso || item.fechaRegistro)}</td>
                    <td><span className="fi-status">{item.estado || 'Registrado'}</span></td>
                    <td>
                      <button
                        type="button"
                        className="fi-link"
                        onClick={() => imprimirFormato(item)}
                      >
                        Imprimir / Guardar PDF
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}
