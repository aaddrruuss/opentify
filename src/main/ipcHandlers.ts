import { app, ipcMain } from "electron";
import path from "path";
import fs from "fs";
import { YouTube } from "youtube-sr";
import YtDlpWrap from "yt-dlp-wrap";

// Ruta específica para el binario yt-dlp basada en la plataforma
const getBinaryPath = () => {
  const isWindows = process.platform === "win32";
  const binaryName = isWindows ? "yt-dlp.exe" : "yt-dlp";
  return path.join(app.getPath("userData"), "bin", binaryName);
};

// Directorio para el cache de canciones
const getSongsDirectory = () => {
  return path.join(app.getPath("userData"), "adrus-music", "songs");
};

// Directorio para las configuraciones
const getSettingsDirectory = () => {
  return path.join(app.getPath("userData"), "adrus-music");
};

// Ruta del archivo de configuraciones
const getSettingsFilePath = () => {
  return path.join(getSettingsDirectory(), "settings.json");
};

const ytdlpPath = getBinaryPath();
const songsDir = getSongsDirectory();

console.log("yt-dlp path:", ytdlpPath);
console.log("Songs cache directory:", songsDir);

// Función para asegurar que el directorio del binario existe
function ensureBinaryDirExists() {
  const binaryDir = path.dirname(ytdlpPath);
  if (!fs.existsSync(binaryDir)) {
    fs.mkdirSync(binaryDir, { recursive: true });
  }
}

// Función para asegurar que el directorio de canciones existe
function ensureSongsDirExists() {
  if (!fs.existsSync(songsDir)) {
    fs.mkdirSync(songsDir, { recursive: true });
    console.log("Directorio de canciones creado:", songsDir);
  }
}

// Función para limpiar el nombre del archivo (remover caracteres no válidos)
function sanitizeFileName(fileName: string): string {
  // Remover caracteres no válidos para nombres de archivo en Windows
  return fileName.replace(/[<>:"/\\|?*]/g, "_").replace(/\s+/g, "_");
}

// Función para obtener la ruta del archivo de canción en cache
function getSongFilePath(videoId: string, title?: string): string {
  ensureSongsDirExists();
  
  // Si tenemos el título, crear un nombre más descriptivo
  if (title) {
    const sanitizedTitle = sanitizeFileName(title);
    return path.join(songsDir, `${videoId}_${sanitizedTitle.substring(0, 50)}.mp3`);
  }
  
  return path.join(songsDir, `${videoId}.mp3`);
}

// Función para verificar si una canción existe en cache
function isSongCached(videoId: string): string | null {
  ensureSongsDirExists();
  
  // Buscar archivos que empiecen con el videoId
  try {
    const files = fs.readdirSync(songsDir);
    const cachedFile = files.find(file => 
      file.startsWith(videoId) && file.endsWith('.mp3')
    );
    
    if (cachedFile) {
      const fullPath = path.join(songsDir, cachedFile);
      // Verificar que el archivo existe y tiene contenido
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).size > 0) {
        return fullPath;
      }
    }
  } catch (error) {
    console.error("Error checking song cache:", error);
  }
  
  return null;
}

// Función para descargar yt-dlp si no existe
async function downloadYtDlpIfNeeded() {
  ensureBinaryDirExists();

  // Comprobar si el binario ya existe
  if (fs.existsSync(ytdlpPath)) {
    console.log("yt-dlp ya está descargado en:", ytdlpPath);
    return ytdlpPath;
  }

  try {
    console.log("Descargando yt-dlp...");
    await YtDlpWrap.downloadFromGithub(ytdlpPath);
    console.log("yt-dlp descargado correctamente en:", ytdlpPath);

    // En Linux/Mac, asegurar que el binario tenga permisos de ejecución
    if (process.platform !== "win32") {
      fs.chmodSync(ytdlpPath, "755");
    }

    return ytdlpPath;
  } catch (error) {
    console.error("Error al descargar yt-dlp:", error);
    throw error;
  }
}

