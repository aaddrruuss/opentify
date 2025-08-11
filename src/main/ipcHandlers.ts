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
  private maxConcurrentDownloads = 1;
  private activeCount = 0;
  private lastDownloadTime = 0;
  private minDelayBetweenDownloads = 1500; // Reducir delay

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
      const cachedPath = isSongCached(videoId);
      if (cachedPath) {
        if (!preload) {
          console.log("📂 Cache hit:", path.basename(cachedPath));
        }
        return cachedPath;
      }

      // Rate limiting más eficiente
      const now = Date.now();
      const timeSinceLastDownload = now - this.lastDownloadTime;
      if (timeSinceLastDownload < this.minDelayBetweenDownloads) {
        const waitTime = this.minDelayBetweenDownloads - timeSinceLastDownload;
        await new Promise(resolve => setTimeout(resolve, waitTime));
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

      // Argumentos optimizados para menor uso de recursos
      const args = [
        `https://www.youtube.com/watch?v=${videoId}`,
        "-f", "bestaudio[ext=m4a][filesize<50M]/bestaudio/best",
        "-o", tempPath,
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", preload ? "9" : "6",
        "--no-playlist",
        "--no-warnings",
        "--concurrent-fragments", "1",
        "--retries", "1",
        "--fragment-retries", "1",
        "--no-continue",
        "--no-part",
        "--socket-timeout", "20",
        "--user-agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "--sleep-interval", "0.5",
        "--max-sleep-interval", "2",
        "--buffer-size", "16K"
      ];

      if (process.platform === "win32") {
        args.push("--no-check-certificates");
      }

      const startTime = Date.now();
      this.lastDownloadTime = startTime;
      
      try {
        await ytDlpWrapInstance.exec(args);
      } catch (ytdlError) {
        const errorMsg = String(ytdlError);
        
        if (errorMsg.includes('403') || errorMsg.includes('Forbidden')) {
          console.warn("⚠️ Error HTTP 403, esperando...");
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          const retryArgs = [...args, "--sleep-requests", "1"];
          await ytDlpWrapInstance.exec(retryArgs);
        } else {
          throw ytdlError;
        }
      }
      
      const downloadTime = Date.now() - startTime;
      if (!preload) {
        console.log(`⏳ Descarga completada en ${downloadTime}ms`);
      }

      const tempMp3Path = path.join(songsDir, `${videoId}_${timestamp}_temp.mp3`);
      
      // Espera más corta
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (fs.existsSync(tempMp3Path)) {
        const stats = fs.statSync(tempMp3Path);
        const fileSizeKB = stats.size / 1024;
        
        // NUEVA VALIDACIÓN: Verificar duración si tenemos el título
        if (title) {
          // Intentar extraer duración estimada del contexto si está disponible
          // Por ahora, validar principalmente por tamaño
          const isValid = await validateDownloadedFile(tempMp3Path, 0); // Sin duración esperada por ahora
          
          if (!isValid) {
            console.warn(`❌ Archivo no válido para ${title}, eliminando`);
            try {
              fs.unlinkSync(tempMp3Path);
            } catch (err) {
              console.warn("Error eliminando archivo inválido:", err);
            }
            throw new Error("Archivo descargado no válido");
          }
        }
        
        if (stats.size < 30 * 1024) { // 30KB mínimo
          console.warn(`⚠️ Archivo muy pequeño (${fileSizeKB.toFixed(2)}KB), posible error`);
          // No lanzar error automáticamente, pero advertir
        }
        
        if (fs.existsSync(finalSongPath)) {
          try {
            fs.unlinkSync(tempMp3Path);
          } catch (err) {
            // Ignorar
          }
          
          // Validar el archivo final existente
          const finalIsValid = await validateDownloadedFile(finalSongPath, 0);
          if (finalIsValid) {
            return finalSongPath;
          } else {
            console.warn("Archivo final existente no es válido, reemplazando");
            try {
              fs.unlinkSync(finalSongPath);
            } catch (err) {
              console.warn("Error eliminando archivo final inválido:", err);
            }
          }
        }

        try {
          fs.renameSync(tempMp3Path, finalSongPath);
          
          // Validación final
          const finalValidation = await validateDownloadedFile(finalSongPath, 0);
          if (!finalValidation) {
            console.warn("⚠️ Archivo final no pasó validación, pero se mantiene");
          }
          
          if (!preload) {
            console.log(`✅ Descarga finalizada: ${path.basename(finalSongPath)} (${fileSizeKB.toFixed(2)}KB)`);
          }
          
          return finalSongPath;
        } catch (moveError) {
          console.error("❌ Error moviendo archivo:", moveError);
          throw new Error("No se pudo finalizar la descarga");
        }
      } else {
        throw new Error("❌ Archivo no creado");
      }

    } catch (error) {
      this.cleanupTempFiles(videoId);
      const errorMsg = String(error);
      
      if (!preload) {
        console.error("❌ Error descargando:", errorMsg);
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

// Función para descargar las canciones de una playlist en background - CORREGIDA
async function downloadPlaylistTracks(playlistName: string, tracks: any[]) {
  const playlistDir = getPlaylistPath(playlistName);
  const playlistSongsDir = path.join(playlistDir, 'songs');
  
  // Crear directorio de canciones de la playlist
  if (!fs.existsSync(playlistSongsDir)) {
    fs.mkdirSync(playlistSongsDir, { recursive: true });
  }
  
  console.log(`📥 Iniciando descarga optimizada de ${tracks.length} canciones para "${playlistName}"`);
  console.log(`📁 Directorio de destino: ${playlistSongsDir}`);
  
  // Configuración muy conservadora para playlist
  const batchSize = 1; // Una canción a la vez
  const batchDelay = 5000; // 5 segundos entre descargas
  
  for (let i = 0; i < tracks.length; i += batchSize) {
    const batch = tracks.slice(i, i + batchSize);
    
    for (const track of batch) {
      const globalIndex = i + batch.indexOf(track);
      
      try {
        console.log(`📥 Descargando ${globalIndex + 1}/${tracks.length}: ${track.title}`);
        
        // Crear nombre de archivo seguro para la playlist
        const sanitizedTitle = sanitizeFileName(track.title.substring(0, 30));
        const playlistSongPath = path.join(playlistSongsDir, `${track.id}_${sanitizedTitle}.mp3`);
        
        if (fs.existsSync(playlistSongPath)) {
          console.log(`✓ Ya existe en playlist: ${track.title}`);
          continue;
        }
        
        // CAMBIO PRINCIPAL: Descargar directamente al directorio de la playlist
        // en lugar de usar el cache global y luego copiar
        try {
          const tempSongPath = await downloadManager.queueDownload(track.id, track.title, true);
          
          if (tempSongPath && fs.existsSync(tempSongPath)) {
            // Copiar desde el cache global al directorio de la playlist
            fs.copyFileSync(tempSongPath, playlistSongPath);
            console.log(`✓ Copiada a playlist: ${track.title}`);
            
            // Verificar que se copió correctamente
            if (fs.existsSync(playlistSongPath)) {
              const stats = fs.statSync(playlistSongPath);
              console.log(`📊 Archivo copiado: ${(stats.size / 1024).toFixed(2)}KB en ${playlistSongPath}`);
            }
          } else {
            console.warn(`⚠️ No se pudo descargar ${track.title}`);
          }
        } catch (downloadError) {
          console.error(`❌ Error descargando ${track.title}:`, downloadError);
        }
        
      } catch (error) {
        console.error(`Error procesando ${track.title}:`, error);
      }
      
      // Delay entre cada canción individual
      await new Promise(resolve => setTimeout(resolve, batchDelay));
    }
  }
  
  // Verificar resultado final
  try {
    const finalFiles = fs.readdirSync(playlistSongsDir);
    console.log(`✅ Descarga completada para playlist "${playlistName}"`);
    console.log(`📊 Total de archivos en directorio: ${finalFiles.length}`);
  } catch (error) {
    console.error("Error verificando directorio final:", error);
  }
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

// Función para renombrar una playlist preservando todos los datos (mejorada)
async function renamePlaylist(oldName: string, newName: string): Promise<boolean> {
  try {
    const oldPlaylistDir = getPlaylistPath(oldName);
    const newPlaylistDir = getPlaylistPath(newName);
    
    if (!fs.existsSync(oldPlaylistDir)) {
      console.error(`Playlist "${oldName}" no existe`);
      return false;
    }
    
    if (fs.existsSync(newPlaylistDir)) {
      console.error(`Ya existe una playlist con el nombre "${newName}"`);
      return false;
    }
    
    console.log(`🔄 Renombrando playlist de "${oldName}" a "${newName}"`);
    console.log(`📁 Desde: ${oldPlaylistDir}`);
    console.log(`📁 Hacia: ${newPlaylistDir}`);
    
    // Verificar contenido antes del renombrado
    const beforeContents = fs.readdirSync(oldPlaylistDir);
    console.log(`📋 Contenido antes del renombrado:`, beforeContents);
    
    // Renombrar el directorio completo (preserva todo: canciones, imagen, metadata)
    fs.renameSync(oldPlaylistDir, newPlaylistDir);
    
    // Verificar que el renombrado fue exitoso
    if (!fs.existsSync(newPlaylistDir)) {
      throw new Error("El directorio no fue renombrado correctamente");
    }
    
    const afterContents = fs.readdirSync(newPlaylistDir);
    console.log(`📋 Contenido después del renombrado:`, afterContents);
    
    // Actualizar el metadata con el nuevo nombre
    const metadataPath = path.join(newPlaylistDir, 'playlist.json');
    if (fs.existsSync(metadataPath)) {
      const playlistData = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
      playlistData.name = newName;
      playlistData.updatedAt = new Date().toISOString();
      fs.writeFileSync(metadataPath, JSON.stringify(playlistData, null, 2), 'utf8');
      console.log(`📝 Metadata actualizado con nuevo nombre`);
    }
    
    // Verificar que la imagen se preservó
    const imagesDir = path.join(newPlaylistDir, 'images');
    if (fs.existsSync(imagesDir)) {
      const images = fs.readdirSync(imagesDir);
      console.log(`🖼️ Imágenes preservadas:`, images);
    }
    
    // Verificar que las canciones se preservaron
    const songsDir = path.join(newPlaylistDir, 'songs');
    if (fs.existsSync(songsDir)) {
      const songs = fs.readdirSync(songsDir);
      console.log(`🎵 Canciones preservadas: ${songs.length} archivos`);
    }
    
    console.log(`✅ Playlist renombrada exitosamente de "${oldName}" a "${newName}"`);
    return true;
  } catch (error) {
    console.error("❌ Error renombrando playlist:", error);
    
    // Intentar rollback si algo salió mal
    try {
      const oldPlaylistDir = getPlaylistPath(oldName);
      const newPlaylistDir = getPlaylistPath(newName);
      
      if (!fs.existsSync(oldPlaylistDir) && fs.existsSync(newPlaylistDir)) {
        console.log("🔄 Intentando rollback...");
        fs.renameSync(newPlaylistDir, oldPlaylistDir);
        console.log("✅ Rollback exitoso");
      }
    } catch (rollbackError) {
      console.error("❌ Error en rollback:", rollbackError);
    }
    
    return false;
  }
}

// Función para guardar imagen personalizada de playlist (mejorada)
async function savePlaylistImage(playlistName: string, imageData: string): Promise<boolean> {
  try {
    const playlistDir = getPlaylistPath(playlistName);
    
    if (!fs.existsSync(playlistDir)) {
      console.error(`Playlist "${playlistName}" no existe`);
      return false;
    }
    
    // Detectar el tipo de imagen desde el data URL
    const imageTypeMatch = imageData.match(/^data:image\/([a-z]+);base64,/);
    const imageType = imageTypeMatch ? imageTypeMatch[1] : 'jpg';
    const validExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    const extension = validExtensions.includes(imageType) ? imageType : 'jpg';
    
    // Convertir base64 a buffer
    const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Crear directorio de imágenes si no existe
    const imagesDir = path.join(playlistDir, 'images');
    if (!fs.existsSync(imagesDir)) {
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Eliminar imagen anterior si existe
    const existingImages = ['cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif', 'cover.webp'];
    for (const imageName of existingImages) {
      const imagePath = path.join(imagesDir, imageName);
      if (fs.existsSync(imagePath)) {
        fs.unlinkSync(imagePath);
        console.log(`🗑️ Imagen anterior eliminada: ${imageName}`);
      }
    }
    
    // Guardar nueva imagen con la extensión correcta
    const imagePath = path.join(imagesDir, `cover.${extension}`);
    fs.writeFileSync(imagePath, buffer);
    
    console.log(`✅ Imagen guardada para playlist "${playlistName}": cover.${extension}`);
    return true;
  } catch (error) {
    console.error("Error guardando imagen de playlist:", error);
    return false;
  }
}

// Función para cargar imagen personalizada de playlist (mejorada)
async function loadPlaylistImage(playlistName: string): Promise<string | null> {
  try {
    const playlistDir = getPlaylistPath(playlistName);
    const imagesDir = path.join(playlistDir, 'images');
    
    // Buscar cualquier archivo de imagen
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    for (const ext of imageExtensions) {
      const imagePath = path.join(imagesDir, `cover.${ext}`);
      if (fs.existsSync(imagePath)) {
        const buffer = fs.readFileSync(imagePath);
        const base64 = buffer.toString('base64');
        const mimeType = getMimeType(ext);
        return `data:${mimeType};base64,${base64}`;
      }
    }
    
    // Si no hay imagen personalizada, retornar null
    return null;
  } catch (error) {
    console.error("Error cargando imagen de playlist:", error);
    return null;
  }
}

// Función auxiliar para obtener el MIME type
function getMimeType(extension: string): string {
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp'
  };
  return mimeTypes[extension.toLowerCase()] || 'image/jpeg';
}

// Función para obtener la duración de un archivo de audio
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    // Usar ffprobe para obtener la duración exacta del archivo
    const { exec } = require('child_process');
    const util = require('util');
    const execAsync = util.promisify(exec);
    
    // Verificar si ffprobe está disponible
    try {
      await execAsync('ffprobe -version');
    } catch (error) {
      console.warn("ffprobe no disponible, usando estimación básica");
      return -1; // Indicar que no se puede verificar
    }
    
    const command = `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`;
    const { stdout } = await execAsync(command);
    const duration = parseFloat(stdout.trim());
    
    return isNaN(duration) ? -1 : duration;
  } catch (error) {
    console.warn("Error obteniendo duración del audio:", error);
    return -1;
  }
}

// Función para validar si un archivo está completamente descargado
async function validateDownloadedFile(filePath: string, expectedDurationMs: number): Promise<boolean> {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    
    const stats = fs.statSync(filePath);
    
    // Verificar tamaño mínimo (30KB)
    if (stats.size < 30 * 1024) {
      console.warn(`⚠️ Archivo muy pequeño: ${(stats.size / 1024).toFixed(2)}KB`);
      return false;
    }
    
    // Si no tenemos duración esperada, solo verificar tamaño
    if (expectedDurationMs <= 0) {
      return true;
    }
    
    // Obtener duración real del archivo
    const actualDurationSeconds = await getAudioDuration(filePath);
    
    if (actualDurationSeconds < 0) {
      // Si no se puede obtener la duración, aceptar si el tamaño es razonable
      console.warn("⚠️ No se pudo verificar duración, usando validación por tamaño");
      return stats.size > 100 * 1024; // Al menos 100KB
    }
    
    const expectedDurationSeconds = expectedDurationMs / 1000;
    const durationDifference = Math.abs(actualDurationSeconds - expectedDurationSeconds);
    
    console.log(`⏱️ Duración esperada: ${expectedDurationSeconds}s, real: ${actualDurationSeconds}s, diferencia: ${durationDifference}s`);
    
    // Margen de 3 segundos como especificaste
    if (durationDifference <= 3) {
      console.log("✅ Archivo validado correctamente");
      return true;
    } else {
      console.warn(`⚠️ Duración no coincide: diferencia de ${durationDifference}s`);
      return false;
    }
    
  } catch (error) {
    console.error("Error validando archivo descargado:", error);
    return false;
  }
}

