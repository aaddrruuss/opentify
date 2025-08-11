import React, { useState, useEffect } from 'react';
import { X, Play, Pause, Square, Download, AlertCircle, CheckCircle, Clock, Music } from 'lucide-react';

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

interface ImportManagerPopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ImportManagerPopup({ isOpen, onClose }: ImportManagerPopupProps) {
  const [tasks, setTasks] = useState<ImportTask[]>([]);
  const [showCancelDialog, setShowCancelDialog] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Cargar tareas al abrir
  useEffect(() => {
    if (isOpen) {
      loadTasks();
      
      // Escuchar actualizaciones del manager
      const handleImportUpdate = (event: any, data: any) => {
        switch (data.event) {
          case 'task-created':
          case 'task-updated':
            setTasks(prev => {
              const index = prev.findIndex(t => t.id === data.data.id);
              if (index >= 0) {
                const newTasks = [...prev];
                newTasks[index] = data.data;
                return newTasks;
              } else {
                return [...prev, data.data];
              }
            });
            break;
          case 'task-completed':
            // Opcional: remover tarea completada después de un tiempo
            setTimeout(() => {
              setTasks(prev => prev.filter(t => t.id !== data.data.id));
            }, 10000); // 10 segundos
            break;
        }
      };

      window.electronAPI?.on('import-manager', handleImportUpdate);
      
      return () => {
        window.electronAPI?.removeListener('import-manager', handleImportUpdate);
      };
    }
  }, [isOpen]);

  const loadTasks = async () => {
    try {
      setIsLoading(true);
      const activeTasks = await window.importManagerAPI?.getTasks();
      setTasks(activeTasks || []);
    } catch (error) {
      console.error("Error cargando tareas:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePauseResume = async (taskId: string, currentStatus: string) => {
    try {
      if (currentStatus === 'running') {
        await window.importManagerAPI?.pauseTask(taskId);
      } else if (currentStatus === 'paused') {
        await window.importManagerAPI?.resumeTask(taskId);
      }
    } catch (error) {
      console.error("Error pausando/reanudando tarea:", error);
    }
  };

  const handleCancel = async (taskId: string, savePartial: boolean) => {
    try {
      await window.importManagerAPI?.cancelTask(taskId, savePartial);
      setShowCancelDialog(null);
    } catch (error) {
      console.error("Error cancelando tarea:", error);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Download className="h-4 w-4 text-blue-500 animate-pulse" />;
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-500" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'cancelled':
        return <AlertCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'running': return 'Importando';
      case 'paused': return 'Pausado';
      case 'completed': return 'Completado';
      case 'cancelled': return 'Cancelado';
      default: return 'Desconocido';
    }
  };

  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getProgressPercentage = (processed: number, total: number) => {
    return total > 0 ? Math.round((processed / total) * 100) : 0;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Music className="h-6 w-6 text-blue-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                Importaciones en Segundo Plano
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Gestiona tus importaciones de Spotify mientras usas la aplicación
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 pb-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Cargando importaciones...</span>
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12">
              <Music className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
              <p className="text-gray-500 dark:text-gray-400 mb-2">
                No hay importaciones activas
              </p>
              <p className="text-sm text-gray-400 dark:text-gray-500">
                Las importaciones aparecerán aquí cuando las inicies
              </p>
            </div>
          ) : (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {tasks.map((task) => (
                <div
                  key={task.id}
                  className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  {/* Task Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        {getStatusIcon(task.status)}
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {task.playlistName}
                        </h3>
                        <span className="text-xs px-2 py-1 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200">
                          {getStatusText(task.status)}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span>{task.foundTracks}/{task.totalTracks} encontradas</span>
                        <span>Iniciado: {formatTime(task.createdAt)}</span>
                        {task.completedAt && (
                          <span>Completado: {formatTime(task.completedAt)}</span>
                        )}
                      </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-2 ml-4">
                      {(task.status === 'running' || task.status === 'paused') && (
                        <>
                          <button
                            onClick={() => handlePauseResume(task.id, task.status)}
                            className="p-2 rounded-md bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800 transition-colors"
                            title={task.status === 'running' ? 'Pausar' : 'Reanudar'}
                          >
                            {task.status === 'running' ? (
                              <Pause className="h-4 w-4" />
                            ) : (
                              <Play className="h-4 w-4" />
                            )}
                          </button>
                          <button
                            onClick={() => setShowCancelDialog(task.id)}
                            className="p-2 rounded-md bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800 transition-colors"
                            title="Cancelar"
                          >
                            <Square className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600 dark:text-gray-400">
                        Progreso: {task.processedTracks}/{task.totalTracks} 
                        ({getProgressPercentage(task.processedTracks, task.totalTracks)}%)
                      </span>
                      {task.status === 'running' && task.currentTrack && (
                        <span className="text-blue-600 dark:text-blue-400 truncate max-w-xs">
                          🎵 {task.currentTrack}
                        </span>
                      )}
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          task.status === 'completed' 
                            ? 'bg-green-500' 
                            : task.status === 'cancelled'
                            ? 'bg-red-500'
                            : 'bg-blue-500'
                        }`}
                        style={{
                          width: `${getProgressPercentage(task.processedTracks, task.totalTracks)}%`
                        }}
                      />
                    </div>
                  </div>

                  {/* Success Rate */}
                  {task.processedTracks > 0 && (
                    <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                      Tasa de éxito: {Math.round((task.foundTracks / task.processedTracks) * 100)}%
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cancel Confirmation Dialog */}
      {showCancelDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-60">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-md mx-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
              Cancelar Importación
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              ¿Qué quieres hacer con las canciones ya encontradas?
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => handleCancel(showCancelDialog, true)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Guardar canciones encontradas
              </button>
              <button
                onClick={() => handleCancel(showCancelDialog, false)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
              >
                Descartar todo
              </button>
              <button
                onClick={() => setShowCancelDialog(null)}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