// Inicializar yt-dlp con una promesa para asegurar que esté listo
let ytDlpWrapInstance: YtDlpWrap | null = null;
const ytdlpReadyPromise = downloadYtDlpIfNeeded()
  .then((binaryPath) => {
    ytDlpWrapInstance = new YtDlpWrap(binaryPath);
    console.log("YtDlpWrap inicializado correctamente");
    return ytDlpWrapInstance;
  })
  .catch((err) => {
    console.error("No se pudo inicializar YtDlpWrap:", err);
    throw err;
  });

// Configuraciones por defecto
const defaultSettings = {
  volume: 80,
  isMuted: false,
  repeatMode: "off", // "off" | "all" | "one"
  isShuffle: false,
  isDarkMode: false,
  lastPlayedTrack: null,
  lastPlayedPosition: 0,
  lastPlayedTime: null
};

// Función para asegurar que el directorio de configuraciones existe
function ensureSettingsDirectoryExists() {
  const settingsDir = getSettingsDirectory();
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
    console.log("Directorio de configuraciones creado:", settingsDir);
  }
}

// Función para cargar configuraciones
function loadSettings() {
  ensureSettingsDirectoryExists();
  const settingsPath = getSettingsFilePath();
  
  try {
    if (fs.existsSync(settingsPath)) {
      const settingsData = fs.readFileSync(settingsPath, 'utf8');
      const settings = JSON.parse(settingsData);
      
      // Combinar con configuraciones por defecto para asegurar que todas las propiedades existen
      const mergedSettings = { ...defaultSettings, ...settings };
      console.log("Configuraciones cargadas:", mergedSettings);
      return mergedSettings;
    }
  } catch (error) {
    console.error("Error cargando configuraciones:", error);
  }
  
  // Si no se pueden cargar las configuraciones, devolver las por defecto
  console.log("Usando configuraciones por defecto:", defaultSettings);
  return defaultSettings;
}

// Función para guardar configuraciones
function saveSettings(settings: typeof defaultSettings) {
  ensureSettingsDirectoryExists();
  const settingsPath = getSettingsFilePath();
  
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2), 'utf8');
    console.log("Configuraciones guardadas:", settings);
  } catch (error) {
    console.error("Error guardando configuraciones:", error);
  }
}

