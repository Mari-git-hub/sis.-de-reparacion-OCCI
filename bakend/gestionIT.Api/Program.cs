using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Base de datos SQL Server con reintentos automáticos
builder.Services.AddDbContext<DbContext>(options =>
    options.UseSqlServer(
        builder.Configuration.GetConnectionString("Default"),
        sqlOptions => sqlOptions.EnableRetryOnFailure(3)
    ));

// 2. Controladores
builder.Services.AddControllers();

// 3. Autenticación JWT
var jwtKey = builder.Configuration["Jwt:Key"] ?? "ClaveSecretaSuperSeguraParaDesarrollo12345!";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = builder.Configuration["Jwt:Issuer"],
            ValidAudience = builder.Configuration["Jwt:Audience"],
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

// 4. Políticas de Autorización
builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("AdminIT", policy => policy.RequireRole("Admin IT"));
    options.AddPolicy("TecnicoIT", policy => policy.RequireRole("Admin IT", "Técnico IT"));
});

builder.Services.AddScoped<GestionIT.Api.Seguridad.TokenService>();


// 5. Configuración de Swagger
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "Gestión TI API", Version = "v1" });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Ingrese el token JWT"
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new List<string>()
        }
    });
});

var app = builder.Build();

app.MapGet("/test-db", async () =>
{
    try
    {
        using var conn = new Microsoft.Data.SqlClient.SqlConnection(builder.Configuration.GetConnectionString("Default"));
        await conn.OpenAsync();
        var comando = new Microsoft.Data.SqlClient.SqlCommand("SELECT COUNT(*) FROM TIENDAS", conn);
        var totalTiendas = await comando.ExecuteScalarAsync();
        return Results.Ok($"¡Conexión exitosa! Tiendas registradas: {totalTiendas}");
    }
    catch (Exception ex)
    {
        return Results.Problem(ex.Message);
    }
});

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();