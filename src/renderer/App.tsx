import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Sidebar } from './components/Sidebar';
import { NowPlaying } from './components/NowPlaying';
import { MusicLibrary } from './components/MusicLibrary';
import { PlayerControls } from './components/PlayerControls';
import { musicService } from './services/musicService';
import { discordRPCClient } from './services/discordRPCService';
import { Track, Settings, QueueItem } from './types/index';

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
  const { t } = useTranslation();
  
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
  
  // Estados para la cola de reproducción
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isPlayingFromQueue, setIsPlayingFromQueue] = useState(false);
  const [originalPlaylistContext, setOriginalPlaylistContext] = useState<{
    playlist: Track[];
    currentIndex: number;
    playlistName: string;
  } | null>(null);
  
  // NUEVO: Estados globales para compresión
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionProgress, setCompressionProgress] = useState<{
    processed: number;
    total: number;
    current: string;
    success: number;
    failed: number;
  } | null>(null);
  const [compressionResult, setCompressionResult] = useState<string | null>(null);

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

  // Función de throttle para guardar configuraciones - ahora se usa inline

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
            
            // NUEVO: Restaurar contexto de playlist si existe
            if (settings.lastPlaylistContext) {
              console.log(`🔄 Restaurando contexto de playlist: "${settings.lastPlaylistContext.playlistName}", canción ${settings.lastPlaylistContext.currentIndex + 1}/${settings.lastPlaylistContext.playlist.length}`);
              setPlaylist(settings.lastPlaylistContext.playlist);
              setCurrentTrackIndex(settings.lastPlaylistContext.currentIndex);
              setPlaylistName(settings.lastPlaylistContext.playlistName);
              
              // Si es una playlist de usuario, intentar actualizarla desde el almacenamiento
              setTimeout(async () => {
                try {
                  if (settings.lastPlaylistContext && settings.lastPlaylistContext.playlistName !== "Resultados de búsqueda" && settings.lastPlaylistContext.playlistName !== "Canción individual") {
                    const playlistNames = await window.playlistAPI.getPlaylists();
                    if (playlistNames.includes(settings.lastPlaylistContext.playlistName)) {
                      const updatedPlaylist = await window.playlistAPI.loadPlaylist(settings.lastPlaylistContext.playlistName);
                      console.log(`🔄 Actualizando playlist restaurada "${settings.lastPlaylistContext.playlistName}" con ${updatedPlaylist.length} canciones`);
                      setPlaylist(updatedPlaylist);
                      
                      // Encontrar el índice actual de la canción en la playlist actualizada
                      const currentTrackInUpdatedPlaylist = updatedPlaylist.findIndex(t => t.id === settings.lastPlayedTrack?.id);
                      if (currentTrackInUpdatedPlaylist >= 0) {
                        setCurrentTrackIndex(currentTrackInUpdatedPlaylist);
                      }
                    }
                  }
                } catch (error) {
                  console.error("Error actualizando playlist restaurada:", error);
                }
              }, 1000);
            }
          }
        }
        
        setSettingsLoaded(true);
        
        // Inicializar Discord RPC
        if (settings.discordRPCEnabled !== false) {
          setTimeout(() => {
            discordRPCClient.initialize().catch(error => {
              console.warn('Discord RPC initialization failed (this is normal if Discord is not running):', error);
            });
          }, 1000);
        }
      } catch (error) {
        console.error("Error cargando configuraciones:", error);
        if (mounted) setSettingsLoaded(true);
      }
    };

    loadInitialSettings();
    
    return () => { mounted = false; };
  }, []);

  // Guardar configuraciones (CORREGIDO: preservar configuraciones existentes)
  useEffect(() => {
    if (!settingsLoaded) return;

    const saveSettingsAsync = async () => {
      try {
        // ARREGLADO: Cargar configuraciones existentes primero
        const currentSettings = await window.settingsAPI.loadSettings();
        
        // ARREGLADO: Solo actualizar los campos relacionados con la música/app, preservar configuraciones del usuario
        const updatedSettings: Settings = {
          ...currentSettings, // Preservar TODAS las configuraciones existentes
          // Solo actualizar los campos de estado de la aplicación
          volume,
          isMuted,
          repeatMode,
          isShuffle,
          isDarkMode,
          lastPlayedTrack: currentTrack,
          lastPlayedPosition: currentTime,
          lastPlayedTime: Date.now(),
          // NUEVO: Guardar contexto de playlist actual si existe
          lastPlaylistContext: currentTrack && playlist.length > 0 && playlistName ? {
            playlist: [...playlist],
            currentIndex: currentTrackIndex,
            playlistName: playlistName
          } : null
        };

        await window.settingsAPI.saveSettings(updatedSettings);
      } catch (error) {
        console.error("Error guardando configuraciones:", error);
      }
    };

    // Crear throttled version de la función async
    const throttledAsyncSave = throttle(saveSettingsAsync, 2000);
    throttledAsyncSave();
  }, [volume, isMuted, repeatMode, isShuffle, isDarkMode, currentTrack, currentTime, settingsLoaded, playlist, currentTrackIndex, playlistName]);

  // Aplicar modo oscuro (optimizado)
  useEffect(() => {
    const root = document.documentElement;
    if (isDarkMode) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Actualizar Discord RPC cuando cambia la canción
  useEffect(() => {
    discordRPCClient.updateTrack(currentTrack, currentTime, isPlaying);
  }, [currentTrack]);

  // Actualizar Discord RPC cuando cambia el estado de reproducción
  useEffect(() => {
    if (currentTrack) {
      discordRPCClient.updatePlayState(isPlaying);
    }
  }, [isPlaying, currentTrack]);

  // Actualizar Discord RPC cuando cambia la posición (throttled)
  const throttledDiscordPositionUpdate = useMemo(
    () => throttle((time: number) => {
      if (currentTrack && isPlaying) {
        discordRPCClient.updatePosition(time);
      }
    }, 5000), // Actualizar posición cada 5 segundos
    [currentTrack, isPlaying]
  );

  useEffect(() => {
    throttledDiscordPositionUpdate(currentTime);
  }, [currentTime, throttledDiscordPositionUpdate]);

  // Track selection optimizada
  const handleTrackSelect = useCallback(async (track: Track, fromPlaylist?: Track[], trackIndex?: number, isFromQueue: boolean = false, playlistNameOverride?: string) => {
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
      
      // Solo actualizar playlist si NO viene de la cola
      if (!isFromQueue) {
        if (fromPlaylist && Array.isArray(fromPlaylist) && fromPlaylist.length > 0) {
          const safeIndex = trackIndex !== undefined ? trackIndex : fromPlaylist.findIndex(t => t.id === track.id);
          
          setPlaylist([...fromPlaylist]);
          setCurrentTrackIndex(safeIndex >= 0 ? safeIndex : 0);
          
          if (playlistNameOverride) {
            setPlaylistName(playlistNameOverride);
          } else if (fromPlaylist === searchResults) {
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
      } else {
        console.log(`🎵 Reproducing canción de cola sin actualizar playlist: ${track.title}`);
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

  const getNextFromQueue = useCallback((saveContext: boolean = false): Track | null => {
    if (queue.length === 0) return null;
    
    // Si necesitamos guardar el contexto y no estamos ya reproducing desde la cola
    if (saveContext && !isPlayingFromQueue && currentTrack) {
      setOriginalPlaylistContext({
        playlist: [...playlist],
        currentIndex: currentTrackIndex,
        playlistName: playlistName
      });
      console.log(`💾 Guardando contexto de playlist: "${playlistName}", canción ${currentTrackIndex + 1}/${playlist.length}`);
    }
    
    // Obtener la primera canción de la cola
    const nextQueueItem = queue[0];
    
    // Remover de la cola
    setQueue(prev => prev.slice(1));
    
    return nextQueueItem.track;
  }, [queue, isPlayingFromQueue, currentTrack, playlist, currentTrackIndex, playlistName]);

  const restoreOriginalPlaylistContext = useCallback(() => {
    if (originalPlaylistContext) {
      console.log(`🔄 Restaurando contexto de playlist: "${originalPlaylistContext.playlistName}", canción ${originalPlaylistContext.currentIndex + 1}/${originalPlaylistContext.playlist.length}`);
      
      setPlaylist(originalPlaylistContext.playlist);
      setCurrentTrackIndex(originalPlaylistContext.currentIndex);
      setPlaylistName(originalPlaylistContext.playlistName);
      setIsPlayingFromQueue(false);
      setOriginalPlaylistContext(null);
      
      return true;
    }
    return false;
  }, [originalPlaylistContext]);

  const handleSongEnded = useCallback(() => {
    console.log(`🎵 Canción terminada. RepeatMode: ${repeatMode}, Playlist length: ${playlist.length}, Queue length: ${queue.length}, IsPlayingFromQueue: ${isPlayingFromQueue}`);
    
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
    
    // CASO 1: Hay más canciones en la cola
    if (queue.length > 0) {
      const nextTrackFromQueue = getNextFromQueue(!isPlayingFromQueue); // Solo guardar contexto si no estamos ya en cola
      if (nextTrackFromQueue) {
        console.log(`🎵 Reproduciendo siguiente de la cola: ${nextTrackFromQueue.title}`);
        handleTrackSelect(nextTrackFromQueue, undefined, undefined, true); // isFromQueue = true
        setIsPlayingFromQueue(true);
        return;
      }
    }
    
    // CASO 2: No hay más canciones en la cola Y estábamos reproducing desde la cola
    if (queue.length === 0 && isPlayingFromQueue && originalPlaylistContext) {
      console.log(`🔄 Cola vacía, restaurando contexto original...`);
      const savedContext = originalPlaylistContext;
      
      // Restaurar estado
      setPlaylist(savedContext.playlist);
      setCurrentTrackIndex(savedContext.currentIndex);
      setPlaylistName(savedContext.playlistName);
      setIsPlayingFromQueue(false);
      setOriginalPlaylistContext(null);
      
      // Continuar con la siguiente canción de la playlist original
      let nextIndex;
      if (isShuffle) {
        const availableIndexes = savedContext.playlist.map((_, index) => index).filter(index => index !== savedContext.currentIndex);
        if (availableIndexes.length === 0) {
          console.log("🔀 No hay más canciones disponibles para shuffle en playlist restaurada");
          setIsPlaying(false);
          return;
        }
        nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      } else {
        if (repeatMode === "all") {
          nextIndex = (savedContext.currentIndex + 1) % savedContext.playlist.length;
        } else {
          if (savedContext.currentIndex >= savedContext.playlist.length - 1) {
            console.log("⏹️ Última canción en playlist restaurada modo 'off', pausando");
            setIsPlaying(false);
            return;
          }
          nextIndex = savedContext.currentIndex + 1;
        }
      }
      
      const nextTrack = savedContext.playlist[nextIndex];
      if (nextTrack) {
        console.log(`🎵 Continuando con playlist restaurada: ${nextTrack.title} (${nextIndex + 1}/${savedContext.playlist.length})`);
        handleTrackSelect(nextTrack, savedContext.playlist, nextIndex, false, savedContext.playlistName);
        return;
      }
    }
    
    // CASO 3: Playlist normal (no hay cola y no estamos reproducing desde cola)
    setIsPlayingFromQueue(false);
    
    // Si no hay playlist actual pero tenemos una sola canción, no pausar inmediatamente
    // sino verificar si hay contexto de playlist guardado
    if (playlist.length <= 1) {
      console.log("📭 Playlist actual pequeña o vacía, verificando contexto persistente...");
      
      // Si estamos restaurando y hay contexto, mantener reproducción
      if (playlistName && playlistName !== "Canción individual") {
        console.log(`🔄 Manteniendo reproducción en contexto: "${playlistName}"`);
        // No pausar aquí, continuar con la lógica normal
      } else {
        console.log("📭 No hay más canciones en la playlist, pausando");
        setIsPlaying(false);
        return;
      }
    }
    
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
        nextIndex = (currentTrackIndex + 1) % playlist.length;
        console.log(`🔄 Modo "all": avanzando a canción ${nextIndex + 1}/${playlist.length}`);
      } else {
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
      handleTrackSelect(nextTrack, playlist, nextIndex, false, playlistName);
    } else {
      console.log("❌ No se encontró la siguiente canción, pausando");
      setIsPlaying(false);
    }
  }, [repeatMode, currentTrack, playlist, currentTrackIndex, isShuffle, handleTrackSelect, queue, getNextFromQueue, isPlayingFromQueue, originalPlaylistContext, playlistName]);

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
    
    if (now - lastActionTime < 500 || pendingTrackId) {
      return;
    }
    
    setLastActionTime(now);
    
    console.log(`⏭️ Skip forward - Queue length: ${queue.length}, IsPlayingFromQueue: ${isPlayingFromQueue}`);
    
    // CASO 1: Hay canciones en la cola
    if (queue.length > 0) {
      const nextTrackFromQueue = getNextFromQueue(!isPlayingFromQueue); // Solo guardar contexto si no estamos ya en cola
      if (nextTrackFromQueue) {
        console.log(`⏭️ Saltando a siguiente de la cola: ${nextTrackFromQueue.title}`);
        handleTrackSelect(nextTrackFromQueue, undefined, undefined, true); // isFromQueue = true
        setIsPlayingFromQueue(true);
        return;
      }
    }
    
    // CASO 2: No hay más canciones en la cola Y estábamos reproducing desde la cola
    if (queue.length === 0 && isPlayingFromQueue && originalPlaylistContext) {
      console.log(`⏭️ Cola vacía en skip, restaurando contexto original...`);
      const savedContext = originalPlaylistContext;
      
      // Restaurar estado
      setPlaylist(savedContext.playlist);
      setCurrentTrackIndex(savedContext.currentIndex);
      setPlaylistName(savedContext.playlistName);
      setIsPlayingFromQueue(false);
      setOriginalPlaylistContext(null);
      
      // Avanzar a la siguiente canción de la playlist original
      let nextIndex;
      if (isShuffle) {
        const availableIndexes = savedContext.playlist.map((_, index) => index).filter(index => index !== savedContext.currentIndex);
        if (availableIndexes.length === 0) {
          console.log("🔀 No hay más canciones disponibles para shuffle en playlist restaurada");
          setIsPlaying(false);
          return;
        }
        nextIndex = availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
      } else {
        if (repeatMode === "all") {
          nextIndex = (savedContext.currentIndex + 1) % savedContext.playlist.length;
        } else {
          if (savedContext.currentIndex >= savedContext.playlist.length - 1) {
            console.log("⏹️ Última canción en playlist restaurada modo 'off', pausando");
            setIsPlaying(false);
            return;
          }
          nextIndex = savedContext.currentIndex + 1;
        }
      }
      
      const nextTrack = savedContext.playlist[nextIndex];
      if (nextTrack) {
        console.log(`⏭️ Saltando en playlist restaurada: ${nextTrack.title} (${nextIndex + 1}/${savedContext.playlist.length})`);
        handleTrackSelect(nextTrack, savedContext.playlist, nextIndex, false, savedContext.playlistName);
        return;
      }
    }
    
    // CASO 3: Playlist normal
    setIsPlayingFromQueue(false);
    
    if (playlist.length === 0) {
      return;
    }
    
    let nextIndex;
    if (isShuffle) {
      const availableIndexes = playlist.map((_, index) => index).filter(index => index !== currentTrackIndex);
      nextIndex = availableIndexes.length === 0 ? currentTrackIndex : 
        availableIndexes[Math.floor(Math.random() * availableIndexes.length)];
    } else {
      if (repeatMode === "all") {
        nextIndex = (currentTrackIndex + 1) % playlist.length;
      } else {
        if (currentTrackIndex < playlist.length - 1) {
          nextIndex = currentTrackIndex + 1;
        } else {
          setIsPlaying(false);
          return;
        }
      }
    }
    
    const nextTrack = playlist[nextIndex];
    if (nextTrack) {
      console.log(`⏭️ Saltando en playlist normal: ${nextTrack.title}`);
      handleTrackSelect(nextTrack, playlist, nextIndex, false, playlistName);
    }
  }, [lastActionTime, playlist, pendingTrackId, isShuffle, currentTrackIndex, repeatMode, handleTrackSelect, queue, getNextFromQueue, isPlayingFromQueue, originalPlaylistContext, playlistName]);

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
      handleTrackSelect(prevTrack, playlist, prevIndex, false, playlistName);
    }
  }, [lastActionTime, pendingTrackId, currentTime, playlist, isShuffle, currentTrackIndex, handleSeek, handleTrackSelect, playlistName]);

  // NUEVO: Handler para toggle dark mode desde settings
  const toggleDarkMode = useCallback((darkMode: boolean) => {
    setIsDarkMode(darkMode);
  }, []);

  // Configurar MediaSession handlers cuando los callbacks estén listos
  useEffect(() => {
    if ('mediaSession' in navigator) {
      console.log('🎛️ Setting up MediaSession action handlers');
      
      try {
        navigator.mediaSession.setActionHandler('play', () => {
          console.log('🎵 Media key: Play pressed');
          handlePlayPause();
        });
        
        navigator.mediaSession.setActionHandler('pause', () => {
          console.log('⏸️ Media key: Pause pressed');
          handlePlayPause();
        });
        
        navigator.mediaSession.setActionHandler('nexttrack', () => {
          console.log('⏭️ Media key: Next track pressed');
          handleSkipForward();
        });
        
        navigator.mediaSession.setActionHandler('previoustrack', () => {
          console.log('⏮️ Media key: Previous track pressed');
          handleSkipBack();
        });
        
        navigator.mediaSession.setActionHandler('stop', () => {
          console.log('⏹️ Media key: Stop pressed');
          handlePlayPause();
        });

        console.log('✅ All MediaSession action handlers set up successfully');
      } catch (error) {
        console.error('❌ Error setting up MediaSession action handlers:', error);
      }
    } else {
      console.warn('⚠️ MediaSession API not supported');
    }
  }, [handlePlayPause, handleSkipForward, handleSkipBack]);

  const handleRepeatModeChange = useCallback((mode: "off" | "all" | "one") => {
    setRepeatMode(mode);
  }, []);

  const handleShuffleToggle = useCallback((shuffle: boolean) => {
    setIsShuffle(shuffle);
  }, []);

  // Funciones para la cola de reproducción
  const handleAddToQueue = useCallback((track: Track) => {
    const queueItem: QueueItem = {
      track,
      addedAt: Date.now(),
      id: `queue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    setQueue(prev => [...prev, queueItem]);
    console.log(`📝 Canción "${track.title}" añadida a la cola`);
  }, []);

  const handlePlayFromQueue = useCallback((queueItem: QueueItem) => {
    // Guardar contexto antes de reproducir desde la cola (si no estamos ya en cola)
    if (!isPlayingFromQueue && currentTrack) {
      setOriginalPlaylistContext({
        playlist: [...playlist],
        currentIndex: currentTrackIndex,
        playlistName: playlistName
      });
      console.log(`💾 Guardando contexto antes de reproducir desde cola: "${playlistName}", canción ${currentTrackIndex + 1}/${playlist.length}`);
    }
    
    // Reproducir la canción de la cola
    handleTrackSelect(queueItem.track, undefined, undefined, true); // isFromQueue = true
    
    // Remover de la cola
    setQueue(prev => prev.filter(item => item.id !== queueItem.id));
    
    // Marcar que estamos reproducing desde la cola
    setIsPlayingFromQueue(true);
    
    console.log(`🎵 Reproduciendo desde la cola: "${queueItem.track.title}"`);
  }, [isPlayingFromQueue, currentTrack, playlist, currentTrackIndex, playlistName, handleTrackSelect]);

  const handleRemoveFromQueue = useCallback((queueItemId: string) => {
    setQueue(prev => prev.filter(item => item.id !== queueItemId));
  }, []);

    // Memoizar props complejas
    const playlistInfo = useMemo(() => ({
      name: playlistName,
      current: currentTrackIndex + 1,
      total: playlist.length
    }), [playlistName, currentTrackIndex, playlist.length]);

  return (
    <div className="flex h-screen w-full bg-white dark:bg-black text-black dark:text-white">
      <Sidebar 
        currentView={currentView} 
        setCurrentView={setCurrentView}
        isDarkMode={isDarkMode}
        onToggleDarkMode={toggleDarkMode}
      />
      
      <div className="flex flex-col flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto bg-gradient-to-b from-gray-100 to-white dark:from-gray-900 dark:to-black p-6 pb-24">
          <MusicLibrary
            onTrackSelect={handleTrackSelect}
            currentView={currentView}
            searchResults={searchResults}
            onSearch={handleSearch}
            isLoading={isLoading}
            searchQuery={searchQuery}
            queue={queue}
            onAddToQueue={handleAddToQueue}
            onPlayFromQueue={handlePlayFromQueue}
            isShuffle={isShuffle}
            isDarkMode={isDarkMode}
            onToggleDarkMode={toggleDarkMode}
            // NUEVO: Props para compresión
            isCompressing={isCompressing}
            setIsCompressing={setIsCompressing}
            compressionProgress={compressionProgress}
            compressionResult={compressionResult}
            setCompressionResult={setCompressionResult}
          />
        </main>
        
        
        {currentTrack && (
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
            currentTrack={currentTrack}
            playlistInfo={playlistInfo}
          />
        )}
      </div>
    </div>
  );
}

