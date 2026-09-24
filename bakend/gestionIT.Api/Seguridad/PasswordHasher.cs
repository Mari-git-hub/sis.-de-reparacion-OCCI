using System.Security.Cryptography;
using System.Text;
using Konscious.Security.Cryptography;

namespace GestionIT.Api.Seguridad;

public static class PasswordHasher


{
    // Convierte una contraseña en texto plano en un hash seguro (Argon2id).
    // Devuelve un solo texto que contiene la "sal" (salt) + el hash, separados por ":".
    public static string Hash(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16); // 16 bytes aleatorios, únicos por usuario

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = 4,
            Iterations = 4,
            MemorySize = 65536 // 64 MB
        };

        var hash = argon2.GetBytes(32);
        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    // Verifica si una contraseña escrita coincide con el hash guardado, sin descifrarlo.
    public static bool Verify(string password, string stored)
    {
        var partes = stored.Split(':');
        var salt = Convert.FromBase64String(partes[0]);
        var hashEsperado = Convert.FromBase64String(partes[1]);

        using var argon2 = new Argon2id(Encoding.UTF8.GetBytes(password))
        {
            Salt = salt,
            DegreeOfParallelism = 4,
            Iterations = 4,
            MemorySize = 65536
        };

        var hashCalculado = argon2.GetBytes(32);
        return CryptographicOperations.FixedTimeEquals(hashCalculado, hashEsperado);
    }
}