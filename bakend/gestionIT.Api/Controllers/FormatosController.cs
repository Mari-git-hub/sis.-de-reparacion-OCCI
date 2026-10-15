
using System.Security.Claims;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/v1/formatos")]
[EnableCors("PermitirReact")]
public class FormatosController : ControllerBase
{
    // Estados permitidos por CK_EQUIPOS_estado_actual en SQL Server.
    private const string EstadoEquipoEnReparacion = "En reparacion";
    private const string EstadoEquipoOperativo = "Operativo";
    private const string EstadoEquipoBaja = "Baja";

    // Estado utilizado en la tabla REPARACIONES.
   private const string EstadoReparacionEnProceso = "REGISTRADO";

    private readonly IConfiguration _configuration;
    private readonly ILogger<FormatosController> _logger;

    public FormatosController(
        IConfiguration configuration,
        ILogger<FormatosController> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    private SqlConnection CreateConnection()
    {
        var connectionString =
            _configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "No está configurada la cadena de conexión 'Default'.");
        }

        return new SqlConnection(connectionString);
    }

    private int? TryGetUserId()
    {
        var value =
            User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        return int.TryParse(value, out var id) && id > 0
            ? id
            : null;
    }

    private static string NuevoFolio() =>
        "REP-" + Guid.NewGuid().ToString("N")[..16].ToUpperInvariant();

    private const string SelectFormatoBase = """
        SELECT
            r.id,
            r.folio,
            r.estado,
            r.fecha_registro AS fechaRegistro,
            e.id AS equipoId,
            e.codigo_interno AS codigoInterno,
            e.nombre AS nombreEquipo,
            e.tipo AS tipoEquipo,
            e.marca,
            e.modelo,
            e.serie,
            e.tienda_id AS tiendaId,
            t.codigo AS tiendaCodigo,
            t.nombre AS tiendaNombre,
            u.nombre_completo AS solicitante,
            fi.estado_fisico_recepcion AS estadoFisico,
            fi.accesorios_incluidos AS accesorios,
            fi.falla_reportada AS fallaReportada,
            fi.fecha_ingreso AS fechaIngreso
        FROM REPARACIONES r
        INNER JOIN EQUIPOS e ON e.id = r.equipo_id
        LEFT JOIN TIENDAS t ON t.id = e.tienda_id
        LEFT JOIN USUARIOS u ON u.id = r.solicitante_id
        LEFT JOIN FORMATO_INGRESO fi ON fi.reparacion_id = r.id
        """;

    // GET: /api/v1/formatos/reparaciones
    [HttpGet("reparaciones")]
    public async Task<IActionResult> GetReparaciones()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = SelectFormatoBase + """

            ORDER BY r.fecha_registro DESC;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var rows = new List<object>();

        while (await reader.ReadAsync())
        {
            rows.Add(LeerFormato(reader));
        }

        return Ok(rows);
    }

    // GET: /api/v1/formatos/ingreso/{id}
    [HttpGet("ingreso/{id:int}")]
    public async Task<IActionResult> GetIngresoPorId(int id)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = SelectFormatoBase + """

            WHERE r.id = @id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@id", id);

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return NotFound(new
            {
                mensaje = "No se encontró el formato de ingreso solicitado."
            });
        }

        return Ok(LeerFormato(reader));
    }

    // GET: /api/v1/formatos/equipos-pendientes
    [HttpGet("equipos-pendientes")]
    public async Task<IActionResult> GetEquiposPendientes()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            SELECT
                r.id AS reparacionId,
                r.folio,
                e.id AS equipoId,
                e.nombre AS equipoNombre,
                e.tipo,
                e.marca,
                e.serie,
                t.nombre AS tiendaNombre,
                fi.falla_reportada AS falla
            FROM REPARACIONES r
            INNER JOIN EQUIPOS e ON e.id = r.equipo_id
            LEFT JOIN TIENDAS t ON t.id = e.tienda_id
            LEFT JOIN FORMATO_INGRESO fi ON fi.reparacion_id = r.id
            WHERE r.estado NOT IN
                ('ENTREGADO', 'DESCARTADO', 'CANCELADO')
            ORDER BY r.fecha_registro DESC;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var lista = new List<object>();

        while (await reader.ReadAsync())
        {
            var nombre = reader.IsDBNull(3) ? "" : reader.GetString(3);
            var tipo = reader.IsDBNull(4) ? "" : reader.GetString(4);
            var marca = reader.IsDBNull(5) ? "" : reader.GetString(5);
            var serie = reader.IsDBNull(6) ? "" : reader.GetString(6);

            lista.Add(new
            {
                reparacionId = reader.GetInt32(0),
                folio = Texto(reader, "folio"),
                equipoId = reader.GetInt32(2),
                equipoNombre = nombre,
                tipo,
                marca,
                serie,
                tienda = reader.IsDBNull(7)
                    ? "Sin tienda"
                    : reader.GetString(7),
                falla = reader.IsDBNull(8) ? "" : reader.GetString(8),
                etiqueta = $"{nombre} ({tipo} - Serie: {serie})"
            });
        }

        return Ok(lista);
    }

    // POST: /api/v1/formatos/ingreso
    [HttpPost("ingreso")]
    public async Task<IActionResult> PostIngreso(
        [FromBody] FormatoIngresoRequest? request)
    {
        var errorValidacion = ValidarIngreso(request);

        if (errorValidacion is not null)
        {
            return BadRequest(new { mensaje = errorValidacion });
        }

        int? usuarioId = TryGetUserId();

        if (usuarioId is null)
        {
            return Unauthorized(new
            {
                mensaje = "No se encontró el ID del usuario en el token. Cierra sesión e inicia sesión nuevamente."
            });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            // Comprobar que el usuario del token existe en USUARIOS.
            const string comprobarUsuarioSql = """
                SELECT COUNT(1)
                FROM USUARIOS
                WHERE id = @usuarioId;
                """;

            await using (var cmdUsuario = new SqlCommand(
                comprobarUsuarioSql, connection, transaction))
            {
                cmdUsuario.Parameters.AddWithValue(
                    "@usuarioId", usuarioId.Value);

                int existeUsuario = Convert.ToInt32(
                    await cmdUsuario.ExecuteScalarAsync());

                if (existeUsuario == 0)
                {
                    await RevertirSinLanzarError(transaction);

                    return Unauthorized(new
                    {
                        mensaje = "El usuario del token no existe en la tabla USUARIOS. Cierra sesión e inicia sesión nuevamente."
                    });
                }
            }

            // Comprobar que la tienda seleccionada existe.
            const string comprobarTiendaSql = """
                SELECT COUNT(1)
                FROM TIENDAS
                WHERE id = @tiendaId;
                """;

            await using (var cmdTienda = new SqlCommand(
                comprobarTiendaSql, connection, transaction))
            {
                cmdTienda.Parameters.AddWithValue(
                    "@tiendaId", request!.TiendaId);

                int existeTienda = Convert.ToInt32(
                    await cmdTienda.ExecuteScalarAsync());

                if (existeTienda == 0)
                {
                    await RevertirSinLanzarError(transaction);

                    return BadRequest(new
                    {
                        mensaje = "La tienda seleccionada no existe en la tabla TIENDAS."
                    });
                }
            }

            int equipoId = 0;
            string serieClean = request!.Serie!.Trim();

            const string buscarEquipoSql = """
                SELECT id
                FROM EQUIPOS WITH (UPDLOCK, HOLDLOCK)
                WHERE serie = @serie;
                """;

            await using (var cmd = new SqlCommand(
                buscarEquipoSql, connection, transaction))
            {
                cmd.Parameters.AddWithValue("@serie", serieClean);

                var res = await cmd.ExecuteScalarAsync();

                if (res != null && res != DBNull.Value)
                {
                    equipoId = Convert.ToInt32(res);
                }
            }

            if (equipoId == 0)
            {
                const string crearEquipoSql = """
                    INSERT INTO EQUIPOS
                    (
                        codigo_interno,
                        nombre,
                        tipo,
                        marca,
                        modelo,
                        serie,
                        estado_actual,
                        tienda_id,
                        fecha_alta
                    )
                    OUTPUT INSERTED.id
                    VALUES
                    (
                        @codigoInterno,
                        @nombre,
                        @tipo,
                        @marca,
                        @modelo,
                        @serie,
                        @estadoActual,
                        @tiendaId,
                        SYSDATETIME()
                    );
                    """;

                await using var cmdNuevo = new SqlCommand(
                    crearEquipoSql, connection, transaction);

                cmdNuevo.Parameters.AddWithValue(
                    "@codigoInterno",
                    DbValue(request.CodigoInterno)
                    ?? ("EQ-" + serieClean.ToUpperInvariant()));

                cmdNuevo.Parameters.AddWithValue(
                    "@nombre", request.NombreEquipo!.Trim());

                cmdNuevo.Parameters.AddWithValue(
                    "@tipo", request.TipoEquipo!.Trim());

                cmdNuevo.Parameters.AddWithValue(
                    "@marca", request.Marca!.Trim());

                cmdNuevo.Parameters.AddWithValue(
                    "@modelo", DbValue(request.Modelo));

                cmdNuevo.Parameters.AddWithValue(
                    "@serie", serieClean);

                cmdNuevo.Parameters.AddWithValue(
                    "@estadoActual", EstadoEquipoEnReparacion);

                cmdNuevo.Parameters.AddWithValue(
                    "@tiendaId", request.TiendaId);

                var newId = await cmdNuevo.ExecuteScalarAsync();
                equipoId = Convert.ToInt32(newId);
            }
            else
            {
                const string actEquipoSql = """
                    UPDATE EQUIPOS
                    SET estado_actual = @estadoActual
                    WHERE id = @id;
                    """;

                await using var cmdAct = new SqlCommand(
                    actEquipoSql, connection, transaction);

                cmdAct.Parameters.AddWithValue("@id", equipoId);
                cmdAct.Parameters.AddWithValue(
                    "@estadoActual", EstadoEquipoEnReparacion);

                await cmdAct.ExecuteNonQueryAsync();
            }

            string folio = NuevoFolio();

            const string crearReparacionSql = """
                INSERT INTO REPARACIONES
                (
                    folio,
                    equipo_id,
                    solicitante_id,
                    estado,
                    fecha_registro
                )
                OUTPUT INSERTED.id
                VALUES
                (
                    @folio,
                    @equipoId,
                    @solicitanteId,
                    @estado,
                    SYSDATETIME()
                );
                """;

            int reparacionId;

            await using (var cmdRep = new SqlCommand(
                crearReparacionSql, connection, transaction))
            {
                cmdRep.Parameters.AddWithValue("@folio", folio);
                cmdRep.Parameters.AddWithValue("@equipoId", equipoId);

                cmdRep.Parameters.AddWithValue(
                    "@solicitanteId", usuarioId.Value);

                cmdRep.Parameters.AddWithValue(
                    "@estado", EstadoReparacionEnProceso);

                reparacionId = Convert.ToInt32(
                    await cmdRep.ExecuteScalarAsync());
            }

            const string crearFormatoIngresoSql = """
                INSERT INTO FORMATO_INGRESO
                (
                    reparacion_id,
                    estado_fisico_recepcion,
                    accesorios_incluidos,
                    falla_reportada,
                    fecha_ingreso
                )
                VALUES
                (
                    @reparacionId,
                    @estadoFisico,
                    @accesorios,
                    @falla,
                    SYSDATETIME()
                );
                """;

            await using (var cmdFi = new SqlCommand(
                crearFormatoIngresoSql, connection, transaction))
            {
                cmdFi.Parameters.AddWithValue("@reparacionId", reparacionId);

                cmdFi.Parameters.AddWithValue(
                    "@estadoFisico", DbValue(request.EstadoFisico));

                cmdFi.Parameters.AddWithValue(
                    "@accesorios", DbValue(request.Accesorios));

                cmdFi.Parameters.AddWithValue(
                    "@falla", request.FallaReportada!.Trim());

                await cmdFi.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return StatusCode(201, new
            {
                folio,
                reparacionId,
                mensaje = "Formato de ingreso registrado con éxito."
            });
        }
        catch (SqlException ex)
        {
            await RevertirSinLanzarError(transaction);

            _logger.LogError(
                ex,
                "Error SQL al registrar formato de ingreso. Número: {NumeroError}",
                ex.Number);

            return StatusCode(500, new
            {
                mensaje = $"Error SQL en Ingreso ({ex.Number}): {ex.Message}"
            });
        }
        catch (Exception ex)
        {
            await RevertirSinLanzarError(transaction);

            _logger.LogError(
                ex,
                "Error interno al registrar formato de ingreso.");

            return StatusCode(500, new
            {
                mensaje = "Error interno al procesar ingreso: " + ex.Message
            });
        }
    }

    // PUT: /api/v1/formatos/ingreso/{id}
    [HttpPut("ingreso/{id:int}")]
    public async Task<IActionResult> PutIngreso(
        int id,
        [FromBody] FormatoIngresoRequest? request)
    {
        var errorValidacion = ValidarIngreso(request);

        if (errorValidacion is not null)
        {
            return BadRequest(new { mensaje = errorValidacion });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            int equipoId = 0;
            string? estadoReparacion = null;

            const string buscarSql = """
                SELECT equipo_id, estado
                FROM REPARACIONES WITH (UPDLOCK, HOLDLOCK)
                WHERE id = @id;
                """;

            await using (var cmd = new SqlCommand(
                buscarSql, connection, transaction))
            {
                cmd.Parameters.AddWithValue("@id", id);

                await using var reader = await cmd.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    equipoId = reader.GetInt32(0);
                    estadoReparacion = reader.IsDBNull(1)
                        ? null
                        : reader.GetString(1);
                }
            }

            if (equipoId == 0)
            {
                return await RevertirYResponder(
                    transaction,
                    NotFound(new
                    {
                        mensaje = "No se encontró el formato que intentas editar."
                    }));
            }

            if (!string.Equals(
                estadoReparacion,
                EstadoReparacionEnProceso,
                StringComparison.OrdinalIgnoreCase))
            {
                return await RevertirYResponder(
                    transaction,
                    Conflict(new
                    {
                        mensaje = "Solo se pueden editar formatos cuya reparación está en proceso."
                    }));
            }

            const string actualizarEquipoSql = """
                UPDATE EQUIPOS
                SET codigo_interno = COALESCE(@codigoInterno, codigo_interno),
                    nombre = @nombre,
                    tipo = @tipo,
                    marca = @marca,
                    modelo = @modelo,
                    serie = @serie,
                    tienda_id = @tiendaId
                WHERE id = @equipoId;
                """;

            await using (var cmdEq = new SqlCommand(
                actualizarEquipoSql, connection, transaction))
            {
                cmdEq.Parameters.AddWithValue(
                    "@codigoInterno", DbValue(request!.CodigoInterno));

                cmdEq.Parameters.AddWithValue(
                    "@nombre", request.NombreEquipo!.Trim());

                cmdEq.Parameters.AddWithValue(
                    "@tipo", request.TipoEquipo!.Trim());

                cmdEq.Parameters.AddWithValue(
                    "@marca", request.Marca!.Trim());

                cmdEq.Parameters.AddWithValue(
                    "@modelo", DbValue(request.Modelo));

                cmdEq.Parameters.AddWithValue(
                    "@serie", request.Serie!.Trim());

                cmdEq.Parameters.AddWithValue(
                    "@tiendaId", request.TiendaId);

                cmdEq.Parameters.AddWithValue("@equipoId", equipoId);

                await cmdEq.ExecuteNonQueryAsync();
            }

            const string actualizarFormatoSql = """
                UPDATE FORMATO_INGRESO
                SET estado_fisico_recepcion = @estadoFisico,
                    accesorios_incluidos = @accesorios,
                    falla_reportada = @falla
                WHERE reparacion_id = @reparacionId;
                """;

            int filas;

            await using (var cmdFi = new SqlCommand(
                actualizarFormatoSql, connection, transaction))
            {
                cmdFi.Parameters.AddWithValue("@reparacionId", id);

                cmdFi.Parameters.AddWithValue(
                    "@estadoFisico", DbValue(request.EstadoFisico));

                cmdFi.Parameters.AddWithValue(
                    "@accesorios", DbValue(request.Accesorios));

                cmdFi.Parameters.AddWithValue(
                    "@falla", request.FallaReportada!.Trim());

                filas = await cmdFi.ExecuteNonQueryAsync();
            }

            if (filas == 0)
            {
                const string crearFormatoSql = """
                    INSERT INTO FORMATO_INGRESO
                    (
                        reparacion_id,
                        estado_fisico_recepcion,
                        accesorios_incluidos,
                        falla_reportada,
                        fecha_ingreso
                    )
                    VALUES
                    (
                        @reparacionId,
                        @estadoFisico,
                        @accesorios,
                        @falla,
                        SYSDATETIME()
                    );
                    """;

                await using var cmdNuevo = new SqlCommand(
                    crearFormatoSql, connection, transaction);

                cmdNuevo.Parameters.AddWithValue("@reparacionId", id);

                cmdNuevo.Parameters.AddWithValue(
                    "@estadoFisico", DbValue(request.EstadoFisico));

                cmdNuevo.Parameters.AddWithValue(
                    "@accesorios", DbValue(request.Accesorios));

                cmdNuevo.Parameters.AddWithValue(
                    "@falla", request.FallaReportada!.Trim());

                await cmdNuevo.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return Ok(new
            {
                reparacionId = id,
                mensaje = "Formato de ingreso actualizado correctamente."
            });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            await RevertirSinLanzarError(transaction);

            return Conflict(new
            {
                mensaje = "Ya existe otro equipo con ese número de serie o código interno."
            });
        }
        catch (SqlException ex)
        {
            await RevertirSinLanzarError(transaction);

            _logger.LogError(
                ex,
                "Error SQL al actualizar formato de ingreso. Número: {NumeroError}",
                ex.Number);

            return StatusCode(500, new
            {
                mensaje = $"Error SQL al editar ingreso ({ex.Number}): {ex.Message}"
            });
        }
        catch (Exception ex)
        {
            await RevertirSinLanzarError(transaction);

            _logger.LogError(
                ex,
                "Error interno al actualizar formato de ingreso.");

            return StatusCode(500, new
            {
                mensaje = "Error interno al editar ingreso: " + ex.Message
            });
        }
    }

    // POST: /api/v1/formatos/salida
    [HttpPost("salida")]
    public async Task<IActionResult> PostSalida(
        [FromBody] FormatoSalidaRequest? request)
    {
        if (request is null)
        {
            return BadRequest(new
            {
                mensaje = "No se recibieron los datos de salida."
            });
        }

        if (request.ReparacionId <= 0)
        {
            return BadRequest(new
            {
                mensaje = "Debes seleccionar un equipo o reparación válida."
            });
        }

        if (string.IsNullOrWhiteSpace(request.TrabajoRealizado))
        {
            return BadRequest(new
            {
                mensaje = "El trabajo realizado es obligatorio."
            });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var transaction =
            (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            int equipoId = 0;

            const string buscarSql = """
                SELECT equipo_id
                FROM REPARACIONES WITH (UPDLOCK, HOLDLOCK)
                WHERE id = @id;
                """;

            await using (var cmd = new SqlCommand(
                buscarSql, connection, transaction))
            {
                cmd.Parameters.AddWithValue("@id", request.ReparacionId);

                var res = await cmd.ExecuteScalarAsync();

                if (res != null && res != DBNull.Value)
                {
                    equipoId = Convert.ToInt32(res);
                }
            }

            if (equipoId == 0)
            {
                return await RevertirYResponder(
                    transaction,
                    NotFound(new
                    {
                        mensaje = "No se encontró el registro de la reparación seleccionada."
                    }));
            }

            const string insertarSalidaSql = """
    INSERT INTO FORMATO_SALIDA
        (
            reparacion_id,
            diagnostico_tecnico,
            trabajo_realizado,
            pruebas_conformidad_ok,
            observaciones_garantia,
            fecha_salida
        )
    VALUES
        (
            @reparacionId,
            @diagnostico,
            @trabajo,
            @pruebasConformidad,
            @observaciones,
            SYSDATETIME()
        );
    """;


           await using (var cmdSalida = new SqlCommand(insertarSalidaSql, connection, transaction))
{
    cmdSalida.Parameters.AddWithValue("@reparacionId", request.ReparacionId);
    cmdSalida.Parameters.AddWithValue("@diagnostico", DbValue(request.DiagnosticoTecnico));
    cmdSalida.Parameters.AddWithValue("@trabajo", request.TrabajoRealizado.Trim());
    cmdSalida.Parameters.AddWithValue("@pruebasConformidad", request.PruebasConformidadOk);
    cmdSalida.Parameters.AddWithValue("@observaciones", DbValue(request.ObservacionesGarantia));

    await cmdSalida.ExecuteNonQueryAsync();
}

            bool esBaja = string.Equals(
                request.EstadoFinalEquipo,
                "BAJA",
                StringComparison.OrdinalIgnoreCase);

            string nuevoEstadoReparacion =
                esBaja ? "DESCARTADO" : "ENTREGADO";

            string nuevoEstadoEquipo =
                esBaja ? EstadoEquipoBaja : EstadoEquipoOperativo;

            const string actualizarReparacionSql = """
                UPDATE REPARACIONES
                SET estado = @nuevoEstado
                WHERE id = @reparacionId;
                """;

            await using (var cmdActRep = new SqlCommand(
                actualizarReparacionSql, connection, transaction))
            {
                cmdActRep.Parameters.AddWithValue(
                    "@nuevoEstado", nuevoEstadoReparacion);

                cmdActRep.Parameters.AddWithValue(
                    "@reparacionId", request.ReparacionId);

                await cmdActRep.ExecuteNonQueryAsync();
            }

            const string actualizarEquipoSql = """
                UPDATE EQUIPOS
                SET estado_actual = @nuevoEstadoEquipo
                WHERE id = @equipoId;
                """;

            await using (var cmdActEq = new SqlCommand(
                actualizarEquipoSql, connection, transaction))
            {
                cmdActEq.Parameters.AddWithValue(
                    "@nuevoEstadoEquipo", nuevoEstadoEquipo);

                cmdActEq.Parameters.AddWithValue("@equipoId", equipoId);

                await cmdActEq.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return Ok(new
            {
                mensaje = "Formato de salida registrado correctamente."
            });
        }
        catch (SqlException ex)
        {
            await RevertirSinLanzarError(transaction);

            _logger.LogError(
                ex,
                "Error SQL al registrar formato de salida. Número: {NumeroError}",
                ex.Number);

            return StatusCode(500, new
            {
                mensaje = $"Error SQL en Salida ({ex.Number}): {ex.Message}"
            });
        }
        catch (Exception ex)
        {
            await RevertirSinLanzarError(transaction);

            _logger.LogError(
                ex,
                "Error interno al registrar formato de salida.");

            return StatusCode(500, new
            {
                mensaje = "Error interno en salida: " + ex.Message
            });
        }
    }
    
        
    // PUT: /api/v1/formatos/salida/{id}
    // El id corresponde a reparacionId.
    [HttpPut("salida/{id:int}")]
    public async Task<IActionResult> PutSalida(
        int id,
        [FromBody] FormatoSalidaRequest? request)
    {
        if (request is null)
        {
            return BadRequest(new
            {
                mensaje = "No se recibieron los datos del formato de salida."
            });
        }

        if (id <= 0)
        {
            return BadRequest(new
            {
                mensaje = "El identificador de la reparación no es válido."
            });
        }

        if (string.IsNullOrWhiteSpace(request.TrabajoRealizado))
        {
            return BadRequest(new
            {
                mensaje = "El trabajo realizado es obligatorio."
            });
        }

        try
        {
            await using var connection = CreateConnection();
            await connection.OpenAsync();

            const string sql = """
                UPDATE FORMATO_SALIDA
                SET diagnostico_tecnico = @diagnostico,
                    trabajo_realizado = @trabajo,
                    pruebas_conformidad_ok = @pruebasConformidad,
                    observaciones_garantia = @observaciones
                WHERE reparacion_id = @reparacionId;
                """;

            await using var command = new SqlCommand(sql, connection);

            command.Parameters.AddWithValue("@reparacionId", id);
            command.Parameters.AddWithValue(
                "@diagnostico", DbValue(request.DiagnosticoTecnico));
            command.Parameters.AddWithValue(
                "@trabajo", request.TrabajoRealizado.Trim());
            command.Parameters.AddWithValue(
                "@pruebasConformidad", request.PruebasConformidadOk);
            command.Parameters.AddWithValue(
                "@observaciones", DbValue(request.ObservacionesGarantia));

            int filas = await command.ExecuteNonQueryAsync();

            if (filas == 0)
            {
                return NotFound(new
                {
                    mensaje = "No existe un formato de salida guardado para esta reparación."
                });
            }

            return Ok(new
            {
                reparacionId = id,
                mensaje = "Formato de salida actualizado correctamente."
            });
        }
        catch (SqlException ex)
        {
            _logger.LogError(
                ex,
                "Error SQL al actualizar el formato de salida. Reparación: {Id}",
                id);

            return StatusCode(500, new
            {
                mensaje = $"Error SQL al editar salida ({ex.Number}): {ex.Message}"
            });
        }
    }


    // GET: /api/v1/formatos/reportes
    [HttpGet("reportes")]
    public async Task<IActionResult> GetReportes()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();
           
const string sql = """
    SELECT
        r.id AS reparacionId,
        r.folio,
        r.estado,
        r.fecha_registro AS fechaIngreso,
        e.nombre AS equipoNombre,
        e.tipo AS tipoEquipo,
        e.marca,
        e.modelo,
        e.serie,
        t.nombre AS tiendaNombre,
        fi.falla_reportada AS fallaReportada,
        fi.estado_fisico_recepcion AS estadoFisico,
        fi.accesorios_incluidos AS accesorios,
        fs.fecha_salida AS fechaSalida,
        fs.diagnostico_tecnico AS diagnostico,
        fs.trabajo_realizado AS trabajoRealizado,
        fs.pruebas_conformidad_ok AS pruebasConformidadOk,
        fs.observaciones_garantia AS observacionesSalida
    FROM REPARACIONES r
    INNER JOIN EQUIPOS e ON e.id = r.equipo_id
    LEFT JOIN TIENDAS t ON t.id = e.tienda_id
    LEFT JOIN FORMATO_INGRESO fi ON fi.reparacion_id = r.id
    LEFT JOIN FORMATO_SALIDA fs ON fs.reparacion_id = r.id
    ORDER BY r.fecha_registro DESC;
    """;


        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var reportes = new List<object>();

        while (await reader.ReadAsync())
        {
            reportes.Add(new
            {
                reparacionId = reader.GetInt32(0),
                folio = Texto(reader, "folio"),
                estado = Texto(reader, "estado"),
                fechaIngreso = Fecha(reader, "fechaIngreso")?
                    .ToString("dd/MM/yyyy HH:mm"),
                equipoNombre = Texto(reader, "equipoNombre") ?? "",
                tipoEquipo = Texto(reader, "tipoEquipo") ?? "",
                marca = Texto(reader, "marca") ?? "",
                modelo = Texto(reader, "modelo") ?? "",
                serie = Texto(reader, "serie") ?? "",
                tiendaNombre = Texto(reader, "tiendaNombre") ?? "N/A",
                fallaReportada = Texto(reader, "fallaReportada") ?? "",
                estadoFisico = Texto(reader, "estadoFisico") ?? "",
                accesorios = Texto(reader, "accesorios") ?? "",
                fechaSalida = Fecha(reader, "fechaSalida")?
                    .ToString("dd/MM/yyyy HH:mm"),
                diagnostico = Texto(reader, "diagnostico") ?? "",
                trabajoRealizado = Texto(reader, "trabajoRealizado") ?? "",
                pruebasConformidadOk = reader.IsDBNull(
                reader.GetOrdinal("pruebasConformidadOk"))
                ? false
                : Convert.ToBoolean(reader["pruebasConformidadOk"]),
                observacionesSalida = Texto(reader, "observacionesSalida") ?? ""
            });
        }

        return Ok(reportes);
    }

    // Validación de los datos de ingreso.
    private static string? ValidarIngreso(
        FormatoIngresoRequest? request)
    {
        if (request is null)
            return "No se recibieron los datos del formulario de ingreso.";

        if (request.TiendaId <= 0)
            return "Debes seleccionar una tienda válida.";

        if (string.IsNullOrWhiteSpace(request.NombreEquipo))
            return "El nombre o descripción del equipo es obligatorio.";

        if (string.IsNullOrWhiteSpace(request.TipoEquipo))
            return "Debes seleccionar el tipo de equipo.";

        if (string.IsNullOrWhiteSpace(request.Marca))
            return "La marca del equipo es obligatoria.";

        if (string.IsNullOrWhiteSpace(request.Serie))
            return "El número de serie es obligatorio.";

        if (string.IsNullOrWhiteSpace(request.EstadoFisico))
            return "Debes indicar el estado físico del equipo.";

        if (string.IsNullOrWhiteSpace(request.FallaReportada))
            return "Debes describir la falla reportada.";

        return null;
    }

    private static object LeerFormato(SqlDataReader reader) => new
    {
        id = reader.GetInt32(reader.GetOrdinal("id")),
        folio = Texto(reader, "folio"),
        estado = Texto(reader, "estado"),
        fechaRegistro = Fecha(reader, "fechaRegistro"),
        equipoId = EnteroNulo(reader, "equipoId"),
        codigoInterno = Texto(reader, "codigoInterno"),
        nombreEquipo = Texto(reader, "nombreEquipo"),
        tipoEquipo = Texto(reader, "tipoEquipo"),
        marca = Texto(reader, "marca"),
        modelo = Texto(reader, "modelo"),
        serie = Texto(reader, "serie"),
        tiendaId = EnteroNulo(reader, "tiendaId"),
        tiendaCodigo = Texto(reader, "tiendaCodigo"),
        tiendaNombre = Texto(reader, "tiendaNombre"),
        solicitante = Texto(reader, "solicitante"),
        estadoFisico = Texto(reader, "estadoFisico"),
        accesorios = Texto(reader, "accesorios"),
        fallaReportada = Texto(reader, "fallaReportada"),
        fechaIngreso = Fecha(reader, "fechaIngreso")
    };

    private static string? Texto(
        SqlDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);

        return reader.IsDBNull(index)
            ? null
            : Convert.ToString(reader.GetValue(index));
    }

    private static int? EnteroNulo(
        SqlDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);

        return reader.IsDBNull(index)
            ? null
            : Convert.ToInt32(reader.GetValue(index));
    }

    private static DateTime? Fecha(
        SqlDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);

        return reader.IsDBNull(index)
            ? null
            : Convert.ToDateTime(reader.GetValue(index));
    }

    private static object DbValue(string? value) =>
        string.IsNullOrWhiteSpace(value)
            ? DBNull.Value
            : value.Trim();

    private static async Task<IActionResult> RevertirYResponder(
        SqlTransaction transaction,
        IActionResult response)
    {
        await RevertirSinLanzarError(transaction);
        return response;
    }

    private static async Task RevertirSinLanzarError(
        SqlTransaction transaction)
    {
        try
        {
            await transaction.RollbackAsync();
        }
        catch
        {
            // Evita que el error de rollback oculte el error original.
        }
    }
}

// DTO de salida
public class FormatoSalidaRequest
{
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int ReparacionId { get; set; }

    public string? Folio { get; set; }
    public string? DiagnosticoTecnico { get; set; }
    public string? TrabajoRealizado { get; set; }
    public bool PruebasConformidadOk { get; set; }
    public string? ObservacionesGarantia { get; set; }
    public string? EstadoFinalEquipo { get; set; }
}

// DTO de ingreso
public class FormatoIngresoRequest
{
    [JsonNumberHandling(JsonNumberHandling.AllowReadingFromString)]
    public int TiendaId { get; set; }

    public string? CodigoInterno { get; set; }
    public string? NombreEquipo { get; set; }
    public string? TipoEquipo { get; set; }
    public string? Marca { get; set; }
    public string? Modelo { get; set; }
    public string? Serie { get; set; }
    public string? EstadoFisico { get; set; }
    public string? Accesorios { get; set; }
    public string? FallaReportada { get; set; }
}
