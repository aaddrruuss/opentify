import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("musicAPI", {
  searchMusic: (query: string) => ipcRenderer.invoke("search-music", query),
  getSongPath: async (videoId: string, title?: string, preload: boolean = false) => {
    try {
      const path = await ipcRenderer.invoke("get-song-path", videoId, title, preload);
      if (path && process.platform === "win32") {
        // En Windows, convertir backslashes a forward slashes para URLs
        return path.replace(/\\/g, '/');
      }
      return path;
    } catch (error) {
      console.error("Error getting song path:", error);
      return null;
    }
  },
  checkSongCache: (videoId: string) => ipcRenderer.invoke("check-song-cache", videoId),
});

contextBridge.exposeInMainWorld("settingsAPI", {
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings: any) => ipcRenderer.invoke("save-settings", settings),
});

contextBridge.exposeInMainWorld("playlistAPI", {
  savePlaylist: (name: string, tracks: any[]) => ipcRenderer.invoke('save-playlist', name, tracks),
  loadPlaylist: (name: string) => ipcRenderer.invoke('load-playlist', name),
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  deletePlaylist: (name: string) => ipcRenderer.invoke('delete-playlist', name),
  renamePlaylist: (oldName: string, newName: string) => ipcRenderer.invoke("rename-playlist", oldName, newName),
  savePlaylistImage: (playlistName: string, imageData: string) => ipcRenderer.invoke("save-playlist-image", playlistName, imageData),
  loadPlaylistImage: (playlistName: string) => ipcRenderer.invoke("load-playlist-image", playlistName),
});

const importManagerAPI = {
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
};

const electronAPI = {
  on: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.on(channel, listener);
  },
  removeListener: (channel: string, listener: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, listener);
  },
};

contextBridge.exposeInMainWorld('importManagerAPI', importManagerAPI);
contextBridge.exposeInMainWorld('electronAPI', electronAPI);
