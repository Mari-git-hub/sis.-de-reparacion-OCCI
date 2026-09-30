using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/inventario")]
public class InventarioController(IConfiguration cfg) : ControllerBase
{
    private int UserId =>
        int.TryParse(User.FindFirstValue("sub"), out var id) ? id : 0;

    private int? Tienda =>
        int.TryParse(User.FindFirstValue("tienda_id"), out var tiendaId)
            ? tiendaId
            : null;

    private string Rol =>
        User.FindFirstValue(ClaimTypes.Role) ?? "";

    private SqlConnection C() =>
        new(cfg.GetConnectionString("Default"));

    private bool EsAdmin =>
        Rol == "Admin IT";


    // ============================================================
    // CONSUMIBLES / CATÁLOGO
    // ============================================================

    [HttpGet("consumibles")]
    public async Task<IActionResult> Consumibles(
        [FromQuery] int? tiendaId,
        [FromQuery] string? tipo)
    {
        if (!EsAdmin)
        {
            if (!Tienda.HasValue)
            {
                return StatusCode(403, new
                {
                    message = "El usuario no tiene una tienda asignada."
                });
            }

            tiendaId = Tienda.Value;
        }

        await using var c = C();
        await c.OpenAsync();

        const string sql = """
            SELECT
                c.id,
                c.codigo,
                c.descripcion,
                c.tipo,
                c.color,
                c.marca,
                c.numero_parte,
                c.modelo,
                ISNULL(i.stock_actual, 0) AS stock_actual
            FROM CONSUMIBLES c
            LEFT JOIN INVENTARIO_CONSUMIBLE i
                ON i.consumible_id = c.id
               AND i.tienda_id = @tiendaId
            WHERE (@tipo IS NULL OR c.tipo = @tipo)
            ORDER BY c.descripcion, c.codigo;
            """;

        await using var q = new SqlCommand(sql, c);

        q.Parameters.AddWithValue(
            "@tiendaId",
            (object?)tiendaId ?? DBNull.Value
        );

        q.Parameters.AddWithValue(
            "@tipo",
            (object?)tipo ?? DBNull.Value
        );

        await using var r = await q.ExecuteReaderAsync();

        var lista = new List<object>();

        while (await r.ReadAsync())
        {
            lista.Add(new
            {
                id = r.GetInt32(0),
                codigo = r.GetString(1),

                descripcion = r.IsDBNull(2)
                    ? ""
                    : r.GetString(2),

                tipo = r.GetString(3),

                color = r.IsDBNull(4)
                    ? ""
                    : r.GetString(4),

                marca = r.IsDBNull(5)
                    ? ""
                    : r.GetString(5),

                numeroParte = r.IsDBNull(6)
                    ? ""
                    : r.GetString(6),

                modelo = r.IsDBNull(7)
                    ? ""
                    : r.GetString(7),

                stockActual = r.GetInt32(8)
            });
        }

        return Ok(lista);
    }


    // ============================================================
    // INVENTARIO / STOCK
    // ============================================================

    [HttpGet("stock")]
    public async Task<IActionResult> Stock()
    {
        if (!EsAdmin && !Tienda.HasValue)
        {
            return StatusCode(403, new
            {
                message = "El usuario no tiene una tienda asignada."
            });
        }

        await using var c = C();
        await c.OpenAsync();

        var sql =
            """
            SELECT
                i.id,
                i.consumible_id,
                i.tienda_id,
                c.codigo,
                c.descripcion,
                c.tipo,
                c.color,
                c.marca,
                c.numero_parte,
                c.modelo,
                i.stock_actual,
                i.stock_minimo,
                t.nombre AS tienda
            FROM INVENTARIO_CONSUMIBLE i
            INNER JOIN CONSUMIBLES c
                ON c.id = i.consumible_id
            INNER JOIN TIENDAS t
                ON t.id = i.tienda_id
            """
            +
            (EsAdmin
                ? ""
                : " WHERE i.tienda_id=@t")
            +
            """
            ORDER BY t.nombre, c.codigo;
            """;

        await using var q = new SqlCommand(sql, c);

        if (!EsAdmin)
        {
            q.Parameters.AddWithValue("@t", Tienda!.Value);
        }

        await using var r = await q.ExecuteReaderAsync();

        var lista = new List<object>();

        while (await r.ReadAsync())
        {
            lista.Add(new
            {
                id = r.GetInt32(0),
                consumibleId = r.GetInt32(1),
                tiendaId = r.GetInt32(2),
                codigo = r.GetString(3),

                descripcion = r.IsDBNull(4)
                    ? ""
                    : r.GetString(4),

                tipo = r.GetString(5),

                color = r.IsDBNull(6)
                    ? ""
                    : r.GetString(6),

                marca = r.IsDBNull(7)
                    ? ""
                    : r.GetString(7),

                numeroParte = r.IsDBNull(8)
                    ? ""
                    : r.GetString(8),

                modelo = r.IsDBNull(9)
                    ? ""
                    : r.GetString(9),

                stock = r.GetInt32(10),
                minimo = r.GetInt32(11),
                tienda = r.GetString(12)
            });
        }

        return Ok(lista);
    }


    // ============================================================
    // MOVIMIENTO INDIVIDUAL / SALIDA
    // ============================================================

