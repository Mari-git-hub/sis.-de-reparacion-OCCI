using System.Net;
using System.Net.Mail;
using Microsoft.Extensions.Options;

namespace gestionIT.Api.Services
{
    public interface IEmailService
    {
        Task EnviarNotificacionEstadoAsync(string correoDestino, string nombreSolicitante, string idSolicitud, string nuevoEstado, string observaciones);
    }

    public class EmailService : IEmailService
    {
        private readonly EmailSettings _emailSettings;

        public EmailService(IOptions<EmailSettings> emailSettings)
        {
            _emailSettings = emailSettings.Value;
        }

        public async Task EnviarNotificacionEstadoAsync(string correoDestino, string nombreSolicitante, string idSolicitud, string nuevoEstado, string observaciones)
        {
            var smtpClient = new SmtpClient(_emailSettings.SmtpServer)
            {
                Port = _emailSettings.Port,
                Credentials = new NetworkCredential(_emailSettings.Username, _emailSettings.Password),
                EnableSsl = true
            };

            var mailMessage = new MailMessage
            {
                From = new MailAddress(_emailSettings.SenderEmail, _emailSettings.SenderName),
                Subject = $"[Avance de Reparación #{idSolicitud}] Estado: {nuevoEstado}",
                Body = $@"
                    <h2>Hola, {nombreSolicitante}</h2>
                    <p>Te informamos la actualización del estado de tu equipo en reparación <strong>#{idSolicitud}</strong>.</p>
                    <p><strong>Nuevo Estado:</strong> <span style='color: #007bff;'>{nuevoEstado}</span></p>
                    <p><strong>Observaciones:</strong> {observaciones}</p>
                    <hr>
                    <p><small>Soporte Técnico IT</small></p>",
                IsBodyHtml = true
            };

            mailMessage.To.Add(correoDestino);
            await smtpClient.SendMailAsync(mailMessage);
        }
    }
}