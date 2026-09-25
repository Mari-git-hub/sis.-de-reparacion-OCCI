import { useState } from 'react';

// Datos de prueba iniciales (se reemplazarán con tu API REST)
const DATOS_INICIALES = [
  { id: 1, codigo: 'ACT-1001', tipo: 'Láser', marcaModelo: 'HP LaserJet Pro M404dn', serie: 'VND3K9921', tienda: 'Tienda 01 - Centro', estado: 'OPERATIVO', insumo: 'Tóner HP 58A' },
  { id: 2, codigo: 'ACT-1002', tipo: 'Inyección', marcaModelo: 'Epson EcoTank L3250', serie: 'EP-998212', tienda: 'Tienda 02 - Norte', estado: 'EN_TALLER', insumo: 'Tinta Epson T544' },
  { id: 3, codigo: 'ACT-1003', tipo: 'Térmica', marcaModelo: 'Zebra ZT230', serie: 'ZB-442100', tienda: 'Tienda 01 - Centro', estado: 'OPERATIVO', insumo: 'Cinta Ribbon 110x300m' },
  { id: 4, codigo: 'ACT-1004', tipo: 'Láser', marcaModelo: 'Brother HL-L2350DW', serie: 'BR-881234', tienda: 'Tienda 03 - Sur', estado: 'BAJA', insumo: 'Tóner TN-760' },
];