// Función para convertir duración de YouTube (formato string) a milisegundos
function parseYoutubeDuration(durationString: string): number {
  if (!durationString) return 0;
  
  const parts = durationString.split(':').map(Number);
  if (parts.length === 2) {
    // Formato MM:SS
    return (parts[0] * 60 + parts[1]) * 1000;
  } else if (parts.length === 3) {
    // Formato HH:MM:SS
    return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
  }
  
  return 0;
}

export function setupIpcHandlers() {
  // Limpiar archivos huérfanos al iniciar
  downloadManager.cleanupOrphanedFiles();

  // Cache más eficiente con LRU y compresión
  const searchCache = new Map<string, { results: any[], timestamp: number, hits: number }>();
  const maxCacheSize = 30; // Reducir cache
  const cacheExpiration = 8 * 60 * 1000; // 8 minutos

  // Función optimizada para limpiar cache con LRU
  const cleanExpiredCache = () => {
    const now = Date.now();
    const entries = Array.from(searchCache.entries());
    
    // Eliminar entradas expiradas
    const validEntries = entries.filter(([key, value]) => 
      now - value.timestamp < cacheExpiration
    );
    
    // Si aún excedemos el tamaño, usar LRU (menos hits y más antiguos)
    if (validEntries.length > maxCacheSize) {
      validEntries.sort((a, b) => {
        const scoreA = a[1].hits / (now - a[1].timestamp);
        const scoreB = b[1].hits / (now - b[1].timestamp);
        return scoreA - scoreB; // Menor score = eliminar primero
      });
      
      const toKeep = validEntries.slice(-maxCacheSize);
      searchCache.clear();
      toKeep.forEach(([key, value]) => searchCache.set(key, value));
    } else {
      searchCache.clear();
      validEntries.forEach(([key, value]) => searchCache.set(key, value));
    }
  };

  ipcMain.handle("search-music", async (event, query: string) => {
    try {
      // Limpiar cache solo ocasionalmente
      if (Math.random() < 0.05) { // 5% de probabilidad
        cleanExpiredCache();
      }

      // Cache hit con tracking de uso
      const cacheKey = query.toLowerCase().trim();
      const cachedEntry = searchCache.get(cacheKey);
      
      if (cachedEntry && (Date.now() - cachedEntry.timestamp) < cacheExpiration) {
        cachedEntry.hits++;
        console.log(`⚡ Cache hit para: "${query}" (${cachedEntry.hits} hits)`);
        return cachedEntry.results;
      }

      console.log(`🔍 Buscando música: "${query}"`);
      
      // Timeout más agresivo para mejor responsividad
      let videos;
      try {
        const searchPromise = YouTube.search(query, {
          limit: 12, // Reducir límite para menos memoria
          type: "video",
        });
        
        const timeoutPromise = new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Search timeout')), 10000) // 10 segundos
        );
        
        videos = await Promise.race([searchPromise, timeoutPromise]);
      } catch (searchError) {
        const errorMsg = String(searchError);
        console.error(`Error buscando "${query}":`, errorMsg);
        
        if (errorMsg.includes('403')) {
          await new Promise(resolve => setTimeout(resolve, 3000)); // Reducir espera
        }
        
        return [];
      }

      // Filtrado más eficiente
      const filteredVideos = videos
        .filter((video) => {
          const duration = video.duration;
          return duration && duration > 0 && Math.floor(duration / 1000) <= 900;
        })
        .slice(0, 10); // Límite más bajo

      const results = filteredVideos.map((video) => ({
        id: video.id!,
        title: video.title || "Sin título",
        artist: video.channel?.name || "Unknown Artist",
        duration: video.durationFormatted || "0:00",
        thumbnail: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
        cover: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`
      })).filter(Boolean);

      // Guardar en cache con score inicial
      if (results.length > 0) {
        searchCache.set(cacheKey, {
          results,
          timestamp: Date.now(),
          hits: 1
        });
      }

      console.log(`✅ Búsqueda: "${query}" - ${results.length} resultados`);
      return results;
    } catch (error) {
      console.error("Error crítico en búsqueda:", error);
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

  // Handler para renombrar playlist
  ipcMain.handle("rename-playlist", async (event, oldName: string, newName: string) => {
    return await renamePlaylist(oldName, newName);
  });

  // Handler para guardar imagen de playlist
  ipcMain.handle("save-playlist-image", async (event, playlistName: string, imageData: string) => {
    return await savePlaylistImage(playlistName, imageData);
  });

  // Handler para cargar imagen de playlist
  ipcMain.handle("load-playlist-image", async (event, playlistName: string) => {
    return await loadPlaylistImage(playlistName);
  });
}
