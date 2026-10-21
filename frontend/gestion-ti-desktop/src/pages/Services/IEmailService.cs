using System.Threading.Tasks;

namespace GestionIT.API.Services
{
    public interface IEmailService
    {
        Task SendIngresoNotificacionAsync(string correoDestino, string folio, string nombreEquipo, string serie);
        Task SendCambioEstadoNotificacionAsync(string correoDestino, string folio, string nombreEquipo, string nuevoEstado, string observaciones);
    }
}