export default function Inventario() {
  const [activos, setActivos] = useState(DATOS_INICIALES);
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('TODOS');
  const [mostrarModal, setMostrarModal] = useState(false);

  // Estado del formulario para nuevo activo
  const [nuevoActivo, setNuevoActivo] = useState({
    codigo: '', tipo: 'Láser', marcaModelo: '', serie: '', tienda: 'Tienda 01 - Centro', estado: 'OPERATIVO', insumo: ''
  });

  // Filtrado dinámico
  const activosFiltrados = activos.filter(item => {
    const coincideTexto = item.codigo.toLowerCase().includes(busqueda.toLowerCase()) ||
                          item.marcaModelo.toLowerCase().includes(busqueda.toLowerCase()) ||
                          item.serie.toLowerCase().includes(busqueda.toLowerCase()) ||
                          item.tienda.toLowerCase().includes(busqueda.toLowerCase());
    
    const coincideEstado = filtroEstado === 'TODOS' || item.estado === filtroEstado;
    return coincideTexto && coincideEstado;
  });

  const handleGuardar = (e) => {
    e.preventDefault();
    const itemGuardado = { ...nuevoActivo, id: Date.now() };
    setActivos([itemGuardado, ...activos]);
    setMostrarModal(false);
    setNuevoActivo({ codigo: '', tipo: 'Láser', marcaModelo: '', serie: '', tienda: 'Tienda 01 - Centro', estado: 'OPERATIVO', insumo: '' });
  };

  const getBadgeStyle = (estado) => {
    switch (estado) {
      case 'OPERATIVO': return { backgroundColor: '#059669', color: '#ffffff' };
      case 'EN_TALLER': return { backgroundColor: '#d97706', color: '#ffffff' };
      case 'BAJA': return { backgroundColor: '#dc2626', color: '#ffffff' };
      default: return { backgroundColor: '#64748b', color: '#ffffff' };
    }
  };

  return (
    <div style={styles.container}>
      {/* Encabezado y Acciones */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>📦 Inventario de Activos e Impresoras</h2>
          <p style={styles.subtitle}>Gestión centralizada de equipos distribuidos por tienda</p>
        </div>
        <button style={styles.btnPrimary} onClick={() => setMostrarModal(true)}>
          + Registrar Nuevo Activo
        </button>
      </div>

      {/* Barra de Filtros */}
      <div style={styles.filterBar}>
        <input
          type="text"
          placeholder="🔍 Buscar por código, serie, modelo o tienda..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          style={styles.searchInput}
        />
        <select 
          value={filtroEstado} 
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={styles.selectFilter}
        >
          <option value="TODOS">Todos los Estados</option>
          <option value="OPERATIVO">Operativos</option>
          <option value="EN_TALLER">En Taller</option>
          <option value="BAJA">Dados de Baja</option>
        </select>
      </div>

      {/* Tabla de Activos */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr style={styles.trHead}>
              <th style={styles.th}>Código</th>
              <th style={styles.th}>Tipo</th>
              <th style={styles.th}>Marca y Modelo</th>
              <th style={styles.th}>Nº Serie</th>
              <th style={styles.th}>Tienda Asignada</th>
              <th style={styles.th}>Insumo Asociado</th>
              <th style={styles.th}>Estado</th>
            </tr>
          </thead>
          <tbody>
            {activosFiltrados.length > 0 ? (
              activosFiltrados.map((item) => (
                <tr key={item.id} style={styles.trBody}>
                  <td style={{ ...styles.td, fontWeight: 'bold', color: '#38bdf8' }}>{item.codigo}</td>
                  <td style={styles.td}>{item.tipo}</td>
                  <td style={styles.td}>{item.marcaModelo}</td>
                  <td style={{ ...styles.td, fontFamily: 'monospace' }}>{item.serie}</td>
                  <td style={styles.td}>{item.tienda}</td>
                  <td style={styles.td}>{item.insumo}</td>
                  <td style={styles.td}>
                    <span style={{ ...styles.badge, ...getBadgeStyle(item.estado) }}>
                      {item.estado}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" style={styles.tdEmpty}>
                  No se encontraron activos registradas con ese criterio.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal para Agregar Activo */}
      {mostrarModal && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={{ marginTop: 0, marginBottom: '16px', color: '#1e293b' }}>Registrar Nuevo Activo</h3>
            <form onSubmit={handleGuardar} style={styles.formGrid}>
              <div>
                <label style={styles.label}>Código de Activo *</label>
                <input required type="text" placeholder="EJ: ACT-2001" style={styles.inputModal} value={nuevoActivo.codigo} onChange={(e) => setNuevoActivo({ ...nuevoActivo, codigo: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Tipo de Impresora</label>
                <select style={styles.inputModal} value={nuevoActivo.tipo} onChange={(e) => setNuevoActivo({ ...nuevoActivo, tipo: e.target.value })}>
                  <option value="Láser">Láser</option>
                  <option value="Inyección">Inyección</option>
                  <option value="Térmica">Térmica</option>
                </select>
              </div>
              <div>
                <label style={styles.label}>Marca y Modelo *</label>
                <input required type="text" placeholder="EJ: HP LaserJet M404" style={styles.inputModal} value={nuevoActivo.marcaModelo} onChange={(e) => setNuevoActivo({ ...nuevoActivo, marcaModelo: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Número de Serie *</label>
                <input required type="text" placeholder="EJ: SN-998822" style={styles.inputModal} value={nuevoActivo.serie} onChange={(e) => setNuevoActivo({ ...nuevoActivo, serie: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Tienda Origen</label>
                <input type="text" placeholder="EJ: Tienda 01 - Centro" style={styles.inputModal} value={nuevoActivo.tienda} onChange={(e) => setNuevoActivo({ ...nuevoActivo, tienda: e.target.value })} />
              </div>
              <div>
                <label style={styles.label}>Insumo Principal</label>
                <input type="text" placeholder="EJ: Tóner HP 58A" style={styles.inputModal} value={nuevoActivo.insumo} onChange={(e) => setNuevoActivo({ ...nuevoActivo, insumo: e.target.value })} />
              </div>
              
              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button type="button" style={styles.btnSecondary} onClick={() => setMostrarModal(false)}>Cancelar</button>
                <button type="submit" style={styles.btnPrimary}>Guardar Activo</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Estilos dinámicos y responsivos
const styles = {
  container: { display: 'flex', flexDirection: 'column', gap: '20px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  title: { margin: 0, fontSize: '22px', fontWeight: 'bold', color: '#f8fafc' },
  subtitle: { margin: '4px 0 0 0', fontSize: '13px', color: '#94a3b8' },
  btnPrimary: { backgroundColor: '#2563eb', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '14px' },
  btnSecondary: { backgroundColor: '#64748b', color: '#fff', border: 'none', padding: '10px 16px', borderRadius: '6px', cursor: 'pointer', fontSize: '14px' },
  filterBar: { display: 'flex', gap: '12px' },
  searchInput: { flex: 1, padding: '10px 14px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', outline: 'none' },
  selectFilter: { padding: '10px 14px', borderRadius: '6px', border: '1px solid #334155', backgroundColor: '#1e293b', color: '#fff', cursor: 'pointer' },
  tableCard: { backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', overflow: 'hidden' },
  table: { width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '14px' },
  trHead: { backgroundColor: '#0f172a', borderBottom: '1px solid #334155' },
  th: { padding: '14px', color: '#94a3b8', fontWeight: '600' },
  trBody: { borderBottom: '1px solid #334155' },
  td: { padding: '14px', color: '#e2e8f0' },
  tdEmpty: { padding: '24px', textAlign: 'center', color: '#94a3b8' },
  badge: { padding: '4px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 'bold', display: 'inline-block' },
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
  modalCard: { backgroundColor: '#ffffff', padding: '24px', borderRadius: '10px', width: '500px', maxWidth: '90%' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
  label: { display: 'block', fontSize: '12px', color: '#475569', marginBottom: '4px', fontWeight: '600' },
  inputModal: { width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }
};