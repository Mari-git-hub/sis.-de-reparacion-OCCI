const { app, BrowserWindow } = require("electron");
const path = require("path");

function crearVentanaPrincipal() {
  const ventana = new BrowserWindow({
    width: 1366,
    height: 768, // resolución mínima exigida
    minWidth: 1366,
    minHeight: 768,
    title: "Sistema de Gestión TI - Multi-Tienda",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true, // Seguridad: aísla el contexto de Node del contexto web
      nodeIntegration: false, // Seguridad: el renderer no tiene acceso directo a Node
    },
  });

  // Si está empaquetado carga el build de producción; si no, carga Vite en desarrollo
  const port = process.env.VITE_PORT || 5173;
  const url = app.isPackaged
    ? `file://${path.join(__dirname, "../dist/index.html")}`
    : `http://localhost:${port}`;

  ventana.loadURL(url);
}

// Inicialización de la aplicación
app.whenReady().then(crearVentanaPrincipal);

// Gestión del cierre de ventanas
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    crearVentanaPrincipal();
  }
});