    [HttpPost("movimiento")]
    [Authorize(Roles = "Admin IT,Técnico IT")]
    public async Task<IActionResult> Movimiento(
        [FromBody] ConsumirInsumoRequest r)
    {
        if (r.Cantidad <= 0)
        {
            return BadRequest(new
            {
                message = "La cantidad debe ser mayor que cero."
            });
        }

        if (!EsAdmin &&
            (!Tienda.HasValue || Tienda.Value != r.TiendaId))
        {
            return StatusCode(403, new
            {
                message =
                    "No tiene permiso para operar inventario de esta tienda."
            });
        }

        await using var c = C();
        await c.OpenAsync();

        await using var tx = await c.BeginTransactionAsync();

        try
        {
            const string sql = """
                SELECT
                    id,
                    stock_actual,
                    stock_minimo
                FROM INVENTARIO_CONSUMIBLE WITH (UPDLOCK, HOLDLOCK)
                WHERE consumible_id=@c
                  AND tienda_id=@t;
                """;

            await using var q =
                new SqlCommand(sql, c, (SqlTransaction)tx);

            q.Parameters.AddWithValue("@c", r.ConsumibleId);
            q.Parameters.AddWithValue("@t", r.TiendaId);

            await using var rd = await q.ExecuteReaderAsync();

            if (!await rd.ReadAsync())
            {
                await rd.DisposeAsync();
                await tx.RollbackAsync();

                return NotFound(new
                {
                    message =
                        "No existe inventario para ese consumible y tienda."
                });
            }

            var inventarioId = rd.GetInt32(0);
            var stockAnterior = rd.GetInt32(1);
            var stockMinimo = rd.GetInt32(2);

            await rd.DisposeAsync();

            if (stockAnterior < r.Cantidad)
            {
                await tx.RollbackAsync();

                return Conflict(new
                {
                    message = "Stock insuficiente.",
                    stockActual = stockAnterior
                });
            }

            var stockNuevo = stockAnterior - r.Cantidad;

            const string updateSql = """
                UPDATE INVENTARIO_CONSUMIBLE
                SET stock_actual = stock_actual - @cantidad
                WHERE id=@inventarioId;

                INSERT INTO MOVIMIENTOS_CONSUMIBLE
                (
                    inventario_id,
                    impresora_id,
                    usuario_id,
                    tipo,
                    cantidad,
                    reparacion_id
                )
                VALUES
                (
                    @inventarioId,
                    @impresoraId,
                    @usuarioId,
                    'SALIDA',
                    @cantidad,
                    @reparacionId
                );
                """;

            await using var u =
                new SqlCommand(updateSql, c, (SqlTransaction)tx);

            u.Parameters.AddWithValue("@inventarioId", inventarioId);

            u.Parameters.AddWithValue(
                "@impresoraId",
                (object?)r.ImpresoraId ?? DBNull.Value
            );

            u.Parameters.AddWithValue("@usuarioId", UserId);
            u.Parameters.AddWithValue("@cantidad", r.Cantidad);

            u.Parameters.AddWithValue(
                "@reparacionId",
                (object?)r.ReparacionId ?? DBNull.Value
            );

            await u.ExecuteNonQueryAsync();

            await InsertarHistorialInventario(
                c,
                (SqlTransaction)tx,
                inventarioId,
                r.ConsumibleId,
                r.TiendaId,
                UserId,
                "SALIDA",
                r.Cantidad,
                stockAnterior,
                stockNuevo,
                null,
                r.ReparacionId,
                null
            );

            if (stockNuevo <= stockMinimo)
            {
                await InsertarAlertaStock(
                    c,
                    (SqlTransaction)tx,
                    r.ConsumibleId,
                    r.TiendaId,
                    stockNuevo
                );
            }

            await tx.CommitAsync();

            return Ok(new
            {
                message = "Salida registrada.",
                stockAnterior,
                stockNuevo
            });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }


    // ============================================================
    // MOVIMIENTOS MÚLTIPLES
    // ============================================================

    [HttpPost("consumibles/movimientos")]
    [Authorize(Roles = "Admin IT,Técnico IT")]
    public async Task<IActionResult> RegistrarMovimientos(
        [FromBody] RegistrarSalidasRequest request)
    {
        if (request.TiendaId <= 0)
        {
            return BadRequest(new
            {
                message = "Debe seleccionar una tienda."
            });
        }

        if (string.IsNullOrWhiteSpace(request.Tipo))
        {
            return BadRequest(new
            {
                message = "Debe indicar el tipo de consumible."
            });
        }

        if (request.Detalles == null ||
            request.Detalles.Count == 0)
        {
            return BadRequest(new
            {
                message =
                    "Debe registrar al menos un consumible."
            });
        }

        if (!EsAdmin &&
            (!Tienda.HasValue ||
             Tienda.Value != request.TiendaId))
        {
            return StatusCode(403, new
            {
                message =
                    "No tiene permiso para operar inventario de esta tienda."
            });
        }

        var codigos =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        foreach (var detalle in request.Detalles)
        {
            if (string.IsNullOrWhiteSpace(detalle.Codigo))
            {
                return BadRequest(new
                {
                    message =
                        "Todos los consumibles deben tener un código."
                });
            }

            if (detalle.Cantidad <= 0)
            {
                return BadRequest(new
                {
                    message =
                        $"La cantidad del código {detalle.Codigo} debe ser mayor que cero."
                });
            }

            var codigo =
                detalle.Codigo.Trim().ToUpperInvariant();

            if (!codigos.Add(codigo))
            {
                return BadRequest(new
                {
                    message =
                        $"El código {codigo} está repetido."
                });
            }
        }

        await using var c = C();
        await c.OpenAsync();

        await using var tx = await c.BeginTransactionAsync();

        var resultados = new List<object>();

        try
        {
            foreach (var detalle in request.Detalles)
            {
                var codigo =
                    detalle.Codigo.Trim().ToUpperInvariant();

                const string consumibleSql = """
                    SELECT TOP 1
                        id,
                        codigo,
                        descripcion,
                        tipo,
                        color,
                        marca,
                        numero_parte,
                        modelo
                    FROM CONSUMIBLES
                    WHERE UPPER(codigo)=@codigo
                      AND tipo=@tipo;
                    """;

                await using var consumibleCmd =
                    new SqlCommand(
                        consumibleSql,
                        c,
                        (SqlTransaction)tx
                    );

                consumibleCmd.Parameters.AddWithValue(
                    "@codigo",
                    codigo
                );

                consumibleCmd.Parameters.AddWithValue(
                    "@tipo",
                    request.Tipo
                );

                await using var cr =
                    await consumibleCmd.ExecuteReaderAsync();

                if (!await cr.ReadAsync())
                {
                    await cr.DisposeAsync();
                    await tx.RollbackAsync();

                    return NotFound(new
                    {
                        message =
                            $"No existe el código {codigo} para el tipo {request.Tipo}."
                    });
                }

                var consumibleId = cr.GetInt32(0);
                var codigoDb = cr.GetString(1);

                var descripcion =
                    cr.IsDBNull(2) ? "" : cr.GetString(2);

                var tipoDb = cr.GetString(3);

                var color =
                    cr.IsDBNull(4) ? "" : cr.GetString(4);

                var marca =
                    cr.IsDBNull(5) ? "" : cr.GetString(5);

                var numeroParte =
                    cr.IsDBNull(6) ? "" : cr.GetString(6);

                var modelo =
                    cr.IsDBNull(7) ? "" : cr.GetString(7);

                await cr.DisposeAsync();

                const string inventarioSql = """
                    SELECT
                        id,
                        stock_actual,
                        stock_minimo
                    FROM INVENTARIO_CONSUMIBLE WITH (UPDLOCK, HOLDLOCK)
                    WHERE consumible_id=@consumibleId
                      AND tienda_id=@tiendaId;
                    """;

                await using var inventarioCmd =
                    new SqlCommand(
                        inventarioSql,
                        c,
                        (SqlTransaction)tx
                    );

                inventarioCmd.Parameters.AddWithValue(
                    "@consumibleId",
                    consumibleId
                );

                inventarioCmd.Parameters.AddWithValue(
                    "@tiendaId",
                    request.TiendaId
                );

                await using var ir =
                    await inventarioCmd.ExecuteReaderAsync();

                if (!await ir.ReadAsync())
                {
                    await ir.DisposeAsync();
                    await tx.RollbackAsync();

                    return NotFound(new
                    {
                        message =
                            $"No existe inventario para {codigoDb} en la tienda seleccionada."
                    });
                }

                var inventarioId = ir.GetInt32(0);
                var stockAnterior = ir.GetInt32(1);
                var stockMinimo = ir.GetInt32(2);

                await ir.DisposeAsync();

                if (stockAnterior < detalle.Cantidad)
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            $"Stock insuficiente para {codigoDb}.",
                        codigo = codigoDb,
                        stockActual = stockAnterior,
                        cantidadSolicitada = detalle.Cantidad
                    });
                }

                var stockNuevo =
                    stockAnterior - detalle.Cantidad;

                const string updateSql = """
                    UPDATE INVENTARIO_CONSUMIBLE
                    SET stock_actual = stock_actual - @cantidad
                    WHERE id=@inventarioId;

                    INSERT INTO MOVIMIENTOS_CONSUMIBLE
                    (
                        inventario_id,
                        impresora_id,
                        usuario_id,
                        tipo,
                        cantidad,
                        reparacion_id
                    )
                    VALUES
                    (
                        @inventarioId,
                        NULL,
                        @usuarioId,
                        'SALIDA',
                        @cantidad,
                        @reparacionId
                    );
                    """;

                await using var updateCmd =
                    new SqlCommand(
                        updateSql,
                        c,
                        (SqlTransaction)tx
                    );

                updateCmd.Parameters.AddWithValue(
                    "@cantidad",
                    detalle.Cantidad
                );

                updateCmd.Parameters.AddWithValue(
                    "@inventarioId",
                    inventarioId
                );

                updateCmd.Parameters.AddWithValue(
                    "@usuarioId",
                    UserId
                );

                updateCmd.Parameters.AddWithValue(
                    "@reparacionId",
                    (object?)request.ReparacionId ??
                    DBNull.Value
                );

                await updateCmd.ExecuteNonQueryAsync();

                await InsertarHistorialInventario(
                    c,
                    (SqlTransaction)tx,
                    inventarioId,
                    consumibleId,
                    request.TiendaId,
                    UserId,
                    "SALIDA",
                    detalle.Cantidad,
                    stockAnterior,
                    stockNuevo,
                    null,
                    request.ReparacionId,
                    null
                );

                if (stockNuevo <= stockMinimo)
                {
                    await InsertarAlertaStock(
                        c,
                        (SqlTransaction)tx,
                        consumibleId,
                        request.TiendaId,
                        stockNuevo
                    );
                }

                resultados.Add(new
                {
                    codigo = codigoDb,
                    descripcion,
                    tipo = tipoDb,
                    color,
                    marca,
                    numeroParte,
                    modelo,
                    cantidad = detalle.Cantidad,
                    stockAnterior,
                    stockNuevo
                });
            }

