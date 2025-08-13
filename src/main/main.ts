import { app, BrowserWindow, ipcMain, session, shell, Tray, Menu, nativeImage } from "electron";
import path from "path";
import fs from "fs";
import { setupIpcHandlers } from './ipcHandlers';
import { setupImportManagerHandlers, importManager } from './importManager';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuiting = false;

// NUEVO: Configurar switches para evitar suspensión en background ANTES de app.whenReady
app.commandLine.appendSwitch('disable-background-timer-throttling');
app.commandLine.appendSwitch('disable-backgrounding-occluded-windows');
app.commandLine.appendSwitch('disable-renderer-backgrounding');

function createTray() {
  const iconPath = path.join(__dirname, "../icon.png");
  
  // Crear el ícono para el tray
  let trayIcon;
  if (fs.existsSync(iconPath)) {
    trayIcon = nativeImage.createFromPath(iconPath);
    // Redimensionar el ícono para el tray (16x16 en Windows)
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } else {
    // Crear un ícono simple si no se encuentra el archivo
    trayIcon = nativeImage.createFromNamedImage('NSComputer', [16, 16]);
  }
  
  tray = new Tray(trayIcon);
  
  // Crear el menú contextual del tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Opentify',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: 'Mostrar',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          // ARREGLADO: Resetear isQuiting cuando se muestra la ventana desde el menú
          isQuiting = false;
        }
      }
    },
    {
      label: 'Ocultar',
      click: () => {
        if (mainWindow) {
          mainWindow.hide();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Salir',
      click: () => {
        isQuiting = true;
        app.quit();
      }
    }
  ]);
  
  tray.setContextMenu(contextMenu);
  tray.setToolTip('Opentify');
  
  // Hacer clic en el tray para mostrar/ocultar la ventana
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
        // ARREGLADO: Resetear isQuiting cuando se muestra la ventana desde el tray
        isQuiting = false;
      }
    }
  });
  
  console.log('✅ System tray created');
}

function createWindow() {
  const iconPath = path.join(__dirname, "../icon.png");
  console.log("🎨 Loading app icon from:", iconPath);
  
  // Verificar si el icono existe
  if (fs.existsSync(iconPath)) {
    console.log("✅ Icon file found");
  } else {
    console.error("❌ Icon file not found at:", iconPath);
    // Intentar rutas alternativas
    const altPaths = [
      path.join(__dirname, "../../assets/images/icon.png"),
      path.join(__dirname, "../../../assets/images/icon.png"),
      path.join(process.cwd(), "assets/images/icon.png"),
    ];
    
    for (const altPath of altPaths) {
      if (fs.existsSync(altPath)) {
        console.log("✅ Found alternative icon at:", altPath);
        // Copiar el icono a la ubicación esperada
        try {
          fs.copyFileSync(altPath, iconPath);
          console.log("✅ Icon copied to expected location");
        } catch (error) {
          console.error("❌ Error copying icon:", error);
        }
        break;
      }
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"), // Esto debería seguir como .js ya que TypeScript se compila a .js
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
      // Optimizaciones de rendimiento para tray
      backgroundThrottling: false, // Evitar throttling en background
      experimentalFeatures: false,
      // NUEVO: Permitir que el audio continúe cuando está oculto
      // paintWhenInitiallyHidden: true, // Removed: not a valid WebPreferences property
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

  // ARREGLADO: Resetear isQuiting cuando la ventana se muestra
  mainWindow.on('show', () => {
    isQuiting = false;
    console.log('🔄 Window shown, reset isQuiting to false');
  });

  // Optimizar garbage collection
  mainWindow.webContents.on('dom-ready', () => {
    // Forzar garbage collection después de cargar
    if (global.gc) {
      global.gc();
    }
  });

  // Manejar el evento de cierre
  mainWindow.on('close', (event) => {
    try {
      // Cargar configuraciones para verificar si minimizar a tray está habilitado
      const ipcHandlers = require('./ipcHandlers');
      if (ipcHandlers && typeof ipcHandlers.loadSettings === 'function') {
        const settings = ipcHandlers.loadSettings();
        
        if (settings && settings.minimizeToTray && !isQuiting) {
          // Si minimize to tray está habilitado, prevenir el cierre y ocultar
          event.preventDefault();
          mainWindow?.hide();
          console.log('🔽 Window minimized to tray');
        } else if (!isQuiting) {
          // Si minimize to tray está deshabilitado, realmente cerrar la aplicación
          console.log('🚪 Closing application (minimize to tray disabled)');
          isQuiting = true;
          // Destruir el tray para que no quede el icono
          if (tray) {
            tray.destroy();
            tray = null;
          }
          app.quit();
        }
      }
    } catch (error) {
      console.error('❌ Error checking minimize to tray setting:', error);
      // En caso de error, cerrar la aplicación normalmente
      if (!isQuiting) {
        isQuiting = true;
        if (tray) {
          tray.destroy();
          tray = null;
        }
        app.quit();
      }
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
  app.setAppUserModelId('com.adrus.opentify');
  
  createWindow();
  createTray(); // Crear el system tray
  
  // Verificar si se inició con --hidden
  if (process.argv.includes('--hidden')) {
    console.log('🔽 Starting minimized to tray');
    if (mainWindow) {
      mainWindow.hide();
    }
  }
});

app.on("before-quit", () => {
  isQuiting = true;
  console.log("App closing - settings should be saved automatically");
});

app.on("window-all-closed", () => {
  // En macOS es común que las apps permanezcan activas incluso cuando todas las ventanas estén cerradas
  // En otros sistemas, solo salir si no tenemos tray o si está marcado para salir
  if (process.platform !== "darwin" && isQuiting) {
    app.quit();
  } else if (!isQuiting) {
    // NUEVO: Si no estamos saliendo realmente, mantener la app activa para reproducir música
    console.log('🎵 App continues running in background for music playback');
  }
});

app.on("activate", () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Limpieza de memoria cada 10 minutos en desarrollo - deshuso
if (process.env.NODE_ENV === 'development') {
  setInterval(() => {
    if (global.gc) {
      global.gc();
      console.log('🧹 Garbage collection ejecutado');
    }
  }, 10 * 60 * 1000);
}
