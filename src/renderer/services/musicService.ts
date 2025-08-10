import { Track } from "../types";

class MusicService {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: Track | null = null;
  private timeUpdateCallback: ((time: number) => void) | null = null;
  private endedCallback: (() => void) | null = null;

  async play(track: Track): Promise<void> {
    try {
      // Si es la misma canción, no recrear el audio element
      if (this.currentTrack && this.currentTrack.id === track.id && this.audio) {
        await this.audio.play();
        return;
      }

      // Obtener la ruta local del archivo (desde cache o descarga)
      const songPath = await window.musicAPI.getSongPath(track.id, track.title);

      if (!songPath) {
        throw new Error("No se pudo obtener la ruta de la canción");
      }

      console.log("Reproduciendo desde:", songPath);

      // Limpiar audio anterior si existe
      if (this.audio) {
        this.audio.pause();
        this.audio.removeEventListener("timeupdate", this.handleTimeUpdate);
        this.audio.removeEventListener("ended", this.handleEnded);
        this.audio.removeEventListener("loadedmetadata", this.handleLoadedMetadata);
        this.audio.src = "";
      }

      // Crear nuevo elemento de audio
      this.audio = new Audio(songPath.replace(/\\/g, '/'));
      this.currentTrack = track;

      // Configurar event listeners
      this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
      this.audio.addEventListener("ended", this.handleEnded);
      this.audio.addEventListener("loadedmetadata", this.handleLoadedMetadata);

      // Configurar volumen actual
      this.setVolume(this.getCurrentVolume());

      // Esperar a que se carguen los metadatos antes de reproducir
      await new Promise<void>((resolve, reject) => {
        if (!this.audio) {
          reject(new Error("Audio element not available"));
          return;
        }

        const onCanPlay = () => {
          if (this.audio) {
            this.audio.removeEventListener("canplay", onCanPlay);
            this.audio.removeEventListener("error", onError);
            resolve();
          }
        };

        const onError = (error: Event) => {
          if (this.audio) {
            this.audio.removeEventListener("canplay", onCanPlay);
            this.audio.removeEventListener("error", onError);
          }
          reject(new Error("Failed to load audio"));
        };

        this.audio.addEventListener("canplay", onCanPlay);
        this.audio.addEventListener("error", onError);

        // Cargar el audio
        this.audio.load();
      });

      // Reproducir
      await this.audio.play();
    } catch (error) {
      console.error("Error al reproducir:", error);
      throw error;
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused) {
      this.audio.pause();
    }
  }

  resume(): void {
    if (this.audio && this.audio.paused) {
      this.audio.play().catch(error => {
        console.error("Error al reanudar:", error);
      });
    }
  }

  private currentVolume: number = 80;
  private actualVolume: number = 80; // Volumen real sin considerar mute

  setVolume(volume: number): void {
    this.currentVolume = volume;
    this.actualVolume = volume > 0 ? volume : this.actualVolume; // Preservar el volumen real
    
    if (this.audio) {
      // Convertir el volumen lineal (0-100) a escala logarítmica para un control más natural
      let logVolume: number;
      
      if (volume === 0) {
        logVolume = 0;
      } else {
        // Usar una escala logarítmica: log10(volume/10 + 1) / log10(11)
        logVolume = Math.log10(volume / 10 + 1) / Math.log10(11);
        
        // Aplicar una curva adicional para hacer los niveles bajos aún más silenciosos
        logVolume = Math.pow(logVolume, 2);
      }
      
      this.audio.volume = Math.max(0, Math.min(1, logVolume));
    }
  }

  getCurrentVolume(): number {
    return this.currentVolume;
  }

  getActualVolume(): number {
    return this.actualVolume;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime || 0;
  }

  getDuration(): number {
    return this.audio?.duration || 0;
  }

  seek(time: number): void {
    if (this.audio && !isNaN(this.audio.duration)) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.audio.duration));
    }
  }

  // Event handlers como métodos de clase para poder removerlos correctamente
  private handleTimeUpdate = () => {
    if (this.timeUpdateCallback && this.audio) {
      this.timeUpdateCallback(this.audio.currentTime);
    }
  };

  private handleEnded = () => {
    if (this.endedCallback) {
      this.endedCallback();
    }
  };

  private handleLoadedMetadata = () => {
    // Cuando se cargan los metadatos, notificar el cambio de duración
    if (this.timeUpdateCallback && this.audio) {
      this.timeUpdateCallback(this.audio.currentTime);
    }
  };

  onTimeUpdate(callback: (time: number) => void): void {
    this.timeUpdateCallback = callback;
  }

  onEnded(callback: () => void): void {
    this.endedCallback = callback;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}

export const musicService = new MusicService();
