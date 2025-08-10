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

const ytdlpPath = getBinaryPath();
console.log("yt-dlp path:", ytdlpPath);

// Función para asegurar que el directorio del binario existe
function ensureBinaryDirExists() {
  const binaryDir = path.dirname(ytdlpPath);
  if (!fs.existsSync(binaryDir)) {
    fs.mkdirSync(binaryDir, { recursive: true });
  }
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

        console.log("Video procesado:", {
          id: result.id,
          title: result.title,
          thumbnail: result.thumbnail
        });

        return result;
      });
    } catch (error) {
      console.error("Search error:", error);
      return [];
    }
  });

  ipcMain.handle("get-song-path", async (event, videoId: string) => {
    try {
      // Esperar a que yt-dlp esté listo antes de continuar
      await ytdlpReadyPromise;

      if (!ytDlpWrapInstance) {
        throw new Error("YtDlpWrap no está inicializado");
      }

      const tempDir = app.getPath("temp");
      const songPath = path.join(tempDir, `${videoId}.%(ext)s`);
      const finalSongPath = path.join(tempDir, `${videoId}.mp3`);

      // Si la canción ya está descargada, devolvemos la ruta
      if (fs.existsSync(finalSongPath)) {
        console.log("Canción ya descargada:", finalSongPath);
        return finalSongPath;
      }

      console.log("Descargando canción:", videoId);

      // Configuración específica para Windows
      const args = [
        `https://www.youtube.com/watch?v=${videoId}`,
        "-f", "bestaudio/best",
        "-o", songPath,
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

      // Verificar que el archivo se creó correctamente
      if (fs.existsSync(finalSongPath)) {
        console.log("Canción descargada correctamente:", finalSongPath);
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
