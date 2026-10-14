import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import httpClient from '../api/httpClient';
import './RegistroInventario.css';

const formularioInicial = {
  codigo: '',
  descripcion: '',
  tipo: 'TINTA',
  color: '',
  marca: '',
  numero_parte: '',
  modelo: ''
};

export default function RegistrarInsumo() {
  const navigate = useNavigate();
  const [formulario, setFormulario] = useState(formularioInicial);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState('');
  const [error, setError] = useState('');

  const cambiarCampo = (e) => {
    const { name, value } = e.target;
    setFormulario((anterior) => ({ ...anterior, [name]: value }));
  };

  const guardarInsumo = async (e) => {
    e.preventDefault();
    setMensaje('');
    setError('');

    if (!formulario.codigo.trim() || !formulario.descripcion.trim()) {
      setError('El código y la descripción son obligatorios.');
      return;
    }

    try {
      setGuardando(true);

      // Este formulario requiere que el backend tenga
      // disponible POST /api/v1/consumibles.
      const datos = {
        codigo: formulario.codigo.trim().toUpperCase(),
        descripcion: formulario.descripcion.trim(),
        tipo: formulario.tipo,
        color: formulario.tipo === 'TINTA'
          ? formulario.color.trim()
          : '',
        marca: formulario.marca.trim() || null,
        numero_parte: formulario.numero_parte.trim() || null,
        modelo: formulario.modelo.trim() || null
      };

      await httpClient.post('/inventario/consumibles', datos);

      setMensaje('El insumo se registró correctamente.');
      setFormulario(formularioInicial);
    } catch (err) {
      setError(
        err.response?.data?.mensaje ||
        err.response?.data?.detail ||
        err.response?.data?.title ||
        'No se pudo registrar el insumo. Verifica la API.'
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <main className="pagina-registro">
      <section className="tarjeta-registro">
        <div className="encabezado-registro">
          <div>
            <h1>Registrar insumo</h1>
            <p>Agrega un nuevo artículo al catálogo de consumibles.</p>
          </div>
        </div>

        {mensaje && <div className="mensaje-exito">{mensaje}</div>}
        {error && <div className="mensaje-error">{error}</div>}

        <form onSubmit={guardarInsumo}>
          <div className="rejilla-formulario">
            <label>
              Código o número de identificación *
              <input
                name="codigo"
                value={formulario.codigo}
                onChange={cambiarCampo}
                placeholder="Ej. TINTA-001"
                maxLength={50}
                required
              />
            </label>

            <label>
              Tipo de insumo *
              <select
                name="tipo"
                value={formulario.tipo}
                onChange={cambiarCampo}
                required
              >
                <option value="TINTA">Tinta</option>
                <option value="TONER">Tóner</option>
                <option value="CINTA">Cinta</option>
                <option value="ROLLO_TERMICO">Rollo térmico</option>
              </select>
            </label>

            <label className="campo-completo">
              Descripción del insumo *
              <input
                name="descripcion"
                value={formulario.descripcion}
                onChange={cambiarCampo}
                placeholder="Ej. Tinta negra para impresora"
                maxLength={200}
                required
              />
            </label>

            {formulario.tipo === 'TINTA' && (
              <label>
                Color de la tinta *
                <select
                  name="color"
                  value={formulario.color}
                  onChange={cambiarCampo}
                  required
                >
                  <option value="">Seleccione un color</option>
                  <option value="Negro">Negro</option>
                  <option value="Cian">Cian</option>
                  <option value="Magenta">Magenta</option>
                  <option value="Amarillo">Amarillo</option>
                  <option value="Otro">Otro</option>
                </select>
              </label>
            )}

            <label>
              Marca
              <input
                name="marca"
                value={formulario.marca}
                onChange={cambiarCampo}
                placeholder="Ej. Epson, HP, Brother"
                maxLength={100}
              />
            </label>

            <label>
              Número de parte o serie del fabricante
              <input
                name="numero_parte"
                value={formulario.numero_parte}
                onChange={cambiarCampo}
                placeholder="Ingrese el número correspondiente"
                maxLength={100}
              />
            </label>

            <label>
              Modelo compatible
              <input
                name="modelo"
                value={formulario.modelo}
                onChange={cambiarCampo}
                placeholder="Ej. L3250"
                maxLength={100}
              />
            </label>
          </div>

          <p className="nota-formulario">
            Este formulario registra los datos del insumo. Para registrar
            las cantidades y actualizar las existencias, utiliza la pantalla
            de entradas de inventario que ya tienes.
          </p>

          <div className="acciones-formulario">
            <button type="button" className="boton-secundario"
              onClick={() => navigate(-1)}>
              Cancelar
            </button>
            <button type="submit" className="boton-principal"
              disabled={guardando}>
              {guardando ? 'Guardando...' : 'Guardar insumo'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}