            await tx.CommitAsync();

            return Ok(new
            {
                message =
                    "Salida registrada correctamente.",
                tiendaId = request.TiendaId,
                tipo = request.Tipo,
                reparacionId = request.ReparacionId,
                detalles = resultados
            });
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }


    // ============================================================
    // HISTORIAL COMPLETO DE INVENTARIO
    // ============================================================

    [HttpGet("historial")]
    [Authorize(Roles = "Admin IT,Técnico IT")]
    public async Task<IActionResult> Historial(
        [FromQuery] int? tiendaId,
        [FromQuery] string? tipoMovimiento,
        [FromQuery] string? tipoConsumible,
        [FromQuery] string? codigo,
        [FromQuery] int? solicitudId,
        [FromQuery] int? reparacionId)
    {
        if (!EsAdmin)
        {
            if (!Tienda.HasValue)
            {
                return StatusCode(403, new
                {
                    message = "El usuario no tiene una tienda asignada."
                });
            }

            tiendaId = Tienda.Value;
        }

        await using var c = C();
        await c.OpenAsync();

        const string sql = """
            SELECT
                h.id,
                h.fecha,
                h.inventario_id,
                h.consumible_id,
                c.codigo,
                c.descripcion,
                c.tipo,
                c.color,
                c.marca,
                c.numero_parte,
                c.modelo,
                h.tienda_id,
                t.nombre AS tienda,
                h.usuario_id,
                u.nombre_completo AS usuario,
                h.tipo_movimiento,
                h.cantidad,
                h.stock_anterior,
                h.stock_nuevo,
                h.solicitud_id,
                h.reparacion_id,
                h.comentario
            FROM HISTORIAL_INVENTARIO h
            INNER JOIN CONSUMIBLES c
                ON c.id = h.consumible_id
            INNER JOIN TIENDAS t
                ON t.id = h.tienda_id
            INNER JOIN USUARIOS u
                ON u.id = h.usuario_id
            WHERE
                (@tiendaId IS NULL OR h.tienda_id=@tiendaId)
                AND
                (@tipoMovimiento IS NULL
                 OR h.tipo_movimiento=@tipoMovimiento)
                AND
                (@tipoConsumible IS NULL
                 OR c.tipo=@tipoConsumible)
                AND
                (@codigo IS NULL
                 OR c.codigo=@codigo)
                AND
                (@solicitudId IS NULL
                 OR h.solicitud_id=@solicitudId)
                AND
                (@reparacionId IS NULL
                 OR h.reparacion_id=@reparacionId)
            ORDER BY h.fecha DESC, h.id DESC;
            """;

        await using var q =
            new SqlCommand(sql, c);

        q.Parameters.AddWithValue(
            "@tiendaId",
            (object?)tiendaId ?? DBNull.Value
        );

        q.Parameters.AddWithValue(
            "@tipoMovimiento",
            (object?)tipoMovimiento ?? DBNull.Value
        );

        q.Parameters.AddWithValue(
            "@tipoConsumible",
            (object?)tipoConsumible ?? DBNull.Value
        );

        q.Parameters.AddWithValue(
            "@codigo",
            (object?)codigo ?? DBNull.Value
        );

        q.Parameters.AddWithValue(
            "@solicitudId",
            (object?)solicitudId ?? DBNull.Value
        );

        q.Parameters.AddWithValue(
            "@reparacionId",
            (object?)reparacionId ?? DBNull.Value
        );

        await using var r =
            await q.ExecuteReaderAsync();

        var lista = new List<object>();

        while (await r.ReadAsync())
        {
            lista.Add(new
            {
                id = r.GetInt32(0),
                fecha = r.GetDateTime(1),

                inventarioId = r.GetInt32(2),
                consumibleId = r.GetInt32(3),

                codigo = r.GetString(4),

                descripcion = r.IsDBNull(5)
                    ? ""
                    : r.GetString(5),

                tipo = r.GetString(6),

                color = r.IsDBNull(7)
                    ? ""
                    : r.GetString(7),

                marca = r.IsDBNull(8)
                    ? ""
                    : r.GetString(8),

                numeroParte = r.IsDBNull(9)
                    ? ""
                    : r.GetString(9),

                modelo = r.IsDBNull(10)
                    ? ""
                    : r.GetString(10),

                tiendaId = r.GetInt32(11),
                tienda = r.GetString(12),

                usuarioId = r.GetInt32(13),
                usuario = r.GetString(14),

                movimiento = r.GetString(15),

                cantidad = r.GetInt32(16),
                stockAnterior = r.GetInt32(17),
                stockNuevo = r.GetInt32(18),

                solicitudId =
                    r.IsDBNull(19)
                        ? (int?)null
                        : r.GetInt32(19),

                reparacionId =
                    r.IsDBNull(20)
                        ? (int?)null
                        : r.GetInt32(20),

                comentario =
                    r.IsDBNull(21)
                        ? null
                        : r.GetString(21)
            });
        }

        return Ok(lista);
    }


    // ============================================================
    // ALERTA DE STOCK MÍNIMO
    // ============================================================

    private static async Task InsertarAlertaStock(
        SqlConnection c,
        SqlTransaction tx,
        int consumibleId,
        int tiendaId,
        int stockActual)
    {
        const string sql = """
            INSERT INTO ALERTAS
            (
                tipo,
                mensaje,
                usuario_destino_id
            )
            SELECT
                'STOCK_MINIMO',
                @mensaje,
                u.id
            FROM USUARIOS u
            WHERE u.rol_id =
                (
                    SELECT id
                    FROM ROLES
                    WHERE nombre='Admin IT'
                )
              AND u.activo=1
              AND NOT EXISTS
                (
                    SELECT 1
                    FROM ALERTAS a
                    WHERE a.tipo='STOCK_MINIMO'
                      AND a.usuario_destino_id=u.id
                      AND a.mensaje=@mensaje
                      AND a.fecha_resuelta IS NULL
                );
            """;

        await using var cmd =
            new SqlCommand(sql, c, tx);

        cmd.Parameters.AddWithValue(
            "@mensaje",
            $"Stock bajo: consumible {consumibleId} en tienda {tiendaId}. Stock actual: {stockActual}"
        );

        await cmd.ExecuteNonQueryAsync();
    }


    // ============================================================
    // HISTORIAL DE INVENTARIO
    // ============================================================

    private static async Task InsertarHistorialInventario(
        SqlConnection c,
        SqlTransaction tx,
        int inventarioId,
        int consumibleId,
        int tiendaId,
        int usuarioId,
        string tipoMovimiento,
        int cantidad,
        int stockAnterior,
        int stockNuevo,
        int? solicitudId,
        int? reparacionId,
        string? comentario)
    {
        const string sql = """
            INSERT INTO HISTORIAL_INVENTARIO
            (
                inventario_id,
                consumible_id,
                tienda_id,
                usuario_id,
                tipo_movimiento,
                cantidad,
                stock_anterior,
                stock_nuevo,
                solicitud_id,
                reparacion_id,
                comentario
            )
            VALUES
            (
                @inventarioId,
                @consumibleId,
                @tiendaId,
                @usuarioId,
                @tipoMovimiento,
                @cantidad,
                @stockAnterior,
                @stockNuevo,
                @solicitudId,
                @reparacionId,
                @comentario
            );
            """;

        await using var cmd =
            new SqlCommand(sql, c, tx);

        cmd.Parameters.AddWithValue(
            "@inventarioId",
            inventarioId
        );

        cmd.Parameters.AddWithValue(
            "@consumibleId",
            consumibleId
        );

        cmd.Parameters.AddWithValue(
            "@tiendaId",
            tiendaId
        );

        cmd.Parameters.AddWithValue(
            "@usuarioId",
            usuarioId
        );

        cmd.Parameters.AddWithValue(
            "@tipoMovimiento",
            tipoMovimiento
        );

        cmd.Parameters.AddWithValue(
            "@cantidad",
            cantidad
        );

        cmd.Parameters.AddWithValue(
            "@stockAnterior",
            stockAnterior
        );

        cmd.Parameters.AddWithValue(
            "@stockNuevo",
            stockNuevo
        );

        cmd.Parameters.AddWithValue(
            "@solicitudId",
            (object?)solicitudId ?? DBNull.Value
        );

        cmd.Parameters.AddWithValue(
            "@reparacionId",
            (object?)reparacionId ?? DBNull.Value
        );

        cmd.Parameters.AddWithValue(
            "@comentario",
            (object?)comentario ?? DBNull.Value
        );

        await cmd.ExecuteNonQueryAsync();
    }


    // ============================================================
    // SOLICITUDES
    // ============================================================

    [HttpPost("solicitudes")]
    [Authorize(Roles = "Admin IT,Técnico IT,Solicitante")]
    public async Task<IActionResult> Solicitud(
        [FromBody] SolicitudInsumoRequest r)
    {
        if (r.TiendaId <= 0)
        {
            return BadRequest(new
            {
                message = "Debe indicar una tienda."
            });
        }

        if (r.ConsumibleId <= 0)
        {
            return BadRequest(new
            {
                message = "Debe indicar un consumible."
            });
        }

        if (r.Cantidad <= 0)
        {
            return BadRequest(new
            {
                message =
                    "La cantidad debe ser mayor que cero."
            });
        }

        if (!EsAdmin &&
            (!Tienda.HasValue ||
             Tienda.Value != r.TiendaId))
        {
            return StatusCode(403, new
            {
                message =
                    "No puede solicitar insumos de otra tienda."
            });
        }

        await using var c = C();
        await c.OpenAsync();

        const string sql = """
            INSERT INTO SOLICITUDES_INSUMO
            (
                tienda_id,
                consumible_id,
                solicitante_id,
                cantidad_solicitada,
                estado,
                fecha_solicitud,
                comentario
            )
            OUTPUT INSERTED.id
            VALUES
            (
                @tienda,
                @consumible,
                @usuario,
                @cantidad,
                'SOLICITADA',
                SYSDATETIME(),
                @comentario
            );
            """;

        await using var q =
            new SqlCommand(sql, c);

        q.Parameters.AddWithValue(
            "@tienda",
            r.TiendaId
        );

        q.Parameters.AddWithValue(
            "@consumible",
            r.ConsumibleId
        );

        q.Parameters.AddWithValue(
            "@usuario",
            UserId
        );

        q.Parameters.AddWithValue(
            "@cantidad",
            r.Cantidad
        );

        q.Parameters.AddWithValue(
            "@comentario",
            (object?)r.Comentario ?? DBNull.Value
        );

        var result =
            await q.ExecuteScalarAsync();

        var id = Convert.ToInt32(result);

        return Ok(new
        {
            id,
            estado = "SOLICITADA",
            message = "Solicitud registrada."
        });
    }


    // ============================================================
    // LISTAR SOLICITUDES
    // ============================================================

    [HttpGet("solicitudes")]
    public async Task<IActionResult> Solicitudes()
    {
        if (!EsAdmin && !Tienda.HasValue)
        {
            return StatusCode(403, new
            {
                message = "El usuario no tiene una tienda asignada."
            });
        }

        await using var c = C();
        await c.OpenAsync();

        const string sql = """
            SELECT
                s.id,
                s.tienda_id,
                t.nombre AS tienda,
                s.consumible_id,
                c.codigo,
                c.descripcion,
                c.tipo,
                c.color,
                c.marca,
                c.numero_parte,
                c.modelo,
                s.cantidad_solicitada,
                s.estado,
                s.fecha_solicitud,
                s.fecha_resolucion,
                s.preparada_por,
                s.fecha_preparacion,
                s.enviada_por,
                s.fecha_envio,
                s.recibida_por,
                s.fecha_recepcion,
                s.solicitante_id,
                u.nombre_completo AS solicitante,
                s.comentario
            FROM SOLICITUDES_INSUMO s
            INNER JOIN TIENDAS t
                ON t.id=s.tienda_id
            INNER JOIN CONSUMIBLES c
                ON c.id=s.consumible_id
            INNER JOIN USUARIOS u
                ON u.id=s.solicitante_id
            WHERE
                (
                    @admin=1
                    OR s.solicitante_id=@usuario
                    OR s.tienda_id=@tienda
                )
            ORDER BY s.fecha_solicitud DESC, s.id DESC;
            """;

        await using var q =
            new SqlCommand(sql, c);

        q.Parameters.AddWithValue(
            "@admin",
            EsAdmin ? 1 : 0
        );

        q.Parameters.AddWithValue(
            "@usuario",
            UserId
        );

        q.Parameters.AddWithValue(
            "@tienda",
            (object?)Tienda ?? DBNull.Value
        );

        await using var rd =
            await q.ExecuteReaderAsync();

        var lista = new List<object>();

        while (await rd.ReadAsync())
        {
            lista.Add(new
            {
                id = rd.GetInt32(0),

                tiendaId = rd.GetInt32(1),
                tienda = rd.GetString(2),

                consumibleId = rd.GetInt32(3),
                codigo = rd.GetString(4),

                consumible =
                    rd.IsDBNull(5)
                        ? ""
                        : rd.GetString(5),

                tipo = rd.GetString(6),

                color =
                    rd.IsDBNull(7)
                        ? ""
                        : rd.GetString(7),

                marca =
                    rd.IsDBNull(8)
                        ? ""
                        : rd.GetString(8),

                numeroParte =
                    rd.IsDBNull(9)
                        ? ""
                        : rd.GetString(9),

                modelo =
                    rd.IsDBNull(10)
                        ? ""
                        : rd.GetString(10),

                cantidad = rd.GetInt32(11),
                estado = rd.GetString(12),

                fechaSolicitud = rd.GetDateTime(13),

                fechaResolucion =
                    rd.IsDBNull(14)
                        ? (DateTime?)null
                        : rd.GetDateTime(14),

                preparadaPor =
                    rd.IsDBNull(15)
                        ? (int?)null
                        : rd.GetInt32(15),

                fechaPreparacion =
                    rd.IsDBNull(16)
                        ? (DateTime?)null
                        : rd.GetDateTime(16),

                enviadaPor =
                    rd.IsDBNull(17)
                        ? (int?)null
                        : rd.GetInt32(17),

                fechaEnvio =
                    rd.IsDBNull(18)
                        ? (DateTime?)null
                        : rd.GetDateTime(18),

                recibidaPor =
                    rd.IsDBNull(19)
                        ? (int?)null
                        : rd.GetInt32(19),

                fechaRecepcion =
                    rd.IsDBNull(20)
                        ? (DateTime?)null
                        : rd.GetDateTime(20),

                solicitanteId = rd.GetInt32(21),
                solicitante = rd.GetString(22),

                comentario =
                    rd.IsDBNull(23)
                        ? null
                        : rd.GetString(23)
            });
        }

        return Ok(lista);
    }


    // ============================================================
    // CAMBIAR ESTADO DE SOLICITUD
    //
    // APROBAR
    // RECHAZAR
    // PREPARAR
    // ENVIAR
    // RECIBIR
    //
    // ENTREGAR queda para compatibilidad con solicitudes antiguas.
    // ============================================================

    [HttpPut("solicitudes/{id:int}")]
    [Authorize(Roles = "Admin IT")]
    public async Task<IActionResult> Resolver(
        int id,
        [FromBody] ResolverSolicitudRequest r)
    {
        var accion =
            (r.Accion ?? "")
            .Trim()
            .ToUpperInvariant();

        var accionesPermitidas = new[]
        {
            "APROBAR",
            "RECHAZAR",
            "PREPARAR",
            "ENVIAR",
            "RECIBIR",
            "ENTREGAR"
        };

        if (!accionesPermitidas.Contains(accion))
        {
            return BadRequest(new
            {
                message =
                    "La acción debe ser APROBAR, RECHAZAR, PREPARAR, ENVIAR, RECIBIR o ENTREGAR."
            });
        }

        await using var c = C();
        await c.OpenAsync();

        await using var tx =
            await c.BeginTransactionAsync();

        try
        {
            const string buscarSql = """
                SELECT
                    tienda_id,
                    consumible_id,
                    cantidad_solicitada,
                    estado
                FROM SOLICITUDES_INSUMO
                WHERE id=@id;
                """;

            await using var buscar =
                new SqlCommand(
                    buscarSql,
                    c,
                    (SqlTransaction)tx
                );

            buscar.Parameters.AddWithValue("@id", id);

            await using var rd =
                await buscar.ExecuteReaderAsync();

            if (!await rd.ReadAsync())
            {
                await rd.DisposeAsync();
                await tx.RollbackAsync();

                return NotFound(new
                {
                    message = "La solicitud no existe."
                });
            }

            var tiendaId = rd.GetInt32(0);
            var consumibleId = rd.GetInt32(1);
            var cantidad = rd.GetInt32(2);
            var estadoActual = rd.GetString(3);

            await rd.DisposeAsync();


            // ----------------------------------------------------
            // APROBAR
            // ----------------------------------------------------

            if (accion == "APROBAR")
            {
                if (estadoActual != "SOLICITADA")
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            $"No se puede aprobar una solicitud en estado {estadoActual}."
                    });
                }

                await ActualizarEstadoSolicitud(
                    c,
                    (SqlTransaction)tx,
                    id,
                    "APROBADA",
                    UserId,
                    null,
                    null,
                    null,
                    null,
                    null,
                    r.Comentario
                );

                await tx.CommitAsync();

                return Ok(new
                {
                    id,
                    estado = "APROBADA",
                    message = "Solicitud aprobada."
                });
            }


            // ----------------------------------------------------
            // RECHAZAR
            // ----------------------------------------------------

            if (accion == "RECHAZAR")
            {
                if (estadoActual != "SOLICITADA")
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            $"No se puede rechazar una solicitud en estado {estadoActual}."
                    });
                }

                await ActualizarEstadoSolicitud(
                    c,
                    (SqlTransaction)tx,
                    id,
                    "RECHAZADA",
                    UserId,
                    null,
                    null,
                    null,
                    null,
                    null,
                    r.Comentario
                );

                await tx.CommitAsync();

                return Ok(new
                {
                    id,
                    estado = "RECHAZADA",
                    message = "Solicitud rechazada."
                });
            }


            // ----------------------------------------------------
            // PREPARAR
            // ----------------------------------------------------

            if (accion == "PREPARAR")
            {
                if (estadoActual != "APROBADA")
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            $"Solo se pueden preparar solicitudes APROBADAS. Estado actual: {estadoActual}."
                    });
                }

                await ActualizarEstadoSolicitud(
                    c,
                    (SqlTransaction)tx,
                    id,
                    "PREPARANDO",
                    null,
                    UserId,
                    null,
                    null,
                    null,
                    null,
                    r.Comentario
                );

                await tx.CommitAsync();

                return Ok(new
                {
                    id,
                    estado = "PREPARANDO",
                    message = "Solicitud en preparación."
                });
            }


            // ----------------------------------------------------
            // ENVIAR
            // ----------------------------------------------------

            if (accion == "ENVIAR")
            {
                if (estadoActual != "PREPARANDO")
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            $"Solo se pueden enviar solicitudes en preparación. Estado actual: {estadoActual}."
                    });
                }

                await ActualizarEstadoSolicitud(
                    c,
                    (SqlTransaction)tx,
                    id,
                    "ENVIADA",
                    null,
                    null,
                    UserId,
                    null,
                    null,
                    null,
                    r.Comentario
                );

                await tx.CommitAsync();

                return Ok(new
                {
                    id,
                    estado = "ENVIADA",
                    message = "Solicitud enviada."
                });
            }


            // ----------------------------------------------------
            // RECIBIR
            // ----------------------------------------------------

            if (accion == "RECIBIR")
            {
                if (estadoActual != "ENVIADA")
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            $"Solo se pueden recibir solicitudes ENVIADAS. Estado actual: {estadoActual}."
                    });
                }

                /*
                 * IMPORTANTE:
                 * La tabla SOLICITUDES_INSUMO actual no contiene
                 * inventario_origen ni tienda_origen.
                 *
                 * Por eso RECIBIR registra el cierre de la
                 * solicitud, pero NO descuenta inventario.
                 *
                 * La transferencia física entre almacenes se
                 * implementará cuando exista esa relación en BD.
                 */

                await ActualizarEstadoSolicitud(
                    c,
                    (SqlTransaction)tx,
                    id,
                    "RECIBIDA",
                    null,
                    null,
                    null,
                    UserId,
                    null,
                    null,
                    r.Comentario
                );

                await tx.CommitAsync();

                return Ok(new
                {
                    id,
                    estado = "RECIBIDA",
                    message = "Solicitud recibida."
                });
            }


            // ----------------------------------------------------
            // ENTREGAR
            //
            // Compatibilidad con solicitudes antiguas.
            // ----------------------------------------------------

            if (accion == "ENTREGAR")
            {
                if (estadoActual != "APROBADA")
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message =
                            "Solo se pueden entregar solicitudes aprobadas."
                    });
                }

                const string inventarioSql = """
                    SELECT
                        id,
                        stock_actual,
                        stock_minimo
                    FROM INVENTARIO_CONSUMIBLE WITH (UPDLOCK, HOLDLOCK)
                    WHERE tienda_id=@tienda
                      AND consumible_id=@consumible;
                    """;

                await using var invCmd =
                    new SqlCommand(
                        inventarioSql,
                        c,
                        (SqlTransaction)tx
                    );

                invCmd.Parameters.AddWithValue(
                    "@tienda",
                    tiendaId
                );

                invCmd.Parameters.AddWithValue(
                    "@consumible",
                    consumibleId
                );

                await using var ir =
                    await invCmd.ExecuteReaderAsync();

                if (!await ir.ReadAsync())
                {
                    await ir.DisposeAsync();
                    await tx.RollbackAsync();

                    return NotFound(new
                    {
                        message =
                            "No existe inventario para el consumible y tienda de la solicitud."
                    });
                }

                var inventarioId = ir.GetInt32(0);
                var stockAnterior = ir.GetInt32(1);
                var stockMinimo = ir.GetInt32(2);

                await ir.DisposeAsync();

                if (stockAnterior < cantidad)
                {
                    await tx.RollbackAsync();

                    return Conflict(new
                    {
                        message = "Stock insuficiente.",
                        stockActual = stockAnterior,
                        cantidadSolicitada = cantidad
                    });
                }

                var stockNuevo =
                    stockAnterior - cantidad;

                const string entregarSql = """
                    UPDATE INVENTARIO_CONSUMIBLE
                    SET stock_actual=stock_actual-@cantidad
                    WHERE id=@inventario;

                    INSERT INTO MOVIMIENTOS_CONSUMIBLE
                    (
                        inventario_id,
                        usuario_id,
                        tipo,
                        cantidad
                    )
                    VALUES
                    (
                        @inventario,
                        @usuario,
                        'SALIDA',
                        @cantidad
                    );

                    UPDATE SOLICITUDES_INSUMO
                    SET
                        estado='ENTREGADA',
                        fecha_resolucion=SYSDATETIME(),
                        comentario=COALESCE(@comentario, comentario)
                    WHERE id=@solicitud;
                    """;

                await using var entregarCmd =
                    new SqlCommand(
                        entregarSql,
                        c,
                        (SqlTransaction)tx
                    );

                entregarCmd.Parameters.AddWithValue(
                    "@cantidad",
                    cantidad
                );

                entregarCmd.Parameters.AddWithValue(
                    "@inventario",
                    inventarioId
                );

                entregarCmd.Parameters.AddWithValue(
                    "@usuario",
                    UserId
                );

                entregarCmd.Parameters.AddWithValue(
                    "@comentario",
                    (object?)r.Comentario ?? DBNull.Value
                );

                entregarCmd.Parameters.AddWithValue(
                    "@solicitud",
                    id
                );

                await entregarCmd.ExecuteNonQueryAsync();

                await InsertarHistorialInventario(
                    c,
                    (SqlTransaction)tx,
                    inventarioId,
                    consumibleId,
                    tiendaId,
                    UserId,
                    "SALIDA",
                    cantidad,
                    stockAnterior,
                    stockNuevo,
                    id,
                    null,
                    r.Comentario
                );

                if (stockNuevo <= stockMinimo)
                {
                    await InsertarAlertaStock(
                        c,
                        (SqlTransaction)tx,
                        consumibleId,
                        tiendaId,
                        stockNuevo
                    );
                }

                await tx.CommitAsync();

                return Ok(new
                {
                    id,
                    estado = "ENTREGADA",
                    stockAnterior,
                    stockNuevo,
                    message = "Solicitud entregada."
                });
            }

            await tx.RollbackAsync();

            return BadRequest();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }
    }


    // ============================================================
    // ACTUALIZAR ESTADO DE SOLICITUD
    // ============================================================

    private static async Task ActualizarEstadoSolicitud(
        SqlConnection c,
        SqlTransaction tx,
        int solicitudId,
        string nuevoEstado,
        int? aprobadaPor,
        int? preparadaPor,
        int? enviadaPor,
        int? recibidaPor,
        DateTime? fechaPreparacion,
        DateTime? fechaEnvio,
        string? comentario)
    {
        var partes = new List<string>
        {
            "estado=@estado"
        };

        if (aprobadaPor.HasValue)
        {
            partes.Add(
                "aprobada_por=@aprobadaPor"
            );
        }

        if (preparadaPor.HasValue)
        {
            partes.Add(
                "preparada_por=@preparadaPor"
            );

            partes.Add(
                "fecha_preparacion=SYSDATETIME()"
            );
        }

        if (enviadaPor.HasValue)
        {
            partes.Add(
                "enviada_por=@enviadaPor"
            );

            partes.Add(
                "fecha_envio=SYSDATETIME()"
            );
        }

        if (recibidaPor.HasValue)
        {
            partes.Add(
                "recibida_por=@recibidaPor"
            );

            partes.Add(
                "fecha_recepcion=SYSDATETIME()"
            );
        }

        if (aprobadaPor.HasValue)
        {
            partes.Add(
                "fecha_resolucion=SYSDATETIME()"
            );
        }

        partes.Add(
            "comentario=COALESCE(@comentario, comentario)"
        );

        var sql =
            $"""
            UPDATE SOLICITUDES_INSUMO
            SET {string.Join(", ", partes)}
            WHERE id=@id;
            """;

        await using var cmd =
            new SqlCommand(sql, c, tx);

        cmd.Parameters.AddWithValue(
            "@estado",
            nuevoEstado
        );

        cmd.Parameters.AddWithValue(
            "@id",
            solicitudId
        );

        cmd.Parameters.AddWithValue(
            "@aprobadaPor",
            (object?)aprobadaPor ?? DBNull.Value
        );

        cmd.Parameters.AddWithValue(
            "@preparadaPor",
            (object?)preparadaPor ?? DBNull.Value
        );

        cmd.Parameters.AddWithValue(
            "@enviadaPor",
            (object?)enviadaPor ?? DBNull.Value
        );

        cmd.Parameters.AddWithValue(
            "@recibidaPor",
            (object?)recibidaPor ?? DBNull.Value
        );

        cmd.Parameters.AddWithValue(
            "@comentario",
            (object?)comentario ?? DBNull.Value
        );

        await cmd.ExecuteNonQueryAsync();
    }


    // ============================================================
    // TIENDAS
    // ============================================================

    [HttpGet("tiendas")]
    public async Task<IActionResult> Tiendas()
    {
        await using var c = C();
        await c.OpenAsync();

        if (!EsAdmin)
        {
            if (!Tienda.HasValue)
            {
                return StatusCode(403, new
                {
                    message = "El usuario no tiene una tienda asignada."
                });
            }

            const string sqlPropia = """
                SELECT
                    id,
                    codigo,
                    nombre
                FROM TIENDAS
                WHERE activo=1
                  AND id=@tienda
                ORDER BY nombre;
                """;

            await using var propia =
                new SqlCommand(sqlPropia, c);

            propia.Parameters.AddWithValue(
                "@tienda",
                Tienda.Value
            );

            await using var pr =
                await propia.ExecuteReaderAsync();

            var tienda = new List<object>();

            while (await pr.ReadAsync())
            {
                tienda.Add(new
                {
                    id = pr.GetInt32(0),
                    codigo = pr.GetString(1),
                    nombre = pr.GetString(2)
                });
            }

            return Ok(tienda);
        }

        const string sql = """
            SELECT
                id,
                codigo,
                nombre
            FROM TIENDAS
            WHERE activo=1
            ORDER BY nombre;
            """;

        await using var q =
            new SqlCommand(sql, c);

        await using var r =
            await q.ExecuteReaderAsync();

        var tiendas = new List<object>();

        while (await r.ReadAsync())
        {
            tiendas.Add(new
            {
                id = r.GetInt32(0),
                codigo = r.GetString(1),
                nombre = r.GetString(2)
            });
        }

        return Ok(tiendas);
    }
}


