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

      // Configurar volumen actual y procesamiento de audio
      this.setupAudioProcessing();
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
        
        // Actualizar sesión multimedia
        this.updateMediaSession();
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
        // Limpiar nodos de audio antes de eliminar el elemento
        this.cleanupAudioNodes();
        this.audio.src = "";
        this.audio = null;
      }
    }
  }

  // NUEVO: Método específico para reanudar
  resume(): void {
    if (this.audio && this.audio.paused && !this.isLoadingTrack && !this.audio.ended) {
      console.log(`MusicService: Reanudando desde ${this.audio.currentTime}s`);
      this.audio.play().then(() => {
        // Actualizar sesión multimedia cuando se reanuda
        this.updateMediaSession();
      }).catch(error => {
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
      // Actualizar sesión multimedia cuando se pausa
      this.updateMediaSession();
    }
  }

  // Método para detener completamente la reproducción
  stop(): void {
    this.cleanup();
    this.currentTrack = null;
    // Limpiar sesión multimedia
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
    }
  }

  private currentVolume: number = 80;
  private actualVolume: number = 80; // Volumen real sin considerar mute
  private audioContext: AudioContext | null = null;
  private gainNode: GainNode | null = null;
  private compressorNode: DynamicsCompressorNode | null = null;
  private sourceNode: MediaElementAudioSourceNode | null = null;

  setVolume(volume: number): void {
    this.currentVolume = volume;
    this.actualVolume = volume > 0 ? volume : this.actualVolume; // Preservar el volumen real
    
    if (this.audio) {
      let adjustedVolume: number;
      
      if (volume === 0) {
        adjustedVolume = 0;
      } else {
        const normalizedVolume = volume / 100;
        adjustedVolume = Math.pow(normalizedVolume, 2) * 0.5; 
      }
      
      if (this.gainNode) {
        this.gainNode.gain.value = adjustedVolume;
      } else {
        this.audio.volume = Math.max(0, Math.min(1, adjustedVolume));
      }
    }
  }

  getCurrentVolume(): number {
    return this.currentVolume;
  }

  getActualVolume(): number {
    return this.actualVolume;
  }

  // Configurar procesamiento de audio con normalización
  private setupAudioProcessing(): void {
    if (!this.audio) return;

    try {
      // Crear AudioContext si no existe
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      // Limpiar nodos anteriores
      this.cleanupAudioNodes();

      // Crear source node desde el elemento audio
      this.sourceNode = this.audioContext.createMediaElementSource(this.audio);

      // Crear gain node para control de volumen
      this.gainNode = this.audioContext.createGain();

      // Crear compresor para normalización de audio
      this.compressorNode = this.audioContext.createDynamicsCompressor();
      
      // Configurar compresor para normalización suave
      this.compressorNode.threshold.value = -24; // dB
      this.compressorNode.knee.value = 30; // dB
      this.compressorNode.ratio.value = 12; // 12:1 ratio
      this.compressorNode.attack.value = 0.003; // 3ms
      this.compressorNode.release.value = 0.25; // 250ms

      // Conectar la cadena de audio: source -> compresor -> gain -> destination
      this.sourceNode.connect(this.compressorNode);
      this.compressorNode.connect(this.gainNode);
      this.gainNode.connect(this.audioContext.destination);

      console.log("Audio processing chain configured with normalization");
    } catch (error) {
      console.warn("No se pudo configurar el procesamiento de audio:", error);
      // Fallback a volumen directo si falla Web Audio API
    }
  }

  // Limpiar nodos de audio
  private cleanupAudioNodes(): void {
    try {
      if (this.sourceNode) {
        this.sourceNode.disconnect();
        this.sourceNode = null;
      }
      if (this.gainNode) {
        this.gainNode.disconnect();
        this.gainNode = null;
      }
      if (this.compressorNode) {
        this.compressorNode.disconnect();
        this.compressorNode = null;
      }
    } catch (error) {
      console.warn("Error cleaning up audio nodes:", error);
    }
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
      
      // Actualizar posición en la sesión multimedia (throttled)
      if (this.currentTrack && !this.audio.paused && 'mediaSession' in navigator) {
        try {
          if (this.audio.duration > 0 && !isNaN(this.audio.duration)) {
            navigator.mediaSession.setPositionState({
              duration: this.audio.duration,
              playbackRate: 1.0,
              position: Math.max(0, Math.min(this.audio.currentTime, this.audio.duration))
            });
          }
        } catch (error) {
          // Ignore position update errors
        }
      }
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

      // Configurar volumen actual y procesamiento de audio
      this.setupAudioProcessing();
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

      // Configurar volumen actual y procesamiento de audio
      this.setupAudioProcessing();
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
      
      // Actualizar sesión multimedia
      this.updateMediaSession();
      
    } catch (error) {
      console.error("MusicService: Error en loadAudioOnly:", error);
      this.cleanup();
      throw error;
    } finally {
      this.isLoadingTrack = false;
    }
  }

  // Actualizar sesión multimedia
  private updateMediaSession(): void {
    if (this.currentTrack && 'mediaSession' in navigator) {
      try {
        // Actualizar metadatos
        const metadata = new MediaMetadata({
          title: this.currentTrack.title || 'Título desconocido',
          artist: this.currentTrack.artist || 'Artista desconocido',
          album: 'Opentify',
          artwork: [
            {
              src: this.currentTrack.thumbnail || this.currentTrack.cover || '',
              sizes: '320x180',
              type: 'image/jpeg'
            },
            {
              src: this.currentTrack.thumbnail || this.currentTrack.cover || '',
              sizes: '640x360', 
              type: 'image/jpeg'
            }
          ]
        });

        navigator.mediaSession.metadata = metadata;
        navigator.mediaSession.playbackState = this.isPlaying() ? 'playing' : 'paused';

        // Actualizar posición si tenemos información válida
        if (this.audio && this.audio.duration > 0 && !isNaN(this.audio.duration)) {
          navigator.mediaSession.setPositionState({
            duration: this.audio.duration,
            playbackRate: 1.0,
            position: Math.max(0, Math.min(this.audio.currentTime, this.audio.duration))
          });
        }

        console.log(`🎵 Media session updated:`, {
          title: this.currentTrack.title,
          artist: this.currentTrack.artist,
          playbackState: this.isPlaying() ? 'playing' : 'paused',
          duration: this.audio?.duration,
          position: this.audio?.currentTime
        });
      } catch (error) {
        console.error('❌ Error updating media session:', error);
      }
    }
  }

  // Verificar si la MediaSession API está soportada
  isMediaSessionSupported(): boolean {
    return 'mediaSession' in navigator;
  }
}

export const musicService = new MusicService();
