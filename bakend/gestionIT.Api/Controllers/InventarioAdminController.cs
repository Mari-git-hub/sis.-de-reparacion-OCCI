using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/inventario-admin")]
[EnableCors("PermitirReact")]
public class InventarioAdminController : ControllerBase
{
    private readonly IConfiguration _config;

    public InventarioAdminController(IConfiguration config)
    {
        _config = config;
    }

    // 1. OBTENER TODO EL INVENTARIO CON ESTADO Y DÍAS DESDE ÚLTIMA SALIDA
    [HttpGet]
    public async Task<IActionResult> ObtenerInventario()
    {
        var lista = new List<object>();
        using var conn = new SqlConnection(_config.GetConnectionString("Default"));
        await conn.OpenAsync();

        var query = @"
            SELECT 
                c.id, c.codigo, c.tipo, c.marca, c.modelo, c.color, 
                ISNULL(c.stock_actual, 0) AS stock_actual,
                ISNULL(c.stock_minimo, 5) AS stock_minimo,
                MAX(s.fecha_salida) AS ultima_salida,
                DATEDIFF(day, MAX(s.fecha_salida), GETDATE()) AS dias_sin_despacho
            FROM CONSUMIBLES c
            LEFT JOIN SALIDAS s ON s.consumible_id = c.id
            GROUP BY c.id, c.codigo, c.tipo, c.marca, c.modelo, c.color, c.stock_actual, c.stock_minimo
            ORDER BY c.tipo, c.marca";

        using var cmd = new SqlCommand(query, conn);
        using var reader = await cmd.ExecuteReaderAsync();

        while (await reader.ReadAsync())
        {
            var ultimaSalida = reader["ultima_salida"] != DBNull.Value ? (DateTime?)reader["ultima_salida"] : null;
            var dias = reader["dias_sin_despacho"] != DBNull.Value ? Convert.ToInt32(reader["dias_sin_despacho"]) : (int?)null;

            lista.Add(new
            {
                id = (int)reader["id"],
                codigo = reader["codigo"].ToString(),
                tipo = reader["tipo"].ToString(),
                marca = reader["marca"].ToString(),
                modelo = reader["modelo"].ToString(),
                color = reader["color"].ToString(),
                stockActual = Convert.ToInt32(reader["stock_actual"]),
                stockMinimo = Convert.ToInt32(reader["stock_minimo"]),
                ultimaSalida = ultimaSalida?.ToString("dd/MM/yyyy"),
                diasSinDespacho = dias
            });
        }

        return Ok(lista);
    }

    // 2. ACTUALIZAR STOCK Y DATOS DEL INSUMO DIRECTO (ADMIN)
    [HttpPut("{id}")]
    public async Task<IActionResult> ActualizarInventario(int id, [FromBody] ActualizarInsumoDto dto)
    {
        using var conn = new SqlConnection(_config.GetConnectionString("Default"));
        await conn.OpenAsync();

        var query = @"
            UPDATE CONSUMIBLES 
            SET stock_actual = @stockActual, 
                stock_minimo = @stockMinimo,
                marca = @marca,
                modelo = @modelo
            WHERE id = @id";

        using var cmd = new SqlCommand(query, conn);
        cmd.Parameters.AddWithValue("@stockActual", dto.StockActual);
        cmd.Parameters.AddWithValue("@stockMinimo", dto.StockMinimo);
        cmd.Parameters.AddWithValue("@marca", dto.Marca ?? "");
        cmd.Parameters.AddWithValue("@modelo", dto.Modelo ?? "");
        cmd.Parameters.AddWithValue("@id", id);

        int filasAfectadas = await cmd.ExecuteNonQueryAsync();
        if (filasAfectadas > 0) return Ok(new { mensaje = "Inventario actualizado correctamente." });

        return NotFound(new { mensaje = "Insumo no encontrado." });
    }
}

public class ActualizarInsumoDto
{
    public int StockActual { get; set; }
    public int StockMinimo { get; set; }
    public string Marca { get; set; }
    public string Modelo { get; set; }
}