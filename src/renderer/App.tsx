import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NowPlaying } from './components/NowPlaying';
import { MusicLibrary } from './components/MusicLibrary';
import { PlayerControls } from './components/PlayerControls';
import { musicService } from './services/musicService';
import { Track, Settings } from './types';

export function App() {
  const [currentView, setCurrentView] = useState('home');
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [searchResults, setSearchResults] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Estados de configuración
  const [volume, setVolume] = useState(80);
  const [isMuted, setIsMuted] = useState(false);
  const [repeatMode, setRepeatMode] = useState<"off" | "all" | "one">("off");
  const [isShuffle, setIsShuffle] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [playlist, setPlaylist] = useState<Track[]>([]); // Current playlist for repeat all
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isRestoringTrack, setIsRestoringTrack] = useState(false);
  const [isPreloadingNext, setIsPreloadingNext] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false); // Track if current song is downloading
  const [savedPosition, setSavedPosition] = useState(0); // Store saved position separately

  // Cargar configuraciones al inicio
  useEffect(() => {
    const loadInitialSettings = async () => {
      try {
        const settings = await window.settingsAPI.loadSettings();
        
        setVolume(settings.volume);
        setIsMuted(settings.isMuted);
        setRepeatMode(settings.repeatMode);
        setIsShuffle(settings.isShuffle);
        setIsDarkMode(settings.isDarkMode);
        
        // Restaurar última canción reproducida si existe
        if (settings.lastPlayedTrack && settings.lastPlayedPosition !== undefined) {
          const timeSinceLastPlay = Date.now() - (settings.lastPlayedTime || 0);
          const maxRestoreTime = 24 * 60 * 60 * 1000; // 24 horas en millisegundos
          
          // Solo restaurar si no ha pasado más de 24 horas
          if (timeSinceLastPlay < maxRestoreTime) {
            console.log("Restaurando última canción:", settings.lastPlayedTrack.title, "en posición:", settings.lastPlayedPosition);
            setCurrentTrack(settings.lastPlayedTrack);
            setSavedPosition(settings.lastPlayedPosition); // Store separately
            setIsRestoringTrack(true);
          }
        }
        
        console.log("Configuraciones cargadas desde archivo:", settings);
        setSettingsLoaded(true);
      } catch (error) {
        console.error("Error cargando configuraciones:", error);
        setSettingsLoaded(true);
      }
    };

    loadInitialSettings();
  }, []);

  // Guardar configuraciones cuando cambien
  useEffect(() => {
    if (!settingsLoaded) return;

    const settings: Settings = {
      volume,
      isMuted,
      repeatMode,
      isShuffle,
      isDarkMode,
      lastPlayedTrack: currentTrack,
      lastPlayedPosition: currentTime,
      lastPlayedTime: Date.now()
    };

    const saveSettings = async () => {
      try {
        await window.settingsAPI.saveSettings(settings);
      } catch (error) {
        console.error("Error guardando configuraciones:", error);
      }
    };

    saveSettings();
  }, [volume, isMuted, repeatMode, isShuffle, isDarkMode, currentTrack, currentTime, settingsLoaded]);

  // Aplicar modo oscuro
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    // Configurar listeners del servicio de música
    musicService.onTimeUpdate((time) => {
      setCurrentTime(time);
      setDuration(musicService.getDuration());
      
      // Precargar la siguiente canción cuando llevemos 30% de la canción actual
      const progressPercentage = musicService.getDuration() > 0 ? (time / musicService.getDuration()) * 100 : 0;
      if (progressPercentage > 30 && !isPreloadingNext && playlist.length > 0 && !isDownloading) {
        preloadNextTrack();
      }
    });

    musicService.onEnded(() => {
      setIsPlaying(false);
      handleSongEnded();
    });

    // Establecer volumen inicial cuando las configuraciones estén cargadas
    if (settingsLoaded) {
      musicService.setVolume(isMuted ? 0 : volume);
      
      // Si estamos restaurando una canción, cargarla y posicionarla SIN reproducir
      if (isRestoringTrack && currentTrack) {
        const restoreTrack = async () => {
          try {
            setIsDownloading(true);
            
            // Usar el método específico para restauración que NO reproduce automáticamente
            await musicService.loadTrackForRestore(currentTrack);
            
            // Esperar un momento para que los metadatos se carguen completamente
            setTimeout(() => {
              if (savedPosition > 0) {
                musicService.seek(savedPosition); // Ir a la posición guardada
                setCurrentTime(savedPosition); // Actualizar el tiempo mostrado
                console.log("Canción restaurada en posición:", savedPosition, "sin reproducir");
              }
              
              setDuration(musicService.getDuration());
              setIsRestoringTrack(false);
              setIsDownloading(false);
              setSavedPosition(0); // Limpiar la posición guardada
              
              console.log("Restauración completada. La canción está lista para reproducir desde:", savedPosition);
            }, 100);
            
          } catch (error) {
            console.error("Error restaurando canción:", error);
            setIsRestoringTrack(false);
            setIsDownloading(false);
            setSavedPosition(0);
          }
        };
        restoreTrack();
      }
    }
  }, [settingsLoaded, volume, isMuted, isRestoringTrack, currentTrack, savedPosition, isPreloadingNext, playlist.length, isDownloading]);

  // Función para precargar la siguiente canción
  const preloadNextTrack = async () => {
    if (isPreloadingNext || playlist.length === 0 || isDownloading) return;
    
    setIsPreloadingNext(true);
    
    try {
      let nextIndex;
      if (isShuffle) {
        const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
        if (availableIndexes.length === 0) {
          setIsPreloadingNext(false);
          return;
        }
        nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      } else {
        nextIndex = (currentTrackIndex + 1) % playlist.length;
      }
      
      const nextTrack = playlist[nextIndex];
      if (nextTrack) {
        console.log("Precargando siguiente canción:", nextTrack.title);
        // Usar el flag preload=true para descarga silenciosa
        await window.musicAPI.getSongPath(nextTrack.id, nextTrack.title, true);
        console.log("Canción precargada exitosamente:", nextTrack.title);
      }
    } catch (error) {
      console.error("Error precargando siguiente canción:", error);
    } finally {
      setIsPreloadingNext(false);
    }
  };

  const handleSongEnded = () => {
    if (repeatMode === "one") {
      // Repetir la misma canción
      if (currentTrack) {
        handleTrackSelect(currentTrack);
      }
    } else if (repeatMode === "all") {
      // Reproducir siguiente canción en la playlist
      handleSkipForward();
    }
    // Si repeatMode === "off", no hacer nada (canción termina)
  };

  const handlePlayPause = async () => {
    if (!currentTrack || isDownloading) return;

    try {
      if (isPlaying) {
        musicService.pause();
        setIsPlaying(false);
      } else {
        // Si hay una canción cargada y pausada, reanudar
        if (musicService.getCurrentTrack()?.id === currentTrack.id) {
          // Verificar si la canción está realmente cargada
          const currentAudioTime = musicService.getCurrentTime();
          const audioDuration = musicService.getDuration();
          
          if (audioDuration > 0) {
            // La canción está cargada, solo reanudar
            musicService.resume();
            setIsPlaying(true);
          } else {
            // La canción no está completamente cargada, cargarla de nuevo
            setIsDownloading(true);
            await musicService.play(currentTrack);
            setIsDownloading(false);
            setIsPlaying(true);
          }
        } else {
          // Cargar y reproducir una nueva canción
          setIsDownloading(true);
          await musicService.play(currentTrack);
          setIsDownloading(false);
          setIsPlaying(true);
        }
      }
    } catch (error) {
      console.error('Error al reproducir/pausar:', error);
      setIsPlaying(false);
      setIsDownloading(false);
    }
  };

  const handleTrackSelect = async (track: Track, fromPlaylist?: Track[], trackIndex?: number) => {
    // Prevenir cambios múltiples mientras se descarga
    if (isDownloading) {
      console.log("Descarga en progreso, ignorando selección de track");
      return;
    }

    try {
      setIsDownloading(true);
      setIsPreloadingNext(false); // Reset preload flag
      setSavedPosition(0); // Clear any saved position when manually selecting
      
      // Solo actualizar la UI después de que la canción esté lista para reproducir
      console.log("Iniciando descarga/carga de:", track.title);
      
      // Actualizar playlist si se proporciona
      if (fromPlaylist) {
        setPlaylist(fromPlaylist);
        setCurrentTrackIndex(trackIndex || 0);
      }
      
      // Reproducir la canción (esto manejará la descarga si es necesaria)
      await musicService.play(track);
      
      // Solo actualizar el estado después de que la canción esté lista
      setCurrentTrack(track);
      setCurrentTime(0); // Reset to 0 for new track selections
      setDuration(musicService.getDuration());
      setIsPlaying(true);
      
      console.log("Canción cargada y reproduciendo:", track.title);
    } catch (error) {
      console.error('Error al seleccionar pista:', error);
      setIsPlaying(false);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleSearch = async (query: string) => {
    if (!query.trim()) return;

    setIsLoading(true);
    
    const displayQuery = query.replace(/ audio$/, '').trim();
    setSearchQuery(displayQuery);
    
    try {
      const results = await window.musicAPI.searchMusic(query);
      setSearchResults(results);
      // Actualizar playlist con los resultados de búsqueda
      setPlaylist(results);
      setIsPreloadingNext(false); // Reset preload flag when new search
    } catch (error) {
      console.error('Error en búsqueda:', error);
      setSearchResults([]);
      setPlaylist([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSeek = (time: number) => {
    musicService.seek(time);
    setCurrentTime(time);
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    musicService.setVolume(newVolume);
  };

  const handleMuteToggle = (muted: boolean) => {
    setIsMuted(muted);
    musicService.setVolume(muted ? 0 : volume);
  };

  const handleSkipForward = () => {
    if (playlist.length === 0 || isDownloading) return;
    
    let nextIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) return;
      nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length;
    }
    
    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      handleTrackSelect(nextTrack, playlist, nextIndex);
    }
  };

  const handleSkipBack = () => {
    if (isDownloading) return;

    // Si llevamos más de 3 segundos, reiniciar la canción actual
    if (currentTime > 3) {
      handleSeek(0);
      return;
    }
    
    if (playlist.length === 0) return;
    
    let prevIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) return;
      prevIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1;
    }
    
    const prevTrack = playlist[prevIndex];
    if (prevTrack) {
      handleTrackSelect(prevTrack, playlist, prevIndex);
    }
  };

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
  };

  const handleRepeatModeChange = (mode: "off" | "all" | "one") => {
    setRepeatMode(mode);
  };

  const handleShuffleToggle = (shuffle: boolean) => {
    setIsShuffle(shuffle);
  };

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isDarkMode={isDarkMode}
        toggleDarkMode={toggleDarkMode}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#F5F5F5] dark:bg-gray-800 p-6 transition-colors">
          <MusicLibrary
            onTrackSelect={(track) => {
              const trackIndex = searchResults.findIndex(t => t.id === track.id);
              handleTrackSelect(track, searchResults, trackIndex);
            }}
            currentView={currentView}
            searchResults={searchResults}
            onSearch={handleSearch}
            isLoading={isLoading}
            searchQuery={searchQuery}
          />
        </main>
        
        {currentTrack && (
          <div className="flex flex-col bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors">
            <NowPlaying
              track={currentTrack}
              isPlaying={isPlaying}
              isDownloading={isDownloading}
            />
            <PlayerControls
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              currentTime={currentTime}
              duration={duration}
              onSeek={handleSeek}
              volume={volume}
              onVolumeChange={handleVolumeChange}
              onMuteToggle={handleMuteToggle}
              isMuted={isMuted}
              repeatMode={repeatMode}
              onRepeatModeChange={handleRepeatModeChange}
              isShuffle={isShuffle}
              onShuffleToggle={handleShuffleToggle}
              onSkipForward={handleSkipForward}
              onSkipBack={handleSkipBack}
              isDownloading={isDownloading}
            />
            
            {/* Mostrar indicador de precarga solo cuando no está descargando la actual */}
            {isPreloadingNext && !isDownloading && (
              <div className="px-6 pb-2 flex-shrink-0">
                <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                  <div className="animate-spin rounded-full h-3 w-3 border-b border-[#2196F3] mr-2"></div>
                  Precargando siguiente canción...
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}