using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/alertas")]
[EnableCors("PermitirReact")]
public class AlertasController : ControllerBase
{
    [HttpGet]
    public IActionResult GetAlertas()
    {
        // Devuelve las alertas activas
        return Ok(new List<object>());
    }
}