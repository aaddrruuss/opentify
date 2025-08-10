import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "path";
import { setupIpcHandlers } from "./ipcHandlers";

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false, // Permitir cargar archivos locales
    },
    // Configuraciones específicas para Windows
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
  });

  // Configurar CSP más permisiva para imágenes externas
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": [
          "default-src 'self' data: blob: file:; script-src 'self'; style-src 'self' 'unsafe-inline'; media-src 'self' data: blob: file: *.googlevideo.com; img-src 'self' data: blob: https: *.youtube.com *.ytimg.com *.googleapis.com via.placeholder.com;",
        ],
      },
    });
  });

  // Permitir cargar archivos locales
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({});
  });

  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // En desarrollo, abrir DevTools
  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.on("ready", () => {
  createWindow();
  setupIpcHandlers();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});
