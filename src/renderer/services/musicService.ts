import { Track } from "../types/index";

class MusicService {
  private audio: HTMLAudioElement | null = null;
  private currentTrack: Track | null = null;
  private timeUpdateCallback: ((time: number) => void) | null = null;
  private endedCallback: (() => void) | null = null;
  private isLoadingTrack: boolean = false;

  async play(track: Track): Promise<void> {
    try {
      this.isLoadingTrack = true;
      console.log("MusicService: Iniciando carga de", track.title);
      
      // Si es la misma canción y ya está cargada, solo reproducir
      if (this.currentTrack && this.currentTrack.id === track.id && this.audio && !this.audio.ended) {
        console.log("MusicService: Reanudando canción existente");
        await this.audio.play();
        this.isLoadingTrack = false;
        return;
      }

      // Limpiar cualquier reproducción anterior solo si es diferente canción
      if (!this.currentTrack || this.currentTrack.id !== track.id) {
        this.cleanup();
      }

      // Obtener la ruta local del archivo con timeout
      console.log("MusicService: Solicitando descarga...");
      const songPath = await Promise.race([
        window.musicAPI.getSongPath(track.id, track.title),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Download timeout')), 25000)
        )
      ]);

      if (!songPath) {
        throw new Error("No se pudo obtener la ruta de la canción");
      }

      console.log("MusicService: Descarga completada, cargando audio desde:", songPath);

      // Crear nuevo elemento de audio
      this.audio = new Audio(songPath.replace(/\\/g, '/'));
      this.currentTrack = track;

      // Configurar event listeners
      this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
      this.audio.addEventListener("ended", this.handleEnded);
      this.audio.addEventListener("loadedmetadata", this.handleLoadedMetadata);

      // Configurar volumen actual
      this.setVolume(this.getCurrentVolume());

      // Esperar a que se carguen los metadatos Y esté listo para reproducir
      console.log("MusicService: Esperando metadatos...");
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (!this.audio) {
            reject(new Error("Audio element not available"));
            return;
          }

          const onCanPlay = () => {
            if (this.audio) {
              this.audio.removeEventListener("canplay", onCanPlay);
              this.audio.removeEventListener("error", onError);
              this.audio.removeEventListener("loadedmetadata", onLoadedMetadata);
              console.log("MusicService: Audio listo para reproducir");
              resolve();
            }
          };

          const onLoadedMetadata = () => {
            console.log("MusicService: Metadatos cargados");
          };

          const onError = (error: Event) => {
            if (this.audio) {
              this.audio.removeEventListener("canplay", onCanPlay);
              this.audio.removeEventListener("error", onError);
              this.audio.removeEventListener("loadedmetadata", onLoadedMetadata);
            }
            console.error("MusicService: Error cargando audio");
            reject(new Error("Failed to load audio"));
          };

          this.audio.addEventListener("canplay", onCanPlay);
          this.audio.addEventListener("loadedmetadata", onLoadedMetadata);
          this.audio.addEventListener("error", onError);

          // Cargar el audio
          this.audio.load();
        }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Audio load timeout')), 10000)
        )
      ]);

      // Reproducir solo si no se ha iniciado otra carga
      if (this.currentTrack?.id === track.id) {
        console.log("MusicService: Iniciando reproducción...");
        await this.audio.play();
        console.log("MusicService: Reproducción iniciada exitosamente");
      }
      
    } catch (error) {
      const errorMsg = String(error);
      
      // **NUEVO: Manejar error de restricción de edad sin mostrar error**
      if (errorMsg.includes('AGE_RESTRICTED') || errorMsg.includes('sign in to confirm')) {
        console.warn(`🔞 Canción con restricción de edad eliminada automáticamente: ${track.title}`);
        
        // NO lanzar error, solo log silencioso
        this.cleanup();
        return; // Salir silenciosamente
      }
      
      console.error("MusicService: Error en play:", error);
      this.cleanup();
      throw error;
    } finally {
      this.isLoadingTrack = false;
    }
  }

  // Método para limpiar recursos de audio
  private cleanup(preserveState: boolean = false): void {
    if (this.audio) {
      if (!preserveState) {
        this.audio.pause();
      }
      this.audio.removeEventListener("timeupdate", this.handleTimeUpdate);
      this.audio.removeEventListener("ended", this.handleEnded);
      this.audio.removeEventListener("loadedmetadata", this.handleLoadedMetadata);
      this.audio.removeEventListener("playing", this.handlePlaying);
      this.audio.removeEventListener("pause", this.handlePause);
      
      if (!preserveState) {
        this.audio.src = "";
        this.audio = null;
      }
    }
  }

  // NUEVO: Método específico para reanudar
  resume(): void {
    if (this.audio && this.audio.paused && !this.isLoadingTrack && !this.audio.ended) {
      console.log(`MusicService: Reanudando desde ${this.audio.currentTime}s`);
      this.audio.play().catch(error => {
        console.error("Error al reanudar:", error);
      });
    } else {
      console.warn("Cannot resume: audio not ready", {
        hasAudio: !!this.audio,
        isPaused: this.audio?.paused,
        isLoading: this.isLoadingTrack,
        hasEnded: this.audio?.ended,
        currentTime: this.audio?.currentTime
      });
    }
  }

  pause(): void {
    if (this.audio && !this.audio.paused && !this.audio.ended) {
      console.log(`MusicService: Pausando en ${this.audio.currentTime}s`);
      this.audio.pause();
    }
  }

  // Método para detener completamente la reproducción
  stop(): void {
    this.cleanup();
    this.currentTrack = null;
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
    if (this.audio && !isNaN(this.audio.duration) && this.audio.duration > 0) {
      const seekTime = Math.max(0, Math.min(time, this.audio.duration));
      this.audio.currentTime = seekTime;
      console.log(`Seeking to: ${seekTime}s (duration: ${this.audio.duration}s)`);
      
      // Force a time update to ensure UI is synchronized
      if (this.timeUpdateCallback) {
        this.timeUpdateCallback(seekTime);
      }
    } else {
      console.warn("Cannot seek: audio not ready or invalid duration", {
        hasAudio: !!this.audio,
        duration: this.audio?.duration,
        readyState: this.audio?.readyState
      });
    }
  }

  // Event handlers como métodos de clase para poder removerlos correctamente
  private handleTimeUpdate = () => {
    if (this.timeUpdateCallback && this.audio) {
      this.timeUpdateCallback(this.audio.currentTime);
    }
  };

  private handleEnded = () => {
    console.log("MusicService: Audio ended event fired");
    if (this.endedCallback) {
      // Pequeño delay para asegurar que el evento se procese correctamente
      setTimeout(() => {
        if (this.endedCallback) {
          this.endedCallback();
        }
      }, 100);
    }
  };

  private handleLoadedMetadata = () => {
    // Cuando se cargan los metadatos, notificar el cambio de duración
    if (this.timeUpdateCallback && this.audio) {
      this.timeUpdateCallback(this.audio.currentTime);
    }
  };

  private handlePlaying = () => {
    console.log("MusicService: Audio playing event fired");
    // Forzar actualización de estado cuando el audio realmente empiece
    if (this.timeUpdateCallback && this.audio) {
      this.timeUpdateCallback(this.audio.currentTime);
    }
  };

  private handlePause = () => {
    console.log("MusicService: Audio paused event fired");
    // Forzar actualización de estado cuando el audio se pause
    if (this.timeUpdateCallback && this.audio) {
      this.timeUpdateCallback(this.audio.currentTime);
    }
  };

  onTimeUpdate(callback: (time: number) => void): (() => void) | void {
    this.timeUpdateCallback = callback;
    // Retornar función de cleanup explícita
    return () => {
      this.timeUpdateCallback = null;
    };
  }

  onEnded(callback: () => void): (() => void) | void {
    this.endedCallback = callback;
    // Retornar función de cleanup explícita
    return () => {
      this.endedCallback = null;
    };
  }

  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }

  // Método para precargar una canción sin reproducirla
  async preloadTrack(track: Track): Promise<boolean> {
    try {
      const songPath = await window.musicAPI.getSongPath(track.id, track.title, true);
      return songPath !== null;
    } catch (error) {
      console.error("Error precargando canción:", error);
      return false;
    }
  }

  async loadTrackForRestore(track: Track): Promise<void> {
    try {
      this.isLoadingTrack = true;
      
      // Limpiar cualquier audio anterior
      this.cleanup();
      
      // Obtener la ruta con timeout más corto para restauración
      const songPath = await Promise.race([
        window.musicAPI.getSongPath(track.id, track.title),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Restore timeout')), 15000)
        )
      ]);

      if (!songPath) {
        throw new Error("No se pudo obtener la ruta para restauración");
      }

      console.log("Cargando para restauración desde:", songPath);

      // Crear nuevo elemento de audio
      this.audio = new Audio(songPath.replace(/\\/g, '/'));
      this.currentTrack = track;

      // Configurar event listeners
      this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
      this.audio.addEventListener("ended", this.handleEnded);
      this.audio.addEventListener("loadedmetadata", this.handleLoadedMetadata);

      // Configurar volumen actual
      this.setVolume(this.getCurrentVolume());

      // Esperar a que se carguen los metadatos SIN reproducir con timeout
      await Promise.race([
        new Promise<void>((resolve, reject) => {
          if (!this.audio) {
            reject(new Error("Audio element not available"));
            return;
          }

          const onLoadedMetadata = () => {
            if (this.audio) {
              this.audio.removeEventListener("loadedmetadata", onLoadedMetadata);
              this.audio.removeEventListener("error", onError);
              console.log("Metadatos cargados para restauración");
              resolve();
            }
          };

          const onError = (error: Event) => {
            if (this.audio) {
              this.audio.removeEventListener("loadedmetadata", onLoadedMetadata);
              this.audio.removeEventListener("error", onError);
            }
            reject(new Error("Failed to load audio for restore"));
          };

          this.audio.addEventListener("loadedmetadata", onLoadedMetadata);
          this.audio.addEventListener("error", onError);

          // Cargar el audio SIN reproducir - solo cargar metadatos
          this.audio.load();
        }),
        new Promise<void>((_, reject) => 
          setTimeout(() => reject(new Error('Metadata load timeout')), 5000)
        )
      ]);

    } catch (error) {
      console.error("Error al cargar para restauración:", error);
      this.cleanup();
      throw error;
    } finally {
      this.isLoadingTrack = false;
    }
  }

  isReady(): boolean {
    return this.audio !== null && !this.isLoadingTrack && this.getDuration() > 0;
  }

  isLoadingCurrentTrack(): boolean {
    return this.isLoadingTrack;
  }

  async repeatCurrentTrack(): Promise<void> {
    if (!this.audio || !this.currentTrack) {
      throw new Error("No hay audio o track para repetir");
    }

    try {
      console.log("MusicService: Repitiendo canción actual");
      
      // Reiniciar posición
      this.audio.currentTime = 0;
      
      // Si ya está pausado, reproducir
      if (this.audio.paused) {
        await this.audio.play();
      }
      
      console.log("MusicService: Repetición iniciada");
    } catch (error) {
      console.error("MusicService: Error repitiendo canción:", error);
      throw error;
    }
  }

  // Método mejorado para verificar si está reproduciendo
  isPlaying(): boolean {
    if (!this.audio) return false;
    
    return !this.audio.paused && 
           !this.audio.ended && 
           this.audio.currentTime >= 0 &&
           this.audio.readyState > 2;
  }

  // Mejorar el método isPaused
  isPaused(): boolean {
    if (!this.audio) return false;
    return this.audio.paused && !this.audio.ended && this.audio.currentTime > 0;
  }

  // Nuevo método para verificar si la canción terminó
  hasEnded(): boolean {
    if (!this.audio) return false;
    return this.audio.ended || (this.audio.currentTime >= this.audio.duration && this.audio.duration > 0);
  }

  async loadAudioOnly(track: Track): Promise<void> {
    try {
      this.isLoadingTrack = true;
      console.log("MusicService: Cargando audio de", track.title);
      
      // Limpiar cualquier reproducción anterior
      this.cleanup();
      
      // Obtener la ruta del archivo
      const songPath = await window.musicAPI.getSongPath(track.id, track.title);

      if (!songPath) {
        throw new Error("No se pudo obtener la ruta de la canción");
      }

      console.log("MusicService: Audio desde:", songPath);

      // Crear nuevo elemento de audio
      this.audio = new Audio(songPath.replace(/\\/g, '/'));
      this.currentTrack = track;

      // Configurar event listeners incluyendo 'playing' para mejor detección
      this.audio.addEventListener("timeupdate", this.handleTimeUpdate);
      this.audio.addEventListener("ended", this.handleEnded);
      this.audio.addEventListener("loadedmetadata", this.handleLoadedMetadata);
      this.audio.addEventListener("playing", this.handlePlaying);
      this.audio.addEventListener("pause", this.handlePause);

      // Configurar volumen actual
      this.setVolume(this.getCurrentVolume());

      // Esperar a que se carguen los metadatos
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
        this.audio.load();
      });
      
      // Reproducir automáticamente
      await this.audio.play();
      console.log("MusicService: Reproduciendo exitosamente");
      
    } catch (error) {
      console.error("MusicService: Error en loadAudioOnly:", error);
      this.cleanup();
      throw error;
    } finally {
      this.isLoadingTrack = false;
    }
  }
}

export const musicService = new MusicService();
