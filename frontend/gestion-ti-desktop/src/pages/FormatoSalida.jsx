import { useState, useEffect } from 'react';
import httpClient from '../api/httpClient';
import './FormatoSalida.css';

export default function FormatoSalida() {
  const [equiposPendientes, setEquiposPendientes] = useState([]);
  const [reparacionId, setReparacionId] = useState('');
  const [diagnostico, setDiagnostico] = useState('');
  const [trabajoRealizado, setTrabajoRealizado] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [pruebasConformidadOk, setPruebasConformidadOk] = useState(false);
  const [estadoFinal, setEstadoFinal] = useState('OPERATIVO');

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');
  const [ultimoFormato, setUltimoFormato] = useState(null);

  const meEscaparHtml = (valor) => String(valor ?? '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  const imprimirFormatoSalida = (formatoAImprimir = ultimoFormato) => {
    if (!formatoAImprimir) {
      setError('Debes seleccionar un equipo o llenar el formulario antes de imprimir.');
      return;
    }

    const ventana = window.open('', '_blank', 'width=900,height=750');
    if (!ventana) {
      setError('El navegador bloqueó la ventana. Permite ventanas emergentes para poder imprimir o guardar el PDF.');
      return;
    }

    const f = formatoAImprimir;
    ventana.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Formato de salida ${meEscaparHtml(f.reparacionId)}</title>
      <style>@page{size:A4;margin:18mm}body{font-family:Arial,sans-serif;color:#172033;font-size:12px}h1{text-align:center;color:#075985;border-bottom:2px solid #075985;padding-bottom:12px}h2{background:#eff6ff;padding:8px;font-size:14px}table{width:100%;border-collapse:collapse}td{border:1px solid #cbd5e1;padding:9px;vertical-align:top}.firma{display:inline-block;width:42%;margin:65px 3% 0;border-top:1px solid #333;text-align:center;padding-top:8px}</style></head><body>
      <h1>SISTEMA DE GESTIÓN DE TI<br>FORMATO DE SALIDA / ENTREGA DE EQUIPO</h1>
      <p><b>Reparación:</b> ${meEscaparHtml(f.reparacionId)} &nbsp; <b>Fecha:</b> ${meEscaparHtml(new Date().toLocaleString('es-HN'))}</p>
      <h2>Detalle del trabajo</h2><table>
      <tr><td><b>Equipo</b></td><td>${meEscaparHtml(f.etiqueta)}</td></tr>
      <tr><td><b>Falla reportada</b></td><td>${meEscaparHtml(f.falla)}</td></tr>
      <tr><td><b>Diagnóstico técnico</b></td><td>${meEscaparHtml(f.diagnostico || 'No indicado')}</td></tr>
      <tr><td><b>Trabajo realizado</b></td><td>${meEscaparHtml(f.trabajoRealizado)}</td></tr>
      <tr><td><b>Pruebas de conformidad</b></td><td>${f.pruebasConformidadOk ? 'Satisfactorias' : 'No marcadas como satisfactorias'}</td></tr>
      <tr><td><b>Observaciones / garantía</b></td><td>${meEscaparHtml(f.observaciones || 'Ninguna')}</td></tr>
      <tr><td><b>Estado final del equipo</b></td><td>${meEscaparHtml(f.estadoFinal)}</td></tr></table>
      <div><div class="firma">Firma del técnico</div><div class="firma">Firma de quien recibe</div></div>
      <script>window.addEventListener('load',()=>window.print());</script></body></html>`);
    ventana.document.close();
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/immutability
    cargarEquiposPendientes();
  }, []);

  const cargarEquiposPendientes = async () => {
    try {
      const res = await httpClient.get('/formatos/equipos-pendientes');
      setEquiposPendientes(res.data);
    } catch (err) {
      console.error('Error al cargar equipos pendientes:', err);
    }
  };

  const resetFormulario = () => {
    setReparacionId('');
    setDiagnostico('');
    setTrabajoRealizado('');
    setObservaciones('');
    setPruebasConformidadOk(false);
    setEstadoFinal('OPERATIVO');
  };

  const handleImprimirDirecto = () => {
    setError('');
    if (!reparacionId) {
      setError('Debes seleccionar un equipo de la lista para imprimir.');
      return;
    }

    const seleccionado = equiposPendientes.find((item) => String(item.reparacionId) === String(reparacionId));
    const formatoActual = {
      reparacionId: Number(reparacionId),
      etiqueta: seleccionado?.etiqueta || `Reparación ${reparacionId}`,
      falla: seleccionado?.falla || '',
      diagnostico: diagnostico.trim(),
      trabajoRealizado: trabajoRealizado.trim() || 'No especificado',
      observaciones: observaciones.trim(),
      pruebasConformidadOk,
      estadoFinal
    };

    imprimirFormatoSalida(formatoActual);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!reparacionId) {
      setError('Debes seleccionar un equipo de la lista.');
      return;
    }

    if (!trabajoRealizado.trim()) {
      setError('El campo Trabajo Realizado es obligatorio.');
      return;
    }

    try {
      setGuardando(true);

      const res = await httpClient.post('/formatos/salida', {
        reparacionId: Number(reparacionId),
        diagnosticoTecnico: diagnostico.trim(),
        trabajoRealizado: trabajoRealizado.trim(),
        pruebasConformidadOk: pruebasConformidadOk,
        observacionesGarantia: observaciones.trim(),
        estadoFinalEquipo: estadoFinal
      });

      const seleccionado = equiposPendientes.find((item) => String(item.reparacionId) === String(reparacionId));
      const nuevoFormato = {
        reparacionId: Number(reparacionId),
        etiqueta: seleccionado?.etiqueta || `Reparación ${reparacionId}`,
        falla: seleccionado?.falla || '',
        diagnostico: diagnostico.trim(),
        trabajoRealizado: trabajoRealizado.trim(),
        observaciones: observaciones.trim(),
        pruebasConformidadOk,
        estadoFinal
      };

      setUltimoFormato(nuevoFormato);
      setMensaje(res.data?.mensaje || 'Formato de salida registrado correctamente.');
      resetFormulario();
      cargarEquiposPendientes();
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        err.response?.data?.message ||
        'Error al guardar el formato de salida.'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="tarjeta-formulario">
      <h2>Formato de Salida / Entrega de Equipo</h2>

      {mensaje && <div className="mensaje-exito">{mensaje}</div>}
      {error && <div className="mensaje-error">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="campo-formulario">
          <label>Seleccionar Equipo en Reparación *</label>
          <select
            value={reparacionId}
            onChange={(e) => setReparacionId(e.target.value)}
            required
          >
            <option value="">-- Selecciona el Equipo --</option>
            {equiposPendientes.map((item) => (
              <option key={item.reparacionId} value={item.reparacionId}>
                {item.etiqueta} | Falla: {item.falla}
              </option>
            ))}
          </select>
        </div>

        <div className="campo-formulario">
          <label>Estado Final del Activo *</label>
          <select
            value={estadoFinal}
            onChange={(e) => setEstadoFinal(e.target.value)}
          >
            <option value="OPERATIVO">OPERATIVO (Reparado / Listo)</option>
            <option value="BAJA">BAJA TÉCNICA (Inoperativo / Descartado)</option>
          </select>
        </div>

        <div className="campo-formulario">
          <label>Diagnóstico Técnico Aplicado</label>
          <textarea
            rows={3}
            value={diagnostico}
            onChange={(e) => setDiagnostico(e.target.value)}
            placeholder="Escribe el diagnóstico final realizado..."
          />
        </div>

        <div className="campo-formulario">
          <label>Trabajo Realizado / Repuestos *</label>
          <textarea
            rows={3}
            value={trabajoRealizado}
            onChange={(e) => setTrabajoRealizado(e.target.value)}
            placeholder="Describe las acciones tomadas..."
            required
          />
        </div>

        <div className="campo-formulario">
          <label>Observaciones de Garantía</label>
          <textarea
            rows={2}
            value={observaciones}
            onChange={(e) => setObservaciones(e.target.value)}
            placeholder="Condiciones o notas adicionales..."
          />
        </div>

        <div className="campo-formulario">
          <label>
            <input
              type="checkbox"
              checked={pruebasConformidadOk}
              onChange={(e) => setPruebasConformidadOk(e.target.checked)}
            />
            {' '}Pruebas de conformidad satisfactorias
          </label>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div style={{ display: 'flex', gap: '10px', marginTop: '20px', flexWrap: 'wrap' }}>
          <button 
            type="submit" 
            className="boton-principal" 
            disabled={guardando}
            style={{ flex: '1 1 200px' }}
          >
            {guardando ? 'Procesando...' : '💾 Guardar Formato'}
          </button>

          <button 
            type="button" 
            onClick={handleImprimirDirecto} 
            className="boton-secundario"
            style={{ flex: '1 1 200px' }}
          >
            🖨️ Imprimir / Guardar PDF
          </button>
        </div>
      </form>
    </div>
  );
}