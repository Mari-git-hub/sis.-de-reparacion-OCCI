using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace GestionIT.Api.Seguridad;

public class TokenService
{
    private readonly IConfiguration _config;

    public TokenService(IConfiguration config)
    {
        _config = config;
    }

    public string GenerarToken(int usuarioId, string email, string rol, int? tiendaId)
    {
        return GenerarToken(usuarioId, email, rol, tiendaId, _config);
    }

    public string GenerarToken(int usuarioId, string email, string rol, int? tiendaId, IConfiguration _config1)
    {
        var claims = new List<Claim>();
        claims.Add(new Claim(JwtRegisteredClaimNames.Sub, usuarioId.ToString()));
        claims.Add(new Claim(ClaimTypes.Email, email));
        claims.Add(new Claim(ClaimTypes.Role, rol));

        if (tiendaId.HasValue)
        {
            claims.Add(new Claim("tienda_id", tiendaId.Value.ToString()));
        }

        string clave = _config["Jwt:Key"];
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(clave));
        var credenciales = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        string emisor = _config["Jwt:Issuer"];
        string audiencia = _config1["Jwt:Audience"];
        DateTime expira = DateTime.UtcNow.AddMinutes(60);

        var token = new JwtSecurityToken(emisor, audiencia, claims, null, expira, credenciales);

        var handler = new JwtSecurityTokenHandler();
        string tokenTexto = handler.WriteToken(token);

        return tokenTexto;
    }
}