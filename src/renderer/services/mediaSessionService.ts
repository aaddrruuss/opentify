import { Track } from "../types/index";

class MediaSessionService {
  private isSupported: boolean = false;
  private currentTrack: Track | null = null;
  private playCallback: (() => void) | null = null;
  private pauseCallback: (() => void) | null = null;
  private nextTrackCallback: (() => void) | null = null;
  private previousTrackCallback: (() => void) | null = null;

  constructor() {
    this.isSupported = 'mediaSession' in navigator;
    if (this.isSupported) {
      console.log('✅ MediaSession API is supported');
      this.setupActionHandlers();
    } else {
      console.warn('❌ MediaSession API is not supported in this browser');
    }
  }

  private setupActionHandlers(): void {
    if (!this.isSupported) return;

    const actionHandlers: [MediaSessionAction, () => void][] = [
      ['play', () => {
        console.log('🎵 Media key: Play pressed');
        if (this.playCallback) {
          this.playCallback();
        }
      }],
      ['pause', () => {
        console.log('⏸️ Media key: Pause pressed');
        if (this.pauseCallback) {
          this.pauseCallback();
        }
      }],
      ['nexttrack', () => {
        console.log('⏭️ Media key: Next track pressed');
        if (this.nextTrackCallback) {
          this.nextTrackCallback();
        }
      }],
      ['previoustrack', () => {
        console.log('⏮️ Media key: Previous track pressed');
        if (this.previousTrackCallback) {
          this.previousTrackCallback();
        }
      }],
      ['stop', () => {
        console.log('⏹️ Media key: Stop pressed');
        if (this.pauseCallback) {
          this.pauseCallback();
        }
      }]
    ];

    for (const [action, handler] of actionHandlers) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
        console.log(`✅ Media action handler registered: ${action}`);
      } catch (error) {
        console.warn(`⚠️ The media session action "${action}" is not supported:`, error);
      }
    }
  }

  // Actualizar los metadatos de la canción actual
  updateMetadata(track: Track | null, isPlaying: boolean = false): void {
    if (!this.isSupported || !track) {
      if (this.isSupported) {
        // Limpiar metadatos si no hay track
        navigator.mediaSession.metadata = null;
      }
      return;
    }

    this.currentTrack = track;

    try {
      const metadata = new MediaMetadata({
        title: track.title || 'Título desconocido',
        artist: track.artist || 'Artista desconocido',
        album: 'Opentify',
        artwork: [
          {
            src: track.thumbnail || track.cover || '',
            sizes: '320x180',
            type: 'image/jpeg'
          },
          {
            src: track.thumbnail || track.cover || '',
            sizes: '640x360', 
            type: 'image/jpeg'
          }
        ]
      });

      navigator.mediaSession.metadata = metadata;
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';

      console.log(`🎵 Media session metadata updated:`, {
        title: track.title,
        artist: track.artist,
        playbackState: isPlaying ? 'playing' : 'paused'
      });
    } catch (error) {
      console.error('❌ Error updating media session metadata:', error);
    }
  }

  // Actualizar solo el estado de reproducción
  updatePlaybackState(isPlaying: boolean): void {
    if (!this.isSupported) return;

    try {
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
      console.log(`🎵 Media session playback state: ${isPlaying ? 'playing' : 'paused'}`);
    } catch (error) {
      console.error('❌ Error updating media session playback state:', error);
    }
  }

  // Actualizar información de posición
  updatePositionState(duration: number, currentTime: number, playbackRate: number = 1.0): void {
    if (!this.isSupported) return;

    try {
      // Solo actualizar si tenemos duración válida
      if (duration > 0 && !isNaN(duration) && !isNaN(currentTime)) {
        navigator.mediaSession.setPositionState({
          duration: duration,
          playbackRate: playbackRate,
          position: Math.max(0, Math.min(currentTime, duration))
        });
      }
    } catch (error) {
      console.error('❌ Error updating media session position:', error);
    }
  }

  // Registrar callbacks para las acciones de media
  setCallbacks(callbacks: {
    onPlay?: () => void;
    onPause?: () => void;
    onNextTrack?: () => void;
    onPreviousTrack?: () => void;
  }): void {
    this.playCallback = callbacks.onPlay || null;
    this.pauseCallback = callbacks.onPause || null;
    this.nextTrackCallback = callbacks.onNextTrack || null;
    this.previousTrackCallback = callbacks.onPreviousTrack || null;

    console.log('🎛️ Media session callbacks registered:', {
      onPlay: !!this.playCallback,
      onPause: !!this.pauseCallback,
      onNextTrack: !!this.nextTrackCallback,
      onPreviousTrack: !!this.previousTrackCallback
    });

    // Re-setup action handlers with new callbacks
    this.setupActionHandlers();
  }

  // Limpiar la sesión multimedia
  clearSession(): void {
    if (!this.isSupported) return;

    try {
      navigator.mediaSession.metadata = null;
      navigator.mediaSession.playbackState = 'none';
      console.log('🧹 Media session cleared');
    } catch (error) {
      console.error('❌ Error clearing media session:', error);
    }
  }

  // Verificar si la API está soportada
  isMediaSessionSupported(): boolean {
    return this.isSupported;
  }

  // Obtener el track actual
  getCurrentTrack(): Track | null {
    return this.currentTrack;
  }
}

export const mediaSessionService = new MediaSessionService();