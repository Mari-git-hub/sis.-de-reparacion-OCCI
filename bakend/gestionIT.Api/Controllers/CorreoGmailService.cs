
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;

namespace gestionIT.Api.Servicios;

public sealed class CorreoGmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<CorreoGmailService> _logger;

    public CorreoGmailService(
        IConfiguration configuration,
        ILogger<CorreoGmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<bool> EnviarAsync(
        string destinatario,
        string asunto,
        string mensaje)
    {
        var remitente = _configuration["CorreoGmail:Usuario"];
        var contrasena = _configuration["CorreoGmail:ContrasenaAplicacion"];

        if (string.IsNullOrWhiteSpace(remitente) ||
            string.IsNullOrWhiteSpace(contrasena))
        {
            _logger.LogError(
                "No está configurada la cuenta Gmail o su contraseña de aplicación.");
            return false;
        }

        if (string.IsNullOrWhiteSpace(destinatario))
        {
            _logger.LogWarning("No se envió el correo: destinatario vacío.");
            return false;
        }

        try
        {
            var correo = new MimeMessage();
            correo.From.Add(MailboxAddress.Parse(remitente));
            correo.To.Add(MailboxAddress.Parse(destinatario));
            correo.Subject = asunto;
            correo.Body = new TextPart("plain")
            {
                Text = mensaje
            };

            using var cliente = new SmtpClient();

            await cliente.ConnectAsync(
                "smtp.gmail.com",
                587,
                SecureSocketOptions.StartTls);

            await cliente.AuthenticateAsync(remitente, contrasena);
            await cliente.SendAsync(correo);
            await cliente.DisconnectAsync(true);

            _logger.LogInformation(
                "Correo enviado correctamente a {Destinatario}.",
                destinatario);

            return true;
        }
        catch (Exception ex)
        {
            // El correo puede fallar sin deshacer un registro ya guardado.
            _logger.LogError(
                ex,
                "No se pudo enviar un correo a {Destinatario}.",
                destinatario);

            return false;
        }
    }
}
