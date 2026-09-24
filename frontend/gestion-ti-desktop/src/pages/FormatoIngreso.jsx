import { useState } from 'react';
import httpClient from '../api/httpClient';
import { useAuth } from '../auth/AuthContext';

export default function FormatoIngreso() {
  const { usuario } = useAuth();
  
  const [form, setForm] = useState({
    tiendaId: usuario?.tiendaId || 1,
    codigoInterno: '',
    nombreEquipo: '',
    tipoEquipo: 'CPU',
    marca: '',
    modelo: '',
    serie: '',
    estadoFisico: '',
    accesorios: '',
    fallaReportada: '',
  });

  const [mensaje, setMensaje] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMensaje(null);
    setError(null);
    setCargando(true);

    try {
      // Envía la petición a la API para registrar el ingreso y crear la orden
      const res = await httpClient.post('/formatos/ingreso', form);
      setMensaje(`¡Ingreso registrado exitosamente! Folio de servicio: ${res.data.folio || 'REG-' + Date.now()}`);
      
      // Limpia el formulario
      setForm({
        tiendaId: usuario?.tiendaId || 1,
        codigoInterno: '',
        nombreEquipo: '',
        tipoEquipo: 'CPU',
        marca: '',
        modelo: '',
        serie: '',
        estadoFisico: '',
        accesorios: '',
        fallaReportada: '',
      });
    } catch (err) {
      setError(err.response?.data?.mensaje || 'Ocurrió un error al registrar el formato de ingreso.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: '700px', margin: '30px auto', padding: '25px', background: '#ffffff', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ borderBottom: '2px solid #2563eb', paddingBottom: '10px', color: '#1e293b' }}>
        Pantalla 1: Formato de Ingreso / Recepción de Equipo
      </h2>

      {mensaje && (
        <div style={{ background: '#dcfce7', color: '#15803d', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
          {mensaje}
        </div>
      )}

      {error && (
        <div style={{ background: '#fef2f2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginBottom: '15px' }}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Tienda Sucursal (1 de 14):</label>
            <select name="tiendaId" value={form.tiendaId} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
              {[...Array(14)].map((_, i) => (
                <option key={i + 1} value={i + 1}>
                  Tienda Sucursal {i + 1}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Tipo de Equipo (6 Categorías):</label>
            <select name="tipoEquipo" value={form.tipoEquipo} onChange={handleChange} required style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}>
              <option value="CPU">CPU (Computadora de escritorio)</option>
              <option value="LAPTOP">Laptop</option>
              <option value="IMPRESORA_NORMAL">Impresora Normal (Láser / Inyección)</option>
              <option value="IMPRESORA_CAJA">Impresora de Caja (Térmica / Ticket)</option>
              <option value="IMPRESORA_ETIQUETAS">Impresora de Etiquetas</option>
              <option value="RELOJ_MARCADOR">Reloj Marcador</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Código Interno del Activo:</label>
            <input name="codigoInterno" value={form.codigoInterno} onChange={handleChange} required placeholder="Ej. EQ-T1-004" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>

          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Número de Serie:</label>
            <input name="serie" value={form.serie} onChange={handleChange} required placeholder="Ej. SN-89237498" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '15px', marginBottom: '15px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Nombre / Descripción:</label>
            <input name="nombreEquipo" value={form.nombreEquipo} onChange={handleChange} required placeholder="Ej. Laptop HP ProBook" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Marca:</label>
            <input name="marca" value={form.marca} onChange={handleChange} placeholder="Ej. HP, Epson, Zebra" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Modelo:</label>
            <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="Ej. L3110 / TM-T20" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
          </div>
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Estado Físico de Recepción:</label>
          <input name="estadoFisico" value={form.estadoFisico} onChange={handleChange} required placeholder="Ej. Panta Rayada, carcasa golpeada en la esquina superior" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Accesorios Incluidos:</label>
          <input name="accesorios" value={form.accesorios} onChange={handleChange} placeholder="Ej. Cargador original, cable de poder, cable USB" style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', fontSize: '14px', marginBottom: '5px' }}>Falla Detallada Reportada:</label>
          <textarea name="fallaReportada" value={form.fallaReportada} onChange={handleChange} required rows={3} placeholder="Describa el problema reportado por el usuario o tienda..." style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
        </div>

        <button type="submit" disabled={cargando} style={{ background: '#16a34a', color: '#ffffff', border: 'none', padding: '12px 20px', borderRadius: '6px', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', width: '100%' }}>
          {cargando ? 'Guardando Ingreso...' : 'Registrar Ingreso y Generar Ticket'}
        </button>
      </form>
    </div>
  );
}