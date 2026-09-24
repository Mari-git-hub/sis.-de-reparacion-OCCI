using Microsoft.AspNetCore.Mvc;
using Microsoft.Data.SqlClient;
using GestionIT.Api.Seguridad; // Corregido: GestionIT (no GestionTI)

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/auth")]
public class AuthController : ControllerBase
{
    private readonly IConfiguration _config;
    private readonly TokenService _tokenService;

    public AuthController(IConfiguration config, TokenService tokenService)
    {
        _config = config;
        _tokenService = tokenService;
    }

    public record LoginRequest(string Email, string Password);

    // Endpoint para resetear o crear el admin con el HASH CORRECTO
    [HttpPost("seed-admin")]
    public async Task<IActionResult> SeedAdmin()
    {
        using var conn = new SqlConnection(_config.GetConnectionString("Default"));
        await conn.OpenAsync();

        var hash = PasswordHasher.Hash("Admin123!");

        var check = new SqlCommand("SELECT COUNT(*) FROM USUARIOS WHERE email = 'admin@empresa.com'", conn);
        var existe = (int)(await check.ExecuteScalarAsync())! > 0;

        if (existe)
        {
            // Si ya existe, actualizamos su contraseña al hash correcto de PasswordHasher
            var update = new SqlCommand(@"
                UPDATE USUARIOS 
                SET password_hash = @hash, activo = 1, intentos_fallidos = 0, bloqueado_hasta = NULL 
                WHERE email = 'admin@empresa.com'", conn);
            update.Parameters.AddWithValue("@hash", hash);
            await update.ExecuteNonQueryAsync();

            return Ok(new { message = "Usuario admin reconfigurado con la clave Admin123!", email = "admin@empresa.com" });
        }

        var insert = new SqlCommand(@"
            INSERT INTO USUARIOS (nombre_completo, email, password_hash, rol_id, activo)
            VALUES ('Administrador', 'admin@empresa.com', @hash,
                    (SELECT id FROM ROLES WHERE nombre = 'Admin IT'), 1)", conn);
        insert.Parameters.AddWithValue("@hash", hash);
        await insert.ExecuteNonQueryAsync();

        return Ok(new { message = "Usuario admin creado", email = "admin@empresa.com", password = "Admin123!" });
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        using var conn = new SqlConnection(_config.GetConnectionString("Default"));
        await conn.OpenAsync();

        var cmd = new SqlCommand(@"
            SELECT u.id, u.password_hash, u.activo, u.intentos_fallidos, u.bloqueado_hasta,
                   u.tienda_id, r.nombre AS rol
            FROM USUARIOS u
            INNER JOIN ROLES r ON r.id = u.rol_id
            WHERE u.email = @email", conn);
        cmd.Parameters.AddWithValue("@email", request.Email);

        int usuarioId; string passwordHash, rol; bool activo; int intentos;
        DateTime? bloqueadoHasta; int? tiendaId;

        using (var reader = await cmd.ExecuteReaderAsync())
        {
            if (!await reader.ReadAsync())
                return Unauthorized(new { message = "Credenciales inválidas" });

            usuarioId = (int)reader["id"];
            passwordHash = (string)reader["password_hash"];
            activo = (bool)reader["activo"];
            intentos = reader["intentos_fallidos"] != DBNull.Value ? Convert.ToInt32(reader["intentos_fallidos"]) : 0;
            bloqueadoHasta = reader["bloqueado_hasta"] as DateTime?;
            tiendaId = reader["tienda_id"] as int?;
            rol = (string)reader["rol"];
        }

        if (!activo)
            return Unauthorized(new { message = "Usuario inactivo" });

        if (bloqueadoHasta.HasValue && bloqueadoHasta.Value > DateTime.UtcNow)
            return StatusCode(423, new { message = "Usuario bloqueado temporalmente. Intenta más tarde." });

        if (!PasswordHasher.Verify(request.Password, passwordHash))
        {
            intentos++;
            DateTime? nuevoBloqueo = intentos >= 5 ? DateTime.UtcNow.AddMinutes(15) : null;

            var upd = new SqlCommand("UPDATE USUARIOS SET intentos_fallidos=@i, bloqueado_hasta=@b WHERE id=@id", conn);
            upd.Parameters.AddWithValue("@i", intentos);
            upd.Parameters.AddWithValue("@b", (object?)nuevoBloqueo ?? DBNull.Value);
            upd.Parameters.AddWithValue("@id", usuarioId);
            await upd.ExecuteNonQueryAsync();

            return Unauthorized(new { message = "Credenciales inválidas" });
        }

        var reset = new SqlCommand("UPDATE USUARIOS SET intentos_fallidos=0, bloqueado_hasta=NULL WHERE id=@id", conn);
        reset.Parameters.AddWithValue("@id", usuarioId);
        await reset.ExecuteNonQueryAsync();

        var token = _tokenService.GenerarToken(usuarioId, request.Email, rol, tiendaId);

        return Ok(new { token, rol, tiendaId });
    }
}