import { app, BrowserWindow, ipcMain, session } from "electron";
import path from "path";
import { setupIpcHandlers } from "./ipcHandlers";
import { setupImportManagerHandlers, importManager } from './importManager';

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.join(__dirname, "../../assets/images/icon.png"),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Esto debería seguir como .js ya que TypeScript se compila a .js
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      // Optimizaciones de rendimiento
      backgroundThrottling: false, // Evitar throttling en background
      experimentalFeatures: false,
    },
    show: false, // No mostrar hasta que esté listo
  });

  // Configurar CSP optimizada
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

  // Optimización de memoria
  session.defaultSession.webRequest.onBeforeRequest((details, callback) => {
    callback({});
  });

  mainWindow.loadFile(path.join(__dirname, "../index.html"));

  // Configurar import manager con la ventana
  importManager.setMainWindow(mainWindow);

  // Mostrar ventana solo cuando esté lista
  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
    
    // Focus automático
    if (process.env.NODE_ENV === 'development') {
      mainWindow?.webContents.openDevTools();
    }
  });

  // Optimizar garbage collection
  mainWindow.webContents.on('dom-ready', () => {
    // Forzar garbage collection después de cargar
    if (global.gc) {
      global.gc();
    }
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
    // Limpiar memoria
    if (global.gc) {
      global.gc();
    }
  });
}

app.whenReady().then(() => {
  // Configuraciones de rendimiento de la app
  app.setAppUserModelId('com.yourname.musicplayer');
  
  createWindow();
  setupIpcHandlers();
  setupImportManagerHandlers(); // Agregar esta línea
});

app.on("before-quit", () => {
  console.log("App closing - settings should be saved automatically");
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

// Limpieza de memoria cada 10 minutos en desarrollo
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (global.gc) {
      global.gc();
      console.log('🧹 Garbage collection ejecutado');
    }
  }, 10 * 60 * 1000);
}
