export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  cover?: string;
  thumbnail?: string;
}

export interface QueueItem {
  track: Track;
  addedAt: number;
  id: string;
}

export interface MusicAPI {
  searchMusic: (query: string) => Promise<Track[]>;
  getSongPath: (videoId: string, title?: string, preload?: boolean) => Promise<string | null>;
  checkSongCache: (videoId: string) => Promise<{ cached: boolean; path: string | null }>;
}

export interface Settings {
  volume: number;
  isMuted: boolean;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  isDarkMode: boolean;
  audioQuality?: 'low' | 'medium' | 'high'; // NUEVO: Configuración de calidad de audio
  discordRPCEnabled?: boolean; // NUEVO: Discord Rich Presence
  autoStartup?: 'no' | 'yes' | 'minimized'; // NUEVO: Auto-inicio del sistema
  minimizeToTray?: boolean; // NUEVO: Minimizar a la bandeja del sistema
  lastPlayedTrack?: Track | null;
  lastPlayedPosition?: number;
  lastPlayedTime?: number; // timestamp when app was closed
  // NUEVO: Persistencia del contexto de playlist
  lastPlaylistContext?: {
    playlist: Track[];
    currentIndex: number;
    playlistName: string;
  } | null;
}

export interface PlaylistSettings {
  sortType: 'default' | 'name' | 'artist' | 'duration';
  sortOrder: 'asc' | 'desc';
}

export interface SettingsAPI {
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<boolean>;
}

export interface PlaylistAPI {
  savePlaylist: (name: string, tracks: Track[]) => Promise<boolean>;
  loadPlaylist: (name: string) => Promise<Track[]>;
  getPlaylists: () => Promise<string[]>;
  deletePlaylist: (name: string) => Promise<boolean>;
  renamePlaylist: (oldName: string, newName: string) => Promise<boolean>;
  loadPlaylistImage: (name: string) => Promise<string | null>;
  savePlaylistImage: (name: string, imageData: string) => Promise<boolean>;
  savePlaylistSettings: (name: string, settings: PlaylistSettings) => Promise<boolean>;
  loadPlaylistSettings: (name: string) => Promise<PlaylistSettings | null>;
}

export interface MusicLibraryProps {
  onTrackSelect: (track: Track, fromPlaylist?: Track[], trackIndex?: number) => void;
  currentView: string;
  searchResults: Track[];
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchQuery: string;
}

interface ImportManagerAPI {
  createTask: (playlistName: string, tracks: SpotifyTrack[]) => Promise<string>;
  getTasks: () => Promise<ImportTask[]>;
  pauseTask: (taskId: string) => Promise<boolean>;
  resumeTask: (taskId: string) => Promise<boolean>;
  cancelTask: (taskId: string, savePartial: boolean) => Promise<boolean>;
}

interface SpotifyTrack {
  trackName: string;
  artistName: string;
  durationMs: number;
}

interface ImportTask {
  id: string;
  playlistName: string;
  totalTracks: number;
  processedTracks: number;
  foundTracks: number;
  currentTrack: string;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  createdAt: number;
  completedAt?: number;
}

// NUEVO: Interfaz para gestión de almacenamiento
interface StorageAPI {
  setAudioQuality: (quality: 'low' | 'medium' | 'high') => Promise<boolean>;
  compressExistingFiles: (quality: 'low' | 'medium' | 'high') => Promise<{
    success: number;
    failed: number;
    spaceSaved: number;
  }>;
  getStorageStats: () => Promise<{
    totalFiles: number;
    totalSizeMB: number;
    avgFileSizeMB: number;
  }>;
  cleanupCacheBySize: (targetSizeMB: number) => Promise<{
    cleaned: number;
    spaceFreedomMB: number;
  }>;
}

// NUEVO: Interfaz para Discord Rich Presence
interface DiscordRPCAPI {
  connect: () => Promise<boolean>;
  disconnect: () => Promise<boolean>;
  setEnabled: (enabled: boolean) => Promise<boolean>;
  updatePresence: (trackInfo: {
    title: string;
    artist: string;
    duration: number;
    position: number;
    cover?: string;
    isPlaying: boolean;
  }) => Promise<boolean>;
  clearPresence: () => Promise<boolean>;
  updatePlayState: (isPlaying: boolean) => Promise<boolean>;
  updatePosition: (position: number) => Promise<boolean>;
  isEnabled: () => Promise<boolean>;
  isConnected: () => Promise<boolean>;
}

// NUEVO: Interfaz para funcionalidades del sistema
interface SystemAPI {
  setAutoStartup: (mode: 'no' | 'yes' | 'minimized') => Promise<boolean>;
  getAutoStartupStatus: () => Promise<'no' | 'yes' | 'minimized'>;
  showWindow: () => Promise<void>;
  hideWindow: () => Promise<void>;
  minimizeToTray: () => Promise<void>;
  setMinimizeToTray: (enabled: boolean) => Promise<boolean>;
}

declare global {
  interface Window {
    musicAPI: MusicAPI;
    settingsAPI: SettingsAPI;
    playlistAPI: PlaylistAPI;
    importManagerAPI?: ImportManagerAPI;
    storageAPI: StorageAPI;
    discordRPCAPI: DiscordRPCAPI; // NUEVO: Discord RPC API
    systemAPI: SystemAPI; // NUEVO: System API
    electronAPI?: {
      on: (channel: string, listener: (...args: any[]) => void) => void;
      removeListener: (channel: string, listener: (...args: any[]) => void) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
      // NUEVO: Soporte para eventos de compresión
      send?: (channel: string, ...args: any[]) => void;
    };
  }
}

// NUEVO: Asegurar que las interfaces se exporten correctamente
export {};
