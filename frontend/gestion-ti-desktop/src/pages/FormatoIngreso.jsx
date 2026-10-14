import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import httpClient from '../api/httpClient';
import { useAuth } from '../auth/AuthContext';
import './FormatoIngreso.css';

const formularioInicial = (tiendaId = 1) => ({
  tiendaId,
  codigoInterno: '',
  nombreEquipo: '',
  tipoEquipo: 'CPU',
  marca: '',
  modelo: '',
  serie: '',
  estadoFisico: '',
  accesorios: '',
  fallaReportada: ''
});

const obtenerLista = (data) => {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.$values)) return data.$values;
  if (Array.isArray(data?.items)) return data.items;
  if (Array.isArray(data?.reparaciones)) return data.reparaciones;
  if (Array.isArray(data?.data)) return data.data;
  return [];
};

const texto = (valor) => (valor == null || valor === '' ? 'No indicado' : String(valor));

const escaparHtml = (valor) => String(valor ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

const fechaLocal = (valor) => {
  if (!valor) return 'No indicada';
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? 'No indicada' : fecha.toLocaleString('es-HN');
};

export default function FormatoIngreso() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const { id: idRuta } = useParams();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState(() => formularioInicial(usuario?.tiendaId || 1));
  const [registros, setRegistros] = useState([]);
  const [tiendas, setTiendas] = useState([]);
  const [detalle, setDetalle] = useState(null);
  const [editId, setEditId] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const esVistaDetalle = Boolean(idRuta);

  const cargarRegistros = useCallback(async () => {
    try {
      setCargando(true);
      const response = await httpClient.get('/formatos/reparaciones');
      setRegistros(obtenerLista(response.data));
      setError('');
    } catch (err) {
      setError(
        err.response?.data?.mensaje || err.response?.data?.message ||
        'No se pudieron consultar los formatos guardados. Comprueba el endpoint GET /formatos/reparaciones.'
      );
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarRegistros();
    httpClient.get('/tiendas')
      .then((response) => setTiendas(obtenerLista(response.data)))
      .catch(() => setTiendas([]));
  }, [cargarRegistros]);

  useEffect(() => {
    let vigente = true;
    if (!idRuta) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDetalle(null);
      return undefined;
    }

    setCargando(true);
    httpClient.get(`/formatos/ingreso/${idRuta}`)
      .then((response) => {
        if (vigente) {
          const data = response.data?.formato ?? response.data?.data ?? response.data;
          setDetalle(data);
          setError('');
        }
      })
      .catch((err) => {
        if (vigente) {
          setError(err.response?.data?.mensaje || err.response?.data?.message || 'No se pudo abrir el formato.');
          setDetalle(null);
        }
      })
      .finally(() => { if (vigente) setCargando(false); });

    return () => { vigente = false; };
  }, [idRuta]);

  useEffect(() => {
    const editar = searchParams.get('editar');
    if (!idRuta && editar && registros.length) {
      const row = registros.find((item) => String(item.id) === String(editar));
      // eslint-disable-next-line react-hooks/immutability
      if (row) iniciarEdicion(row);
      navigate('/ingreso', { replace: true });
    }
    // La navegación elimina el parámetro editar; se ejecuta solo cuando llega una orden válida.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idRuta, searchParams, registros, navigate]);

  const iniciarEdicion = (row) => {
    setForm({
      tiendaId: row.tiendaId ?? usuario?.tiendaId ?? 1,
      codigoInterno: row.codigoInterno ?? row.codigo_interno ?? '',
      nombreEquipo: row.nombreEquipo ?? row.nombre_equipo ?? row.equipo ?? '',
      tipoEquipo: String(row.tipoEquipo ?? row.tipo_equipo ?? row.tipo ?? 'CPU').toUpperCase(),
      marca: row.marca ?? '',
      modelo: row.modelo ?? '',
      serie: row.serie ?? '',
      estadoFisico: row.estadoFisico ?? row.estado_fisico ?? '',
      accesorios: row.accesorios ?? '',
      fallaReportada: row.fallaReportada ?? row.falla_reportada ?? ''
    });
    setEditId(row.id);
    setMensaje('Estás editando el formato ' + (row.folio || `#${row.id}`) + '.');
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelarEdicion = () => {
    setEditId(null);
    setForm(formularioInicial(usuario?.tiendaId || 1));
    setMensaje('');
    setError('');
  };

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((previous) => ({ ...previous, [name]: name === 'tiendaId' ? value : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMensaje('');
    setError('');

    if (!String(form.tiendaId || '').trim() || !form.nombreEquipo.trim() || !form.serie.trim() || !form.estadoFisico.trim() || !form.fallaReportada.trim()) {
      setError('Completa la tienda, nombre del equipo, serie, estado físico y falla reportada.');
      return;
    }

    const datos = {
      ...form,
      tiendaId: Number(form.tiendaId),
      codigoInterno: form.codigoInterno.trim(),
      nombreEquipo: form.nombreEquipo.trim(),
      tipoEquipo: form.tipoEquipo.toUpperCase(),
      marca: form.marca.trim(),
      modelo: form.modelo.trim(),
      serie: form.serie.trim(),
      estadoFisico: form.estadoFisico.trim(),
      accesorios: form.accesorios.trim(),
      fallaReportada: form.fallaReportada.trim()
    };

    try {
      setGuardando(true);
      const response = editId
        ? await httpClient.put(`/formatos/ingreso/${editId}`, datos)
        : await httpClient.post('/formatos/ingreso', datos);

      const folio = response.data?.folio;
      setMensaje(response.data?.mensaje || response.data?.message || (editId
        ? 'Formato actualizado correctamente.'
        : `Ingreso registrado correctamente${folio ? `: ${folio}` : '.'}`));
      setEditId(null);
      setForm(formularioInicial(usuario?.tiendaId || 1));
      await cargarRegistros();
    } catch (err) {
      setError(
        err.response?.data?.mensaje || err.response?.data?.message || err.response?.data?.detail ||
        'No se pudo guardar el formato. Revisa la respuesta de la API.'
      );
    } finally {
      setGuardando(false);
    }
  };

  const abrirImpresion = (item) => {
    const ventana = window.open('', '_blank', 'width=900,height=700');
    if (!ventana) {
      setError('El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para este sitio.');
      return;
    }

    const tienda = [item.tiendaCodigo, item.tiendaNombre].filter(Boolean).join(' - ') || `Tienda ${item.tiendaId ?? ''}`;
    const equipo = item.nombreEquipo ?? item.nombre_equipo ?? item.equipo;
    const tipo = item.tipoEquipo ?? item.tipo_equipo ?? item.tipo;
    const estadoFisico = item.estadoFisico ?? item.estado_fisico;
    const falla = item.fallaReportada ?? item.falla_reportada;
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Formato de ingreso ${escaparHtml(item.folio || item.id)}</title>
      <style>
      @page{size:A4;margin:16mm}*{box-sizing:border-box}body{font-family:Arial,sans-serif;color:#172033;font-size:12px;margin:0}
      header{border-bottom:3px solid #075985;padding-bottom:12px;margin-bottom:20px}h1{font-size:22px;margin:0 0 6px}h2{font-size:14px;background:#eff6ff;padding:9px;margin:20px 0 10px}
      .sub{color:#526176;margin:0}.folio{float:right;font-weight:bold;font-size:14px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:12px 20px}
      .campo{border-bottom:1px solid #dbe3ed;padding:5px 0;min-height:34px}.etiqueta{font-size:10px;text-transform:uppercase;color:#64748b;margin-bottom:4px;font-weight:bold}.valor{white-space:pre-wrap;overflow-wrap:anywhere}
      .ancho{grid-column:1/-1}.firmas{display:grid;grid-template-columns:1fr 1fr;gap:50px;margin-top:65px;text-align:center}.firma{border-top:1px solid #475569;padding-top:8px}
      footer{margin-top:30px;color:#64748b;font-size:10px;text-align:center}@media print{button{display:none}}
      </style></head><body>
      <header><span class="folio">Folio: ${escaparHtml(item.folio || `REG-${item.id}`)}</span><h1>Formato de ingreso / recepción de equipo</h1><p class="sub">Sistema de Gestión IT — Comprobante de recepción</p></header>
      <div class="grid">
        <div class="campo"><div class="etiqueta">Fecha de ingreso</div><div class="valor">${escaparHtml(fechaLocal(item.fechaIngreso || item.fechaRegistro))}</div></div>
        <div class="campo"><div class="etiqueta">Tienda / sucursal</div><div class="valor">${escaparHtml(tienda)}</div></div>
      </div>
      <h2>Datos del equipo</h2><div class="grid">
        <div class="campo"><div class="etiqueta">Nombre / descripción</div><div class="valor">${escaparHtml(texto(equipo))}</div></div>
        <div class="campo"><div class="etiqueta">Tipo de equipo</div><div class="valor">${escaparHtml(texto(tipo))}</div></div>
        <div class="campo"><div class="etiqueta">Marca</div><div class="valor">${escaparHtml(texto(item.marca))}</div></div>
        <div class="campo"><div class="etiqueta">Modelo</div><div class="valor">${escaparHtml(texto(item.modelo))}</div></div>
        <div class="campo"><div class="etiqueta">Número de serie</div><div class="valor">${escaparHtml(texto(item.serie))}</div></div>
        <div class="campo"><div class="etiqueta">Código interno</div><div class="valor">${escaparHtml(texto(item.codigoInterno ?? item.codigo_interno))}</div></div>
      </div>
      <h2>Datos de recepción</h2><div class="grid">
        <div class="campo"><div class="etiqueta">Solicitante</div><div class="valor">${escaparHtml(texto(item.solicitante))}</div></div>
        <div class="campo"><div class="etiqueta">Estado de la reparación</div><div class="valor">${escaparHtml(texto(item.estado))}</div></div>
        <div class="campo ancho"><div class="etiqueta">Estado físico al recibir</div><div class="valor">${escaparHtml(texto(estadoFisico))}</div></div>
        <div class="campo ancho"><div class="etiqueta">Accesorios incluidos</div><div class="valor">${escaparHtml(texto(item.accesorios))}</div></div>
        <div class="campo ancho"><div class="etiqueta">Falla reportada</div><div class="valor">${escaparHtml(texto(falla))}</div></div>
      </div>
      <div class="firmas"><div class="firma">Firma de quien entrega</div><div class="firma">Firma de quien recibe</div></div>
      <footer>Documento generado desde el Sistema de Gestión IT. Para obtener un archivo PDF, selecciona “Guardar como PDF” en el diálogo de impresión.</footer>
      <script>window.onload=()=>setTimeout(()=>window.print(),350);</script></body></html>`;

    ventana.document.open();
    ventana.document.write(html);
    ventana.document.close();
  };

  const registrosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return registros;
    return registros.filter((item) => [
      item.folio, item.nombreEquipo, item.equipo, item.serie, item.codigoInterno,
      item.tiendaNombre, item.tiendaCodigo, item.solicitante, item.estado
    ].some((value) => String(value ?? '').toLowerCase().includes(q)));
  }, [registros, busqueda]);

  if (esVistaDetalle) {
    return (
      <main className="formato-ingreso-page">
        <section className="formato-ingreso-card">
          <div className="formato-ingreso-header">
            <div><p className="formato-kicker">RECEPCIÓN DE EQUIPO</p><h1>Formato de ingreso</h1><p>Consulta del comprobante registrado.</p></div>
            <button className="fi-btn fi-btn-light" type="button" onClick={() => navigate('/ingreso')}>Volver a registros</button>
          </div>
          {error && <div className="fi-alert fi-alert-error">{error}</div>}
          {cargando && <p>Cargando formato…</p>}
          {!cargando && detalle && <>
            <div className="fi-folio"><span>Folio</span><strong>{detalle.folio || `REG-${detalle.id}`}</strong><span className="fi-status">{detalle.estado || 'Registrado'}</span></div>
            <h2>Datos del equipo</h2><div className="fi-detail-grid">
              <Dato etiqueta="Tienda / sucursal" valor={[detalle.tiendaCodigo, detalle.tiendaNombre].filter(Boolean).join(' - ') || detalle.tiendaId} />
              <Dato etiqueta="Tipo de equipo" valor={detalle.tipoEquipo} /><Dato etiqueta="Nombre / descripción" valor={detalle.nombreEquipo} />
              <Dato etiqueta="Marca" valor={detalle.marca} /><Dato etiqueta="Modelo" valor={detalle.modelo} /><Dato etiqueta="Serie" valor={detalle.serie} />
              <Dato etiqueta="Código interno" valor={detalle.codigoInterno} /><Dato etiqueta="Solicitante" valor={detalle.solicitante} />
              <Dato etiqueta="Fecha de ingreso" valor={fechaLocal(detalle.fechaIngreso || detalle.fechaRegistro)} />
            </div>
            <h2>Condiciones de recepción</h2><div className="fi-detail-grid">
              <Dato etiqueta="Estado físico" valor={detalle.estadoFisico} ancho /><Dato etiqueta="Accesorios incluidos" valor={detalle.accesorios} ancho />
              <Dato etiqueta="Falla reportada" valor={detalle.fallaReportada} ancho />
            </div>
            <div className="fi-actions">
              {detalle.estado === 'REGISTRADO' && <button className="fi-btn fi-btn-primary" type="button" onClick={() => navigate(`/ingreso?editar=${detalle.id}`)}>Editar formato</button>}
              <button className="fi-btn fi-btn-light" type="button" onClick={() => abrirImpresion(detalle)}>Ver PDF / Imprimir</button>
            </div>
          </>}
          {!cargando && !detalle && !error && <p>No se encontró el formato solicitado.</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="formato-ingreso-page">
      <section className="formato-ingreso-card">
        <div className="formato-ingreso-header">
          <div><p className="formato-kicker">RECEPCIÓN DE EQUIPO</p><h1>{editId ? 'Editar formato de ingreso' : 'Formato de ingreso / recepción de equipo'}</h1><p>Registra los datos de recepción y conserva el comprobante para consultarlo e imprimirlo.</p></div>
          {editId && <button className="fi-btn fi-btn-light" type="button" onClick={cancelarEdicion}>Cancelar edición</button>}
        </div>

        {mensaje && <div className="fi-alert fi-alert-success">{mensaje}</div>}
        {error && <div className="fi-alert fi-alert-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <h2>Datos generales</h2>
          <div className="fi-form-grid">
            <label>Tienda / sucursal *
              <select name="tiendaId" value={form.tiendaId} onChange={handleChange} required>
                {tiendas.length > 0 ? tiendas.map((tienda) => <option key={tienda.id} value={tienda.id}>{[tienda.codigo, tienda.nombre].filter(Boolean).join(' - ') || `Tienda ${tienda.id}`}</option>) : [...Array(14)].map((_, i) => <option key={i + 1} value={i + 1}>Tienda Sucursal {i + 1}</option>)}
              </select>
            </label>
            <label>Tipo de equipo *
              <select name="tipoEquipo" value={form.tipoEquipo} onChange={handleChange} required>
                <option value="CPU">CPU (Computadora de escritorio)</option><option value="LAPTOP">Laptop</option>
                <option value="IMPRESORA_NORMAL">Impresora normal</option><option value="IMPRESORA_CAJA">Impresora de caja</option>
                <option value="IMPRESORA_ETIQUETAS">Impresora de etiquetas</option><option value="RELOJ_MARCADOR">Reloj marcador</option>
              </select>
            </label>
            <label>Código interno del activo
              <input name="codigoInterno" value={form.codigoInterno} onChange={handleChange} placeholder="Opcional; se deriva de la serie si está vacío" maxLength={50} />
            </label>
            <label>Número de serie *
              <input name="serie" value={form.serie} onChange={handleChange} required maxLength={80} placeholder="Ej. SN-89237498" />
            </label>
            <label className="fi-full">Nombre / descripción del equipo *
              <input name="nombreEquipo" value={form.nombreEquipo} onChange={handleChange} required maxLength={100} placeholder="Ej. Laptop HP ProBook" />
            </label>
            <label>Marca
              <input name="marca" value={form.marca} onChange={handleChange} maxLength={60} placeholder="Ej. HP, Epson, Zebra" />
            </label>
            <label>Modelo
              <input name="modelo" value={form.modelo} onChange={handleChange} maxLength={60} placeholder="Ej. L3110 / TM-T20" />
            </label>
          </div>
          <h2>Condiciones de recepción</h2>
          <div className="fi-form-grid">
            <label className="fi-full">Estado físico del equipo *
              <textarea name="estadoFisico" value={form.estadoFisico} onChange={handleChange} required rows={2} maxLength={255} placeholder="Describe golpes, rayones, daños o condición visual." />
            </label>
            <label className="fi-full">Accesorios incluidos
              <textarea name="accesorios" value={form.accesorios} onChange={handleChange} rows={2} maxLength={255} placeholder="Cargador, cables, adaptador u otros accesorios." />
            </label>
            <label className="fi-full">Falla detallada reportada *
              <textarea name="fallaReportada" value={form.fallaReportada} onChange={handleChange} required rows={4} placeholder="Describe el problema reportado por la tienda o el usuario." />
            </label>
          </div>
          <div className="fi-actions">
            <button className="fi-btn fi-btn-primary" type="submit" disabled={guardando}>{guardando ? 'Guardando…' : editId ? 'Guardar cambios' : 'Registrar ingreso'}</button>
            {editId && <button className="fi-btn fi-btn-light" type="button" onClick={cancelarEdicion}>Cancelar</button>}
          </div>
        </form>
      </section>

      <section className="formato-ingreso-card fi-list-card">
        <div className="fi-list-heading"><div><h2>Formatos registrados</h2><p>Consulta, edita o imprime comprobantes existentes.</p></div><button className="fi-btn fi-btn-light" type="button" onClick={cargarRegistros} disabled={cargando}>{cargando ? 'Actualizando…' : 'Actualizar lista'}</button></div>
        <label className="fi-search">Buscar por folio, serie, equipo o tienda
          <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Escribe para filtrar…" />
        </label>
        {cargando && registros.length === 0 ? <p>Cargando formatos guardados…</p> : registrosFiltrados.length === 0 ? <p className="fi-empty">No hay formatos para mostrar. Los registros aparecerán aquí cuando se guarden en la base de datos.</p> : (
          <div className="fi-table-wrap"><table className="fi-table"><thead><tr><th>Folio</th><th>Equipo / serie</th><th>Tienda</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
            {registrosFiltrados.map((row) => <tr key={row.id}>
              <td><strong>{row.folio || `REG-${row.id}`}</strong></td>
              <td>{row.nombreEquipo || row.equipo || 'Equipo'}<small>{row.serie || 'Sin serie'}</small></td>
              <td>{[row.tiendaCodigo, row.tiendaNombre].filter(Boolean).join(' - ') || row.tiendaId || '—'}</td>
              <td>{fechaLocal(row.fechaIngreso || row.fechaRegistro)}</td>
              <td><span className="fi-status">{row.estado || 'Registrado'}</span></td>
              <td><div className="fi-row-actions">
                <button type="button" className="fi-link" onClick={() => navigate(`/ingreso/${row.id}`)}>Revisar</button>
                {row.estado === 'REGISTRADO' && <button type="button" className="fi-link" onClick={() => iniciarEdicion(row)}>Editar</button>}
                <button type="button" className="fi-link" onClick={() => abrirImpresion(row)}>PDF / Imprimir</button>
              </div></td>
            </tr>)}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}

function Dato({ etiqueta, valor, ancho = false }) {
  return <div className={`fi-detail-item${ancho ? ' fi-full' : ''}`}><span>{etiqueta}</span><p>{texto(valor)}</p></div>;
}
