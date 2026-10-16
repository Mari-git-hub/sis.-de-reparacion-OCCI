import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import httpClient from '../api/httpClient';
import './ReportesFormatos.css';

export default function ReportesFormatos() {
  const [reportes, setReportes] = useState([]);
  const [filtroMes, setFiltroMes] = useState('');
  const [filtroAnio, setFiltroAnio] = useState('');
  const [cargando, setCargando] = useState(true);
  const [editando, setEditando] = useState(null);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  const [errorEdicion, setErrorEdicion] = useState('');
  const [mensajeEdicion, setMensajeEdicion] = useState('');

  const [formSalida, setFormSalida] = useState({
    diagnostico: '',
    trabajoRealizado: '',
    observacionesSalida: '',
    pruebasConformidadOk: false
  });

  const fechaReporte = (valor) => {
    if (!valor) return null;
    const texto = String(valor);
    const partes = texto.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
    if (partes) {
      const fecha = new Date(Number(partes[3]), Number(partes[2]) - 1, Number(partes[1]), Number(partes[4] || 0), Number(partes[5] || 0));
      return Number.isNaN(fecha.getTime()) ? null : fecha;
    }
    const fecha = new Date(texto);
    return Number.isNaN(fecha.getTime()) ? null : fecha;
  };

  const reportesFiltrados = reportes.filter((item) => {
    const fecha = fechaReporte(item.fechaIngreso);
    if (!fecha) return !filtroMes && !filtroAnio;
    const coincideMes = !filtroMes || String(fecha.getMonth() + 1) === filtroMes;
    const coincideAnio = !filtroAnio || String(fecha.getFullYear()) === filtroAnio;
    return coincideMes && coincideAnio;
  });

  const exportarExcel = () => {
    if (reportesFiltrados.length === 0) {
      alert('No hay registros para exportar con los filtros seleccionados.');
      return;
    }
    const filas = reportesFiltrados.map((item) => ({
      Folio: item.folio || '',
      FechaIngreso: item.fechaIngreso || '',
      Equipo: item.equipoNombre || '',
      Tipo: item.tipoEquipo || '',
      Marca: item.marca || '',
      Modelo: item.modelo || '',
      Serie: item.serie || '',
      Tienda: item.tiendaNombre || '',
      FallaReportada: item.fallaReportada || '',
      Estado: item.estado || '',
      FechaSalida: item.fechaSalida || '',
      Diagnostico: item.diagnostico || '',
      TrabajoRealizado: item.trabajoRealizado || '',
      PruebasConformidad: item.pruebasConformidadOk ? 'Sí' : 'No',
      ObservacionesSalida: item.observacionesSalida || ''
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    hoja['!cols'] = Object.keys(filas[0]).map((clave) => ({ wch: Math.max(clave.length + 2, 18) }));
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Reportes');
    const sufijo = [filtroAnio || 'todos', filtroMes ? String(filtroMes).padStart(2, '0') : 'todos'].join('-');
    XLSX.writeFile(libro, `reportes-reparaciones-${sufijo}.xlsx`);
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    cargarReportes();
  }, []);

  const cargarReportes = async () => {
    try {
      const res = await httpClient.get('/formatos/reportes');
      setReportes(res.data);
    } catch (err) {
      console.error('Error al obtener reportes:', err);
    } finally {
      setCargando(false);
    }
  };

  const guardarEdicionSalida = async (e) => {
    e.preventDefault();
    setErrorEdicion('');
    setMensajeEdicion('');

    if (!editando) return;

    if (!formSalida.trabajoRealizado.trim()) {
      setErrorEdicion('El trabajo realizado es obligatorio.');
      return;
    }

    try {
      setGuardandoEdicion(true);

      const respuesta = await httpClient.put(
        `/formatos/salida/${editando.reparacionId}`,
        {
          reparacionId: editando.reparacionId,
          diagnosticoTecnico: formSalida.diagnostico.trim(),
          trabajoRealizado: formSalida.trabajoRealizado.trim(),
          pruebasConformidadOk: formSalida.pruebasConformidadOk,
          observacionesGarantia: formSalida.observacionesSalida.trim()
        }
      );

      setMensajeEdicion(
        respuesta.data?.mensaje || 'Formato de salida actualizado.'
      );

      setEditando(null);
      await cargarReportes();
    } catch (err) {
      setErrorEdicion(
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'No fue posible actualizar el formato de salida.'
      );
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const imprimirPDF = (item, tipoFormato) => {
    const ventana = window.open('', '_blank');
    const esIngreso = tipoFormato === 'INGRESO';

    const contenidoHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${esIngreso ? 'Formato de Ingreso' : 'Formato de Salida'} ${item.folio}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 30px; color: #333; }
          .encabezado { text-align: center; border-bottom: 2px solid #004085; padding-bottom: 10px; }
          .encabezado h1 { margin: 0; color: #004085; font-size: 22px; }
          .seccion { margin-top: 20px; }
          .seccion-titulo { font-weight: bold; background: #f0f4f8; padding: 6px; border-left: 4px solid #004085; margin-bottom: 10px; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          td, th { border: 1px solid #ccc; padding: 8px; text-align: left; font-size: 13px; }
          .firmas { margin-top: 60px; display: flex; justify-content: space-between; }
          .linea-firma { width: 40%; text-align: center; border-top: 1px solid #000; padding-top: 5px; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="encabezado">
          <h1>SISTEMA DE GESTIÓN DE TI</h1>
          <h3>${esIngreso ? 'FORMATO DE INGRESO A REPARACIÓN' : 'FORMATO DE SALIDA Y ENTREGAS'}</h3>
          <p><strong>Folio:</strong> ${item.folio} | <strong>Fecha:</strong> ${esIngreso ? item.fechaIngreso : item.fechaSalida || 'N/A'}</p>
        </div>

        <div class="seccion">
          <div class="seccion-titulo">INFORMACIÓN DEL EQUIPO</div>
          <table>
            <tr><td><strong>Equipo:</strong> ${item.equipoNombre}</td><td><strong>Tipo:</strong> ${item.tipoEquipo}</td></tr>
            <tr><td><strong>Marca / Modelo:</strong> ${item.marca} ${item.modelo}</td><td><strong>Serie:</strong> ${item.serie}</td></tr>
            <tr><td colspan="2"><strong>Ubicación / Tienda:</strong> ${item.tiendaNombre}</td></tr>
          </table>
        </div>

        ${esIngreso ? `
        <div class="seccion">
          <div class="seccion-titulo">DETALLE DEL INGRESO</div>
          <table>
            <tr><td><strong>Falla Reportada:</strong> ${item.fallaReportada}</td></tr>
            <tr><td><strong>Estado Físico:</strong> ${item.estadoFisico}</td></tr>
            <tr><td><strong>Accesorios:</strong> ${item.accesorios || 'Ninguno'}</td></tr>
          </table>
        </div>
        ` : `
        <div class="seccion">
          <div class="seccion-titulo">DETALLE DE LA REPARACIÓN Y SALIDA</div>
          <table>
            <tr><td><strong>Diagnóstico Técnico:</strong> ${item.diagnostico || 'Atendido'}</td></tr>
            <tr><td><strong>Trabajo Realizado:</strong> ${item.trabajoRealizado}</td></tr>
            <tr><td><strong>Garantía / Observaciones:</strong> ${item.observacionesSalida || 'Sin observaciones'}</td></tr>
            <tr><td><strong>Estado Final:</strong> ${item.estado}</td></tr>
          </table>
        </div>
        `}

        <div class="firmas">
          <div class="linea-firma">Firma Técnico Entregado</div>
          <div class="linea-firma">Firma Cliente / Recibido</div>
        </div>

        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;

    ventana.document.write(contenidoHTML);
    ventana.document.close();
  };

  if (cargando) return <div>Cargando historial de reportes...</div>;

  return (
    <div className="reportes-contenedor">
      <h2>Historial de Registro de Formatos</h2>

      <section className="filtros-reportes" style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'end', margin: '16px 0' }}>
        <label style={{ display: 'grid', gap: '5px' }}>
          Filtrar por mes
          <select value={filtroMes} onChange={(e) => setFiltroMes(e.target.value)}>
            <option value="">Todos los meses</option>
            <option value="1">Enero</option><option value="2">Febrero</option>
            <option value="3">Marzo</option><option value="4">Abril</option>
            <option value="5">Mayo</option><option value="6">Junio</option>
            <option value="7">Julio</option><option value="8">Agosto</option>
            <option value="9">Septiembre</option><option value="10">Octubre</option>
            <option value="11">Noviembre</option><option value="12">Diciembre</option>
          </select>
        </label>
        <label style={{ display: 'grid', gap: '5px' }}>
          Filtrar por año
          <input type="number" min="2000" max="2100" placeholder="Ej. 2026" value={filtroAnio} onChange={(e) => setFiltroAnio(e.target.value)} />
        </label>
        <button type="button" onClick={() => { setFiltroMes(''); setFiltroAnio(''); }}>Limpiar filtros</button>
        <button type="button" className="btn-pdf" onClick={exportarExcel}>Descargar Excel (.xlsx)</button>
        <span>Registros: {reportesFiltrados.length}</span>
      </section>

      {mensajeEdicion && (
        <div className="mensaje-exito">{mensajeEdicion}</div>
      )}

      {errorEdicion && (
        <div className="mensaje-error">{errorEdicion}</div>
      )}

      {editando && (
        <form onSubmit={guardarEdicionSalida} className="tarjeta-formulario">
          <h3>Editar formato de salida: {editando.folio}</h3>

          <div className="campo-formulario">
            <label>Diagnóstico técnico</label>
            <textarea
              rows={3}
              value={formSalida.diagnostico}
              onChange={(e) =>
                setFormSalida({
                  ...formSalida,
                  diagnostico: e.target.value
                })
              }
            />
          </div>

          <div className="campo-formulario">
            <label>Trabajo realizado / repuestos *</label>
            <textarea
              rows={3}
              required
              value={formSalida.trabajoRealizado}
              onChange={(e) =>
                setFormSalida({
                  ...formSalida,
                  trabajoRealizado: e.target.value
                })
              }
            />
          </div>

          <div className="campo-formulario">
            <label>Observaciones de garantía</label>
            <textarea
              rows={2}
              value={formSalida.observacionesSalida}
              onChange={(e) =>
                setFormSalida({
                  ...formSalida,
                  observacionesSalida: e.target.value
                })
              }
            />
          </div>

          <div className="campo-formulario">
            <label>
              <input
                type="checkbox"
                checked={formSalida.pruebasConformidadOk}
                onChange={(e) =>
                  setFormSalida({
                    ...formSalida,
                    pruebasConformidadOk: e.target.checked
                  })
                }
              />
              {' '}Pruebas de conformidad satisfactorias
            </label>
          </div>

          <button
            type="submit"
            className="boton-principal"
            disabled={guardandoEdicion}
          >
            {guardandoEdicion ? 'Guardando...' : 'Guardar cambios'}
          </button>

          <button
            type="button"
            onClick={() => setEditando(null)}
            disabled={guardandoEdicion}
          >
            Cancelar
          </button>
        </form>
      )}

      <table className="tabla-reportes">
        <thead>
          <tr>
            <th>Folio</th>
            <th>Equipo</th>
            <th>Serie</th>
            <th>Falla / Ingreso</th>
            <th>Estado</th>
            <th>PDF</th>
          </tr>
        </thead>
        <tbody>
          {reportesFiltrados.map((item) => (
            <tr key={item.reparacionId}>
              <td><strong>{item.folio}</strong></td>
              <td>{item.equipoNombre}</td>
              <td>{item.serie}</td>
              <td>{item.fallaReportada}</td>
              <td>
                <span className={`etiqueta-estado ${item.estado ? item.estado.toLowerCase() : ''}`}>
                  {item.estado}
                </span>
              </td>
              <td>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button className="btn-pdf" onClick={() => imprimirPDF(item, 'INGRESO')} type="button">
                    📄 PDF Ingreso
                  </button>
                  {item.fechaSalida && (
                    <button
                      className="btn-pdf btn-salida"
                      onClick={() => imprimirPDF(item, 'SALIDA')}
                      type="button"
                    >
                      📄 PDF Salida
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {reportesFiltrados.length === 0 && (
            <tr><td colSpan={6} style={{ textAlign: 'center', padding: '18px' }}>No hay registros para el período seleccionado.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}