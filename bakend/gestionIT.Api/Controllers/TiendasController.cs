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

    public TiendasController(IConfiguration config)
    {
        _config = config;
    }

    [HttpGet]
    public async Task<IActionResult> GetTiendas()
    {
        var lista = new List<object>();
        using var conn = new SqlConnection(_config.GetConnectionString("Default"));
        await conn.OpenAsync();

        var cmd = new SqlCommand("SELECT id, nombre, codigo FROM TIENDAS WHERE activa = 1 ORDER BY nombre ASC", conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            lista.Add(new
            {
                id = (int)reader["id"],
                nombre = reader["nombre"].ToString(),
                codigo = reader["codigo"].ToString()
            });
        }

        return Ok(lista);
    }
}