import { ipcMain, BrowserWindow, Notification } from "electron";
import path from "path";
import fs from "fs";
import { YouTube } from "youtube-sr";

interface ImportTask {
  id: string;
  playlistName: string;
  totalTracks: number;
  processedTracks: number;
  foundTracks: number;
  currentTrack: string;
  status: 'running' | 'paused' | 'completed' | 'cancelled';
  tracks: SpotifyTrack[];
  processedResults: ImportedTrack[];
  createdAt: number;
  completedAt?: number;
}

interface SpotifyTrack {
  trackName: string;
  artistName: string;
  durationMs: number;
}

interface ImportedTrack extends SpotifyTrack {
  status: 'pending' | 'searching' | 'found' | 'not_found';
  matchedTrack?: any;
  searchResults?: any[];
}

class BackgroundImportManager {
  private activeTasks = new Map<string, ImportTask>();
  private persistenceFile: string;
  private processingQueue: string[] = [];
  private isProcessing = false;
  private mainWindow: BrowserWindow | null = null;

  constructor() {
    const { app } = require("electron");
    this.persistenceFile = path.join(app.getPath("userData"), "adrus-music", "imports.json");
    this.loadPersistedTasks();
  }

  setMainWindow(window: BrowserWindow) {
    this.mainWindow = window;
  }

  // Persistencia - guardar tareas
  private saveTasks() {
    try {
      const tasksData = Array.from(this.activeTasks.values());
      const dir = path.dirname(this.persistenceFile);
      
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      fs.writeFileSync(this.persistenceFile, JSON.stringify(tasksData, null, 2));
      console.log(`💾 Guardadas ${tasksData.length} tareas de importación`);
    } catch (error) {
      console.error("Error guardando tareas de importación:", error);
    }
  }

  // Persistencia - cargar tareas
  private loadPersistedTasks() {
    try {
      if (fs.existsSync(this.persistenceFile)) {
        const tasksData = JSON.parse(fs.readFileSync(this.persistenceFile, 'utf8'));
        
        for (const taskData of tasksData) {
          if (taskData.status === 'running') {
            taskData.status = 'paused'; // Reanudar como pausado
          }
          
          this.activeTasks.set(taskData.id, taskData);
          
          if (taskData.status === 'paused') {
            this.processingQueue.push(taskData.id);
          }
        }
        
        console.log(`📁 Cargadas ${tasksData.length} tareas de importación persistidas`);
        
        // Auto-reanudar tareas pausadas después de 3 segundos
        if (this.processingQueue.length > 0) {
          setTimeout(() => {
            console.log("🔄 Auto-reanudando tareas pausadas...");
            this.processQueue();
          }, 3000);
        }
      }
    } catch (error) {
      console.error("Error cargando tareas persistidas:", error);
    }
  }

