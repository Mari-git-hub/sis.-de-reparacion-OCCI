using Microsoft.AspNetCore.Cors;
using Microsoft.AspNetCore.Mvc;

namespace gestionIT.Api.Controllers;

[ApiController]
[Route("api/v1/formatos")]
[EnableCors("PermitirReact")]
public class FormatosController : ControllerBase
{
    [HttpGet("reparaciones")]
    public IActionResult GetReparaciones()
    {
        // Devuelve una lista de órdenes o un arreglo vacío temporalmente
        return Ok(new List<object>());
    }
}