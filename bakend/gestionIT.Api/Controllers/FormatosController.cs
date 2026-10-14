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
        var connectionString = _configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "No está configurada la cadena de conexión 'Default'.");
        }

        return new SqlConnection(connectionString);
    }

    private int? TryGetUserId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? User.FindFirstValue("sub");

        return int.TryParse(value, out var id) ? id : null;
    }

    private static string NuevoFolio() =>
        "REP-" + Guid.NewGuid().ToString("N")[..16].ToUpperInvariant();

    // GET /api/v1/formatos/reparaciones
    [HttpGet("reparaciones")]
    public async Task<IActionResult> GetReparaciones()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
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

    // GET /api/v1/formatos/ingreso/123
    [HttpGet("ingreso/{id:int}")]
    public async Task<IActionResult> GetIngreso(int id)
    {
        if (id <= 0)
        {
            return BadRequest(new { mensaje = "El identificador no es válido." });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
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
            WHERE r.id = @id;
            """;

        await using var command = new SqlCommand(sql, connection);
        command.Parameters.AddWithValue("@id", id);

        await using var reader = await command.ExecuteReaderAsync();

        if (!await reader.ReadAsync())
        {
            return NotFound(new { mensaje = "No se encontró el formato de ingreso." });
        }

        return Ok(LeerFormato(reader));
    }

    // POST /api/v1/formatos/ingreso
    [HttpPost("ingreso")]
    public async Task<IActionResult> PostIngreso([FromBody] FormatoIngresoRequest request)
    {
        var usuarioId = TryGetUserId();

        if (!usuarioId.HasValue)
        {
            return Unauthorized(new { mensaje = "El token no contiene un identificador de usuario válido. Vuelve a iniciar sesión." });
        }

        var validacion = Validar(request);

        if (validacion is not null)
        {
            return BadRequest(new { mensaje = validacion });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

        var pasoSql = "Preparar registro";

        try
        {
            int equipoId;
            string? errorEquipo = null;

            pasoSql = "Buscar equipo existente";

            const string buscarEquipoSql = """
                SELECT TOP (1)
                    id,
                    tienda_id,
                    tipo,
                    serie,
                    codigo_interno,
                    estado_actual
                FROM EQUIPOS WITH (UPDLOCK, HOLDLOCK)
                WHERE serie = @serie
                   OR codigo_interno = @codigoInterno;
                """;

            await using (var buscar = new SqlCommand(buscarEquipoSql, connection, transaction))
            {
                buscar.Parameters.AddWithValue("@serie", request.Serie!.Trim());
                buscar.Parameters.AddWithValue("@codigoInterno", CodigoInterno(request));

                await using var reader = await buscar.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    equipoId = reader.GetInt32(0);

                    int? tiendaExistente = reader.IsDBNull(1) ? null : reader.GetInt32(1);
                    string? tipoExistente = reader.IsDBNull(2) ? null : reader.GetString(2);
                    string? serieExistente = reader.IsDBNull(3) ? null : reader.GetString(3);
                    string? estadoExistente = reader.IsDBNull(5) ? null : reader.GetString(5);

                    if (!string.Equals(serieExistente, request.Serie.Trim(), StringComparison.OrdinalIgnoreCase))
                    {
                        errorEquipo = "El código interno ya está registrado con otro número de serie.";
                    }
                    else if (tiendaExistente != request.TiendaId || !string.Equals(tipoExistente, request.TipoEquipo, StringComparison.OrdinalIgnoreCase))
                    {
                        errorEquipo = "La serie existe en el inventario, pero la tienda o el tipo no coincide.";
                    }
                    else if (string.Equals(estadoExistente, "BAJA", StringComparison.OrdinalIgnoreCase))
                    {
                        errorEquipo = "El equipo está dado de baja y no puede ingresar a reparación.";
                    }
                }
                else
                {
                    equipoId = 0;
                }
            }

            if (errorEquipo is not null)
            {
                return await RevertirYResponder(transaction, Conflict(errorEquipo));
            }

            if (equipoId == 0)
            {
                pasoSql = "Insertar equipo en EQUIPOS";

                const string insertarEquipoSql = """
                    INSERT INTO EQUIPOS
                        (codigo_interno, nombre, tipo, marca, modelo, serie, estado_actual, tienda_id, propietario_id)
                    VALUES
                        (@codigoInterno, @nombre, @tipo, @marca, @modelo, @serie, 'En reparacion', @tiendaId, NULL);

                    SELECT CAST(SCOPE_IDENTITY() AS int);
                    """;

                await using var insertarEquipo = new SqlCommand(insertarEquipoSql, connection, transaction);
                AgregarDatosEquipo(insertarEquipo, request);

                var resultadoEquipo = await insertarEquipo.ExecuteScalarAsync();

                if (resultadoEquipo is null || resultadoEquipo == DBNull.Value)
                {
                    throw new InvalidOperationException("No se obtuvo el identificador del equipo registrado.");
                }

                equipoId = Convert.ToInt32(resultadoEquipo);
            }
            else
            {
                pasoSql = "Comprobar reparaciones abiertas";

                const string comprobarAbiertaSql = """
                    SELECT COUNT(1)
                    FROM REPARACIONES
                    WHERE equipo_id = @equipoId
                      AND estado NOT IN ('ENTREGADO', 'DESCARTADO', 'CANCELADO');
                    """;

                await using var comprobar = new SqlCommand(comprobarAbiertaSql, connection, transaction);
                comprobar.Parameters.AddWithValue("@equipoId", equipoId);

                var abiertas = Convert.ToInt32(await comprobar.ExecuteScalarAsync());

                if (abiertas > 0)
                {
                    return await RevertirYResponder(transaction, Conflict("Este equipo ya tiene una reparación abierta."));
                }

                pasoSql = "Actualizar estado del equipo";

                const string actualizarEstadoSql = """
                    UPDATE EQUIPOS
                    SET estado_actual = 'En reparacion'
                    WHERE id = @id;
                    """;

                await using var actualizarEstado = new SqlCommand(actualizarEstadoSql, connection, transaction);
                actualizarEstado.Parameters.AddWithValue("@id", equipoId);
                await actualizarEstado.ExecuteNonQueryAsync();
            }

            pasoSql = "Insertar reparación en REPARACIONES";

            var folio = NuevoFolio();
            int reparacionId;

            const string insertarReparacionSql = """
                INSERT INTO REPARACIONES
                    (folio, equipo_id, solicitante_id, prioridad, estado, fecha_registro)
                VALUES
                    (@folio, @equipoId, @usuarioId, 'MEDIA', 'REGISTRADO', SYSDATETIME());

                SELECT CAST(SCOPE_IDENTITY() AS int);
                """;

            await using (var insertarReparacion = new SqlCommand(insertarReparacionSql, connection, transaction))
            {
                insertarReparacion.Parameters.AddWithValue("@folio", folio);
                insertarReparacion.Parameters.AddWithValue("@equipoId", equipoId);
                insertarReparacion.Parameters.AddWithValue("@usuarioId", usuarioId.Value);

                var resultadoReparacion = await insertarReparacion.ExecuteScalarAsync();

                if (resultadoReparacion is null || resultadoReparacion == DBNull.Value)
                {
                    throw new InvalidOperationException("No se obtuvo el identificador de la reparación.");
                }

                reparacionId = Convert.ToInt32(resultadoReparacion);
            }

            pasoSql = "Insertar formato en FORMATO_INGRESO";

            const string insertarFormatoSql = """
                INSERT INTO FORMATO_INGRESO
                    (reparacion_id, falla_reportada, accesorios_incluidos, estado_fisico_recepcion, fecha_ingreso)
                VALUES
                    (@reparacionId, @falla, @accesorios, @estadoFisico, SYSDATETIME());
                """;

            await using (var insertarFormato = new SqlCommand(insertarFormatoSql, connection, transaction))
            {
                insertarFormato.Parameters.AddWithValue("@reparacionId", reparacionId);
                insertarFormato.Parameters.AddWithValue("@falla", request.FallaReportada!.Trim());
                insertarFormato.Parameters.AddWithValue("@accesorios", DbValue(request.Accesorios));
                insertarFormato.Parameters.AddWithValue("@estadoFisico", request.EstadoFisico!.Trim());

                await insertarFormato.ExecuteNonQueryAsync();
            }

            pasoSql = "Insertar historial en HISTORIAL_ESTADOS";

            const string insertarHistorialSql = """
                INSERT INTO HISTORIAL_ESTADOS
                    (reparacion_id, usuario_id, estado_anterior, estado_nuevo, fecha, comentario)
                VALUES
                    (@reparacionId, @usuarioId, NULL, 'REGISTRADO', SYSDATETIME(), 'Ingreso del equipo');
                """;

            await using (var historial = new SqlCommand(insertarHistorialSql, connection, transaction))
            {
                historial.Parameters.AddWithValue("@reparacionId", reparacionId);
                historial.Parameters.AddWithValue("@usuarioId", usuarioId.Value);

                await historial.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return CreatedAtAction(
                nameof(GetIngreso),
                new { id = reparacionId },
                new
                {
                    id = reparacionId,
                    folio,
                    mensaje = "Formato de ingreso registrado correctamente."
                });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            await RevertirSinLanzarError(transaction);
            _logger.LogWarning(ex, "Registro duplicado. Paso: {PasoSql}", pasoSql);

            return Conflict(new
            {
                mensaje = $"No se pudo guardar porque existe un dato duplicado. Operación: {pasoSql}. Revisa el código interno, el número de serie o el folio."
            });
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Error SQL al registrar formato de ingreso. Paso: {PasoSql}. Número SQL: {NumeroSql}", pasoSql, ex.Number);
            await RevertirSinLanzarError(transaction);

            return StatusCode(500, new
            {
                mensaje = $"Error SQL {ex.Number} durante '{pasoSql}': {ex.Message}",
                codigoSql = ex.Number,
                paso = pasoSql
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al registrar formato de ingreso. Paso: {PasoSql}", pasoSql);
            await RevertirSinLanzarError(transaction);

            return StatusCode(500, new
            {
                mensaje = $"No se pudo registrar el formato durante la operación '{pasoSql}'. Revisa el log de la API.",
                paso = pasoSql
            });
        }
    }

    // PUT /api/v1/formatos/ingreso/123
    [HttpPut("ingreso/{id:int}")]
    public async Task<IActionResult> PutIngreso(int id, [FromBody] FormatoIngresoRequest request)
    {
        if (id <= 0)
        {
            return BadRequest(new { mensaje = "El identificador no es válido." });
        }

        var validacion = Validar(request);

        if (validacion is not null)
        {
            return BadRequest(new { mensaje = validacion });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

        var pasoSql = "Buscar reparación para actualizar";

        try
        {
            int equipoId = 0;
            string? estado = null;

            const string buscarSql = """
                SELECT equipo_id, estado
                FROM REPARACIONES WITH (UPDLOCK, HOLDLOCK)
                WHERE id = @id;
                """;

            await using (var buscar = new SqlCommand(buscarSql, connection, transaction))
            {
                buscar.Parameters.AddWithValue("@id", id);
                await using var reader = await buscar.ExecuteReaderAsync();

                if (await reader.ReadAsync())
                {
                    equipoId = reader.GetInt32(0);
                    estado = reader.IsDBNull(1) ? null : reader.GetString(1);
                }
            }

            if (estado is null)
            {
                return await RevertirYResponder(transaction, NotFound(new { mensaje = "No se encontró el ingreso solicitado." }));
            }

            if (!string.Equals(estado, "REGISTRADO", StringComparison.OrdinalIgnoreCase))
            {
                return await RevertirYResponder(transaction, Conflict("Solo se pueden editar formatos cuyo estado sea REGISTRADO."));
            }

            pasoSql = "Actualizar equipo en EQUIPOS";

            const string equipoSql = """
                UPDATE EQUIPOS
                SET codigo_interno = @codigoInterno,
                    nombre = @nombre,
                    tipo = @tipo,
                    marca = @marca,
                    modelo = @modelo,
                    serie = @serie,
                    tienda_id = @tiendaId
                WHERE id = @equipoId;
                """;

            await using (var updateEquipo = new SqlCommand(equipoSql, connection, transaction))
            {
                AgregarDatosEquipo(updateEquipo, request);
                updateEquipo.Parameters.AddWithValue("@equipoId", equipoId);
                await updateEquipo.ExecuteNonQueryAsync();
            }

            pasoSql = "Actualizar formato en FORMATO_INGRESO";

            const string formatoSql = """
                UPDATE FORMATO_INGRESO
                SET falla_reportada = @falla,
                    accesorios_incluidos = @accesorios,
                    estado_fisico_recepcion = @estadoFisico
                WHERE reparacion_id = @id;
                """;

            await using (var updateFormato = new SqlCommand(formatoSql, connection, transaction))
            {
                updateFormato.Parameters.AddWithValue("@falla", request.FallaReportada!.Trim());
                updateFormato.Parameters.AddWithValue("@accesorios", DbValue(request.Accesorios));
                updateFormato.Parameters.AddWithValue("@estadoFisico", request.EstadoFisico!.Trim());
                updateFormato.Parameters.AddWithValue("@id", id);

                var filas = await updateFormato.ExecuteNonQueryAsync();

                if (filas == 0)
                {
                    return await RevertirYResponder(transaction, NotFound(new { mensaje = "La reparación existe, pero no tiene un formato de ingreso para actualizar." }));
                }
            }

            await transaction.CommitAsync();

            return Ok(new { id, mensaje = "Formato de ingreso actualizado correctamente." });
        }
        catch (SqlException ex) when (ex.Number is 2601 or 2627)
        {
            await RevertirSinLanzarError(transaction);
            _logger.LogWarning(ex, "Dato duplicado al actualizar formato {FormatoId}. Paso: {PasoSql}", id, pasoSql);

            return Conflict(new
            {
                mensaje = $"No se pudo actualizar porque existe un dato duplicado. Operación: {pasoSql}. Revisa el código interno y el número de serie."
            });
        }
        catch (SqlException ex)
        {
            _logger.LogError(ex, "Error SQL al actualizar formato {FormatoId}. Paso: {PasoSql}. Número SQL: {NumeroSql}", id, pasoSql, ex.Number);
            await RevertirSinLanzarError(transaction);

            return StatusCode(500, new
            {
                mensaje = $"Error SQL {ex.Number} durante '{pasoSql}': {ex.Message}",
                codigoSql = ex.Number,
                paso = pasoSql
            });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al actualizar formato {FormatoId}. Paso: {PasoSql}", id, pasoSql);
            await RevertirSinLanzarError(transaction);

            return StatusCode(500, new
            {
                mensaje = $"No se pudo actualizar el formato durante la operación '{pasoSql}'. Revisa el log de la API.",
                paso = pasoSql
            });
        }
    }

    // POST /api/v1/formatos/salida
    [HttpPost("salida")]
    public async Task<IActionResult> PostSalida([FromBody] FormatoSalidaRequest request)
    {
        var usuarioId = TryGetUserId();

        if (!usuarioId.HasValue)
        {
            return Unauthorized(new { mensaje = "El token no contiene un identificador de usuario válido. Vuelve a iniciar sesión." });
        }

        if (string.IsNullOrWhiteSpace(request.Folio) && request.ReparacionId <= 0)
        {
            return BadRequest(new { mensaje = "Debes proporcionar el folio o el ID de la reparación." });
        }

        if (string.IsNullOrWhiteSpace(request.TrabajoRealizado))
        {
            return BadRequest(new { mensaje = "El trabajo realizado es obligatorio." });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        await using var transaction = (SqlTransaction)await connection.BeginTransactionAsync();

        try
        {
            int reparacionId = request.ReparacionId;
            int equipoId = 0;
            string? estadoActual = null;

            const string buscarReparacionSql = """
                SELECT id, equipo_id, estado 
                FROM REPARACIONES WITH (UPDLOCK, HOLDLOCK) 
                WHERE (id = @reparacionId OR folio = @folio);
                """;

            await using (var cmdBuscar = new SqlCommand(buscarReparacionSql, connection, transaction))
            {
                cmdBuscar.Parameters.AddWithValue("@reparacionId", request.ReparacionId);
                cmdBuscar.Parameters.AddWithValue("@folio", DbValue(request.Folio));

                await using var reader = await cmdBuscar.ExecuteReaderAsync();
                if (await reader.ReadAsync())
                {
                    reparacionId = reader.GetInt32(0);
                    equipoId = reader.GetInt32(1);
                    estadoActual = reader.IsDBNull(2) ? null : reader.GetString(2);
                }
            }

            if (reparacionId == 0 || equipoId == 0)
            {
                return await RevertirYResponder(transaction, NotFound(new { mensaje = "No se encontró la reparación indicada con el folio/ID provisto." }));
            }

            if (string.Equals(estadoActual, "ENTREGADO", StringComparison.OrdinalIgnoreCase) ||
                string.Equals(estadoActual, "DESCARTADO", StringComparison.OrdinalIgnoreCase))
            {
                return await RevertirYResponder(transaction, Conflict(new { mensaje = "Esta reparación ya fue procesada anteriormente." }));
            }

            const string insertarSalidaSql = """
                INSERT INTO FORMATO_SALIDA
                    (reparacion_id, trabajo_realizado, diagnostico_final, observaciones, fecha_salida)
                VALUES
                    (@reparacionId, @trabajo, @diagnostico, @observaciones, SYSDATETIME());
                """;

            await using (var cmdSalida = new SqlCommand(insertarSalidaSql, connection, transaction))
            {
                cmdSalida.Parameters.AddWithValue("@reparacionId", reparacionId);
                cmdSalida.Parameters.AddWithValue("@trabajo", request.TrabajoRealizado.Trim());
                cmdSalida.Parameters.AddWithValue("@diagnostico", DbValue(request.DiagnosticoTecnico));
                cmdSalida.Parameters.AddWithValue("@observaciones", DbValue(request.ObservacionesGarantia));

                await cmdSalida.ExecuteNonQueryAsync();
            }

            bool esBaja = string.Equals(request.EstadoFinalEquipo, "BAJA", StringComparison.OrdinalIgnoreCase);
            string nuevoEstadoReparacion = esBaja ? "DESCARTADO" : "ENTREGADO";
            string nuevoEstadoEquipo = esBaja ? "BAJA" : "OPERATIVO";

            const string actualizarReparacionSql = """
                UPDATE REPARACIONES
                SET estado = @nuevoEstado
                WHERE id = @reparacionId;
                """;

            await using (var cmdActualizar = new SqlCommand(actualizarReparacionSql, connection, transaction))
            {
                cmdActualizar.Parameters.AddWithValue("@nuevoEstado", nuevoEstadoReparacion);
                cmdActualizar.Parameters.AddWithValue("@reparacionId", reparacionId);
                await cmdActualizar.ExecuteNonQueryAsync();
            }

            const string actualizarEquipoSql = """
                UPDATE EQUIPOS
                SET estado_actual = @nuevoEstadoEquipo
                WHERE id = @equipoId;
                """;

            await using (var cmdEquipo = new SqlCommand(actualizarEquipoSql, connection, transaction))
            {
                cmdEquipo.Parameters.AddWithValue("@nuevoEstadoEquipo", nuevoEstadoEquipo);
                cmdEquipo.Parameters.AddWithValue("@equipoId", equipoId);
                await cmdEquipo.ExecuteNonQueryAsync();
            }

            const string historialSql = """
                INSERT INTO HISTORIAL_ESTADOS
                    (reparacion_id, usuario_id, estado_anterior, estado_nuevo, fecha, comentario)
                VALUES
                    (@reparacionId, @usuarioId, @estadoAnterior, @nuevoEstado, SYSDATETIME(), @comentario);
                """;

            await using (var cmdHistorial = new SqlCommand(historialSql, connection, transaction))
            {
                cmdHistorial.Parameters.AddWithValue("@reparacionId", reparacionId);
                cmdHistorial.Parameters.AddWithValue("@usuarioId", usuarioId.Value);
                cmdHistorial.Parameters.AddWithValue("@estadoAnterior", DbValue(estadoActual));
                cmdHistorial.Parameters.AddWithValue("@nuevoEstado", nuevoEstadoReparacion);
                cmdHistorial.Parameters.AddWithValue("@comentario", esBaja ? "Equipo descartado / Baja técnica" : "Formato de salida registrado / Equipo entregado");

                await cmdHistorial.ExecuteNonQueryAsync();
            }

            await transaction.CommitAsync();

            return Ok(new { mensaje = "Formato de salida registrado correctamente." });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error al registrar formato de salida.");
            await RevertirSinLanzarError(transaction);
            return StatusCode(500, new { mensaje = "Error interno al procesar el formato de salida: " + ex.Message });
        }
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

    private static string? Texto(SqlDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : Convert.ToString(reader.GetValue(index));
    }

    private static int? EnteroNulo(SqlDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : Convert.ToInt32(reader.GetValue(index));
    }

    private static DateTime? Fecha(SqlDataReader reader, string column)
    {
        var index = reader.GetOrdinal(column);
        return reader.IsDBNull(index) ? null : Convert.ToDateTime(reader.GetValue(index));
    }

    private static void AgregarDatosEquipo(SqlCommand command, FormatoIngresoRequest request)
    {
        command.Parameters.AddWithValue("@codigoInterno", CodigoInterno(request));
        command.Parameters.AddWithValue("@nombre", request.NombreEquipo!.Trim());
        command.Parameters.AddWithValue("@tipo", request.TipoEquipo!.Trim().ToUpperInvariant());
        command.Parameters.AddWithValue("@marca", DbValue(request.Marca));
        command.Parameters.AddWithValue("@modelo", DbValue(request.Modelo));
        command.Parameters.AddWithValue("@serie", request.Serie!.Trim());
        command.Parameters.AddWithValue("@tiendaId", request.TiendaId);
    }

    private static string CodigoInterno(FormatoIngresoRequest request) =>
        string.IsNullOrWhiteSpace(request.CodigoInterno)
            ? "SER-" + request.Serie!.Trim().ToUpperInvariant()
            : request.CodigoInterno.Trim().ToUpperInvariant();

    private static object DbValue(string? value) =>
        string.IsNullOrWhiteSpace(value) ? DBNull.Value : value.Trim();

    private static string? Validar(FormatoIngresoRequest request)
    {
        if (request.TiendaId <= 0) return "Selecciona una tienda válida.";
        if (string.IsNullOrWhiteSpace(request.NombreEquipo)) return "El nombre o descripción del equipo es obligatorio.";
        if (string.IsNullOrWhiteSpace(request.Serie)) return "El número de serie es obligatorio.";
        if (string.IsNullOrWhiteSpace(request.TipoEquipo)) return "Selecciona un tipo de equipo válido.";
        if (string.IsNullOrWhiteSpace(request.EstadoFisico)) return "El estado físico de recepción es obligatorio.";
        if (string.IsNullOrWhiteSpace(request.FallaReportada)) return "La falla reportada es obligatoria.";

        var tipos = new[]
        {
            "CPU", "LAPTOP", "IMPRESORA_NORMAL", "IMPRESORA_CAJA", "IMPRESORA_ETIQUETAS", "RELOJ_MARCADOR"
        };

        if (!tipos.Contains(request.TipoEquipo.Trim().ToUpperInvariant()))
        {
            return "El tipo de equipo seleccionado no es válido.";
        }

        return null;
    }

    private static ConflictObjectResult Conflict(object value) => new(value);

    private static async Task<IActionResult> RevertirYResponder(SqlTransaction transaction, IActionResult response)
    {
        await RevertirSinLanzarError(transaction);
        return response;
    }

    private static async Task RevertirSinLanzarError(SqlTransaction transaction)
    {
        try { await transaction.RollbackAsync(); } catch { }
    }
}

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