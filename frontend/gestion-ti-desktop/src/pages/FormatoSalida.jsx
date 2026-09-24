import { useState } from 'react';
import httpClient from '../api/httpClient';

export default function FormatoSalida() {
  const [form, setForm] = useState({
    reparacionId: '',
    folio: '',
    diagnosticoTecnico: '',
    trabajoRealizado: '',
    pruebasConformidadOk: true,
    observacionesGarantia: '',
    estadoFinalEquipo: 'OPERATIVO', // OPERATIVO o BAJA
  });

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    const value = e.target.type === 'checkbox' ? e.target.checked : e.target.value;
    setForm({ ...form, [e.target.name]: value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setCargando(true);

    try {
      await httpClient.post('/formatos/salida', form);
      setMensaje('¡Formato de Salida registrado con éxito! El equipo ha sido actualizado.');
      setForm({
        reparacionId: '',
        folio: '',
        diagnosticoTecnico: '',
        trabajoRealizado: '',
        pruebasConformidadOk: true,
        observacionesGarantia: '',
        estadoFinalEquipo: 'OPERATIVO',
      });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Error al guardar el formato de salida.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '30px auto', padding: '25px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ borderBottom: '2px solid #2563eb', paddingBottom: '10px', color: '#1e293b' }}>
        Pantalla 2: Formato de Salida / Entrega de Equipo
      </h2>

      {mensaje && <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>{mensaje}</div>}
      {error && <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>{error}</div>}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Folio de Reparación / Orden:</label>
            <input name="folio" value={form.folio} onChange={handleChange} required placeholder="Ej. REP-2026-001" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Estado Final del Activo:</label>
            <select name="estadoFinalEquipo" value={form.estadoFinalEquipo} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
              <option value="OPERATIVO">OPERATIVO (Reparado / Entregado)</option>
              <option value="BAJA">BAJA TÉCNICA (Descartado / Irreparable)</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Diagnóstico Técnico Aplicado:</label>
          <textarea name="diagnosticoTecnico" value={form.diagnosticoTecnico} onChange={handleChange} required rows={3} placeholder="Describa el diagnóstico realizado..." style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Trabajo Realizado / Repuestos Consumidos:</label>
          <textarea name="trabajoRealizado" value={form.trabajoRealizado} onChange={handleChange} required rows={3} placeholder="Mantenimiento preventivo, cambio de disco SSD, sustitución de rodillo térmico, etc." style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Observaciones de Garantía:</label>
          <input name="observacionesGarantia" value={form.observacionesGarantia} onChange={handleChange} placeholder="Ej. Garantía interna de 15 días sobre el trabajo realizado" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <input type="checkbox" id="pruebasConformidadOk" name="pruebasConformidadOk" checked={form.pruebasConformidadOk} onChange={handleChange} />
          <label htmlFor="pruebasConformidadOk" style={{ fontWeight: 'bold', fontSize: '14px', cursor: 'pointer' }}>
            Pruebas de funcionamiento y calidad superadas correctamente.
          </label>
        </div>

        <button type="submit" disabled={cargando} style={{ background: '#2563eb', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
          {cargando ? 'Procesando Salida...' : 'Registrar Salida y Entregar Equipo'}
        </button>
      </form>
    </div>
  );
}