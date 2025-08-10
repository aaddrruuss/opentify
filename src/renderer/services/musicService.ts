import { Track } from "../types";

class MusicService {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: Track | null = null;

  async play(track: Track): Promise<void> {
    try {
      // Obtener la ruta local del archivo (desde cache o descarga)
      const songPath = await window.musicAPI.getSongPath(track.id, track.title);

      if (!songPath) {
        throw new Error("No se pudo obtener la ruta de la canción");
      }

      console.log("Reproduciendo desde:", songPath);

      if (this.audio) {
        this.audio.pause();
        this.audio.src = "";
      }

      // En Windows, usar la ruta directamente sin file://
      // Electron maneja automáticamente las rutas locales
      this.audio = new Audio(songPath.replace(/\\/g, '/'));
      this.currentTrack = track;
      await this.audio.play();
    } catch (error) {
      console.error("Error al reproducir:", error);
      throw error;
    }
  }

  pause(): void {
    if (this.audio) {
      this.audio.pause();
    }
  }

  resume(): void {
    if (this.audio) {
      this.audio.play();
    }
  }

  setVolume(volume: number): void {
    if (this.audio) {
      // Convertir el volumen lineal (0-100) a escala logarítmica para un control más natural
      // Esto hace que los niveles bajos sean mucho más silenciosos
      let logVolume: number;
      
      if (volume === 0) {
        logVolume = 0;
      } else {
        // Usar una escala logarítmica: log10(volume/10 + 1) / log10(11)
        // Esto da una curva más natural donde el volumen bajo es realmente bajo
        logVolume = Math.log10(volume / 10 + 1) / Math.log10(11);
        
        // Aplicar una curva adicional para hacer los niveles bajos aún más silenciosos
        logVolume = Math.pow(logVolume, 2);
      }
      
      this.audio.volume = Math.max(0, Math.min(1, logVolume));
    }
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  onTimeUpdate(callback: (time: number) => void): void {
    if (this.audio) {
      this.audio.addEventListener("timeupdate", () => {
        callback(this.getCurrentTime());
      });
    }
  }

  onEnded(callback: () => void): void {
    if (this.audio) {
      this.audio.addEventListener("ended", callback);
    }
  }
}

export const musicService = new MusicService();
