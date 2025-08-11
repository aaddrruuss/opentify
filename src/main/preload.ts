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

  console.log("✅ Preload script configurado correctamente");

} catch (error) {
  console.error("❌ Error configurando preload script:", error);
}
