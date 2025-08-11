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

// Directorio para las playlists
const getPlaylistsDirectory = () => {
  return path.join(app.getPath("userData"), "adrus-music", "playlists");
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

// Función para asegurar que el directorio de configuraciones existe
function ensureSettingsDirectoryExists() {
  const settingsDir = getSettingsDirectory();
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
    console.log("Directorio de configuraciones creado:", settingsDir);
  }
}

// Función para asegurar que el directorio de playlists existe
function ensurePlaylistsDirExists() {
  const playlistsDir = getPlaylistsDirectory();
  if (!fs.existsSync(playlistsDir)) {
    fs.mkdirSync(playlistsDir, { recursive: true });
    console.log("Directorio de playlists creado:", playlistsDir);
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

// Queue para manejar descargas concurrentes y evitar conflictos
interface DownloadRequest {
  videoId: string;
  title?: string;
  preload: boolean;
  resolve: (path: string | null) => void;
  reject: (error: Error) => void;
}

class DownloadManager {
  private activeDownloads = new Map<string, Promise<string | null>>();
  private downloadQueue: DownloadRequest[] = [];
  private maxConcurrentDownloads = 2;
  private activeCount = 0;

  async queueDownload(videoId: string, title?: string, preload: boolean = false): Promise<string | null> {
    // Si ya hay una descarga activa para este video, esperar a que termine
    if (this.activeDownloads.has(videoId)) {
      console.log(`Download already in progress for ${videoId}, waiting...`);
      return this.activeDownloads.get(videoId)!;
    }

    // Crear promesa para esta descarga
    const downloadPromise = new Promise<string | null>((resolve, reject) => {
      const request: DownloadRequest = { videoId, title, preload, resolve, reject };
      
      if (this.activeCount < this.maxConcurrentDownloads) {
        this.processDownload(request);
      } else {
        this.downloadQueue.push(request);
        if (!preload) {
          console.log(`Download queued for ${title || videoId} (queue length: ${this.downloadQueue.length})`);
        }
      }
    });

    this.activeDownloads.set(videoId, downloadPromise);
    return downloadPromise;
  }

  private async processDownload(request: DownloadRequest) {
    this.activeCount++;
    const { videoId, title, preload, resolve, reject } = request;

    try {
      const result = await this.performDownload(videoId, title, preload);
      resolve(result);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.activeCount--;
      this.activeDownloads.delete(videoId);
      
      // Procesar siguiente en la queue
      if (this.downloadQueue.length > 0) {
        const nextRequest = this.downloadQueue.shift()!;
        this.processDownload(nextRequest);
      }
    }
  }

  private async performDownload(videoId: string, title?: string, preload: boolean = false): Promise<string | null> {
    try {
      // Verificar cache primero
      const cachedPath = isSongCached(videoId);
      if (cachedPath) {
        if (!preload) {
          console.log("📂 Cache hit:", path.basename(cachedPath));
        }
        return cachedPath;
      }

      if (!preload) {
        console.log("🔄 INICIANDO DESCARGA:", title || videoId);
      }

      await ytdlpReadyPromise;

      if (!ytDlpWrapInstance) {
        throw new Error("YtDlpWrap no está inicializado");
      }

      const timestamp = Date.now();
      const finalSongPath = getSongFilePath(videoId, title);
      const tempPath = path.join(songsDir, `${videoId}_${timestamp}_temp.%(ext)s`);

      const args = [
        `https://www.youtube.com/watch?v=${videoId}`,
        "-f", "bestaudio[ext=m4a]/bestaudio/best",
        "-o", tempPath,
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", preload ? "7" : "5",
        "--no-playlist",
        "--no-warnings",
        "--concurrent-fragments", "2",
        "--retries", "3",
        "--fragment-retries", "3",
        "--no-continue",
        "--no-part"
      ];

      if (process.platform === "win32") {
        args.push("--no-check-certificates");
      }

      const startTime = Date.now();
      
      if (!preload) {
        console.log("🚀 Ejecutando yt-dlp...");
      }
      
      // ESPERAR que el proceso termine COMPLETAMENTE
      await ytDlpWrapInstance.exec(args);
      
      const downloadTime = Date.now() - startTime;
      
      if (!preload) {
        console.log(`⏳ Proceso yt-dlp terminado en ${downloadTime}ms`);
      }

      // Buscar archivo descargado
      const tempMp3Path = path.join(songsDir, `${videoId}_${timestamp}_temp.mp3`);
      
      // Esperar un momento adicional para asegurar escritura completa
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (fs.existsSync(tempMp3Path)) {
        const stats = fs.statSync(tempMp3Path);
        const fileSizeKB = stats.size / 1024;
        
        if (!preload) {
          console.log(`📁 Archivo: ${fileSizeKB.toFixed(2)}KB`);
        }
        
        // Validar tamaño mínimo
        if (stats.size < 100 * 1024) {
          console.warn(`⚠️ Archivo pequeño (${fileSizeKB}KB), esperando más...`);
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          if (fs.existsSync(tempMp3Path)) {
            const newStats = fs.statSync(tempMp3Path);
            if (!preload) {
              console.log(`📁 Tamaño final: ${(newStats.size / 1024).toFixed(2)}KB`);
            }
          }
        }
        
        // Verificar archivo final existente
        if (fs.existsSync(finalSongPath)) {
          try {
            fs.unlinkSync(tempMp3Path);
          } catch (err) {
            // Ignorar error
          }
          if (!preload) {
            console.log("📂 Usando existente:", path.basename(finalSongPath));
          }
          return finalSongPath;
        }

        // Mover archivo temporal al final
        try {
          fs.renameSync(tempMp3Path, finalSongPath);
          
          const finalStats = fs.statSync(finalSongPath);
          if (!preload) {
            console.log(`✅ DESCARGA COMPLETADA: ${path.basename(finalSongPath)} (${(finalStats.size / 1024).toFixed(2)}KB en ${downloadTime}ms)`);
          }
          
          return finalSongPath;
        } catch (moveError) {
          console.error("❌ Error moviendo:", moveError);
          throw new Error("No se pudo finalizar la descarga");
        }
      } else {
        throw new Error("❌ Archivo no creado después de descarga");
      }

    } catch (error) {
      this.cleanupTempFiles(videoId);
      if (!preload) {
        console.error("❌ Error descargando:", error);
      }
      throw error;
    }
  }

  // Mejorar cleanup para incluir archivos con timestamp
  private cleanupTempFiles(videoId: string) {
    try {
      const files = fs.readdirSync(songsDir);
      const tempFiles = files.filter(file => 
        file.includes(videoId) && (
          file.includes('_temp') || 
          file.includes('.part') ||
          file.includes('.tmp') ||
          file.includes('.download')
        )
      );
      
      for (const tempFile of tempFiles) {
        const fullPath = path.join(songsDir, tempFile);
        try {
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
            console.log("Cleaned up temp file:", tempFile);
          }
        } catch (cleanupError) {
          console.warn("Could not cleanup temp file:", tempFile, cleanupError);
        }
      }
    } catch (error) {
      console.warn("Error during temp file cleanup:", error);
    }
  }

  // Método para limpiar archivos huérfanos al iniciar
  cleanupOrphanedFiles() {
    try {
      ensureSongsDirExists();
      const files = fs.readdirSync(songsDir);
      const tempFiles = files.filter(file => 
        file.includes('_temp') || file.includes('.part') || file.includes('.tmp')
      );
      
      for (const tempFile of tempFiles) {
        const fullPath = path.join(songsDir, tempFile);
        try {
          const stats = fs.statSync(fullPath);
          const now = Date.now();
          const fileAge = now - stats.mtime.getTime();
          
          // Eliminar archivos temporales de más de 1 hora
          if (fileAge > 3600000) {
            fs.unlinkSync(fullPath);
            console.log("Cleaned up old temp file:", tempFile);
          }
        } catch (error) {
          // Ignore individual file errors
        }
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
}

const downloadManager = new DownloadManager();

// Función para guardar una playlist
async function savePlaylist(playlistName: string, tracks: any[]): Promise<boolean> {
  try {
    ensurePlaylistsDirExists();
    const playlistDir = getPlaylistPath(playlistName);
    
    // Crear directorio para la playlist
    if (!fs.existsSync(playlistDir)) {
      fs.mkdirSync(playlistDir, { recursive: true });
    }
    
    // Guardar metadata de la playlist
    const playlistData = {
      name: playlistName,
      tracks: tracks,
      createdAt: new Date().toISOString(),
      totalTracks: tracks.length
    };
    
    const metadataPath = path.join(playlistDir, 'playlist.json');
    fs.writeFileSync(metadataPath, JSON.stringify(playlistData, null, 2), 'utf8');
    
    console.log(`Playlist "${playlistName}" guardada en:`, playlistDir);
    
    // Iniciar descarga de las canciones en background
    downloadPlaylistTracks(playlistName, tracks);
    
    return true;
  } catch (error) {
    console.error("Error guardando playlist:", error);
    return false;
  }
}

// Función para descargar las canciones de una playlist en background
async function downloadPlaylistTracks(playlistName: string, tracks: any[]) {
  console.log(`📥 Iniciando descarga de ${tracks.length} canciones para "${playlistName}"`);
  
  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    try {
      console.log(`📥 Descargando ${i + 1}/${tracks.length}: ${track.title}`);
      await downloadManager.queueDownload(track.id, track.title, true); // preload = true
      
      // Pequeño delay entre descargas
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error descargando ${track.title}:`, error);
    }
  }
  
  console.log(`✅ Descarga completada para playlist "${playlistName}"`);
}

// Función para obtener la ruta de una playlist
function getPlaylistPath(playlistName: string): string {
  const sanitizedName = sanitizeFileName(playlistName);
  return path.join(getPlaylistsDirectory(), sanitizedName);
}

// Función para cargar una playlist
async function loadPlaylist(playlistName: string): Promise<any[]> {
  try {
    const playlistDir = getPlaylistPath(playlistName);
    const metadataPath = path.join(playlistDir, 'playlist.json');
    
    if (!fs.existsSync(metadataPath)) {
      console.log(`Playlist "${playlistName}" no encontrada`);
      return [];
    }
    
    const playlistData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
    return playlistData.tracks || [];
  } catch (error) {
    console.error("Error cargando playlist:", error);
    return [];
  }
}

// Función para obtener lista de playlists
async function getPlaylists(): Promise<string[]> {
  try {
    ensurePlaylistsDirExists();
    const playlistsDir = getPlaylistsDirectory();
    const dirs = fs.readdirSync(playlistsDir, { withFileTypes: true });
    
    const playlists = [];
    for (const dir of dirs) {
      if (dir.isDirectory()) {
        const metadataPath = path.join(playlistsDir, dir.name, 'playlist.json');
        if (fs.existsSync(metadataPath)) {
          try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            playlists.push(metadata.name || dir.name);
          } catch (error) {
            console.error(`Error leyendo metadata de ${dir.name}:`, error);
          }
        }
      }
    }
    
    return playlists;
  } catch (error) {
    console.error("Error obteniendo playlists:", error);
    return [];
  }
}

// Función para eliminar una playlist
async function deletePlaylist(playlistName: string): Promise<boolean> {
  try {
    const playlistDir = getPlaylistPath(playlistName);
    
    if (fs.existsSync(playlistDir)) {
      // Eliminar directorio y todo su contenido
      fs.rmSync(playlistDir, { recursive: true, force: true });
      console.log(`Playlist "${playlistName}" eliminada`);
      return true;
    }
    
    return false;
  } catch (error) {
    console.error("Error eliminando playlist:", error);
    return false;
  }
}

export function setupIpcHandlers() {
  // Limpiar archivos huérfanos al iniciar
  downloadManager.cleanupOrphanedFiles();

  // Cache simple para búsquedas recientes
  const searchCache = new Map<string, any[]>();
  const maxCacheSize = 50;
  const cacheExpiration = 5 * 60 * 1000; // 5 minutos

  ipcMain.handle("search-music", async (event, query: string) => {
    try {
      // Verificar cache primero
      const cacheKey = query.toLowerCase().trim();
      const cachedResult = searchCache.get(cacheKey);
      
      if (cachedResult) {
        console.log(`Cache hit para: "${query}"`);
        return cachedResult;
      }

      console.log(`Buscando en YouTube: "${query}"`);
      
      // Usar timeout más robusto para búsquedas
      const searchPromise = YouTube.search(query, {
        limit: 30, // Reducir límite para búsquedas más rápidas
        type: "video",
      });
      
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('Search timeout')), 10000) // 10 segundos timeout
      );
      
      const videos = await Promise.race([searchPromise, timeoutPromise]);

      // Filtrar y procesar resultados
      const filteredVideos = videos.filter((video) => {
        const durationInMilliseconds = video.duration;
        
        if (!durationInMilliseconds || durationInMilliseconds === 0) {
          return true;
        }
        
        const durationInSeconds = Math.floor(durationInMilliseconds / 1000);
        return durationInSeconds <= 900; // 15 minutos max
      }).slice(0, 20);

      console.log(`Búsqueda: "${query}" - ${videos.length} encontrados, ${filteredVideos.length} después del filtrado`);

      const results = filteredVideos.map((video) => {
        const videoId = video.id!;
        const thumbnailOptions = [
          `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
          `https://img.youtube.com/vi/${videoId}/default.jpg`
        ];

        return {
          id: videoId,
          title: video.title!,
          artist: video.channel?.name || "Unknown Artist",
          duration: video.durationFormatted || "0:00",
          thumbnail: thumbnailOptions[0],
          cover: thumbnailOptions[0]
        };
      });

      // Guardar en cache
      if (searchCache.size >= maxCacheSize) {
        // Remover el más antiguo
        const firstKey = searchCache.keys().next().value;
        if (firstKey) {
          searchCache.delete(firstKey);
        }
      }
      searchCache.set(cacheKey, results);

      // Limpiar cache expirado después de un tiempo
      setTimeout(() => {
        searchCache.delete(cacheKey);
      }, cacheExpiration);

      return results;
    } catch (error) {
      console.error("Search error:", error);
      
      // Retornar array vacío en lugar de lanzar error para no romper el proceso
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

  // Handler mejorado para descargas con queue management
  ipcMain.handle("get-song-path", async (event, videoId: string, title?: string, preload: boolean = false) => {
    try {
      // Verificar cache primero
      const cachedPath = isSongCached(videoId);
      if (cachedPath) {
        return cachedPath;
      }

      // Usar el download manager para evitar conflictos
      return await downloadManager.queueDownload(videoId, title, preload);

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (!preload) {
        console.error("Download error:", errorMessage);
      }
      
      // No lanzar error para preload, solo retornar null
      if (preload) {
        return null;
      }
      
      // Para descargas principales, intentar una vez más después de un breve delay
      try {
        await new Promise(resolve => setTimeout(resolve, 1000));
        return await downloadManager.queueDownload(videoId, title, preload);
      } catch (retryError) {
        console.error("Retry failed:", retryError);
        return null;
      }
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

  // Handlers para playlists
  ipcMain.handle("save-playlist", async (event, playlistName: string, tracks: any[]) => {
    return await savePlaylist(playlistName, tracks);
  });

  ipcMain.handle("load-playlist", async (event, playlistName: string) => {
    return await loadPlaylist(playlistName);
  });

  ipcMain.handle("get-playlists", async () => {
    return await getPlaylists();
  });

  ipcMain.handle("delete-playlist", async (event, playlistName: string) => {
    return await deletePlaylist(playlistName);
  });
}
