using GestionIT.Api.Seguridad;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;

namespace gestionIT.Api.Controllers;

[ApiController]
[Authorize(Policy = "AdminIT")]
[Route("api/v1/usuarios")]
public class UsuariosController : ControllerBase
{
    private readonly IConfiguration _configuration;

    public UsuariosController(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    private SqlConnection CreateConnection()
    {
        var connectionString = _configuration.GetConnectionString("Default");

        if (string.IsNullOrWhiteSpace(connectionString))
        {
            throw new InvalidOperationException(
                "No está configurada la cadena de conexión 'Default'."
            );
        }

        return new SqlConnection(connectionString);
    }

    // ============================================================
    // LISTAR USUARIOS
    // GET /api/v1/usuarios
    // ============================================================

    [HttpGet]
    public async Task<IActionResult> GetUsuarios()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            SELECT
                u.id,
                u.nombre_completo,
                u.email,
                r.nombre AS rol,
                u.rol_id,
                u.tienda_id,
                t.codigo AS tienda_codigo,
                t.nombre AS tienda_nombre,
                u.area_id,
                u.activo
            FROM USUARIOS u
            INNER JOIN ROLES r
                ON r.id = u.rol_id
            LEFT JOIN TIENDAS t
                ON t.id = u.tienda_id
            ORDER BY u.id;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var usuarios = new List<object>();

        while (await reader.ReadAsync())
        {
            usuarios.Add(new
            {
                id = reader.GetInt32(0),
                nombreCompleto = reader.GetString(1),
                email = reader.GetString(2),
                rol = reader.GetString(3),
                rolId = reader.GetInt32(4),
                tiendaId = reader.IsDBNull(5)
                    ? (int?)null
                    : reader.GetInt32(5),
                tiendaCodigo = reader.IsDBNull(6)
                    ? null
                    : reader.GetString(6),
                tiendaNombre = reader.IsDBNull(7)
                    ? null
                    : reader.GetString(7),
                areaId = reader.IsDBNull(8)
                    ? (int?)null
                    : reader.GetInt32(8),
                activo = reader.GetBoolean(9)
            });
        }

        return Ok(usuarios);
    }


    // ============================================================
    // LISTAR ROLES
    // GET /api/v1/usuarios/roles
    // ============================================================

    [HttpGet("roles")]
    public async Task<IActionResult> GetRoles()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            SELECT
                id,
                nombre,
                descripcion
            FROM ROLES
            ORDER BY id;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var roles = new List<object>();

        while (await reader.ReadAsync())
        {
            roles.Add(new
            {
                id = reader.GetInt32(0),
                nombre = reader.GetString(1),
                descripcion = reader.IsDBNull(2)
                    ? null
                    : reader.GetString(2)
            });
        }

