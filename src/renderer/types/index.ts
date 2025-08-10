export interface Track {
  id: string;
  title: string;
  artist: string;
  album?: string;
  duration: string;
  cover?: string;
  thumbnail?: string;
}

export interface MusicAPI {
  searchMusic: (query: string) => Promise<Track[]>;
  getSongPath: (videoId: string, title?: string) => Promise<string | null>;
}

export interface Settings {
  volume: number;
  isMuted: boolean;
  repeatMode: "off" | "all" | "one";
  isShuffle: boolean;
  isDarkMode: boolean;
}

export interface SettingsAPI {
  loadSettings: () => Promise<Settings>;
  saveSettings: (settings: Settings) => Promise<boolean>;
}

declare global {
  interface Window {
    musicAPI: MusicAPI;
    settingsAPI: SettingsAPI;
  }
}
