import { Track } from "../types";

class MusicService {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: Track | null = null;

  async play(track: Track): Promise<void> {
    try {
      // Obtener la ruta local del archivo descargado
      const songPath = await window.musicAPI.getSongPath(track.id);

      if (!songPath) {
        throw new Error("No se pudo obtener la ruta de la canción");
      }

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
      this.audio.volume = volume / 100;
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
