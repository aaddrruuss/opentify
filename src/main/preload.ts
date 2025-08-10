import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("musicAPI", {
  searchMusic: (query: string) => ipcRenderer.invoke("search-music", query),
  getSongPath: async (videoId: string, title?: string) => {
    try {
      const path = await ipcRenderer.invoke("get-song-path", videoId, title);
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
});

contextBridge.exposeInMainWorld("settingsAPI", {
  loadSettings: () => ipcRenderer.invoke("load-settings"),
  saveSettings: (settings: any) => ipcRenderer.invoke("save-settings", settings),
});