export function setupIpcHandlers() {
  ipcMain.handle("search-music", async (event, query: string) => {
    try {
      const videos = await YouTube.search(query, {
        limit: 50, // Buscar más resultados para poder filtrar
        type: "video",
      });

      // Filtrar videos por duración (menos de 15 minutos = 900 segundos)
      const filteredVideos = videos.filter((video) => {
        const durationInMilliseconds = video.duration;
        
        // Si no hay duración disponible, incluir el video
        if (!durationInMilliseconds || durationInMilliseconds === 0) {
          console.log(`Video sin duración específica incluido: "${video.title}"`);
          return true;
        }
        
        // Convertir millisegundos a segundos
        const durationInSeconds = Math.floor(durationInMilliseconds / 1000);
        
        // Filtrar videos que duren más de 15 minutos (900 segundos)
        if (durationInSeconds > 900) {
          console.log(`Video filtrado por duración: "${video.title}" - ${video.durationFormatted} (${durationInSeconds}s)`);
          return false;
        }
        
        console.log(`Video incluido: "${video.title}" - ${video.durationFormatted} (${durationInSeconds}s)`);
        return true;
      }).slice(0, 20); // Limitar a 20 resultados después del filtrado

      console.log(`Búsqueda: "${query}" - ${videos.length} resultados encontrados, ${filteredVideos.length} después del filtrado por duración`);

      return filteredVideos.map((video) => {
        // Construir URLs de thumbnail más confiables
        const videoId = video.id!;
        const thumbnailOptions = [
          `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/default.jpg`
        ];

        const result = {
          id: videoId,
          title: video.title!,
          artist: video.channel?.name || "Unknown Artist",
          duration: video.durationFormatted || "0:00",
          thumbnail: thumbnailOptions[1], // Usar hqdefault como predeterminado
          cover: thumbnailOptions[1] // También asignar a cover para compatibilidad
        };

        console.log("Canción procesada:", {
          id: result.id,
          title: result.title,
          duration: result.duration,
          artist: result.artist,
          cached: isSongCached(result.id) !== null // Indicar si está en cache
        });

        return result;
      });
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  });

  // Handler para verificar si una canción está en cache sin descargarla
  ipcMain.handle("check-song-cache", async (event, videoId: string) => {
    try {
      const cachedPath = isSongCached(videoId);
      return {
        cached: cachedPath !== null,
        path: cachedPath
      };
    } catch (error) {
      console.error("Error checking cache:", error);
      return {
        cached: false,
        path: null
      };
    }
  });

  // Modificar el handler existente para optimizar velocidad de descarga
  ipcMain.handle("get-song-path", async (event, videoId: string, title?: string, preload: boolean = false) => {
    try {
      // Primero verificar si la canción ya está en cache
      const cachedPath = isSongCached(videoId);
      if (cachedPath) {
        if (!preload) {
          console.log("Canción encontrada en cache:", cachedPath);
        }
        return cachedPath;
      }

      // Si no está en cache, descargarla
      if (!preload) {
        console.log("Canción no encontrada en cache, descargando:", videoId);
      } else {
        console.log("Precargando canción:", title || videoId);
      }

      // Esperar a que yt-dlp esté listo antes de continuar
      await ytdlpReadyPromise;

      if (!ytDlpWrapInstance) {
        throw new Error("YtDlpWrap no está inicializado");
      }

      // Crear la ruta de destino en el directorio de canciones
      const finalSongPath = getSongFilePath(videoId, title);
      const tempPath = path.join(songsDir, `${videoId}_temp.%(ext)s`);

      if (!preload) {
        console.log("Descargando canción a:", finalSongPath);
      }

      // Configuración optimizada para descarga más rápida
      const args = [
        `https://www.youtube.com/watch?v=${videoId}`,
        "-f", "bestaudio[ext=m4a]/bestaudio/best", // Priorizar m4a que es más rápido
        "-o", tempPath,
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "5", // Calidad más baja para velocidad (0=mejor, 9=peor)
        "--no-playlist",
        "--no-warnings",
        "--concurrent-fragments", "4", // Descargas paralelas
        "--retries", "3", // Reintentos en caso de error
        "--fragment-retries", "3"
      ];

      // En Windows y para preload, optimizaciones adicionales
      if (process.platform === "win32") {
        args.push("--no-check-certificates");
      }
      
      if (preload) {
        // Para precarga, usar menor calidad para velocidad
        args[args.findIndex(arg => arg === "--audio-quality") + 1] = "7";
      }

      const startTime = Date.now();
      await ytDlpWrapInstance.exec(args);
      const downloadTime = Date.now() - startTime;

      // Renombrar el archivo temporal al nombre final
      const tempMp3Path = path.join(songsDir, `${videoId}_temp.mp3`);
      if (fs.existsSync(tempMp3Path)) {
        fs.renameSync(tempMp3Path, finalSongPath);
        if (!preload) {
          console.log(`Canción descargada en ${downloadTime}ms:`, finalSongPath);
        } else {
          console.log(`Canción precargada en ${downloadTime}ms:`, title || videoId);
        }
        
        // Mostrar estadísticas del cache solo para descargas principales
        if (!preload) {
          try {
            const files = fs.readdirSync(songsDir);
            const mp3Files = files.filter(f => f.endsWith('.mp3'));
            console.log(`Cache de canciones: ${mp3Files.length} archivos`);
          } catch (error) {
            console.error("Error reading cache stats:", error);
          }
        }
        
        return finalSongPath;
      } else {
        throw new Error("El archivo no se creó correctamente");
      }
    } catch (error) {
      if (!preload) {
        console.error("Download error:", error);
      } else {
        console.error("Preload error:", error);
      }
      return null;
    }
  });

  // Handler para cargar configuraciones
  ipcMain.handle("load-settings", async () => {
    try {
      return loadSettings();
    } catch (error) {
      console.error("Error loading settings:", error);
      return defaultSettings;
    }
  });

  // Handler para guardar configuraciones
  ipcMain.handle("save-settings", async (event, settings) => {
    try {
      saveSettings(settings);
      return true;
    } catch (error) {
      console.error("Error saving settings:", error);
      return false;
    }
  });
}
