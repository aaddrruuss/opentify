import { app, BrowserWindow, ipcMain, session, shell } from "electron";
import path from "path";
import { setupIpcHandlers } from './ipcHandlers';
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

  // FIXED: Asegurar que los handlers se registren correctamente
  console.log("🔧 Registrando handlers de IPC...");
  
  try {
    setupIpcHandlers();
    console.log("✅ Handlers básicos registrados");
    
    // NUEVO: Configurar calidad de audio desde las configuraciones guardadas
    setTimeout(async () => {
      try {
        const { loadSettings } = require('./ipcHandlers');
        const settings = loadSettings();
        if (settings.audioQuality) {
          // Configurar la calidad de audio desde las configuraciones guardadas
          mainWindow?.webContents.send('set-initial-audio-quality', settings.audioQuality);
          console.log(`🎵 Calidad de audio inicial configurada: ${settings.audioQuality}`);
        }
      } catch (error) {
        console.error("Error configurando calidad inicial:", error);
      }
    }, 1000);
    
  } catch (error) {
    console.error("❌ Error registrando handlers básicos:", error);
  }

  try {
    setupImportManagerHandlers();
    console.log("✅ Handlers de import manager registrados");
  } catch (error) {
    console.error("❌ Error registrando handlers de import manager:", error);
  }

  // Configurar el import manager con la ventana principal
  importManager.setMainWindow(mainWindow);

  // Handler para abrir enlaces externos en el navegador predeterminado
  ipcMain.handle('open-external-link', async (event, url) => {
    try {
      await shell.openExternal(url);
      console.log(`🔗 Abriendo enlace externo: ${url}`);
      return { success: true };
    } catch (error) {
      console.error('Error abriendo enlace externo:', error);
      return { success: false, error: typeof error === 'object' && error !== null && 'message' in error ? (error as { message: string }).message : String(error) };
    }
  });

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
