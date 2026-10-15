using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Authorize(Policy = "AdminIT")]
[Route("api/v1/equipos")]
public class EquipoController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public EquipoController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private SqlConnection CrearConexion()
    {
        var cadena = _configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(cadena))
        {
            throw new InvalidOperationException("No está configurada la conexión Default.");
        }

        return new SqlConnection(cadena);
    }

    // GET: /api/v1/equipos
    [HttpGet]
    public async Task<IActionResult> ObtenerEquipos()
    {
        const string sql = """
            SELECT
                e.id,
                e.codigo_interno,
                e.nombre,
                e.tipo,
                e.marca,
                e.modelo,
                e.serie,
                e.estado_actual,
                e.tienda_id,
                t.nombre AS tiendaNombre,
                e.oficina_id,
                o.nombre AS oficinaNombre,
                e.departamento_id,
                d.nombre AS departamentoNombre,
                e.propietario_id,
                u.nombre_completo AS responsable,
                e.fecha_alta,
                e.comentarios AS observaciones,

                CASE
                    WHEN e.oficina_id IS NOT NULL THEN 'Oficina'
                    WHEN e.tienda_id IS NOT NULL THEN 'Tienda'
                    ELSE 'Sin ubicación'
                END AS ubicacionTipo,

                COALESCE(
                    o.nombre,
                    t.nombre,
                    'Sin ubicación asignada'
                ) AS ubicacionNombre

            FROM EQUIPOS e

            LEFT JOIN TIENDAS t ON t.id = e.tienda_id
            LEFT JOIN OFICINAS o ON o.id = e.oficina_id
            LEFT JOIN DEPARTAMENTOS_OFICINA d ON d.id = e.departamento_id
            LEFT JOIN USUARIOS u ON u.id = e.propietario_id

            ORDER BY e.id DESC;
            """;

        try
        {
            await using var conexion = CrearConexion();
            await conexion.OpenAsync();

            await using var comando = new SqlCommand(sql, conexion);
            await using var lector = await comando.ExecuteReaderAsync();

            var equipos = new List<object>();

            while (await lector.ReadAsync())
            {
                var tienda = Texto(lector, 9);
                var oficina = Texto(lector, 11);
                var ubicacionTipo = Texto(lector, 18);
                var ubicacionNombre = Texto(lector, 19);

                equipos.Add(new
                {
                    id = lector.GetInt32(0),
                    codigoInterno = Texto(lector, 1),
                    codigo_interno = Texto(lector, 1),
                    nombre = Texto(lector, 2),
                    tipo = Texto(lector, 3),
                    marca = Texto(lector, 4),
                    modelo = Texto(lector, 5),
                    serie = Texto(lector, 6),
                    estadoActual = Texto(lector, 7),
                    estado_actual = Texto(lector, 7),
                    tiendaId = EnteroNullable(lector, 8),
                    tienda_id = EnteroNullable(lector, 8),
                    tienda = tienda,
                    tiendaNombre = tienda,
                    oficinaId = EnteroNullable(lector, 10),
                    oficina_id = EnteroNullable(lector, 10),
                    oficina = oficina,
                    oficinaNombre = oficina,
                    departamentoId = EnteroNullable(lector, 12),
                    departamento_id = EnteroNullable(lector, 12),
                    departamento = Texto(lector, 13),
                    departamentoNombre = Texto(lector, 13),
                    propietarioId = EnteroNullable(lector, 14),
                    responsable = Texto(lector, 15),
                    fechaAlta = FechaNullable(lector, 16),
                    fecha_alta = FechaNullable(lector, 16),
                    observaciones = Texto(lector, 17),
                    ubicacionTipo = ubicacionTipo,
                    ubicacionNombre = ubicacionNombre
                });
            }

            return Ok(equipos);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error al consultar equipos: " + ex.Message });
        }
    }

    // GET: /api/v1/equipos/tiendas
    [HttpGet("tiendas")]
    public async Task<IActionResult> ObtenerTiendas()
    {
        const string sql = """
            SELECT id, codigo, nombre
            FROM TIENDAS
            ORDER BY nombre;
            """;

        await using var conexion = CrearConexion();
        await conexion.OpenAsync();

        await using var comando = new SqlCommand(sql, conexion);
        await using var lector = await comando.ExecuteReaderAsync();

        var tiendas = new List<object>();

        while (await lector.ReadAsync())
        {
            tiendas.Add(new
            {
                id = lector.GetInt32(0),
                codigo = Texto(lector, 1),
                nombre = Texto(lector, 2)
            });
        }

        return Ok(tiendas);
    }

    // GET: /api/v1/equipos/oficinas
    [HttpGet("oficinas")]
    public async Task<IActionResult> ObtenerOficinas()
    {
        const string sql = """
            SELECT id, nombre, descripcion
            FROM OFICINAS
            ORDER BY nombre;
            """;

        await using var conexion = CrearConexion();
        await conexion.OpenAsync();

        await using var comando = new SqlCommand(sql, conexion);
        await using var lector = await comando.ExecuteReaderAsync();

        var oficinas = new List<object>();

        while (await lector.ReadAsync())
        {
            oficinas.Add(new
            {
                id = lector.GetInt32(0),
                nombre = Texto(lector, 1),
                descripcion = Texto(lector, 2)
            });
        }

        return Ok(oficinas);
    }

    // GET: /api/v1/equipos/departamentos?oficinaId=1
    [HttpGet("departamentos")]
    public async Task<IActionResult> ObtenerDepartamentos([FromQuery] int oficinaId)
    {
        if (oficinaId <= 0) return BadRequest(new { message = "Selecciona una oficina válida." });

        const string sql = "SELECT id, nombre FROM DEPARTAMENTOS_OFICINA WHERE oficina_id = @oficinaId ORDER BY nombre;";

        await using var conexion = CrearConexion();
        await conexion.OpenAsync();

        await using var comando = new SqlCommand(sql, conexion);
        comando.Parameters.AddWithValue("@oficinaId", oficinaId);

        await using var lector = await comando.ExecuteReaderAsync();
        var departamentos = new List<object>();

        while (await lector.ReadAsync())
        {
            departamentos.Add(new { id = lector.GetInt32(0), nombre = Texto(lector, 1) });
        }

        return Ok(departamentos);
    }

    // POST: /api/v1/equipos
    [HttpPost]
    public async Task<IActionResult> CrearEquipo([FromBody] CrearEquipoRequest request)
    {
        if (request is null) return BadRequest(new { message = "No se recibieron los datos del equipo." });
        if (string.IsNullOrWhiteSpace(request.Tipo)) return BadRequest(new { message = "El tipo de equipo es obligatorio." });
        if (string.IsNullOrWhiteSpace(request.Marca)) return BadRequest(new { message = "La marca es obligatoria." });
        if (string.IsNullOrWhiteSpace(request.Serie)) return BadRequest(new { message = "El número de serie es obligatorio." });

        bool tieneTienda = request.TiendaId.HasValue;
        bool tieneOficina = request.OficinaId.HasValue;

        if (tieneTienda == tieneOficina)
        {
            return BadRequest(new { message = "El equipo debe pertenecer a una tienda o a una oficina, no a ambas." });
        }

        if (tieneTienda && request.TiendaId!.Value <= 0) return BadRequest(new { message = "Selecciona una tienda válida." });
        if (tieneOficina && request.OficinaId!.Value <= 0) return BadRequest(new { message = "Selecciona una oficina válida." });
        if (tieneOficina && (!request.DepartamentoId.HasValue || request.DepartamentoId.Value <= 0))
        {
            return BadRequest(new { message = "Selecciona un departamento de oficina." });
        }

        string serie = request.Serie.Trim();
        string tipo = request.Tipo.Trim();
        string marca = request.Marca.Trim();

        try
        {
            await using var conexion = CrearConexion();
            await conexion.OpenAsync();

            // 1. VALIDAR SERIE DUPLICADA
            const string comprobarSerie = "SELECT COUNT(*) FROM EQUIPOS WHERE serie = @serie;";
            await using (var cmdSerie = new SqlCommand(comprobarSerie, conexion))
            {
                cmdSerie.Parameters.AddWithValue("@serie", serie);
                if (Convert.ToInt32(await cmdSerie.ExecuteScalarAsync()) > 0)
                {
                    return Conflict(new { message = "Ya existe un equipo con ese número de serie." });
                }
            }

            // 2. VALIDAR EXISTENCIA DE TIENDA
            if (tieneTienda)
            {
                const string sqlTienda = "SELECT COUNT(*) FROM TIENDAS WHERE id = @id;";
                await using var cmdTienda = new SqlCommand(sqlTienda, conexion);
                cmdTienda.Parameters.AddWithValue("@id", request.TiendaId!.Value);
                if (Convert.ToInt32(await cmdTienda.ExecuteScalarAsync()) == 0)
                {
                    return BadRequest(new { message = "La tienda no existe en la base de datos." });
                }
            }

            // 3. VALIDAR EXISTENCIA DE OFICINA Y DEPARTAMENTO
            if (tieneOficina)
            {
                const string sqlOficina = "SELECT COUNT(*) FROM OFICINAS WHERE id = @id;";
                await using (var cmdOficina = new SqlCommand(sqlOficina, conexion))
                {
                    cmdOficina.Parameters.AddWithValue("@id", request.OficinaId!.Value);
                    if (Convert.ToInt32(await cmdOficina.ExecuteScalarAsync()) == 0)
                    {
                        return BadRequest(new { message = "La oficina no existe en la base de datos." });
                    }
                }

                const string sqlDept = "SELECT COUNT(*) FROM DEPARTAMENTOS_OFICINA WHERE id = @dId AND oficina_id = @oId;";
                await using (var cmdDept = new SqlCommand(sqlDept, conexion))
                {
                    cmdDept.Parameters.AddWithValue("@dId", request.DepartamentoId!.Value);
                    cmdDept.Parameters.AddWithValue("@oId", request.OficinaId!.Value);
                    if (Convert.ToInt32(await cmdDept.ExecuteScalarAsync()) == 0)
                    {
                        return BadRequest(new { message = "El departamento no pertenece a esa oficina." });
                    }
                }
            }

            // 4. GUARDAR EQUIPO EN SQL SERVER
            const string insertar = """
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
                    departamento_id,
                    propietario_id,
                    fecha_alta,
                    comentarios,
                    oficina_id
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
                    'Disponible',
                    @tiendaId,
                    @departamentoId,
                    @propietarioId,
                    SYSDATETIME(),
                    @comentarios,
                    @oficinaId
                );
                """;

            await using var insert = new SqlCommand(insertar, conexion);

            string codigoGenerado = "EQ-" + serie.ToUpperInvariant();

            insert.Parameters.AddWithValue("@codigoInterno", codigoGenerado);
            insert.Parameters.AddWithValue("@nombre", $"{tipo} - {marca}");
            insert.Parameters.AddWithValue("@tipo", tipo);
            insert.Parameters.AddWithValue("@marca", marca);
            insert.Parameters.AddWithValue("@serie", serie);

            insert.Parameters.AddWithValue("@modelo", (object?)(string.IsNullOrWhiteSpace(request.Modelo) ? null : request.Modelo.Trim()) ?? DBNull.Value);
            insert.Parameters.AddWithValue("@tiendaId", (object?)request.TiendaId ?? DBNull.Value);
            insert.Parameters.AddWithValue("@oficinaId", (object?)request.OficinaId ?? DBNull.Value);
            insert.Parameters.AddWithValue("@departamentoId", (object?)request.DepartamentoId ?? DBNull.Value);
            insert.Parameters.AddWithValue("@propietarioId", (object?)request.PropietarioId ?? DBNull.Value);
            insert.Parameters.AddWithValue("@comentarios", (object?)(string.IsNullOrWhiteSpace(request.Observaciones) ? null : request.Observaciones.Trim()) ?? DBNull.Value);

            var idResult = await insert.ExecuteScalarAsync();

            return StatusCode(201, new
            {
                id = Convert.ToInt32(idResult),
                message = "Equipo registrado correctamente."
            });
        }
        catch (SqlException ex)
        {
            return StatusCode(500, new { message = $"Error en la Base de Datos ({ex.Number}): {ex.Message}" });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = "Error interno del servidor: " + ex.Message });
        }
    }

    private static string? Texto(SqlDataReader lector, int indice) => lector.IsDBNull(indice) ? null : Convert.ToString(lector.GetValue(indice));
    private static int? EnteroNullable(SqlDataReader lector, int indice) => lector.IsDBNull(indice) ? null : Convert.ToInt32(lector.GetValue(indice));
    private static DateTime? FechaNullable(SqlDataReader lector, int indice) => lector.IsDBNull(indice) ? null : Convert.ToDateTime(lector.GetValue(indice));
}

public class CrearEquipoRequest
{
    public string Tipo { get; set; } = "";
    public string Marca { get; set; } = "";
    public string? Modelo { get; set; }
    public string Serie { get; set; } = "";
    public int? TiendaId { get; set; }
    public int? OficinaId { get; set; }
    public int? DepartamentoId { get; set; }
    public int? PropietarioId { get; set; }
    public string? Observaciones { get; set; }
}