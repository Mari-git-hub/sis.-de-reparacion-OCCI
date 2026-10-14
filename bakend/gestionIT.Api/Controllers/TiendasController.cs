using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/tiendas")]
[EnableCors("PermitirReact")]
public class TiendasController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly ILogger<TiendasController> _logger;

    public TiendasController(
        IConfiguration config,
        ILogger<TiendasController> logger)
    {
        _config = config;
        _logger = logger;
    }

    [HttpGet]
    public async Task<IActionResult> GetTiendas()
    {
        var lista = new List<object>();

        try
        {
            var connectionString =
                _config.GetConnectionString("Default");

            if (string.IsNullOrWhiteSpace(connectionString))
            {
                _logger.LogError(
                    "No se encontró la cadena de conexión Default.");

                return StatusCode(500, new
                {
                    mensaje = "No está configurada la conexión a la base de datos."
                });
            }

            await using var conn =
                new SqlConnection(connectionString);

            await conn.OpenAsync();

            const string sql = @"
                SELECT id, nombre, codigo
                FROM TIENDAS
                ORDER BY nombre ASC;";

            await using var cmd = new SqlCommand(sql, conn);

            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                lista.Add(new
                {
                    id = Convert.ToInt32(reader["id"]),
                    nombre = reader["nombre"] == DBNull.Value
                        ? ""
                        : reader["nombre"].ToString(),
                    codigo = reader["codigo"] == DBNull.Value
                        ? ""
                        : reader["codigo"].ToString()
                });
            }

            return Ok(lista);
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "Error SQL al consultar las tiendas.");

            return StatusCode(500, new
            {
                mensaje = "Error al consultar las tiendas en la base de datos.",
                detalle = ex.Message
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Error inesperado al consultar las tiendas.");

            return StatusCode(500, new
            {
                mensaje = "Ocurrió un error al consultar las tiendas.",
                detalle = ex.Message
            });
        }
    }
}