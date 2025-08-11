import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { NowPlaying } from './components/NowPlaying';
import { MusicLibrary } from './components/MusicLibrary';
import { PlayerControls } from './components/PlayerControls';
import { musicService } from './services/musicService';
import { Track, Settings } from './types/index';

// Throttle function para optimizar actualizaciones
const throttle = (func: Function, limit: number) => {
  let inThrottle: boolean;
  return function(this: any, ...args: any[]) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
};

// Debounce para acciones de usuario
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function(this: any, ...args: any[]) {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

export function App() {
  // Estados básicos
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
  const [playlist, setPlaylist] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [playlistName, setPlaylistName] = useState<string>("");
  const [isRestoringTrack, setIsRestoringTrack] = useState(false);
  const [isPreloadingNext, setIsPreloadingNext] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [savedPosition, setSavedPosition] = useState(0);
  const [lastActionTime, setLastActionTime] = useState(0);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [importedPlaylists, setImportedPlaylists] = useState<Record<string, Track[]>>({});
  
  // Funciones memoizadas para mejor rendimiento
  const throttledTimeUpdate = useMemo(
    () => throttle((time: number) => {
      setCurrentTime(time);
      setDuration(musicService.getDuration());
      
      const actualIsPlaying = musicService.isPlaying();
      if (actualIsPlaying !== isPlaying) {
        setIsPlaying(actualIsPlaying);
      }
      
      if (time > 1 && !isPreloadingNext && playlist.length > 0 && !isDownloading) {
        preloadNextTrack();
      }
    }, 200), // Throttle a 5 FPS en lugar de 60 FPS
    [isPlaying, isPreloadingNext, playlist.length, isDownloading]
  );

  // Throttled settings save
  const throttledSaveSettings = useMemo(
    () => throttle(async (settings: Settings) => {
      try {
        await window.settingsAPI.saveSettings(settings);
      } catch (error) {
        console.error("Error guardando configuraciones:", error);
      }
    }, 2000), // Guardar máximo cada 2 segundos
    []
  );

  // Debounced search
  const debouncedSearch = useMemo(
    () => debounce(async (query: string) => {
      if (!query.trim()) return;

      setIsLoading(true);
      
      const displayQuery = query.replace(/ audio$/, '').trim();
      setSearchQuery(displayQuery);
      
      try {
        const results = await window.musicAPI.searchMusic(query);
        setSearchResults(results);
        setPlaylist(results);
        setIsPreloadingNext(false);
      } catch (error) {
        console.error('Error en búsqueda:', error);
        setSearchResults([]);
        setPlaylist([]);
      } finally {
        setIsLoading(false);
      }
    }, 500), // 500ms debounce
    []
  );

  // Cargar configuraciones (optimizado)
  useEffect(() => {
    let mounted = true;
    
    const loadInitialSettings = async () => {
      try {
        const settings = await window.settingsAPI.loadSettings();
        
        if (!mounted) return;
        
        setVolume(settings.volume);
        setIsMuted(settings.isMuted);
        setRepeatMode(settings.repeatMode);
        setIsShuffle(settings.isShuffle);
        setIsDarkMode(settings.isDarkMode);
        
        if (settings.lastPlayedTrack && settings.lastPlayedPosition !== undefined) {
          const timeSinceLastPlay = Date.now() - (settings.lastPlayedTime || 0);
          const maxRestoreTime = 24 * 60 * 60 * 1000;
          
          if (timeSinceLastPlay < maxRestoreTime) {
            setCurrentTrack(settings.lastPlayedTrack);
            setSavedPosition(settings.lastPlayedPosition);
            setIsRestoringTrack(true);
          }
        }
        
        setSettingsLoaded(true);
      } catch (error) {
        console.error("Error cargando configuraciones:", error);
        if (mounted) setSettingsLoaded(true);
      }
    };

    loadInitialSettings();
    
    return () => { mounted = false; };
  }, []);

  // Guardar configuraciones (optimizado)
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

    throttledSaveSettings(settings);
  }, [volume, isMuted, repeatMode, isShuffle, isDarkMode, currentTrack, currentTime, settingsLoaded, throttledSaveSettings]);

  // Aplicar modo oscuro (optimizado)
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Track selection optimizada
  const handleTrackSelect = useCallback(async (track: Track, fromPlaylist?: Track[], trackIndex?: number) => {
    const now = Date.now();
    
    if (now - lastActionTime < 300) {
      return;
    }
    
    if (isDownloading || pendingTrackId) {
      return;
    }

    setLastActionTime(now);
    setPendingTrackId(track.id);

    try {
      musicService.stop();
      setIsPlaying(false);
      setIsLoadingAudio(false);
      setIsPreloadingNext(false);
      
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      
      if (fromPlaylist && Array.isArray(fromPlaylist) && fromPlaylist.length > 0) {
        const safeIndex = trackIndex !== undefined ? trackIndex : fromPlaylist.findIndex(t => t.id === track.id);
        
        setPlaylist([...fromPlaylist]);
        setCurrentTrackIndex(safeIndex >= 0 ? safeIndex : 0);
        
        if (fromPlaylist === searchResults) {
          setPlaylistName("Resultados de búsqueda");
        } else {
          const playlistEntry = Object.entries(importedPlaylists).find(([name, tracks]) => {
            return tracks.length === fromPlaylist.length && 
                   tracks.every((t, i) => t.id === fromPlaylist[i]?.id);
          });
          setPlaylistName(playlistEntry ? playlistEntry[0] : "Playlist personalizada");
        }
      } else {
        setPlaylist([track]);
        setCurrentTrackIndex(0);
        setPlaylistName("Canción individual");
      }
      
      setIsDownloading(true);
      setSavedPosition(0);
      
      const downloadTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout')), 45000);
      });

      const songPath = await Promise.race([
        window.musicAPI.getSongPath(track.id, track.title),
        downloadTimeout
      ]);
      
      // **NUEVO: Si getSongPath retorna null (restricción de edad), manejar silenciosamente**
      if (!songPath) {
        console.warn(`🔞 Canción omitida por restricción de edad: ${track.title}`);
        
        // Recargar playlists para reflejar cambios
        setTimeout(() => {
          window.location.reload(); // Forzar recarga completa para actualizar UI
        }, 1000);
        
        return; // Salir silenciosamente
      }
      
      setIsLoadingAudio(true);
      await musicService.loadAudioOnly(track);
      
      if (pendingTrackId === track.id) {
        setDuration(musicService.getDuration());
        
        setTimeout(() => {
          const finalPlayingState = musicService.isPlaying();
          setIsPlaying(finalPlayingState);
        }, 50);
      }
      
    } catch (error) {
      const errorMsg = String(error);
      
      // **NUEVO: No mostrar error si es restricción de edad**
      if (errorMsg.includes('AGE_RESTRICTED') || errorMsg.includes('sign in to confirm')) {
        console.warn(`🔞 Canción con restricción de edad omitida automáticamente: ${track.title}`);
        
        // Recargar playlists para reflejar cambios
        setTimeout(() => {
          window.location.reload(); // Forzar recarga completa
        }, 1000);
        
        return; // No mostrar error
      }
      
      console.error('Error:', error);
      setIsPlaying(false);
    } finally {
      setIsDownloading(false);
      setIsLoadingAudio(false);
      setPendingTrackId(null);
    }
  }, [lastActionTime, isDownloading, pendingTrackId, searchResults, importedPlaylists]);

  const handleSongEnded = useCallback(() => {
    console.log(`🎵 Canción terminada. RepeatMode: ${repeatMode}, Playlist length: ${playlist.length}`);
    
    if (repeatMode === "one") {
      if (currentTrack) {
        console.log("🔁 Repitiendo canción actual");
        musicService.repeatCurrentTrack().then(() => {
          setIsPlaying(true);
          setCurrentTime(0);
        }).catch(error => {
          console.error("Error repitiendo canción:", error);
          handleTrackSelect(currentTrack);
        });
      }
      return;
    }
    
    // Para "all" y "off", verificar si hay más canciones
    if (playlist.length <= 1) {
      console.log("📭 No hay más canciones en la playlist, pausando");
      setIsPlaying(false);
      return;
    }
    
    // Determinar siguiente canción
    let nextIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) {
        console.log("🔀 No hay más canciones disponibles para shuffle");
        setIsPlaying(false);
        return;
      }
      nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      if (repeatMode === "all") {
        // En modo "all", volver al inicio cuando termine la playlist
        nextIndex = (currentTrackIndex + 1) % playlist.length;
        console.log(`🔄 Modo "all": avanzando a canción ${nextIndex + 1}/${playlist.length}`);
      } else {
        // En modo "off", solo avanzar si no es la última canción
        if (currentTrackIndex >= playlist.length - 1) {
          console.log("⏹️ Última canción en modo 'off', pausando");
          setIsPlaying(false);
          return;
        }
        nextIndex = currentTrackIndex + 1;
        console.log(`➡️ Modo "off": avanzando a canción ${nextIndex + 1}/${playlist.length}`);
      }
    }
    
    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      console.log(`🎵 Reproduciendo siguiente: ${nextTrack.title}`);
      handleTrackSelect(nextTrack, playlist, nextIndex);
    } else {
      console.log("❌ No se encontró la siguiente canción, pausando");
      setIsPlaying(false);
    }
  }, [repeatMode, currentTrack, playlist, currentTrackIndex, isShuffle, handleTrackSelect]);

  // Music service setup (optimizado)
  useEffect(() => {
    let mounted = true;
    let timeUpdateCleanup: (() => void) | void;
    let endedCleanup: (() => void) | void;
    
    // Setup listeners con manejo seguro de tipos
    try {
      timeUpdateCleanup = musicService.onTimeUpdate(throttledTimeUpdate);
    } catch (error) {
      console.error("Error setting up time update listener:", error);
    }

    try {
      endedCleanup = musicService.onEnded(() => {
        if (mounted) {
          setIsPlaying(false);
          handleSongEnded();
        }
      });
    } catch (error) {
      console.error("Error setting up ended listener:", error);
    }

    if (settingsLoaded) {
      musicService.setVolume(isMuted ? 0 : volume);
      
      if (isRestoringTrack && currentTrack) {
        const restoreTrack = async () => {
          if (!mounted) return;
          
          try {
            setIsDownloading(true);
            await musicService.loadTrackForRestore(currentTrack);
            
            setTimeout(() => {
              if (!mounted) return;
              
              if (savedPosition > 0) {
                musicService.seek(savedPosition);
                setCurrentTime(savedPosition);
              }
              
              setDuration(musicService.getDuration());
              setIsRestoringTrack(false);
              setIsDownloading(false);
              setSavedPosition(0);
            }, 100);
            
          } catch (error) {
            console.error("Error restaurando canción:", error);
            if (mounted) {
              setIsRestoringTrack(false);
              setIsDownloading(false);
              setSavedPosition(0);
            }
          }
        };
        restoreTrack();
      }
    }

    return () => {
      mounted = false;
      if (typeof timeUpdateCleanup === 'function') {
        timeUpdateCleanup();
      }
      if (typeof endedCleanup === 'function') {
        endedCleanup();
      }
    };
  }, [settingsLoaded, volume, isMuted, isRestoringTrack, currentTrack, savedPosition, throttledTimeUpdate, handleSongEnded]);

  const handlePlayPause = useCallback(() => {
    if (!currentTrack) return;
    
    if (isPlaying) {
      console.log("App: Pausando reproducción");
      musicService.pause();
      setIsPlaying(false);
    } else {
      console.log("App: Intentando reanudar reproducción");
      
      // Si el audio ya está cargado y solo pausado, usar resume
      if (musicService.isPaused && musicService.isPaused()) {
        console.log("App: Usando resume para canción pausada");
        musicService.resume();
        setIsPlaying(true);
      } else {
        // Si no hay audio cargado o terminó, cargar desde el principio
        console.log("App: Cargando canción desde el principio");
        musicService.play(currentTrack).then(() => {
          setIsPlaying(true);
        }).catch(error => {
          console.error("Error en play:", error);
          setIsPlaying(false);
        });
      }
    }
  }, [isPlaying, currentTrack]);

  const preloadNextTrack = useCallback(async () => {
    if (isPreloadingNext || playlist.length <= 1) return;
    
    setIsPreloadingNext(true);
    
    try {
      let nextIndex;
      if (isShuffle) {
        const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
        nextIndex = availableIndexes.length > 0 ? 
          availableIndexes[Math.floor(Math.random() * availableIndexes.length)] : 
          currentTrackIndex;
      } else {
        nextIndex = (currentTrackIndex + 1) % playlist.length;
      }
      
      const nextTrack = playlist[nextIndex];
      if (nextTrack && nextTrack.id !== currentTrack?.id) {
        await window.musicAPI.getSongPath(nextTrack.id, nextTrack.title);
      }
    } catch (error) {
      console.error('Error precargando siguiente canción:', error);
    } finally {
      setIsPreloadingNext(false);
    }
  }, [isPreloadingNext, playlist, isShuffle, currentTrackIndex, currentTrack]);

  const handleSearch = useCallback((query: string) => {
    debouncedSearch(query);
  }, [debouncedSearch]);

  const handleSeek = useCallback((time: number) => {
    musicService.seek(time);
    setCurrentTime(time);
  }, []);

  const handleVolumeChange = useCallback((newVolume: number) => {
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
    musicService.setVolume(newVolume);
  }, []);

  const handleMuteToggle = useCallback((muted: boolean) => {
    setIsMuted(muted);
    musicService.setVolume(muted ? 0 : volume);
  }, [volume]);

  const handleSkipForward = useCallback(() => {
    const now = Date.now();
    
    if (now - lastActionTime < 500 || playlist.length === 0 || pendingTrackId) {
      return;
    }
    
    setLastActionTime(now);
    
    let nextIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      nextIndex = availableIndexes.length === 0 ? currentTrackIndex : 
        availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      // Lógica mejorada para repeat mode "all"
      if (repeatMode === "all") {
        nextIndex = (currentTrackIndex + 1) % playlist.length;
      } else {
        // Para "off", solo avanzar si no es la última canción
        if (currentTrackIndex < playlist.length - 1) {
          nextIndex = currentTrackIndex + 1;
        } else {
          // Última canción en modo "off" - parar
          setIsPlaying(false);
          return;
        }
      }
    }
    
    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      handleTrackSelect(nextTrack, playlist, nextIndex);
    }
  }, [lastActionTime, playlist, pendingTrackId, isShuffle, currentTrackIndex, repeatMode, handleTrackSelect]);

  const handleSkipBack = useCallback(() => {
    const now = Date.now();
    
    if (now - lastActionTime < 500 || pendingTrackId) {
      return;
    }

    setLastActionTime(now);

    if (currentTime > 3) {
      handleSeek(0);
      return;
    }
    
    if (playlist.length === 0) {
      return;
    }
    
    let prevIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      prevIndex = availableIndexes.length === 0 ? currentTrackIndex :
        availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1;
    }
    
    const prevTrack = playlist[prevIndex];
    if (prevTrack) {
      handleTrackSelect(prevTrack, playlist, prevIndex);
    }
  }, [lastActionTime, pendingTrackId, currentTime, playlist, isShuffle, currentTrackIndex, handleSeek, handleTrackSelect]);

  // NUEVO: Handler para toggle dark mode desde settings
  const toggleDarkMode = useCallback((darkMode: boolean) => {
    setIsDarkMode(darkMode);
  }, []);

  const handleRepeatModeChange = useCallback((mode: "off" | "all" | "one") => {
    setRepeatMode(mode);
  }, []);

  const handleShuffleToggle = useCallback((shuffle: boolean) => {
    setIsShuffle(shuffle);
  }, []);

    // Memoizar props complejas
    const playlistInfo = useMemo(() => ({
      name: playlistName,
      current: currentTrackIndex + 1,
      total: playlist.length
    }), [playlistName, currentTrackIndex, playlist.length]);

  return (
    <div className="flex h-screen w-full bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 transition-colors">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-[#F5F5F5] dark:bg-gray-800 p-6 transition-colors">
          <MusicLibrary
            onTrackSelect={handleTrackSelect}
            currentView={currentView}
            searchResults={searchResults}
            onSearch={handleSearch}
            isLoading={isLoading}
            searchQuery={searchQuery}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
          />
        </main>
        
        {currentTrack && (
          <div className="flex flex-col bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 transition-colors">
            <div className="relative">
              <NowPlaying
                track={currentTrack}
                isPlaying={isPlaying}
                isDownloading={isDownloading}
                playlistInfo={playlistInfo}
              />
              
              {isPreloadingNext && !isDownloading && (
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-900 px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="animate-spin rounded-full h-3 w-3 border-b border-[#2196F3] mr-2"></div>
                    <span className="whitespace-nowrap">Precargando...</span>
                  </div>
                </div>
              )}
            </div>
            
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
              isLoadingAudio={isLoadingAudio}
            />
          </div>
        )}
      </div>
    </div>
  );
}

