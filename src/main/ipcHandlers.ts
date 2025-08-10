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

export function setupIpcHandlers() {
  ipcMain.handle("search-music", async (event, query: string) => {
    try {
      const videos = await YouTube.search(query, {
        limit: 20,
        type: "video",
      });

      return videos.map((video) => {
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
          duration: video.durationFormatted,
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

  ipcMain.handle("get-song-path", async (event, videoId: string, title?: string) => {
    try {
      // Primero verificar si la canción ya está en cache
      const cachedPath = isSongCached(videoId);
      if (cachedPath) {
        console.log("Canción encontrada en cache:", cachedPath);
        return cachedPath;
      }

      // Si no está en cache, descargarla
      console.log("Canción no encontrada en cache, descargando:", videoId);

      // Esperar a que yt-dlp esté listo antes de continuar
      await ytdlpReadyPromise;

      if (!ytDlpWrapInstance) {
        throw new Error("YtDlpWrap no está inicializado");
      }

      // Crear la ruta de destino en el directorio de canciones
      const finalSongPath = getSongFilePath(videoId, title);
      const tempPath = path.join(songsDir, `${videoId}_temp.%(ext)s`);

      console.log("Descargando canción a:", finalSongPath);

      // Configuración para descargar directamente al directorio de cache
      const args = [
        `https://www.youtube.com/watch?v=${videoId}`,
        "-f", "bestaudio/best",
        "-o", tempPath,
        "--extract-audio",
        "--audio-format", "mp3",
        "--audio-quality", "0", // Mejor calidad
        "--no-playlist",
        "--no-warnings"
      ];

      // En Windows, agregar opciones adicionales para evitar problemas
      if (process.platform === "win32") {
        args.push("--no-check-certificates");
      }

      await ytDlpWrapInstance.exec(args);

      // Renombrar el archivo temporal al nombre final
      const tempMp3Path = path.join(songsDir, `${videoId}_temp.mp3`);
      if (fs.existsSync(tempMp3Path)) {
        fs.renameSync(tempMp3Path, finalSongPath);
        console.log("Canción descargada y guardada en cache:", finalSongPath);
        
        // Mostrar estadísticas del cache
        try {
          const files = fs.readdirSync(songsDir);
          const mp3Files = files.filter(f => f.endsWith('.mp3'));
          console.log(`Cache de canciones: ${mp3Files.length} archivos`);
        } catch (error) {
          console.error("Error reading cache stats:", error);
        }
        
        return finalSongPath;
      } else {
        throw new Error("El archivo no se creó correctamente");
      }
    } catch (error) {
      console.error("Download error:", error);
      return null;
    }
  });
}
