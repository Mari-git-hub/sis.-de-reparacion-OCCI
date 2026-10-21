using System.Security.Claims;
using gestionIT.Api.Services; // Namespace de tu IEmailService
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/solicitudes")]
public class SolicitudesController : ControllerBase
{
    private readonly IConfiguration _configuration;
    private readonly IEmailService _emailService;

    // Constructor con IConfiguration e IEmailService inyectados
    public SolicitudesController(IConfiguration configuration, IEmailService emailService)
    {
        _configuration = configuration;
        _emailService = emailService;
    }

    [HttpGet("recientes")]
    public async Task<IActionResult> ObtenerRecientes()
    {
        bool esAdminOTecnico =
            User.IsInRole("Admin IT") ||
            User.IsInRole("Técnico IT");

        int? usuarioId = null;

        if (!esAdminOTecnico)
        {
            string? idTexto =
                User.FindFirstValue("sub") ??
                User.FindFirstValue(ClaimTypes.NameIdentifier);

            if (!int.TryParse(idTexto, out int id) || id <= 0)
            {
                return Unauthorized(new
                {
                    mensaje = "No se pudo identificar al usuario autenticado."
                });
            }

            usuarioId = id;
        }

        string? cadena = _configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(cadena))
        {
            return StatusCode(500, new
            {
                mensaje = "No está configurada la conexión Default."
            });
        }

        const string sql = """
            SELECT TOP (100)
                r.id,
                r.folio,
                r.estado,
                r.fecha_registro,
                e.nombre AS equipo,
                e.codigo_interno,
                h.fecha AS fecha_actualizacion,
                h.comentario,
                r.correo_solicitante
            FROM REPARACIONES r
            INNER JOIN EQUIPOS e
                ON e.id = r.equipo_id
            OUTER APPLY
            (
                SELECT TOP (1)
                    he.fecha,
                    he.comentario
                FROM HISTORIAL_ESTADOS he
                WHERE he.reparacion_id = r.id
                ORDER BY he.fecha DESC
            ) h
            WHERE
                (@esAdminOTecnico = 1 OR r.solicitante_id = @usuarioId)
            ORDER BY
                COALESCE(h.fecha, r.fecha_registro) DESC;
            """;

        try
        {
            await using var conexion = new SqlConnection(cadena);
            await conexion.OpenAsync();

            await using var comando = new SqlCommand(sql, conexion);

            comando.Parameters.AddWithValue("@esAdminOTecnico", esAdminOTecnico ? 1 : 0);
            comando.Parameters.AddWithValue("@usuarioId", (object?)usuarioId ?? DBNull.Value);

            await using var lector = await comando.ExecuteReaderAsync();

            var solicitudes = new List<object>();

            while (await lector.ReadAsync())
            {
                solicitudes.Add(new
                {
                    id = lector.GetInt32(0),
                    folio = lector.IsDBNull(1) ? "" : lector.GetString(1),
                    estado = lector.IsDBNull(2) ? "" : lector.GetString(2),
                    fechaRegistro = lector.GetDateTime(3),
                    equipo = lector.IsDBNull(4) ? "" : lector.GetString(4),
                    codigoInterno = lector.IsDBNull(5) ? "" : lector.GetString(5),
                    fechaActualizacion = lector.IsDBNull(6)
                        ? (DateTime?)null
                        : lector.GetDateTime(6),
                    comentario = lector.IsDBNull(7) ? "" : lector.GetString(7),
                    correoSolicitante = lector.IsDBNull(8) ? "" : lector.GetString(8)
                });
            }

            return Ok(solicitudes);
        }
        catch (SqlException ex)
        {
            return StatusCode(500, new
            {
                mensaje = "Error SQL al consultar el avance de solicitudes.",
                detalle = ex.Message
            });
        }
    }

    [HttpPut("{id}/estado")]
    [Authorize(Roles = "Admin IT,Técnico IT")]
    public async Task<IActionResult> ActualizarEstado(int id, [FromBody] ActualizarEstadoDto dto)
    {
        string? cadena = _configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(cadena))
        {
            return StatusCode(500, new { mensaje = "No está configurada la conexión Default." });
        }

        const string sqlBuscar = """
            SELECT r.id, r.folio, r.correo_solicitante, u.nombre AS nombre_solicitante
            FROM REPARACIONES r
            LEFT JOIN USUARIOS u ON u.id = r.solicitante_id
            WHERE r.id = @id;
            """;

        const string sqlActualizar = """
            UPDATE REPARACIONES 
            SET estado = @nuevoEstado 
            WHERE id = @id;

            INSERT INTO HISTORIAL_ESTADOS (reparacion_id, fecha, comentario)
            VALUES (@id, GETDATE(), @comentario);
            """;

        try
        {
            await using var conexion = new SqlConnection(cadena);
            await conexion.OpenAsync();

            // 1. Obtener la información del solicitante antes de actualizar
            string correo = "";
            string nombreSolicitante = "";
            string folio = "";

            await using (var cmdBuscar = new SqlCommand(sqlBuscar, conexion))
            {
                cmdBuscar.Parameters.AddWithValue("@id", id);
                await using var lector = await cmdBuscar.ExecuteReaderAsync();
                
                if (!await lector.ReadAsync())
                {
                    return NotFound(new { mensaje = "No se encontró la solicitud especificada." });
                }

                folio = lector.IsDBNull(1) ? id.ToString() : lector.GetString(1);
                correo = lector.IsDBNull(2) ? "" : lector.GetString(2);
                nombreSolicitante = lector.IsDBNull(3) ? "Usuario" : lector.GetString(3);
            }

            // 2. Actualizar el estado en la Base de Datos
            await using (var cmdActualizar = new SqlCommand(sqlActualizar, conexion))
            {
                cmdActualizar.Parameters.AddWithValue("@id", id);
                cmdActualizar.Parameters.AddWithValue("@nuevoEstado", dto.NuevoEstado);
                cmdActualizar.Parameters.AddWithValue("@comentario", dto.Comentario ?? "");
                await cmdActualizar.ExecuteNonQueryAsync();
            }

            // 3. Enviar notificación por correo electrónico
            if (!string.IsNullOrWhiteSpace(correo))
            {
                try
                {
                    await _emailService.EnviarNotificacionEstadoAsync(
                        correo,
                        nombreSolicitante,
                        folio,
                        dto.NuevoEstado,
                        dto.Comentario ?? "Sin observaciones adicionales."
                    );
                }
                catch (Exception ex)
                {
                    // Si falla el servidor de correo, la actualización en BD no se invalida
                    Console.WriteLine($"Error al enviar correo: {ex.Message}");
                }
            }

            return Ok(new { mensaje = "Estado actualizado y notificación enviada correctamente." });
        }
        catch (SqlException ex)
        {
            return StatusCode(500, new
            {
                mensaje = "Error SQL al actualizar el estado de la reparación.",
                detalle = ex.Message
            });
        }
    }
}

// DTO para recibir la petición HTTP al cambiar estado
public class ActualizarEstadoDto
{
    public string NuevoEstado { get; set; } = string.Empty;
    public string? Comentario { get; set; }
}