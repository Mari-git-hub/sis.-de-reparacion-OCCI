
using System.Security.Claims;
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

    public SolicitudesController(IConfiguration configuration)
    {
        _configuration = configuration;
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

        string? cadena =
            _configuration.GetConnectionString("Default");

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
                h.comentario
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

            comando.Parameters.AddWithValue(
                "@esAdminOTecnico", esAdminOTecnico ? 1 : 0);

            comando.Parameters.AddWithValue(
                "@usuarioId", (object?)usuarioId ?? DBNull.Value);

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
                    comentario = lector.IsDBNull(7) ? "" : lector.GetString(7)
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
}
