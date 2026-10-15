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



      setMensaje(res.data?.mensaje || 'Formato de salida registrado correctamente.');
      setReparacionId('');
      setDiagnostico('');
      setTrabajoRealizado('');
      setObservaciones('');
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

        <button type="submit" className="boton-principal" disabled={guardando}>
          {guardando ? 'Procesando...' : 'Guardar Formato de Salida'}
        </button>
      </form>
    </div>
  );
}