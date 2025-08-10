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
            setCurrentTime(settings.lastPlayedPosition);
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
      if (progressPercentage > 30 && !isPreloadingNext && playlist.length > 0) {
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
      
      // Si estamos restaurando una canción, cargarla y posicionarla
      if (isRestoringTrack && currentTrack) {
        const restoreTrack = async () => {
          try {
            await musicService.play(currentTrack);
            musicService.pause(); // Pausar inmediatamente
            musicService.seek(currentTime); // Ir a la posición guardada
            setIsRestoringTrack(false);
            console.log("Canción restaurada exitosamente");
          } catch (error) {
            console.error("Error restaurando canción:", error);
            setIsRestoringTrack(false);
          }
        };
        restoreTrack();
      }
    }
  }, [settingsLoaded, volume, isMuted, isRestoringTrack, currentTrack, currentTime, isPreloadingNext, playlist.length]);

  // Función para precargar la siguiente canción
  const preloadNextTrack = async () => {
    if (isPreloadingNext || playlist.length === 0) return;
    
    setIsPreloadingNext(true);
    
    try {
      let nextIndex;
      if (isShuffle) {
        // En modo aleatorio, seleccionar una canción aleatoria diferente a la actual
        const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
        if (availableIndexes.length === 0) return;
        nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      } else {
        // Modo normal: siguiente canción en la lista
        nextIndex = (currentTrackIndex + 1) % playlist.length;
      }
      
      const nextTrack = playlist[nextIndex];
      if (nextTrack) {
        console.log("Precargando siguiente canción:", nextTrack.title);
        // Precargar la canción en segundo plano
        await window.musicAPI.getSongPath(nextTrack.id, nextTrack.title);
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
    if (!currentTrack) return;

    try {
      if (isPlaying) {
        musicService.pause();
        setIsPlaying(false);
      } else {
        // Si hay una canción pausada, reanudar; si no, reproducir desde el inicio
        if (musicService.getCurrentTrack()?.id === currentTrack.id && musicService.getCurrentTime() > 0) {
          musicService.resume();
        } else {
          await musicService.play(currentTrack);
        }
        setIsPlaying(true);
      }
    } catch (error) {
      console.error('Error al reproducir/pausar:', error);
      setIsPlaying(false);
    }
  };

  const handleTrackSelect = async (track: Track, fromPlaylist?: Track[], trackIndex?: number) => {
    try {
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      setIsPreloadingNext(false); // Reset preload flag
      
      // Actualizar playlist si se proporciona
      if (fromPlaylist) {
        setPlaylist(fromPlaylist);
        setCurrentTrackIndex(trackIndex || 0);
      }
      
      await musicService.play(track);
      setIsPlaying(true);
    } catch (error) {
      console.error('Error al seleccionar pista:', error);
      setIsPlaying(false);
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
    if (playlist.length === 0) return;
    
    let nextIndex;
    if (isShuffle) {
      // Modo aleatorio: seleccionar índice aleatorio diferente al actual
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) return;
      nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      // Modo normal: siguiente canción
      nextIndex = (currentTrackIndex + 1) % playlist.length;
    }
    
    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      handleTrackSelect(nextTrack, playlist, nextIndex);
    }
  };

  const handleSkipBack = () => {
    // Si llevamos más de 3 segundos, reiniciar la canción actual
    if (currentTime > 3) {
      handleSeek(0);
      return;
    }
    
    if (playlist.length === 0) return;
    
    let prevIndex;
    if (isShuffle) {
      // Modo aleatorio: seleccionar índice aleatorio diferente al actual
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) return;
      prevIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      // Modo normal: canción anterior
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
            />
            {isPreloadingNext && (
              <div className="px-6 pb-2">
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