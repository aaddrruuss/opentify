import React, { useState, useEffect } from 'react';
import { Sun, Moon, HardDrive, Download, Zap, MessageSquare, Power, Minimize2 } from 'lucide-react';

interface SettingsViewProps {
  isDarkMode: boolean;
  onToggleDarkMode: (darkMode: boolean) => void;
  // NUEVO: Props de compresión desde App
  isCompressing: boolean;
  setIsCompressing: (value: boolean) => void;
  compressionProgress: {
    processed: number;
    total: number;
    current: string;
    success: number;
    failed: number;
  } | null;
  setCompressionProgress: (progress: {
    processed: number;
    total: number;
    current: string;
    success: number;
    failed: number;
  } | null) => void;
  compressionResult: string | null;
  setCompressionResult: (value: string | null) => void;
}

interface CompressionProgress {
  processed: number;
  total: number;
  current: string;
  success: number;
  failed: number;
}

interface StorageStats {
  totalFiles: number;
  totalSizeMB: number;
  avgFileSizeMB: number;
}
export function SettingsView({ 
  isDarkMode, 
  onToggleDarkMode,
  isCompressing,
  setIsCompressing,
  compressionProgress,
  setCompressionProgress,
  compressionResult,
  setCompressionResult
}: SettingsViewProps) {
  const [audioQuality, setAudioQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [storageStats, setStorageStats] = useState<StorageStats>({ totalFiles: 0, totalSizeMB: 0, avgFileSizeMB: 0 });
  const [discordRPCEnabled, setDiscordRPCEnabled] = useState<boolean | null>(null);
  const [discordRPCConnected, setDiscordRPCConnected] = useState<boolean>(false);
  // NUEVO: Estados para funcionalidades del sistema con valores null para indicar "no cargado"
  const [autoStartup, setAutoStartup] = useState<'no' | 'yes' | 'minimized' | null>(null);
  const [minimizeToTray, setMinimizeToTray] = useState<boolean | null>(null);
  const [settingsLoaded, setSettingsLoaded] = useState<boolean>(false);

  // NUEVO: Cargar configuraciones al iniciar
  useEffect(() => {
    const loadSettings = async () => {
      try {
        let settings = null;
        
        if (window.settingsAPI) {
          settings = await window.settingsAPI.loadSettings();
          if (settings.audioQuality) {
            setAudioQuality(settings.audioQuality);
            console.log(`📊 Calidad de audio cargada: ${settings.audioQuality}`);
          }
          
          // ARREGLADO: Cargar configuración de Discord RPC con fallback apropiado
          const discordRPCValue = settings.discordRPCEnabled !== undefined ? settings.discordRPCEnabled : true;
          setDiscordRPCEnabled(discordRPCValue);
          console.log(`🎮 Discord RPC cargado: ${discordRPCValue}`);

          // ARREGLADO: Cargar configuraciones del sistema con fallbacks apropiados
          const autoStartupValue = settings.autoStartup !== undefined ? settings.autoStartup : 'no';
          setAutoStartup(autoStartupValue);
          console.log(`🚀 Auto-startup cargado: ${autoStartupValue}`);

          const minimizeToTrayValue = settings.minimizeToTray !== undefined ? settings.minimizeToTray : false;
          setMinimizeToTray(minimizeToTrayValue);
          console.log(`📱 Minimize to tray cargado: ${minimizeToTrayValue}`);
        } else {
          // Si no hay API, usar valores por defecto
          setDiscordRPCEnabled(true);
          setAutoStartup('no');
          setMinimizeToTray(false);
          console.log('⚠️ Settings API no disponible, usando valores por defecto');
        }

        // Verificar estado de conexión de Discord RPC (sin sobrescribir la configuración)
        if (window.discordRPCAPI) {
          // ARREGLADO: Solo verificar conexión, NO sobrescribir la configuración cargada
          const connected = await window.discordRPCAPI.isConnected();
          setDiscordRPCConnected(connected);
          
          // ARREGLADO: Sincronizar el servicio RPC con la configuración guardada
          // Usar el valor de discordRPCEnabled que ya se estableció en el estado
          const currentDiscordRPCEnabled = settings?.discordRPCEnabled !== undefined ? settings.discordRPCEnabled : true;
          await window.discordRPCAPI.setEnabled(currentDiscordRPCEnabled);
          console.log(`🔄 Sincronizando Discord RPC con configuración guardada: ${currentDiscordRPCEnabled}`);
        }

        // NUEVO: Verificar que la configuración del sistema esté sincronizada con la configuración guardada
        if (window.systemAPI && settings && settings.autoStartup) {
          try {
            const currentSystemStartup = await window.systemAPI.getAutoStartupStatus();
            if (currentSystemStartup !== settings.autoStartup) {
              // Sincronizar la configuración del sistema con la configuración guardada
              console.log(`🔄 Sincronizando auto-startup: configuración=${settings.autoStartup}, sistema=${currentSystemStartup}`);
              await window.systemAPI.setAutoStartup(settings.autoStartup);
            }
          } catch (error) {
            console.error("Error sincronizando auto-startup:", error);
          }
        }
        // NUEVO: Marcar configuraciones como cargadas
        setSettingsLoaded(true);
        console.log('✅ Configuraciones cargadas completamente');
        
      } catch (error) {
        console.error("Error cargando configuraciones:", error);
        // Establecer valores por defecto en caso de error
        setDiscordRPCEnabled(true);
        setAutoStartup('no');
        setMinimizeToTray(false);
        setSettingsLoaded(true);
      }
    };

    loadSettings();

    // NUEVO: Configurar listeners para eventos de compresión
    if (window.electronAPI) {
      const handleCompressionProgress = (event: any, progress: CompressionProgress) => {
        console.log("📊 Progreso recibido:", progress);
        setCompressionProgress(progress);
      };
      
      const handleCompressionCompleted = (event: any, result: { success: number, failed: number, spaceSaved: number }) => {
        console.log("✅ Compresión completada:", result);
        
        // CORREGIDO: Limpiar estados de compresión
        setIsCompressing(false);
        setCompressionProgress(null);
        
        const savedMB = (result.spaceSaved / (1024 * 1024)).toFixed(2);
        const resultText = `Compresión completada:\n✅ ${result.success} archivos exitosos\n❌ ${result.failed} errores\n💾 ${savedMB}MB ahorrados`;
        setCompressionResult(resultText);
        
        // Auto-ocultar resultado después de 8 segundos
        setTimeout(() => setCompressionResult(null), 8000);
      };
      
      window.electronAPI.on('compression-progress', handleCompressionProgress);
      window.electronAPI.on('compression-completed', handleCompressionCompleted);
      
      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeListener('compression-progress', handleCompressionProgress);
          window.electronAPI.removeListener('compression-completed', handleCompressionCompleted);
        }
      };
    }
  }, [setIsCompressing, setCompressionProgress, setCompressionResult]);

  // NUEVO: Actualización automática de estadísticas cada segundo
  useEffect(() => {
    const loadStorageStats = async () => {
      try {
        if (window.storageAPI) {
          const stats = await window.storageAPI.getStorageStats();
          setStorageStats(stats);
        }
      } catch (error) {
        console.error("Error cargando estadísticas:", error);
      }
    };

    // Cargar inmediatamente
    loadStorageStats();

    // Actualizar cada segundo
    const intervalId = setInterval(loadStorageStats, 1000);

    return () => clearInterval(intervalId);
  }, []);

  const handleDarkModeToggle = () => {
    onToggleDarkMode(!isDarkMode);
  };

  const handleQualityChange = async (quality: 'low' | 'medium' | 'high') => {
    try {
      setAudioQuality(quality);
      if (window.storageAPI) {
        await window.storageAPI.setAudioQuality(quality);
      }
    } catch (error) {
      console.error("Error configurando calidad:", error);
    }
  };

  const handleDiscordRPCToggle = async () => {
    try {
      const newEnabled = !discordRPCEnabled;
      setDiscordRPCEnabled(newEnabled);

      if (window.discordRPCAPI) {
        await window.discordRPCAPI.setEnabled(newEnabled);
        
        // Verificar estado de conexión después del cambio
        setTimeout(async () => {
          const connected = await window.discordRPCAPI.isConnected();
          setDiscordRPCConnected(connected);
        }, 1000);
      }
      
      // NUEVO: Guardar también en el archivo de configuraciones para persistencia
      if (window.settingsAPI) {
        const currentSettings = await window.settingsAPI.loadSettings();
        currentSettings.discordRPCEnabled = newEnabled;
        await window.settingsAPI.saveSettings(currentSettings);
        console.log(`💾 Discord RPC guardado en configuraciones: ${newEnabled}`);
      }
    } catch (error) {
      console.error("Error configurando Discord RPC:", error);
    }
  };

  const handleCompressExisting = async () => {
    if (isCompressing) return;
    
    console.log("🔄 Iniciando compresión de archivos");
    
    // CORREGIDO: Configurar estados iniciales
    setIsCompressing(true);
    setCompressionProgress({
      processed: 0,
      total: 0,
      current: 'Preparando compresión...',
      success: 0,
      failed: 0
    });
    setCompressionResult(null);
    
    try {
      if (window.storageAPI) {
        // El progreso y resultado se manejan via eventos
        await window.storageAPI.compressExistingFiles(audioQuality);
        console.log("🎯 Llamada de compresión completada");
      }
    } catch (error) {
      console.error("❌ Error comprimiendo archivos:", error);
      
      // CORREGIDO: Limpiar estados en caso de error
      setCompressionResult("❌ Error durante la compresión");
      setIsCompressing(false);
      setCompressionProgress(null);
    }
  };

  // NUEVO: Handlers para configuraciones del sistema
  const handleAutoStartupChange = async (mode: 'no' | 'yes' | 'minimized') => {
    try {
      setAutoStartup(mode);
      
      // Configurar en el sistema
      if (window.systemAPI) {
        await window.systemAPI.setAutoStartup(mode);
        console.log(`🚀 Auto-startup configurado a: ${mode}`);
      }
      
      // NUEVO: Guardar también en el archivo de configuraciones para persistencia
      if (window.settingsAPI) {
        const currentSettings = await window.settingsAPI.loadSettings();
        currentSettings.autoStartup = mode;
        await window.settingsAPI.saveSettings(currentSettings);
        console.log(`💾 Auto-startup guardado en configuraciones: ${mode}`);
      }
    } catch (error) {
      console.error("Error configurando auto-startup:", error);
    }
  };

  const handleMinimizeToTrayToggle = async () => {
    try {
      const newValue = !minimizeToTray;
      setMinimizeToTray(newValue);
      
      // Configurar en el sistema
      if (window.systemAPI) {
        await window.systemAPI.setMinimizeToTray(newValue);
        console.log(`📱 Minimize to tray configurado a: ${newValue}`);
      }
      
      // NUEVO: Guardar también en el archivo de configuraciones para persistencia
      if (window.settingsAPI) {
        const currentSettings = await window.settingsAPI.loadSettings();
        currentSettings.minimizeToTray = newValue;
        await window.settingsAPI.saveSettings(currentSettings);
        console.log(`💾 Minimize to tray guardado en configuraciones: ${newValue}`);
      }
    } catch (error) {
      console.error("Error configurando minimize to tray:", error);
    }
  };

  const getQualityInfo = (quality: 'low' | 'medium' | 'high') => {
    const info = {
      low: { bitrate: '96K', size: '~1MB/min', description: 'Máxima compresión' },
      medium: { bitrate: '128K', size: '~1.5MB/min', description: 'Equilibrado' },
      high: { bitrate: '192K', size: '~2.5MB/min', description: 'Alta calidad' }
    };
    return info[quality];
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Configuración
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Personaliza la apariencia y gestión de almacenamiento
        </p>
      </div>

      {/* Apariencia */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              {isDarkMode ? (
                <Moon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              ) : (
                <Sun className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              )}
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Apariencia
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Cambia entre tema claro y oscuro
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div className="flex items-center space-x-3">
              {isDarkMode ? (
                <Moon className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              ) : (
                <Sun className="h-5 w-5 text-gray-600 dark:text-gray-400" />
              )}
              <div>
                <p className="font-medium text-gray-900 dark:text-gray-100">
                  Modo Oscuro
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Activa o desactiva el tema oscuro
                </p>
              </div>
            </div>
            
            <button
              onClick={handleDarkModeToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:ring-offset-2 ${
                isDarkMode ? 'bg-[#2196F3]' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isDarkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Discord Rich Presence */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <MessageSquare className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Discord Rich Presence
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Muestra lo que estás escuchando en tu perfil de Discord
              </p>
            </div>
          </div>

          {settingsLoaded && discordRPCEnabled !== null ? (
            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <div className="flex items-center space-x-3">
                <MessageSquare className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    Rich Presence
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {discordRPCConnected 
                      ? "Conectado - Mostrando tu música actual" 
                      : discordRPCEnabled 
                        ? "Habilitado - Intentando conectar..."
                        : "Deshabilitado"
                    }
                  </p>
                </div>
              </div>
              
              <button
                onClick={handleDiscordRPCToggle}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:ring-offset-2 ${
                  discordRPCEnabled ? 'bg-[#2196F3]' : 'bg-gray-200'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    discordRPCEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          ) : (
            <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
              <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
              <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
            </div>
          )}

          {settingsLoaded && discordRPCEnabled === true && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm text-blue-800 dark:text-blue-200">
                <strong>Nota:</strong> Discord debe estar abierto para mostrar tu actividad musical. 
                La información se actualiza automáticamente mientras reproduces música.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Calidad de Audio */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Download className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Calidad de Descarga
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configura la compresión de archivos de audio
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {(['low', 'medium', 'high'] as const).map((quality) => {
              const info = getQualityInfo(quality);
              return (
                <div
                  key={quality}
                  className={`p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                    audioQuality === quality
                      ? 'border-[#2196F3] bg-blue-50 dark:bg-blue-900/20'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  }`}
                  onClick={() => handleQualityChange(quality)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 capitalize">
                        {quality === 'low' && 'Baja'} 
                        {quality === 'medium' && 'Media'} 
                        {quality === 'high' && 'Alta'}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {info.bitrate} • {info.size} • {info.description}
                      </p>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 ${
                      audioQuality === quality 
                        ? 'bg-[#2196F3] border-[#2196F3]' 
                        : 'border-gray-300 dark:border-gray-500'
                    }`} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Gestión de Almacenamiento */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <HardDrive className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Gestión de Almacenamiento
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Optimiza el espacio utilizado por las canciones
              </p>
            </div>
          </div>

          {/* Estadísticas actualizadas automáticamente */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {storageStats.totalFiles}
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Archivos</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {storageStats.totalSizeMB}MB
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total</p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 text-center">
              <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                {storageStats.avgFileSizeMB}MB
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">Promedio</p>
            </div>
          </div>

          {/* CORREGIDO: Indicador sutil de compresión con mejor lógica */}
          {(isCompressing || compressionProgress) && (
            <div className="mb-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-500 border-t-transparent"></div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {compressionProgress?.current || 'Iniciando compresión...'}
                    </span>
                    {compressionProgress && compressionProgress.total > 0 && (
                      <span className="text-xs text-blue-600 dark:text-blue-300">
                        {compressionProgress.processed}/{compressionProgress.total}
                      </span>
                    )}
                  </div>
                  
                  {compressionProgress && compressionProgress.total > 0 && (
                    <>
                      <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-1.5 mb-1">
                        <div 
                          className="bg-blue-500 dark:bg-blue-400 h-1.5 rounded-full transition-all duration-300"
                          style={{ 
                            width: `${(compressionProgress.processed / compressionProgress.total) * 100}%`
                          }}
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-blue-700 dark:text-blue-300 truncate flex-1 mr-2">
                          Progreso: {((compressionProgress.processed / compressionProgress.total) * 100).toFixed(1)}%
                        </p>
                        <div className="flex gap-2 text-xs text-blue-600 dark:text-blue-300">
                          <span>✅{compressionProgress.success}</span>
                          <span>❌{compressionProgress.failed}</span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Resultado de compresión */}
          {compressionResult && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <pre className="text-sm text-blue-800 dark:text-blue-200 whitespace-pre-line">
                {compressionResult}
              </pre>
            </div>
          )}

          {/* CORREGIDO: Botón con estado correcto */}
          <div className="space-y-3">
            <button
              onClick={handleCompressExisting}
              disabled={isCompressing}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCompressing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Comprimiendo...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4" />
                  Comprimir Archivos Existentes
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* NUEVO: Configuraciones del Sistema */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Power className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
                Configuraciones del Sistema
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Controla el comportamiento de la aplicación en tu sistema
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Auto-startup */}
            {settingsLoaded && autoStartup !== null ? (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <Power className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">
                        Iniciar automáticamente al encender el ordenador
                      </p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Configura como se inicia Opentify con tu sistema
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  {([
                    { value: 'no', label: 'No', description: 'No iniciar automáticamente' },
                    { value: 'yes', label: 'Sí', description: 'Iniciar normalmente' },
                    { value: 'minimized', label: 'Minimizado', description: 'Iniciar en la bandeja del sistema' }
                  ] as const).map((option) => (
                    <div
                      key={option.value}
                      className={`p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                        autoStartup === option.value
                          ? 'border-[#2196F3] bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                      }`}
                      onClick={() => handleAutoStartupChange(option.value)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {option.label}
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {option.description}
                          </p>
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 ${
                          autoStartup === option.value 
                            ? 'bg-[#2196F3] border-[#2196F3]' 
                            : 'border-gray-300 dark:border-gray-500'
                        }`} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              </div>
            )}

            {/* Minimize to tray */}
            {settingsLoaded && minimizeToTray !== null ? (
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <Minimize2 className="h-5 w-5 text-gray-600 dark:text-gray-400" />
                  <div>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      El botón cerrar debe minimizar la aplicación
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Al cerrar, mantener la aplicación en la bandeja del sistema
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleMinimizeToTrayToggle}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:ring-offset-2 ${
                    minimizeToTray ? 'bg-[#2196F3]' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      minimizeToTray ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            ) : (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg animate-pulse">
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
              </div>
            )}

            {settingsLoaded && minimizeToTray === true && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Nota:</strong> Cuando esta opción esté activada, cerrar la ventana mantendrá 
                  la aplicación funcionando en la bandeja del sistema. Puedes acceder a ella haciendo 
                  clic en el ícono de la bandeja o usar "Salir" desde el menú contextual para cerrarla completamente.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}