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

const playlistAPI = {
  savePlaylist: (name: string, tracks: any[]) => ipcRenderer.invoke('save-playlist', name, tracks),
  loadPlaylist: (name: string) => ipcRenderer.invoke('load-playlist', name),
  getPlaylists: () => ipcRenderer.invoke('get-playlists'),
  deletePlaylist: (name: string) => ipcRenderer.invoke('delete-playlist', name),
};

contextBridge.exposeInMainWorld('playlistAPI', playlistAPI);
