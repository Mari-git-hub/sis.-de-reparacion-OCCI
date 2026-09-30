using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using GestionIT.Api.Seguridad;

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
[EnableCors("PermitirReact")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly TokenService _tokenService;

    public AuthController(
        IConfiguration config,
        TokenService tokenService)
    {
        _config = config;
        _tokenService = tokenService;
    }

    // =========================================================
    // MODELO DEL LOGIN
    // =========================================================

    public record LoginRequest(
        string Email,
        string Password
    );

    // =========================================================
    // LOGIN
    // POST /api/v1/auth/login
    // =========================================================

    [HttpPost("login")]
    public async Task<IActionResult> Login(
        [FromBody] LoginRequest request)
    {
        // -----------------------------------------------------
        // Validar datos recibidos
        // -----------------------------------------------------

        if (request == null ||
            string.IsNullOrWhiteSpace(request.Email) ||
            string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new
            {
                message = "Debe proporcionar correo y contraseña."
            });
        }

        using var conn = new SqlConnection(
            _config.GetConnectionString("Default"));

        await conn.OpenAsync();

        // -----------------------------------------------------
        // Buscar usuario
        // -----------------------------------------------------

        var cmd = new SqlCommand(@"
            SELECT
                u.id,
                u.nombre_completo,
                u.email,
                u.password_hash,
                u.activo,
                u.intentos_fallidos,
                u.bloqueado_hasta,
                u.tienda_id,
                r.nombre AS rol
            FROM USUARIOS u
            INNER JOIN ROLES r
                ON r.id = u.rol_id
            WHERE u.email = @email;
        ", conn);

        cmd.Parameters.AddWithValue(
            "@email",
            request.Email.Trim());

        int usuarioId;
        string nombreCompleto;
        string email;
        string passwordHash;
        string rol;
        bool activo;
        int intentos;
        DateTime? bloqueadoHasta;
        int? tiendaId;

        using (var reader = await cmd.ExecuteReaderAsync())
        {
            // -------------------------------------------------
            // Usuario no encontrado
            // -------------------------------------------------

            if (!await reader.ReadAsync())
            {
                return Unauthorized(new
                {
                    message = "Credenciales inválidas."
                });
            }

            usuarioId = Convert.ToInt32(
                reader["id"]);

            nombreCompleto =
                reader["nombre_completo"].ToString() ?? "";

            email =
                reader["email"].ToString() ?? "";

            passwordHash =
                reader["password_hash"].ToString() ?? "";

            activo =
                Convert.ToBoolean(
                    reader["activo"]);

            intentos =
                reader["intentos_fallidos"] != DBNull.Value
                    ? Convert.ToInt32(
                        reader["intentos_fallidos"])
                    : 0;

            // -------------------------------------------------
            // IMPORTANTE:
            // No usar "as DateTime?" aquí.
            // -------------------------------------------------

            bloqueadoHasta =
                reader["bloqueado_hasta"] != DBNull.Value
                    ? Convert.ToDateTime(
                        reader["bloqueado_hasta"])
                    : (DateTime?)null;

            // -------------------------------------------------
            // IMPORTANTE:
            // No usar "as int?" aquí.
            // -------------------------------------------------

            tiendaId =
                reader["tienda_id"] != DBNull.Value
                    ? Convert.ToInt32(
                        reader["tienda_id"])
                    : (int?)null;

            rol =
                reader["rol"].ToString() ?? "";
        }

        // -----------------------------------------------------
        // Usuario inactivo
        // -----------------------------------------------------

        if (!activo)
        {
            return Unauthorized(new
            {
                message = "Usuario inactivo."
            });
        }

        // -----------------------------------------------------
        // Usuario bloqueado
        // -----------------------------------------------------

        if (bloqueadoHasta.HasValue &&
            bloqueadoHasta.Value > DateTime.UtcNow)
        {
            return StatusCode(423, new
            {
                message =
                    "Usuario bloqueado temporalmente. Intenta más tarde."
            });
        }

        // -----------------------------------------------------
        // Verificar contraseña
        // -----------------------------------------------------

        bool passwordCorrecta;

        try
        {
            passwordCorrecta =
                PasswordHasher.Verify(
                    request.Password,
                    passwordHash);
        }
        catch
        {
            // Si el hash almacenado está dañado
            // o tiene un formato inválido.
            passwordCorrecta = false;
        }

        // -----------------------------------------------------
        // Contraseña incorrecta
        // -----------------------------------------------------

        if (!passwordCorrecta)
        {
            intentos++;

            DateTime? nuevoBloqueo =
                intentos >= 5
                    ? DateTime.UtcNow.AddMinutes(15)
                    : null;

            var upd = new SqlCommand(@"
                UPDATE USUARIOS
                SET
                    intentos_fallidos = @intentos,
                    bloqueado_hasta = @bloqueadoHasta
                WHERE id = @id;
            ", conn);

            upd.Parameters.AddWithValue(
                "@intentos",
                intentos);

            upd.Parameters.AddWithValue(
                "@bloqueadoHasta",
                (object?)nuevoBloqueo ??
                DBNull.Value);

            upd.Parameters.AddWithValue(
                "@id",
                usuarioId);

            await upd.ExecuteNonQueryAsync();

            if (intentos >= 5)
            {
                return StatusCode(423, new
                {
                    message =
                        "Demasiados intentos incorrectos. El usuario ha sido bloqueado durante 15 minutos."
                });
            }

            return Unauthorized(new
            {
                message = "Credenciales inválidas."
            });
        }

        // -----------------------------------------------------
        // Contraseña correcta
        // Reiniciar intentos
        // -----------------------------------------------------

        var reset = new SqlCommand(@"
            UPDATE USUARIOS
            SET
                intentos_fallidos = 0,
                bloqueado_hasta = NULL
            WHERE id = @id;
        ", conn);

        reset.Parameters.AddWithValue(
            "@id",
            usuarioId);

        await reset.ExecuteNonQueryAsync();

        // -----------------------------------------------------
        // Generar JWT
        // -----------------------------------------------------

        var token =
            _tokenService.GenerarToken(
                usuarioId,
                email,
                rol,
                tiendaId);

        // -----------------------------------------------------
        // Respuesta
        // -----------------------------------------------------

        return Ok(new
        {
            token,
            usuarioId,
            nombreCompleto,
            email,
            rol,
            tiendaId
        });
    }
}