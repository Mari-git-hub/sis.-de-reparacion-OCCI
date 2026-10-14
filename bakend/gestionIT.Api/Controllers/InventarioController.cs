using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/inventario")]
[EnableCors("PermitirReact")]
public class InventarioController : ControllerBase
{
    private readonly IConfiguration _config;

    public InventarioController(IConfiguration config)
    {
        _config = config;
    }

    // POST: api/v1/inventario/consumibles
    [HttpPost("consumibles")]
    public async Task<IActionResult> RegistrarConsumible([FromBody] CrearConsumibleDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Codigo) || string.IsNullOrWhiteSpace(dto.Descripcion))
        {
            return BadRequest(new { mensaje = "El código y la descripción son obligatorios." });
        }

        await using var conn = new SqlConnection(_config.GetConnectionString("Default"));
        await conn.OpenAsync();

        try
        {
            // 1. Validar que no exista un consumible con el mismo código
            const string validarSql = "SELECT COUNT(1) FROM CONSUMIBLES WHERE UPPER(codigo) = UPPER(@codigo)";
            await using (var cmdValidar = new SqlCommand(validarSql, conn))
            {
                cmdValidar.Parameters.Add("@codigo", SqlDbType.VarChar, 50).Value = dto.Codigo.Trim();
                int existe = Convert.ToInt32(await cmdValidar.ExecuteScalarAsync());

                if (existe > 0)
                {
                    return Conflict(new { mensaje = "Ya existe un insumo registrado con este código." });
                }
            }

            // 2. Insertar el nuevo consumible en la base de datos
            const string insertarSql = """
                INSERT INTO CONSUMIBLES (codigo, descripcion, tipo, color, marca, numero_parte, modelo)
                VALUES (@codigo, @descripcion, @tipo, @color, @marca, @numeroParte, @modelo);
                SELECT CAST(SCOPE_IDENTITY() AS int);
                """;

            await using var cmdInsertar = new SqlCommand(insertarSql, conn);
            cmdInsertar.Parameters.Add("@codigo", SqlDbType.VarChar, 50).Value = dto.Codigo.Trim().ToUpper();
            cmdInsertar.Parameters.Add("@descripcion", SqlDbType.VarChar, 200).Value = dto.Descripcion.Trim();
            cmdInsertar.Parameters.Add("@tipo", SqlDbType.VarChar, 50).Value = dto.Tipo ?? "TINTA";
            cmdInsertar.Parameters.Add("@color", SqlDbType.VarChar, 50).Value = (object?)dto.Color ?? DBNull.Value;
            cmdInsertar.Parameters.Add("@marca", SqlDbType.VarChar, 100).Value = (object?)dto.Marca ?? DBNull.Value;
            cmdInsertar.Parameters.Add("@numeroParte", SqlDbType.VarChar, 100).Value = (object?)dto.Numero_Parte ?? DBNull.Value;
            cmdInsertar.Parameters.Add("@modelo", SqlDbType.VarChar, 100).Value = (object?)dto.Modelo ?? DBNull.Value;

            int nuevoId = Convert.ToInt32(await cmdInsertar.ExecuteScalarAsync());

            return Ok(new
            {
                id = nuevoId,
                mensaje = "Insumo registrado correctamente en el catálogo."
            });
        }
        catch (SqlException ex)
        {
            Console.Error.WriteLine($"Error SQL en RegistrarConsumible: {ex}");
            return StatusCode(500, new { mensaje = "Error en la base de datos al registrar el insumo.", detalle = ex.Message });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Error en RegistrarConsumible: {ex}");
            return StatusCode(500, new { mensaje = "Error interno al registrar el insumo.", detalle = ex.Message });
        }
    }
}

public class CrearConsumibleDto
{
    public string Codigo { get; set; } = string.Empty;
    public string Descripcion { get; set; } = string.Empty;
    public string? Tipo { get; set; }
    public string? Color { get; set; }
    public string? Marca { get; set; }
    public string? Numero_Parte { get; set; }
    public string? Modelo { get; set; }
}