  // Crear nueva tarea de importación
  createTask(playlistName: string, tracks: SpotifyTrack[]): string {
    const taskId = `import_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const task: ImportTask = {
      id: taskId,
      playlistName,
      totalTracks: tracks.length,
      processedTracks: 0,
      foundTracks: 0,
      currentTrack: '',
      status: 'running',
      tracks,
      processedResults: tracks.map(t => ({ ...t, status: 'pending' })),
      createdAt: Date.now()
    };
    
    this.activeTasks.set(taskId, task);
    this.processingQueue.push(taskId);
    this.saveTasks();
    
    console.log(`🚀 Nueva tarea de importación creada: ${taskId} (${tracks.length} canciones)`);
    
    // Notificar al frontend
    this.notifyFrontend('task-created', task);
    
    // Iniciar procesamiento
    if (!this.isProcessing) {
      this.processQueue();
    }
    
    return taskId;
  }

  // Pausar tarea
  pauseTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (task && task.status === 'running') {
      task.status = 'paused';
      this.saveTasks();
      this.notifyFrontend('task-updated', task);
      console.log(`⏸️ Tarea pausada: ${taskId}`);
      return true;
    }
    return false;
  }

  // Reanudar tarea
  resumeTask(taskId: string): boolean {
    const task = this.activeTasks.get(taskId);
    if (task && task.status === 'paused') {
      task.status = 'running';
      
      if (!this.processingQueue.includes(taskId)) {
        this.processingQueue.push(taskId);
      }
      
      this.saveTasks();
      this.notifyFrontend('task-updated', task);
      console.log(`▶️ Tarea reanudada: ${taskId}`);
      
      if (!this.isProcessing) {
        this.processQueue();
      }
      
      return true;
    }
    return false;
  }

  // Cancelar tarea
  cancelTask(taskId: string, savePartial: boolean = false): boolean {
    const task = this.activeTasks.get(taskId);
    if (!task) return false;
    
    if (savePartial && task.foundTracks > 0) {
      // Crear playlist parcial
      this.savePartialPlaylist(task);
    }
    
    task.status = 'cancelled';
    this.saveTasks();
    this.notifyFrontend('task-updated', task);
    
    // Remover de la cola de procesamiento
    const queueIndex = this.processingQueue.indexOf(taskId);
    if (queueIndex > -1) {
      this.processingQueue.splice(queueIndex, 1);
    }
    
    console.log(`❌ Tarea cancelada: ${taskId} (guardado parcial: ${savePartial})`);
    return true;
  }

  // Obtener todas las tareas activas
  getActiveTasks(): ImportTask[] {
    return Array.from(this.activeTasks.values())
      .filter(task => task.status !== 'completed' && task.status !== 'cancelled');
  }

  // Procesar cola de tareas
  private async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }
    
    this.isProcessing = true;
    console.log(`🔄 Iniciando procesamiento de ${this.processingQueue.length} tareas`);
    
    while (this.processingQueue.length > 0) {
      const taskId = this.processingQueue[0];
      const task = this.activeTasks.get(taskId);
      
      if (!task || task.status !== 'running') {
        this.processingQueue.shift();
        continue;
      }
      
      await this.processTask(task);
      this.processingQueue.shift();
    }
    
    this.isProcessing = false;
    console.log("✅ Procesamiento de cola completado");
  }

  // Procesar una tarea individual
  private async processTask(task: ImportTask) {
    console.log(`🎵 Procesando tarea: ${task.playlistName} (${task.processedTracks}/${task.totalTracks})`);
    
    // Configuración conservadora para no interferir con la reproducción
    const batchSize = 1;
    const batchDelay = 2000; // 2 segundos entre canciones
    const searchTimeout = 12000; // 12 segundos timeout
    
    for (let i = task.processedTracks; i < task.totalTracks; i++) {
      // Verificar si la tarea sigue activa
      if (task.status !== 'running') {
        console.log(`⏸️ Tarea pausada/cancelada: ${task.id}`);
        return;
      }
      
      const trackData = task.processedResults[i];
      if (trackData.status !== 'pending') {
        continue; // Ya procesado
      }
      
      task.currentTrack = trackData.trackName;
      trackData.status = 'searching';
      
      try {
        // Búsqueda con timeout
        const searchQuery = this.buildSearchQuery(trackData);
        console.log(`🔍 [${i + 1}/${task.totalTracks}] "${searchQuery}"`);
        
        const searchResults = await this.searchWithTimeout(searchQuery, searchTimeout);
        trackData.searchResults = searchResults;
        
        // Buscar mejor coincidencia
        const bestMatch = this.findBestMatch(searchResults, trackData.durationMs);
        
        if (bestMatch) {
          trackData.matchedTrack = {
            ...bestMatch,
            title: trackData.trackName,
            artist: trackData.artistName
          };
          trackData.status = 'found';
          task.foundTracks++;
          console.log(`✅ [${i + 1}/${task.totalTracks}] Encontrada: ${trackData.trackName}`);
        } else {
          trackData.status = 'not_found';
          console.log(`⚠️ [${i + 1}/${task.totalTracks}] No encontrada: ${trackData.trackName}`);
        }
        
      } catch (error) {
        trackData.status = 'not_found';
        console.error(`❌ Error buscando "${trackData.trackName}":`, error);
      }
      
      task.processedTracks = i + 1;
      this.saveTasks();
      this.notifyFrontend('task-updated', task);
      
      // Delay entre canciones para no sobrecargar
      if (i < task.totalTracks - 1) {
        await new Promise(resolve => setTimeout(resolve, batchDelay));
      }
    }
    
    // Completar tarea
    task.status = 'completed';
    task.completedAt = Date.now();
    task.currentTrack = '';
    
    // Guardar playlist completa
    await this.saveCompletePlaylist(task);
    
    this.saveTasks();
    this.notifyFrontend('task-completed', task);
    
    // Mostrar notificación de Windows
    this.showCompletionNotification(task);
    
    console.log(`🎉 Tarea completada: ${task.playlistName} (${task.foundTracks}/${task.totalTracks} encontradas)`);
  }

  // Construir query de búsqueda optimizada
  private buildSearchQuery(track: SpotifyTrack): string {
    const cleanTitle = track.trackName.replace(/[^\w\s]/g, '').trim();
    const mainArtist = track.artistName.split(',')[0].split('&')[0].split('feat')[0].trim();
    return `${mainArtist} ${cleanTitle}`.substring(0, 50);
  }

  // Búsqueda con timeout
  private async searchWithTimeout(query: string, timeout: number): Promise<any[]> {
    const { YouTube } = require("youtube-sr");
    
    const searchPromise = YouTube.search(query, {
      limit: 8,
      type: "video",
    });
    
    const timeoutPromise = new Promise<never>((_, reject) => 
      setTimeout(() => reject(new Error('Search timeout')), timeout)
    );
    
    const videos = await Promise.race([searchPromise, timeoutPromise]);
    
    // Filtrar y mapear resultados
    const filteredVideos = videos
      .filter((video: any) => {
        const duration = video.duration;
        return duration && duration > 0 && Math.floor(duration / 1000) <= 900;
      })
      .slice(0, 6);

    return filteredVideos.map((video: any) => ({
      id: video.id!,
      title: video.title || "Sin título",
      artist: video.channel?.name || "Unknown Artist",
      duration: video.durationFormatted || "0:00",
      thumbnail: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`,
      cover: `https://img.youtube.com/vi/${video.id}/hqdefault.jpg`
    }));
  }

  // Encontrar mejor coincidencia por duración
  private findBestMatch(searchResults: any[], targetDurationMs: number): any | null {
    if (searchResults.length === 0) return null;
    
    let bestMatch = searchResults[0];
    let smallestDifference = Infinity;
    
    for (const track of searchResults) {
      const durationParts = track.duration.split(':');
      if (durationParts.length !== 2) continue;
      
      const minutes = parseInt(durationParts[0]) || 0;
      const seconds = parseInt(durationParts[1]) || 0;
      const trackDurationMs = (minutes * 60 + seconds) * 1000;
      
      const difference = Math.abs(trackDurationMs - targetDurationMs);
      
      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestMatch = track;
      }
    }
    
    // Ser más permisivo: hasta 2 minutos de diferencia
    const maxDifference = 120000; // 2 minutos
    return smallestDifference <= maxDifference ? bestMatch : null;
  }

  // Guardar playlist parcial
  private async savePartialPlaylist(task: ImportTask) {
    const successfulTracks = task.processedResults
      .filter(track => track.status === 'found' && track.matchedTrack)
      .map(track => track.matchedTrack!);
    
    if (successfulTracks.length === 0) return;
    
    try {
      const partialName = `${task.playlistName} (Parcial - ${successfulTracks.length} canciones)`;
      await this.savePlaylistToFile(partialName, successfulTracks);
      console.log(`💾 Playlist parcial guardada: ${partialName}`);
    } catch (error) {
      console.error("Error guardando playlist parcial:", error);
    }
  }

  // Guardar playlist completa
  private async saveCompletePlaylist(task: ImportTask) {
    const successfulTracks = task.processedResults
      .filter(track => track.status === 'found' && track.matchedTrack)
      .map(track => track.matchedTrack!);
    
    if (successfulTracks.length === 0) return;
    
    try {
      await this.savePlaylistToFile(task.playlistName, successfulTracks);
      console.log(`💾 Playlist completa guardada: ${task.playlistName}`);
    } catch (error) {
      console.error("Error guardando playlist completa:", error);
    }
  }

  // Guardar playlist a archivo (reutilizar lógica existente)
  private async savePlaylistToFile(name: string, tracks: any[]) {
    // Importar funciones necesarias del ipcHandlers
    const { savePlaylist } = require("./ipcHandlers");
    await savePlaylist(name, tracks);
  }

  // Notificar al frontend
  private notifyFrontend(event: string, data: any) {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('import-manager', { event, data });
    }
  }

  // Mostrar notificación de Windows
  private showCompletionNotification(task: ImportTask) {
    try {
      const notification = new Notification({
        title: '🎵 Importación Completada',
        body: `"${task.playlistName}" - ${task.foundTracks}/${task.totalTracks} canciones importadas`,
        icon: path.join(__dirname, '../../assets/icon.png'), // Opcional
      });
      
      notification.show();
      
      notification.on('click', () => {
        if (this.mainWindow) {
          this.mainWindow.focus();
        }
      });
      
    } catch (error) {
      console.error("Error mostrando notificación:", error);
    }
  }
}

// Instancia singleton
const importManager = new BackgroundImportManager();

// Configurar handlers IPC
export function setupImportManagerHandlers() {
  ipcMain.handle("import-manager-create-task", async (event, playlistName: string, tracks: SpotifyTrack[]) => {
    return importManager.createTask(playlistName, tracks);
  });

  ipcMain.handle("import-manager-get-tasks", async () => {
    return importManager.getActiveTasks();
  });

  ipcMain.handle("import-manager-pause-task", async (event, taskId: string) => {
    return importManager.pauseTask(taskId);
  });

  ipcMain.handle("import-manager-resume-task", async (event, taskId: string) => {
    return importManager.resumeTask(taskId);
  });

  ipcMain.handle("import-manager-cancel-task", async (event, taskId: string, savePartial: boolean) => {
    return importManager.cancelTask(taskId, savePartial);
  });
}

export { importManager };
