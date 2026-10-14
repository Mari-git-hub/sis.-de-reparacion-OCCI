
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using System.Data;

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

    // GET: api/v1/inventario-admin
    // Consulta consumibles, stock total e historial de salidas.
    [HttpGet]
    public async Task<IActionResult> ObtenerInventario()
    {
        try
        {
            var lista = new List<object>();

            await using var conn = new SqlConnection(
                _config.GetConnectionString("Default"));

            await conn.OpenAsync();

            var query = @"
                WITH Stock AS
                (
                    SELECT
                        consumible_id,
                        SUM(stock_actual) AS stock_actual,
                        SUM(stock_minimo) AS stock_minimo
                    FROM INVENTARIO_CONSUMIBLE
                    GROUP BY consumible_id
                ),
                Historial AS
                (
                    SELECT
                        consumible_id,
                        MAX(
                            CASE
                                WHEN UPPER(tipo_movimiento) LIKE '%SALIDA%'
                                  OR UPPER(tipo_movimiento) LIKE '%CONSUMO%'
                                  OR UPPER(tipo_movimiento) LIKE '%ENTREGA%'
                                THEN fecha
                            END
                        ) AS ultima_salida
                    FROM HISTORIAL_INVENTARIO
                    GROUP BY consumible_id
                )
                SELECT
                    c.id,
                    c.codigo,
                    c.descripcion,
                    c.tipo,
                    c.marca,
                    c.modelo,
                    c.color,
                    ISNULL(s.stock_actual, 0) AS stock_actual,
                    ISNULL(s.stock_minimo, 0) AS stock_minimo,
                    h.ultima_salida,
                    CASE
                        WHEN h.ultima_salida IS NOT NULL
                        THEN DATEDIFF(
                            DAY, h.ultima_salida, GETDATE()
                        )
                        ELSE NULL
                    END AS dias_sin_despacho
                FROM CONSUMIBLES c
                LEFT JOIN Stock s
                    ON s.consumible_id = c.id
                LEFT JOIN Historial h
                    ON h.consumible_id = c.id
                ORDER BY c.tipo, c.marca, c.descripcion;";

            await using var cmd = new SqlCommand(query, conn);
            await using var reader = await cmd.ExecuteReaderAsync();

            while (await reader.ReadAsync())
            {
                DateTime? ultimaSalida =
                    reader["ultima_salida"] == DBNull.Value
                        ? null
                        : Convert.ToDateTime(reader["ultima_salida"]);

                int? dias =
                    reader["dias_sin_despacho"] == DBNull.Value
                        ? null
                        : Convert.ToInt32(reader["dias_sin_despacho"]);

                lista.Add(new
                {
                    id = Convert.ToInt32(reader["id"]),
                    codigo = reader["codigo"]?.ToString(),
                    descripcion = reader["descripcion"]?.ToString(),
                    tipo = reader["tipo"]?.ToString(),
                    marca = reader["marca"] == DBNull.Value
                        ? ""
                        : reader["marca"].ToString(),
                    modelo = reader["modelo"] == DBNull.Value
                        ? ""
                        : reader["modelo"].ToString(),
                    color = reader["color"]?.ToString(),
                    stockActual = Convert.ToInt32(
                        reader["stock_actual"]),
                    stockMinimo = Convert.ToInt32(
                        reader["stock_minimo"]),
                    ultimaSalida = ultimaSalida?.ToString("dd/MM/yyyy"),
                    diasSinDespacho = dias
                });
            }

            return Ok(lista);
        }
        catch (SqlException ex)
        {
            // El detalle queda en la terminal del backend.
            Console.Error.WriteLine(
                $"Error SQL en ObtenerInventario: {ex}");

            return StatusCode(500, new
            {
                mensaje = "No fue posible consultar el inventario.",
                detalle = ex.Message
            });
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine(
                $"Error en ObtenerInventario: {ex}");

            return StatusCode(500, new
            {
                mensaje = "Ocurrió un error al consultar el inventario.",
                detalle = ex.Message
            });
        }
    }

    // PUT: api/v1/inventario-admin/{id}
    // Actualiza los datos del consumible y el stock de una tienda.
    [HttpPut("{id:int}")]
    public async Task<IActionResult> ActualizarInventario(
        int id,
        [FromBody] ActualizarInsumoDto dto)
    {
        if (dto.TiendaId <= 0)
        {
            return BadRequest(new
            {
                mensaje = "Debes indicar la tienda cuyo stock deseas actualizar."
            });
        }

        if (dto.StockActual < 0 || dto.StockMinimo < 0)
        {
            return BadRequest(new
            {
                mensaje = "El stock no puede ser negativo."
            });
        }

        await using var conn = new SqlConnection(
            _config.GetConnectionString("Default"));

        await conn.OpenAsync();

        await using var transaction =
            (SqlTransaction)await conn.BeginTransactionAsync();

        try
        {
            // Verificar que exista el consumible.
            await using (var verificar = new SqlCommand(
                "SELECT COUNT(1) FROM CONSUMIBLES WHERE id = @id",
                conn, transaction))
            {
                verificar.Parameters.Add("@id", SqlDbType.Int).Value = id;

                int existe = Convert.ToInt32(
                    await verificar.ExecuteScalarAsync());

                if (existe == 0)
                {
                    await transaction.RollbackAsync();

                    return NotFound(new
                    {
                        mensaje = "No se encontró el consumible."
                    });
                }
            }

            // Actualizar marca y modelo en CONSUMIBLES.
            await using (var cmd = new SqlCommand(@"
                UPDATE CONSUMIBLES
                SET marca = @marca,
                    modelo = @modelo
                WHERE id = @id;",
                conn, transaction))
            {
                cmd.Parameters.Add("@marca", SqlDbType.VarChar, 255)
                    .Value = (object?)dto.Marca ?? DBNull.Value;

                cmd.Parameters.Add("@modelo", SqlDbType.VarChar, 255)
                    .Value = (object?)dto.Modelo ?? DBNull.Value;

                cmd.Parameters.Add("@id", SqlDbType.Int).Value = id;

                await cmd.ExecuteNonQueryAsync();
            }

            // Actualizar el stock únicamente en la tienda seleccionada.
            await using (var cmd = new SqlCommand(@"
                UPDATE INVENTARIO_CONSUMIBLE
                SET stock_actual = @stockActual,
                    stock_minimo = @stockMinimo
                WHERE consumible_id = @id
                  AND tienda_id = @tiendaId;",
                conn, transaction))
            {
                cmd.Parameters.Add("@stockActual", SqlDbType.Int)
                    .Value = dto.StockActual;

                cmd.Parameters.Add("@stockMinimo", SqlDbType.Int)
                    .Value = dto.StockMinimo;

                cmd.Parameters.Add("@id", SqlDbType.Int).Value = id;

                cmd.Parameters.Add("@tiendaId", SqlDbType.Int)
                    .Value = dto.TiendaId;

                int filas = await cmd.ExecuteNonQueryAsync();

                if (filas == 0)
                {
                    await transaction.RollbackAsync();

                    return NotFound(new
                    {
                        mensaje =
                            "No existe un registro de stock para ese consumible y esa tienda."
                    });
                }
            }

            await transaction.CommitAsync();

            return Ok(new
            {
                mensaje = "Inventario actualizado correctamente."
            });
        }
        catch (Exception ex)
        {
            await transaction.RollbackAsync();

            Console.Error.WriteLine(
                $"Error al actualizar inventario: {ex}");

            return StatusCode(500, new
            {
                mensaje = "No fue posible actualizar el inventario.",
                detalle = ex.Message
            });
        }
    }
}

public class ActualizarInsumoDto
{
    public int TiendaId { get; set; }

    public int StockActual { get; set; }

    public int StockMinimo { get; set; }

    public string? Marca { get; set; }

    public string? Modelo { get; set; }
}
