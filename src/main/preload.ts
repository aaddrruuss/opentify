import { contextBridge, ipcRenderer } from 'electron';

console.log("🔧 Configurando preload script...");

try {
  // Exponer APIs al renderer process
  contextBridge.exposeInMainWorld('electronAPI', {
    on: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.on(channel, listener);
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener);
    },
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args);
    },
  });

  contextBridge.exposeInMainWorld('musicAPI', {
    searchMusic: (query: string) => ipcRenderer.invoke('search-music', query),
    getSongPath: (videoId: string, title?: string, preload: boolean = false) => 
      ipcRenderer.invoke('get-song-path', videoId, title, preload),
    checkSongCache: (videoId: string) => ipcRenderer.invoke('check-song-cache', videoId),
  });

  contextBridge.exposeInMainWorld('settingsAPI', {
    loadSettings: () => ipcRenderer.invoke('load-settings'),
    saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  });

  contextBridge.exposeInMainWorld('playlistAPI', {
    savePlaylist: (name: string, tracks: any[]) => ipcRenderer.invoke('save-playlist', name, tracks),
    loadPlaylist: (name: string) => ipcRenderer.invoke('load-playlist', name),
    getPlaylists: () => ipcRenderer.invoke('get-playlists'),
    deletePlaylist: (name: string) => ipcRenderer.invoke('delete-playlist', name),
    renamePlaylist: (oldName: string, newName: string) => ipcRenderer.invoke('rename-playlist', oldName, newName),
    savePlaylistImage: (name: string, imageData: string) => ipcRenderer.invoke('save-playlist-image', name, imageData),
    loadPlaylistImage: (name: string) => ipcRenderer.invoke('load-playlist-image', name),
  });

  contextBridge.exposeInMainWorld('importManagerAPI', {
    createTask: (playlistName: string, tracks: any[]) => 
      ipcRenderer.invoke('import-manager-create-task', playlistName, tracks),
    getTasks: () => 
      ipcRenderer.invoke('import-manager-get-tasks'),
    pauseTask: (taskId: string) => 
      ipcRenderer.invoke('import-manager-pause-task', taskId),
    resumeTask: (taskId: string) => 
      ipcRenderer.invoke('import-manager-resume-task', taskId),
    cancelTask: (taskId: string, savePartial: boolean) => 
      ipcRenderer.invoke('import-manager-cancel-task', taskId, savePartial),
  });

  // API para gestión de almacenamiento
  contextBridge.exposeInMainWorld('storageAPI', {
    setAudioQuality: (quality: 'low' | 'medium' | 'high') => 
      ipcRenderer.invoke('set-audio-quality', quality),
    compressExistingFiles: (quality: 'low' | 'medium' | 'high') => 
      ipcRenderer.invoke('compress-existing-files', quality),
    getStorageStats: () => 
      ipcRenderer.invoke('get-storage-stats'),
    cleanupCacheBySize: (targetSizeMB: number) => 
      ipcRenderer.invoke('cleanup-cache-by-size', targetSizeMB),
  });

  // API para Discord Rich Presence
  contextBridge.exposeInMainWorld('discordRPCAPI', {
    connect: () => ipcRenderer.invoke('discord-rpc-connect'),
    disconnect: () => ipcRenderer.invoke('discord-rpc-disconnect'),
    setEnabled: (enabled: boolean) => ipcRenderer.invoke('discord-rpc-set-enabled', enabled),
    updatePresence: (trackInfo: any) => ipcRenderer.invoke('discord-rpc-update-presence', trackInfo),
    clearPresence: () => ipcRenderer.invoke('discord-rpc-clear-presence'),
    updatePlayState: (isPlaying: boolean) => ipcRenderer.invoke('discord-rpc-update-play-state', isPlaying),
    updatePosition: (position: number) => ipcRenderer.invoke('discord-rpc-update-position', position),
    isEnabled: () => ipcRenderer.invoke('discord-rpc-is-enabled'),
    isConnected: () => ipcRenderer.invoke('discord-rpc-is-connected'),
  });

  // NUEVO: API para funcionalidades del sistema
  contextBridge.exposeInMainWorld('systemAPI', {
    setAutoStartup: (mode: 'no' | 'yes' | 'minimized') => 
      ipcRenderer.invoke('system-set-auto-startup', mode),
    getAutoStartupStatus: () => 
      ipcRenderer.invoke('system-get-auto-startup'),
    showWindow: () => 
      ipcRenderer.invoke('system-show-window'),
    hideWindow: () => 
      ipcRenderer.invoke('system-hide-window'),
    minimizeToTray: () => 
      ipcRenderer.invoke('system-minimize-to-tray'),
    setMinimizeToTray: (enabled: boolean) => 
      ipcRenderer.invoke('system-set-minimize-to-tray', enabled),
  });

  console.log("✅ Preload script configurado correctamente");

} catch (error) {
  console.error("❌ Error configurando preload script:", error);
}