        return Ok(roles);
    }


    // ============================================================
    // LISTAR TIENDAS
    // GET /api/v1/usuarios/tiendas
    // ============================================================

    [HttpGet("tiendas")]
    public async Task<IActionResult> GetTiendas()
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            SELECT
                id,
                codigo,
                nombre
            FROM TIENDAS
            WHERE activo = 1
            ORDER BY codigo;
            """;

        await using var command = new SqlCommand(sql, connection);
        await using var reader = await command.ExecuteReaderAsync();

        var tiendas = new List<object>();

        while (await reader.ReadAsync())
        {
            tiendas.Add(new
            {
                id = reader.GetInt32(0),
                codigo = reader.GetString(1),
                nombre = reader.GetString(2)
            });
        }

        return Ok(tiendas);
    }


    // ============================================================
    // CREAR USUARIO
    // POST /api/v1/usuarios
    // ============================================================

    [HttpPost]
    public async Task<IActionResult> CrearUsuario(
        [FromBody] CrearUsuarioRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.NombreCompleto))
        {
            return BadRequest(new
            {
                message = "El nombre completo es obligatorio."
            });
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return BadRequest(new
            {
                message = "El correo es obligatorio."
            });
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new
            {
                message = "La contraseña es obligatoria."
            });
        }

        if (request.Password.Length < 8)
        {
            return BadRequest(new
            {
                message = "La contraseña debe tener al menos 8 caracteres."
            });
        }

        if (request.RolId <= 0)
        {
            return BadRequest(new
            {
                message = "Debes seleccionar un rol."
            });
        }

        await using var connection = CreateConnection();
        await connection.OpenAsync();

        // --------------------------------------------------------
        // Verificar que el correo no exista
        // --------------------------------------------------------

        const string verificarEmail = """
            SELECT COUNT(*)
            FROM USUARIOS
            WHERE LOWER(email) = LOWER(@email);
            """;

        await using (var emailCommand =
            new SqlCommand(verificarEmail, connection))
        {
            emailCommand.Parameters.AddWithValue(
                "@email",
                request.Email.Trim());

            var existe = Convert.ToInt32(
                await emailCommand.ExecuteScalarAsync());

            if (existe > 0)
            {
                return Conflict(new
                {
                    message = "Ya existe un usuario con ese correo."
                });
            }
        }

        // --------------------------------------------------------
        // Verificar rol
        // --------------------------------------------------------

        const string verificarRol = """
            SELECT nombre
            FROM ROLES
            WHERE id = @rolId;
            """;

        string? nombreRol;

        await using (var rolCommand =
            new SqlCommand(verificarRol, connection))
        {
            rolCommand.Parameters.AddWithValue("@rolId", request.RolId);

            var resultado = await rolCommand.ExecuteScalarAsync();

            if (resultado == null || resultado == DBNull.Value)
            {
                return BadRequest(new
                {
                    message = "El rol seleccionado no existe."
                });
            }

            nombreRol = resultado.ToString();
        }

        // --------------------------------------------------------
        // Validar tienda
        // Admin IT puede quedar sin tienda.
        // Técnico y Solicitante deben tener tienda.
        // --------------------------------------------------------

        if (!string.Equals(nombreRol, "Admin IT",
                StringComparison.OrdinalIgnoreCase)
            && !request.TiendaId.HasValue)
        {
            return BadRequest(new
            {
                message =
                    "Los usuarios Técnico IT y Solicitante deben tener una tienda asignada."
            });
        }

        // --------------------------------------------------------
        // Verificar tienda si fue seleccionada
        // --------------------------------------------------------

        if (request.TiendaId.HasValue)
        {
            const string verificarTienda = """
                SELECT COUNT(*)
                FROM TIENDAS
                WHERE id = @tiendaId
                  AND activo = 1;
                """;

            await using var tiendaCommand =
                new SqlCommand(verificarTienda, connection);

            tiendaCommand.Parameters.AddWithValue(
                "@tiendaId",
                request.TiendaId.Value);

            var existeTienda = Convert.ToInt32(
                await tiendaCommand.ExecuteScalarAsync());

            if (existeTienda == 0)
            {
                return BadRequest(new
                {
                    message = "La tienda seleccionada no existe o está inactiva."
                });
            }
        }

        // --------------------------------------------------------
        // Crear usuario
        // --------------------------------------------------------

        const string insertar = """
            INSERT INTO USUARIOS
            (
                nombre_completo,
                email,
                password_hash,
                rol_id,
                tienda_id,
                area_id,
                activo,
                intentos_fallidos,
                bloqueado_hasta
            )
            OUTPUT INSERTED.id
            VALUES
            (
                @nombre,
                @email,
                @passwordHash,
                @rolId,
                @tiendaId,
                @areaId,
                1,
                0,
                NULL
            );
            """;

        await using var insertCommand =
            new SqlCommand(insertar, connection);

        insertCommand.Parameters.AddWithValue(
            "@nombre",
            request.NombreCompleto.Trim());

        insertCommand.Parameters.AddWithValue(
            "@email",
            request.Email.Trim());

        insertCommand.Parameters.AddWithValue(
            "@passwordHash",
            PasswordHasher.Hash(request.Password));

        insertCommand.Parameters.AddWithValue(
            "@rolId",
            request.RolId);

        insertCommand.Parameters.AddWithValue(
            "@tiendaId",
            (object?)request.TiendaId ?? DBNull.Value);

        insertCommand.Parameters.AddWithValue(
            "@areaId",
            (object?)request.AreaId ?? DBNull.Value);

        try
        {
            var nuevoId = await insertCommand.ExecuteScalarAsync();

            return StatusCode(201, new
            {
                id = Convert.ToInt32(nuevoId),
                message = "Usuario creado correctamente."
            });
        }
        catch (SqlException ex)
            when (ex.Number == 2627 || ex.Number == 2601)
        {
            return Conflict(new
            {
                message = "El correo ya existe."
            });
        }
    }


    // ============================================================
    // ACTUALIZAR USUARIO
    // PUT /api/v1/usuarios/{id}
    // ============================================================

    [HttpPut("{id:int}")]
    public async Task<IActionResult> ActualizarUsuario(
        int id,
        [FromBody] ActualizarUsuarioRequest request)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string buscar = """
            SELECT
                u.id,
                r.nombre
            FROM USUARIOS u
            INNER JOIN ROLES r
                ON r.id = u.rol_id
            WHERE u.id = @id;
            """;

        string? rolActual;

        await using (var buscarCommand =
            new SqlCommand(buscar, connection))
        {
            buscarCommand.Parameters.AddWithValue("@id", id);

            await using var reader =
                await buscarCommand.ExecuteReaderAsync();

            if (!await reader.ReadAsync())
            {
                return NotFound(new
                {
                    message = "Usuario no encontrado."
                });
            }

            rolActual = reader.GetString(1);
        }

        var rolId = request.RolId;

        if (!rolId.HasValue)
        {
            const string obtenerRol = """
                SELECT rol_id
                FROM USUARIOS
                WHERE id = @id;
                """;

            await using var rolCommand =
                new SqlCommand(obtenerRol, connection);

            rolCommand.Parameters.AddWithValue("@id", id);

            rolId = Convert.ToInt32(
                await rolCommand.ExecuteScalarAsync());
        }

        // --------------------------------------------------------
        // Obtener nombre del nuevo rol
        // --------------------------------------------------------

        const string nombreNuevoRolSql = """
            SELECT nombre
            FROM ROLES
            WHERE id = @rolId;
            """;

        string? nombreNuevoRol;

        await using (var rolCommand =
            new SqlCommand(nombreNuevoRolSql, connection))
        {
            rolCommand.Parameters.AddWithValue("@rolId", rolId.Value);

            var resultado =
                await rolCommand.ExecuteScalarAsync();

            if (resultado == null || resultado == DBNull.Value)
            {
                return BadRequest(new
                {
                    message = "El rol seleccionado no existe."
                });
            }

            nombreNuevoRol = resultado.ToString();
        }

        // --------------------------------------------------------
        // Validar tienda para Técnico / Solicitante
        // --------------------------------------------------------

        if (!string.Equals(
                nombreNuevoRol,
                "Admin IT",
                StringComparison.OrdinalIgnoreCase)
            && !request.TiendaId.HasValue)
        {
            return BadRequest(new
            {
                message =
                    "Los usuarios Técnico IT y Solicitante deben tener una tienda."
            });
        }

        // --------------------------------------------------------
        // Construir actualización
        // --------------------------------------------------------

        var campos = new List<string>
        {
            "nombre_completo = @nombre",
            "email = @email",
            "rol_id = @rolId",
            "tienda_id = @tiendaId",
            "area_id = @areaId",
            "activo = @activo"
        };

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            if (request.Password.Length < 8)
            {
                return BadRequest(new
                {
                    message =
                        "La nueva contraseña debe tener al menos 8 caracteres."
                });
            }

            campos.Add("password_hash = @passwordHash");
            campos.Add("intentos_fallidos = 0");
            campos.Add("bloqueado_hasta = NULL");
        }

        var sql = $"""
            UPDATE USUARIOS
            SET {string.Join(", ", campos)}
            WHERE id = @id;
            """;

        await using var command =
            new SqlCommand(sql, connection);

        command.Parameters.AddWithValue(
            "@nombre",
            request.NombreCompleto.Trim());

        command.Parameters.AddWithValue(
            "@email",
            request.Email.Trim());

        command.Parameters.AddWithValue(
            "@rolId",
            rolId.Value);

        command.Parameters.AddWithValue(
            "@tiendaId",
            (object?)request.TiendaId ?? DBNull.Value);

        command.Parameters.AddWithValue(
            "@areaId",
            (object?)request.AreaId ?? DBNull.Value);

        command.Parameters.AddWithValue(
            "@activo",
            request.Activo);

        command.Parameters.AddWithValue(
            "@id",
            id);

        if (!string.IsNullOrWhiteSpace(request.Password))
        {
            command.Parameters.AddWithValue(
                "@passwordHash",
                PasswordHasher.Hash(request.Password));
        }

        try
        {
            var afectados = await command.ExecuteNonQueryAsync();

            if (afectados == 0)
            {
                return NotFound(new
                {
                    message = "Usuario no encontrado."
                });
            }

            return Ok(new
            {
                message = "Usuario actualizado correctamente."
            });
        }
        catch (SqlException ex)
            when (ex.Number == 2627 || ex.Number == 2601)
        {
            return Conflict(new
            {
                message = "El correo ya pertenece a otro usuario."
            });
        }
    }


    // ============================================================
    // ACTIVAR / DESACTIVAR USUARIO
    // PUT /api/v1/usuarios/{id}/estado
    // ============================================================

    [HttpPut("{id:int}/estado")]
    public async Task<IActionResult> CambiarEstado(
        int id,
        [FromBody] bool activo)
    {
        await using var connection = CreateConnection();
        await connection.OpenAsync();

        const string sql = """
            UPDATE USUARIOS
            SET activo = @activo
            WHERE id = @id;
            """;

        await using var command =
            new SqlCommand(sql, connection);

        command.Parameters.AddWithValue("@activo", activo);
        command.Parameters.AddWithValue("@id", id);

        var afectados =
            await command.ExecuteNonQueryAsync();

        if (afectados == 0)
        {
            return NotFound(new
            {
                message = "Usuario no encontrado."
            });
        }

        return Ok(new
        {
            message = activo
                ? "Usuario activado correctamente."
                : "Usuario desactivado correctamente."
        });
    }
}


// ================================================================
// DTO PARA CREAR
// ================================================================

public class CrearUsuarioRequest
{
    public string NombreCompleto { get; set; } = "";
    public string Email { get; set; } = "";
    public string Password { get; set; } = "";
    public int RolId { get; set; }
    public int? TiendaId { get; set; }
    public int? AreaId { get; set; }
}


// ================================================================
// DTO PARA ACTUALIZAR
// ================================================================

public class ActualizarUsuarioRequest
{
    public string NombreCompleto { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Password { get; set; }
    public int? RolId { get; set; }
    public int? TiendaId { get; set; }
    public int? AreaId { get; set; }
    public bool Activo { get; set; } = true;
}