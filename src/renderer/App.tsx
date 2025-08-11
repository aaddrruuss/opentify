import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { NowPlaying } from './components/NowPlaying';
import { MusicLibrary } from './components/MusicLibrary';
import { PlayerControls } from './components/PlayerControls';
import { musicService } from './services/musicService';
import { Track, Settings } from './types/index';

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
  const [playlistName, setPlaylistName] = useState<string>(""); // Nombre de la playlist actual
  const [isRestoringTrack, setIsRestoringTrack] = useState(false);
  const [isPreloadingNext, setIsPreloadingNext] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false); // Track if current song is downloading
  const [isLoadingAudio, setIsLoadingAudio] = useState(false); // Track if audio is loading after download
  const [savedPosition, setSavedPosition] = useState(0); // Store saved position separately
  const [lastActionTime, setLastActionTime] = useState(0);
  const [pendingTrackId, setPendingTrackId] = useState<string | null>(null);
  const [importedPlaylists, setImportedPlaylists] = useState<Record<string, Track[]>>({});

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
      
      // Sincronizar estado de reproducción cada vez que se actualiza el tiempo
      const actualIsPlaying = musicService.isPlaying();
      if (actualIsPlaying !== isPlaying) {
        setIsPlaying(actualIsPlaying);
      }
      
      // Precargar la siguiente canción INMEDIATAMENTE cuando empiece la reproducción
      // Solo necesitamos verificar que haya comenzado (time > 1 segundo)
      if (time > 1 && !isPreloadingNext && playlist.length > 0 && !isDownloading) {
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
            console.log("Intentando restaurar canción:", currentTrack.title);
            
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
            // Si falla la restauración, limpiar el estado pero mantener la UI
            setIsRestoringTrack(false);
            setIsDownloading(false);
            setSavedPosition(0);
            // No limpiar currentTrack para que la UI se mantenga
          }
        };
        restoreTrack();
      }
    }
  }, [settingsLoaded, volume, isMuted, isRestoringTrack, currentTrack, savedPosition, isPreloadingNext, playlist.length, isDownloading, isPlaying]);

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
      // Repetir la misma canción usando método especializado
      if (currentTrack) {
        console.log("Repitiendo canción:", currentTrack.title);
        musicService.repeatCurrentTrack().then(() => {
          setIsPlaying(true);
          setCurrentTime(0); // Reset UI time
        }).catch(error => {
          console.error("Error repitiendo canción:", error);
          // Fallback: cargar de nuevo la canción
          handleTrackSelect(currentTrack);
        });
      }
    } else if (repeatMode === "all") {
      // Reproducir siguiente canción en la playlist
      handleSkipForward();
    }
    // Si repeatMode === "off", no hacer nada (canción termina)
  };

  const handlePlayPause = async () => {
    // Only block if downloading, not if just loading audio
    if (!currentTrack || isDownloading) {
      console.log("Play/pause bloqueado - descarga en progreso");
      return;
    }

    try {
      if (isPlaying) {
        musicService.pause();
        setIsPlaying(false);
      } else {
        const serviceCurrentTrack = musicService.getCurrentTrack();
        const audioDuration = musicService.getDuration();
        
        // Si el servicio tiene la misma canción cargada y con duración válida
        if (serviceCurrentTrack?.id === currentTrack.id && audioDuration > 0) {
          // Solo reanudar
          musicService.resume();
          setIsPlaying(true);
        } else {
          // Cargar y reproducir la canción - marcar como loading audio (no downloading)
          setIsLoadingAudio(true);
          try {
            await musicService.play(currentTrack);
            setIsPlaying(true);
            setDuration(musicService.getDuration());
          } finally {
            setIsLoadingAudio(false);
          }
        }
      }
    } catch (error) {
      console.error('Error al reproducir/pausar:', error);
      setIsPlaying(false);
      setIsLoadingAudio(false);
    }
  };

  const handleTrackSelect = async (track: Track, fromPlaylist?: Track[], trackIndex?: number) => {
    const now = Date.now();
    
    if (now - lastActionTime < 500) {
      console.log("Acción muy rápida, ignorando...");
      return;
    }
    
    if (isDownloading || pendingTrackId) {
      console.log("Descarga en progreso, ignorando selección de track");
      return;
    }

    setLastActionTime(now);
    setPendingTrackId(track.id);

    try {
      // Detener cualquier reproducción actual
      musicService.stop();
      setIsPlaying(false);
      setIsLoadingAudio(false);
      
      // Resetear flag de precarga para permitir nueva precarga
      setIsPreloadingNext(false);
      
      // Actualizar UI inmediatamente
      setCurrentTrack(track);
      setCurrentTime(0);
      setDuration(0);
      
      console.log("🔄 INICIANDO DESCARGA:", track.title);
      
      // GESTIÓN CRÍTICA DE PLAYLIST - Corregido
      if (fromPlaylist && Array.isArray(fromPlaylist) && fromPlaylist.length > 0) {
        const safeIndex = trackIndex !== undefined ? trackIndex : fromPlaylist.findIndex(t => t.id === track.id);
        console.log(`📋 Configurando playlist con ${fromPlaylist.length} canciones, índice: ${safeIndex}`);
        
        setPlaylist([...fromPlaylist]); // Crear copia para evitar referencias
        setCurrentTrackIndex(safeIndex >= 0 ? safeIndex : 0);
        
        // Determinar nombre de playlist
        if (fromPlaylist === searchResults) {
          setPlaylistName("Resultados de búsqueda");
        } else {
          // Buscar en playlists importadas
          const playlistEntry = Object.entries(importedPlaylists).find(([name, tracks]) => {
            return tracks.length === fromPlaylist.length && 
                   tracks.every((t, i) => t.id === fromPlaylist[i]?.id);
          });
          setPlaylistName(playlistEntry ? playlistEntry[0] : "Playlist personalizada");
        }
        
        console.log(`🎵 Playlist configurada: "${playlistName}" - Canción ${safeIndex + 1}/${fromPlaylist.length}`);
      } else {
        // Playlist de una sola canción
        console.log("🎵 Canción individual");
        setPlaylist([track]);
        setCurrentTrackIndex(0);
        setPlaylistName("Canción individual");
      }
      
      // Proceso de descarga
      setIsDownloading(true);
      setSavedPosition(0);
      
      const downloadTimeout = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Download timeout')), 60000);
      });

      console.log("⏳ Esperando descarga completa...");
      const downloadStart = Date.now();
      
      const songPath = await Promise.race([
        window.musicAPI.getSongPath(track.id, track.title),
        downloadTimeout
      ]);
      
      const downloadTime = Date.now() - downloadStart;

      if (!songPath) {
        throw new Error("No se pudo descargar la canción");
      }

      console.log(`✅ DESCARGA COMPLETADA en ${downloadTime}ms`);
      
      console.log("🎵 Cargando audio...");
      setIsLoadingAudio(true);
      
      const audioStart = Date.now();
      await musicService.loadAudioOnly(track);
      const audioTime = Date.now() - audioStart;
      
      console.log(`🔊 AUDIO LISTO en ${audioTime}ms`);
      
      if (pendingTrackId === track.id) {
        setDuration(musicService.getDuration());
        
        setTimeout(() => {
          const finalPlayingState = musicService.isPlaying();
          setIsPlaying(finalPlayingState);
          console.log(`🎶 ESTADO FINAL: Playing=${finalPlayingState}, Playlist: "${playlistName}" (${currentTrackIndex + 1}/${playlist.length})`);
        }, 100);
      }
      
    } catch (error) {
      console.error('❌ ERROR:', error);
      setIsPlaying(false);
      
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      if (errorMessage.includes('timeout')) {
        console.error('⏱️ La descarga tomó más de 60 segundos. Inténtalo de nuevo.');
      } else {
        console.error('🚨 Error:', errorMessage);
      }
      
    } finally {
      console.log("🏁 PROCESO COMPLETADO");
      setIsDownloading(false);
      setIsLoadingAudio(false);
      setPendingTrackId(null);
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
    const now = Date.now();
    
    if (now - lastActionTime < 800) {
      console.log("Skip demasiado rápido, ignorando...");
      return;
    }
    
    if (playlist.length === 0) {
      console.log("❌ No hay playlist para skip forward");
      return;
    }
    
    if (pendingTrackId) {
      console.log("Hay selección pendiente, esperando...");
      return;
    }
    
    setLastActionTime(now);
    
    let nextIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) {
        nextIndex = currentTrackIndex;
      } else {
        nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      }
    } else {
      nextIndex = (currentTrackIndex + 1) % playlist.length;
    }
    
    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      console.log(`⏭️ SKIP FORWARD: De canción ${currentTrackIndex + 1} a ${nextIndex + 1} de ${playlist.length} en "${playlistName}"`);
      console.log(`🎵 Reproduciendo: "${nextTrack.title}"`);
      handleTrackSelect(nextTrack, playlist, nextIndex);
    } else {
      console.error("❌ No se pudo encontrar la siguiente canción");
    }
  };

  const handleSkipBack = () => {
    const now = Date.now();
    
    if (now - lastActionTime < 800) {
      console.log("Skip back demasiado rápido, ignorando...");
      return;
    }
    
    if (pendingTrackId) {
      console.log("Hay selección pendiente, esperando...");
      return;
    }

    setLastActionTime(now);

    // Si llevamos más de 3 segundos, reiniciar la canción actual
    if (currentTime > 3) {
      console.log("⏪ Reiniciando canción actual");
      handleSeek(0);
      return;
    }
    
    if (playlist.length === 0) {
      console.log("❌ No hay playlist para skip back");
      return;
    }
    
    let prevIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      if (availableIndexes.length === 0) {
        prevIndex = currentTrackIndex;
      } else {
        prevIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      }
    } else {
      prevIndex = currentTrackIndex === 0 ? playlist.length - 1 : currentTrackIndex - 1;
    }
    
    const prevTrack = playlist[prevIndex];
    if (prevTrack) {
      console.log(`⏮️ SKIP BACK: De canción ${currentTrackIndex + 1} a ${prevIndex + 1} de ${playlist.length} en "${playlistName}"`);
      console.log(`🎵 Reproduciendo: "${prevTrack.title}"`);
      handleTrackSelect(prevTrack, playlist, prevIndex);
    } else {
      console.error("❌ No se pudo encontrar la canción anterior");
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
            onTrackSelect={(track: Track, fromPlaylist?: Track[], trackIndex?: number) => {
              console.log(`📱 App recibió selección: "${track.title}" con playlist de ${fromPlaylist?.length || 0} canciones, índice: ${trackIndex}`);
              handleTrackSelect(track, fromPlaylist, trackIndex);
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
            <div className="relative">
              <NowPlaying
                track={currentTrack}
                isPlaying={isPlaying}
                isDownloading={isDownloading}
                playlistInfo={{
                  name: playlistName,
                  current: currentTrackIndex + 1,
                  total: playlist.length
                }}
              />
              
              {/* Indicador de precarga posicionado absolutamente en la esquina derecha */}
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