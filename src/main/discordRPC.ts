import DiscordRPC from 'discord-rpc';

interface TrackInfo {
  title: string;
  artist: string;
  duration: number;
  position: number;
  cover?: string;
  isPlaying: boolean;
}

class DiscordRPCService {
  private client: DiscordRPC.Client | null = null;
  private isConnected: boolean = false;
  private isEnabled: boolean = true;
  private currentTrack: TrackInfo | null = null;
  private readonly clientId = '1404915783766773951';
  private startTime: number | null = null;
  
  constructor() {
    DiscordRPC.register(this.clientId);
  }

  async connect(): Promise<boolean> {
    if (this.isConnected || !this.isEnabled) return false;

    try {
      this.client = new DiscordRPC.Client({ transport: 'ipc' });
      
      this.client.on('ready', () => {
        console.log('🎮 Discord RPC conectado');
        this.isConnected = true;
        
        // Si ya hay una canción reproduciéndose, actualizar inmediatamente
        if (this.currentTrack) {
          this.updatePresence(this.currentTrack);
        } else {
          this.clearPresence();
        }
      });

      this.client.on('disconnected', () => {
        console.log('🎮 Discord RPC desconectado');
        this.isConnected = false;
      });

      await this.client.login({ clientId: this.clientId });
      return true;
    } catch (error) {
      console.error('❌ Error conectando Discord RPC:', error);
      this.isConnected = false;
      return false;
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;

    try {
      await this.client.destroy();
      this.client = null;
      this.isConnected = false;
      this.currentTrack = null;
      this.startTime = null;
      console.log('🎮 Discord RPC desconectado exitosamente');
    } catch (error) {
      console.error('❌ Error desconectando Discord RPC:', error);
    }
  }

  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    
    if (!enabled) {
      this.disconnect();
    } else if (!this.isConnected) {
      this.connect();
    }
  }

  isRPCEnabled(): boolean {
    return this.isEnabled;
  }

  isRPCConnected(): boolean {
    return this.isConnected;
  }

  updatePresence(track: TrackInfo): void {
    if (!this.client || !this.isConnected || !this.isEnabled) return;

    try {
      this.currentTrack = track;
      const now = Date.now();

      // Preparar assets para imagen dinámica
      let largeImageUrl = track.cover && /^https?:\/\//.test(track.cover)
        ? track.cover
        : "https://img.youtube.com/vi/k8nxe6UE1gY/hqdefault.jpg"; // Fallback

      if (track.isPlaying) {
        this.startTime = now - (track.position * 1000);
        const endTime = this.startTime + (track.duration * 1000);

        // Usar el método request directamente para agregar el tipo de actividad "Listening"
        (this.client as any).request('SET_ACTIVITY', {
          pid: process?.pid || 0,
          activity: {
            name: track.title,
            type: 2, // 2 = Listening
            state: track.artist,
            details: track.title,
            timestamps: {
              start: this.startTime,
              end: endTime,
            },
            assets: {
              large_image: largeImageUrl,
            },
            instance: false,
          },
        });
      } else {
        // Para cuando está pausado, también usar tipo "Listening"
        (this.client as any).request('SET_ACTIVITY', {
          pid: process?.pid || 0,
          activity: {
            name: track.title,
            type: 2, // 2 = Listening
            state: track.artist,
            details: track.title,
            assets: {
              large_image: largeImageUrl,
            },
            instance: false,
          },
        });
      }

      console.log(`🎮 Discord RPC actualizado: ${track.title} - ${track.artist} (${track.isPlaying ? 'Reproduciendo' : 'Pausado'})`);
    } catch (error) {
      console.error('❌ Error actualizando Discord RPC:', error);
    }
  }

  clearPresence(): void {
    if (!this.client || !this.isConnected) return;

    try {
      this.client.clearActivity();
      this.currentTrack = null;
      this.startTime = null;
      console.log('🎮 Discord RPC limpiado');
    } catch (error) {
      console.error('❌ Error limpiando Discord RPC:', error);
    }
  }

  // Método para actualizar solo el estado de reproducción (play/pause) sin cambiar la canción
  updatePlayState(isPlaying: boolean): void {
    if (!this.currentTrack) return;
    
    this.currentTrack.isPlaying = isPlaying;
    this.updatePresence(this.currentTrack);
  }

  // Método para actualizar la posición actual de la canción
  updatePosition(position: number): void {
    if (!this.currentTrack) return;
    
    this.currentTrack.position = position;
    
    // Solo actualizar si está reproduciendo para mantener el timestamp correcto
    if (this.currentTrack.isPlaying) {
      this.updatePresence(this.currentTrack);
    }
  }
}

// Singleton
export const discordRPCService = new DiscordRPCService();