// ================================================================
// DTO: VARIAS SALIDAS
// ================================================================

public class RegistrarSalidasRequest
{
    public int TiendaId { get; set; }

    public string Tipo { get; set; } = "";

    public int? ReparacionId { get; set; }

    public List<DetalleSalidaRequest> Detalles { get; set; } = new();
}


// ================================================================
// DTO: DETALLE DE SALIDA
// ================================================================

public class DetalleSalidaRequest
{
    public string Codigo { get; set; } = "";

    public int Cantidad { get; set; }
}


// ================================================================
// DTO: MOVIMIENTO INDIVIDUAL
// ================================================================

public class ConsumirInsumoRequest
{
    public int TiendaId { get; set; }

    public int ConsumibleId { get; set; }

    public int? ImpresoraId { get; set; }

    public int Cantidad { get; set; }

    public int? ReparacionId { get; set; }
}


// ================================================================
// DTO: SOLICITUD
// ================================================================

public class SolicitudInsumoRequest
{
    public int TiendaId { get; set; }

    public int ConsumibleId { get; set; }

    public int Cantidad { get; set; }

    public string? Comentario { get; set; }
}


// ================================================================
// DTO: RESOLVER SOLICITUD
// ================================================================

public class ResolverSolicitudRequest
{
    public string Accion { get; set; } = "";

    public string? Comentario { get; set; }
}