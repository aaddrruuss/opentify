import { Track } from '../types/index';

class DiscordRPCClient {
  private isEnabled: boolean = true;
  private currentTrack: Track | null = null;
  private currentPosition: number = 0;
  private isPlaying: boolean = false;
  private updateInterval: NodeJS.Timeout | null = null;

  async initialize(): Promise<boolean> {
    try {
      if (!window.discordRPCAPI) {
        console.warn('Discord RPC API not available');
        return false;
      }

      const enabled = await window.discordRPCAPI.isEnabled();
      this.isEnabled = enabled;

      if (enabled) {
        const connected = await window.discordRPCAPI.connect();
        console.log(`🎮 Discord RPC ${connected ? 'connected' : 'failed to connect'}`);
        return connected;
      }

      return false;
    } catch (error) {
      console.error('Error initializing Discord RPC:', error);
      return false;
    }
  }

  async setEnabled(enabled: boolean): Promise<boolean> {
    try {
      this.isEnabled = enabled;
      if (window.discordRPCAPI) {
        return await window.discordRPCAPI.setEnabled(enabled);
      }
      return false;
    } catch (error) {
      console.error('Error setting Discord RPC enabled:', error);
      return false;
    }
  }

  async updateTrack(track: Track | null, position: number = 0, playing: boolean = false): Promise<void> {
    if (!this.isEnabled || !window.discordRPCAPI) return;

    this.currentTrack = track;
    this.currentPosition = position;
    this.isPlaying = playing;

    try {
      if (!track) {
        await window.discordRPCAPI.clearPresence();
        this.stopPeriodicUpdates();
        return;
      }

      // Parsear duración de string a segundos
      const durationParts = track.duration.split(':').map(Number);
      let durationSeconds = 0;
      if (durationParts.length === 2) {
        durationSeconds = durationParts[0] * 60 + durationParts[1];
      } else if (durationParts.length === 3) {
        durationSeconds = durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2];
      }

      const trackInfo = {
        title: track.title,
        artist: track.artist,
        duration: durationSeconds,
        position: position,
        cover: track.cover || track.thumbnail,
        isPlaying: playing
      };

      await window.discordRPCAPI.updatePresence(trackInfo);
      console.log(`🎮 Discord RPC updated: ${track.title} - ${track.artist} (${playing ? 'Playing' : 'Paused'})`);

      // Iniciar actualizaciones periódicas si está reproduciendo
      if (playing) {
        this.startPeriodicUpdates();
      } else {
        this.stopPeriodicUpdates();
      }
    } catch (error) {
      console.error('Error updating Discord RPC:', error);
    }
  }

  async updatePlayState(isPlaying: boolean): Promise<void> {
    if (!this.isEnabled || !window.discordRPCAPI || !this.currentTrack) return;

    this.isPlaying = isPlaying;

    try {
      await window.discordRPCAPI.updatePlayState(isPlaying);

      if (isPlaying) {
        this.startPeriodicUpdates();
      } else {
        this.stopPeriodicUpdates();
      }
    } catch (error) {
      console.error('Error updating Discord RPC play state:', error);
    }
  }

  async updatePosition(position: number): Promise<void> {
    if (!this.isEnabled || !window.discordRPCAPI || !this.currentTrack) return;

    this.currentPosition = position;

    try {
      await window.discordRPCAPI.updatePosition(position);
    } catch (error) {
      console.error('Error updating Discord RPC position:', error);
    }
  }

  private startPeriodicUpdates(): void {
    this.stopPeriodicUpdates();

    // Actualizar cada 15 segundos mientras está reproduciendo
    this.updateInterval = setInterval(async () => {
      if (this.isEnabled && this.currentTrack && this.isPlaying) {
        // Re-enviar información completa periódicamente para mantener sincronización
        await this.updateTrack(this.currentTrack, this.currentPosition, this.isPlaying);
      }
    }, 15000);
  }

  private stopPeriodicUpdates(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  async clearPresence(): Promise<void> {
    if (!window.discordRPCAPI) return;

    try {
      await window.discordRPCAPI.clearPresence();
      this.stopPeriodicUpdates();
      this.currentTrack = null;
      this.currentPosition = 0;
      this.isPlaying = false;
    } catch (error) {
      console.error('Error clearing Discord RPC presence:', error);
    }
  }

  async disconnect(): Promise<void> {
    if (!window.discordRPCAPI) return;

    try {
      await window.discordRPCAPI.disconnect();
      this.stopPeriodicUpdates();
    } catch (error) {
      console.error('Error disconnecting Discord RPC:', error);
    }
  }

  async isConnected(): Promise<boolean> {
    try {
      return window.discordRPCAPI ? await window.discordRPCAPI.isConnected() : false;
    } catch (error) {
      console.error('Error checking Discord RPC connection:', error);
      return false;
    }
  }
}

// Singleton instance
export const discordRPCClient = new DiscordRPCClient();