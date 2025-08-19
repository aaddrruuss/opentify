import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { useTranslation } from 'react-i18next';
import { TrackList } from "./TrackList";
import { ImportPlaylist } from "./ImportPlaylist";
import { PlaylistCard } from "./PlaylistCard";
import { Track, QueueItem } from "../types/index";
import { SearchIcon, Upload, Music, Plus } from "lucide-react";
import { SettingsView } from './SettingsView';

interface MusicLibraryProps {
  onTrackSelect: (track: Track, fromPlaylist?: Track[], trackIndex?: number, isFromQueue?: boolean, playlistNameOverride?: string) => void;
  currentView: string;
  searchResults: Track[];
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchQuery: string;
  queue?: QueueItem[];
  onAddToQueue?: (track: Track) => void;
  onPlayFromQueue?: (queueItem: QueueItem) => void;
  isShuffle?: boolean;
}

export const MusicLibrary = memo(({
  onTrackSelect,
  currentView,
  searchResults,
  onSearch,
  isLoading,
  searchQuery,
  queue,
  onAddToQueue,
  onPlayFromQueue,
  isShuffle,
  isDarkMode,
  onToggleDarkMode,
  // NUEVO: Props para compresión
  isCompressing,
  setIsCompressing,
  compressionProgress,
  compressionResult,
  setCompressionResult,
}: MusicLibraryProps & { 
  isDarkMode: boolean; 
  onToggleDarkMode: (darkMode: boolean) => void;
  // NUEVO: Props de compresión
  isCompressing: boolean;
  setIsCompressing: (value: boolean) => void;
  compressionProgress: {
    processed: number;
    total: number;
    current: string;
    success: number;
    failed: number;
  } | null;
  compressionResult: string | null;
  setCompressionResult: (value: string | null) => void;
}) => {
  const { t } = useTranslation();
  const [inputValue, setInputValue] = useState("");
  // Add missing compressionProgress state and setter
  const [compressionProgressState, setCompressionProgress] = useState<{
    processed: number;
    total: number;
    current: string;
    success: number;
    failed: number;
  } | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [importedPlaylists, setImportedPlaylists] = useState<{[key: string]: Track[]}>({});
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [expandedPlaylists, setExpandedPlaylists] = useState<string[]>([]);
  const [popularMusic, setPopularMusic] = useState<Track[]>([]); // Estado independiente para música popular
  const [displayedResults, setDisplayedResults] = useState(10); // Número de resultados mostrados
  const [manualSearchResults, setManualSearchResults] = useState<Track[]>([]); // Estado para búsquedas manuales
  // Redefinir los estados `isLoading` y `searchQuery` con sus setters
  const [isLoadingPopular, setIsLoadingPopular] = useState(false); // Indicador de carga para música popular
  const [popularQuery, setPopularQuery] = useState("música popular 2025"); // Consulta para el menú principal

  // Lazy load playlists only when needed
  useEffect(() => {
    if (currentView === "playlists" && !playlistsLoaded) {
      const loadSavedPlaylists = async () => {
        try {
          const playlistNames = await window.playlistAPI.getPlaylists();
          const playlists: {[key: string]: Track[]} = {};
          
          // Load playlists in batches to avoid blocking
          for (let i = 0; i < playlistNames.length; i += 2) {
            const batch = playlistNames.slice(i, i + 2);
            await Promise.all(
              batch.map(async (name) => {
                try {
                  const tracks = await window.playlistAPI.loadPlaylist(name);
                  playlists[name] = tracks;
                } catch (error) {
                  console.error(`Error loading playlist ${name}:`, error);
                }
              })
            );
            
            // Small delay between batches
            if (i + 2 < playlistNames.length) {
              await new Promise(resolve => setTimeout(resolve, 50));
            }
          }
          
          setImportedPlaylists(playlists);
          setPlaylistsLoaded(true);
          console.log(`📚 Cargadas ${playlistNames.length} playlists`);
        } catch (error) {
          console.error("Error cargando playlists:", error);
          setPlaylistsLoaded(true);
        }
      };
      
      loadSavedPlaylists();
    }
  }, [currentView, playlistsLoaded]);

  // NUEVO: Escuchar completación de importaciones en segundo plano
  useEffect(() => {
    const handleImportCompletion = (event: any, data: any) => {
      if (data.event === 'task-completed') {
        console.log('🎉 Importación completada, recargando playlists...');
        
        // Forzar recarga de playlists después de un breve delay
        setTimeout(async () => {
          try {
            setPlaylistsLoaded(false); // Forzar recarga
            
            const playlistNames = await window.playlistAPI.getPlaylists();
            const playlists: {[key: string]: Track[]} = {};
            
            for (const name of playlistNames) {
              try {
                const tracks = await window.playlistAPI.loadPlaylist(name);
                playlists[name] = tracks;
              } catch (error) {
                console.error(`Error loading playlist ${name}:`, error);
              }
            }
            
            setImportedPlaylists(playlists);
            setPlaylistsLoaded(true);
            
            console.log(`🔄 Playlists recargadas después de importación completada: ${playlistNames.length} playlists`);
          } catch (error) {
            console.error("Error recargando playlists después de importación:", error);
            setPlaylistsLoaded(true);
          }
        }, 3000); // 3 segundos de delay para dar tiempo al guardado
      }
    };

    if (window.electronAPI) {
      window.electronAPI.on('import-manager', handleImportCompletion);
      
      return () => {
        if (window.electronAPI) {
          window.electronAPI.removeListener('import-manager', handleImportCompletion);
        }
      };
    }
  }, []);

  const handleSearchSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      let searchTerm = inputValue.trim();
      
      if (!searchTerm.toLowerCase().includes('audio')) {
        searchTerm += ' audio';
      }
      
      onSearch(searchTerm);
    }
  }, [inputValue, onSearch]);

  const handleImportComplete = useCallback(async (tracks: Track[], playlistName: string) => {
    // Si hay canciones, actualizar inmediatamente
    if (tracks.length > 0) {
      setImportedPlaylists(prev => ({
        ...prev,
        [playlistName]: tracks
      }));
    }
    
    // MEJORADO: Recargar más agresivamente
    setTimeout(async () => {
      try {
        console.log(`🔄 Recargando playlists después de importación manual...`);
        
        const playlistNames = await window.playlistAPI.getPlaylists();
        const playlists: {[key: string]: Track[]} = {};
        
        for (const name of playlistNames) {
          try {
            const playlistTracks = await window.playlistAPI.loadPlaylist(name);
            playlists[name] = playlistTracks;
          } catch (error) {
            console.error(`Error loading playlist ${name}:`, error);
          }
        }
        
        setImportedPlaylists(playlists);
        setPlaylistsLoaded(true);
        console.log(`🔄 Playlists recargadas: ${playlistNames.length} total`);
      } catch (error) {
        console.error("Error recargando playlists:", error);
      }
    }, 1000); // Reducir delay a 1 segundo
    
    setShowImportModal(false);
  }, []);

  const searchForImport = useCallback(async (query: string): Promise<Track[]> => {
    try {
      const results = await window.musicAPI.searchMusic(query);
      return results;
    } catch (error) {
      console.error('Error en búsqueda para importación:', error);
      return [];
    }
  }, []);

  const togglePlaylistExpansion = useCallback((playlistName: string) => {
    setExpandedPlaylists(prev => 
      prev.includes(playlistName) 
        ? prev.filter(name => name !== playlistName)
        : [...prev, playlistName]
    );
  }, []);

  const handlePlaylistNameChange = useCallback(async (oldName: string, newName: string) => {
    if (oldName === newName) return;
    
    try {
      // Usar la nueva API de renombrado que preserva todos los datos (archivos, imagen, etc.)
      const success = await window.playlistAPI.renamePlaylist(oldName, newName);
      
      if (success) {
        // Actualizar el estado local
        setImportedPlaylists(prev => {
          const updated = { ...prev };
          const tracks = updated[oldName];
          delete updated[oldName];
          updated[newName] = tracks;
          return updated;
        });

        // Actualizar expanded playlists si es necesario
        setExpandedPlaylists(prev => 
          prev.includes(oldName) 
            ? prev.map(name => name === oldName ? newName : name)
            : prev
        );
        
        console.log(`✅ Playlist renombrada de "${oldName}" a "${newName}"`);
      } else {
        console.error("❌ Error al renombrar la playlist");
      }
    } catch (error) {
      console.error("Error renombrando playlist:", error);
    }
  }, []);

  // NUEVO: Función para recargar playlists cuando se eliminan canciones
  const reloadPlaylists = useCallback(async () => {
    try {
      setPlaylistsLoaded(false);
      
      const playlistNames = await window.playlistAPI.getPlaylists();
      const playlists: {[key: string]: Track[]} = {};
      
      for (const name of playlistNames) {
        try {
          const tracks = await window.playlistAPI.loadPlaylist(name);
          playlists[name] = tracks;
        } catch (error) {
          console.error(`Error loading playlist ${name}:`, error);
        }
      }
      
      setImportedPlaylists(playlists);
      setPlaylistsLoaded(true);
      
      console.log(`🔄 Playlists recargadas después de eliminar canciones con restricción: ${playlistNames.length} playlists`);
    } catch (error) {
      console.error("Error recargando playlists:", error);
      setPlaylistsLoaded(true);
    }
  }, []);

  // Funciones para el menú contextual
  const handleAddToPlaylist = useCallback(async (track: Track, playlistName: string) => {
    try {
      // Cargar la playlist actual
      const currentTracks = await window.playlistAPI.loadPlaylist(playlistName);
      
      // Verificar si la canción ya está en la playlist
      const trackExists = currentTracks.some(t => t.id === track.id);
      if (trackExists) {
        console.log(`La canción "${track.title}" ya está en la playlist "${playlistName}"`);
        return;
      }
      
      // Añadir la canción a la playlist
      const updatedTracks = [...currentTracks, track];
      await window.playlistAPI.savePlaylist(playlistName, updatedTracks);
      
      // Actualizar el estado local
      setImportedPlaylists(prev => ({
        ...prev,
        [playlistName]: updatedTracks
      }));
      
      console.log(`✅ Canción "${track.title}" añadida a la playlist "${playlistName}"`);
    } catch (error) {
      console.error('Error añadiendo canción a playlist:', error);
    }
  }, []);

  const handleRemoveFromPlaylist = useCallback(async (track: Track, playlistName: string) => {
    try {
      // Cargar la playlist actual
      const currentTracks = await window.playlistAPI.loadPlaylist(playlistName);
      
      // Remover la canción de la playlist
      const updatedTracks = currentTracks.filter(t => t.id !== track.id);
      await window.playlistAPI.savePlaylist(playlistName, updatedTracks);
      
      // Actualizar el estado local
      setImportedPlaylists(prev => ({
        ...prev,
        [playlistName]: updatedTracks
      }));
      
      console.log(`🗑️ Canción "${track.title}" eliminada de la playlist "${playlistName}"`);
    } catch (error) {
      console.error('Error eliminando canción de playlist:', error);
    }
  }, []);

  const handleAddToQueueAction = useCallback((track: Track) => {
    if (onAddToQueue) {
      onAddToQueue(track);
      console.log(`📝 Canción "${track.title}" añadida a la cola`);
    }
  }, [onAddToQueue]);

  const handleDeletePlaylist = useCallback(async (playlistName: string) => {
    try {
      const success = await window.playlistAPI.deletePlaylist(playlistName);
      if (success) {
        // Actualizar el estado local removiendo la playlist
        setImportedPlaylists(prev => {
          const updated = { ...prev };
          delete updated[playlistName];
          return updated;
        });

        // Remover de playlists expandidas si está allí
        setExpandedPlaylists(prev => prev.filter(name => name !== playlistName));
        
        console.log(`🗑️ Playlist "${playlistName}" eliminada correctamente`);
      } else {
        console.error(`❌ Error eliminando la playlist "${playlistName}"`);
      }
    } catch (error) {
      console.error('Error eliminando playlist:', error);
    }
  }, []);

  const handleCreatePlaylist = useCallback(async () => {
    if (!newPlaylistName.trim()) return;

    try {
      // Crear playlist vacía
      const success = await window.playlistAPI.savePlaylist(newPlaylistName.trim(), []);
      
      if (success) {
        // Actualizar el estado local
        setImportedPlaylists(prev => ({
          ...prev,
          [newPlaylistName.trim()]: []
        }));
        
        console.log(`✅ Playlist "${newPlaylistName.trim()}" creada correctamente`);
        
        // Limpiar y cerrar modal
        setNewPlaylistName('');
        setShowCreatePlaylistModal(false);
      } else {
        console.error(`❌ Error creando la playlist "${newPlaylistName.trim()}"`);
      }
    } catch (error) {
      console.error('Error creando playlist:', error);
    }
  }, [newPlaylistName]);

  const handleCancelCreatePlaylist = useCallback(() => {
    setNewPlaylistName('');
    setShowCreatePlaylistModal(false);
  }, []);

  // MEJORADO: Escuchar cambios en playlists y recargar automáticamente
  useEffect(() => {
    const handlePlaylistChanges = () => {
      console.log('🔄 Detectados cambios en playlists, recargando...');
      reloadPlaylists();
    };

    // Recargar playlists cada 5 segundos si hay cambios pendientes
    const intervalId = setInterval(() => {
      if (currentView === "playlists" && playlistsLoaded) {
        // Solo recargar ocasionalmente para detectar cambios
        if (Math.random() < 0.1) { // 10% de probabilidad cada 5 segundos
          reloadPlaylists();
        }
      }
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentView, playlistsLoaded, reloadPlaylists]);

  // Memoizar contenido pesado
  const playlistsContent = useMemo(() => {
    if (currentView !== "playlists") return null;
    
    return (
      <section>
        <h2 className="text-2xl font-bold mb-6 text-black dark:text-white">{t('playlists.your_playlists')}</h2>
        
        <div className="mb-8">
          <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-300 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-black dark:text-white mb-2">
                  {t('playlists.manage_playlists')}
                </h3>
                <p className="text-gray-700 dark:text-gray-300 text-sm">
                  {t('playlists.import_description')}
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-green-500 text-black rounded-md hover:bg-green-400 transition-colors font-medium"
              >
                <Upload className="h-4 w-4" />
                {t('playlists.import_from_spotify')}
              </button>
              
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-black dark:text-white rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {t('playlists.create_playlist')}
              </button>
            </div>
          </div>
        </div>

        {Object.keys(importedPlaylists).length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-6">
            {Object.entries(importedPlaylists).map(([name, tracks]) => (
              <PlaylistCard
                key={name}
                name={name}
                tracks={tracks}
                isExpanded={expandedPlaylists.includes(name)}
                onToggleExpand={() => togglePlaylistExpansion(name)}
                onNameChange={handlePlaylistNameChange}
                onPlay={() => {
                  if (tracks.length > 0) {
                    let startIndex = 0;
                    if (isShuffle) {
                      // Si shuffle está activado, elegir una canción aleatoria
                      startIndex = Math.floor(Math.random() * tracks.length);
                      console.log(`🔀 Shuffle activado: comenzando playlist "${name}" desde canción ${startIndex + 1}/${tracks.length}`);
                    }
                    onTrackSelect(tracks[startIndex], tracks, startIndex, false, name);
                  }
                }}
                onTrackSelect={(track, trackIndex) => {
                  onTrackSelect(track, tracks, trackIndex, false, name);
                }}
                onAddToPlaylist={handleAddToPlaylist}
                onRemoveFromPlaylist={handleRemoveFromPlaylist}
                onAddToQueue={handleAddToQueueAction}
                onDeletePlaylist={handleDeletePlaylist}
                isShuffle={isShuffle}
              />
            ))}
          </div>
        )}

        {!playlistsLoaded && (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#2196F3]"></div>
          </div>
        )}

        {playlistsLoaded && Object.keys(importedPlaylists).length === 0 && (
          <div className="text-center py-12">
            <div className="w-32 h-32 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg mx-auto mb-6 flex items-center justify-center">
              <Music className="w-16 h-16 text-white" />
            </div>
            <p className="text-gray-500 dark:text-gray-400 mb-2 text-lg font-medium">
              No tienes playlists aún
            </p>
            <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">
              Importa una playlist de Spotify o crea una nueva para comenzar
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setShowImportModal(true)}
                className="px-6 py-3 bg-[#1DB954] text-white rounded-lg hover:bg-green-600 transition-colors"
              >
                Importar de Spotify
              </button>
              <button
                onClick={() => setShowCreatePlaylistModal(true)}
                className="px-6 py-3 bg-[#2196F3] text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                {t('playlists.create_new_playlist')}
              </button>
            </div>
          </div>
        )}
      </section>
    );
  }, [currentView, importedPlaylists, playlistsLoaded, onTrackSelect, expandedPlaylists, togglePlaylistExpansion, handlePlaylistNameChange]);

  // Buscamos de manera automatica nada mas cargar el exe 
  useEffect(() => {
    const fetchPopularMusic = async () => {
      try {
        setIsLoadingPopular(true);
        const results = await window.musicAPI.searchMusic("canciones populares 2025");
        setPopularMusic(results.slice(0, 15)); 
      } catch (error) {
        console.error("Error en búsqueda automática de música popular:", error);
      } finally {
        setIsLoadingPopular(false);
      }
    };

    fetchPopularMusic();
  }, []);

  // Reseteamos las paginas de mostrar mas cuando cambien de pestaña 
  useEffect(() => {
    if (currentView === "home") {
      setDisplayedResults(10);
    }
  }, [currentView]);

  const handleShowMore = () => {
    setDisplayedResults(prev => Math.min(prev + 10, popularMusic.length));
  };

  const renderContent = () => {
    switch (currentView) {
      case "settings":
        return (
          <SettingsView 
            isDarkMode={isDarkMode}
            onToggleDarkMode={onToggleDarkMode}
            isCompressing={isCompressing}
            setIsCompressing={setIsCompressing}
            compressionProgress={compressionProgress}
            compressionResult={compressionResult}
            setCompressionResult={setCompressionResult}
            setCompressionProgress={setCompressionProgress}
          />
        );

      case "home":
        return (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">{t('home.welcome_back')}</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                {t('home.description')}
              </p>
              <button
                onClick={() => onSearch("musica 2025")}
                className="flex items-center gap-2 px-4 py-2 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                <SearchIcon className="w-5 h-5" />
                {t('home.refresh_popular_music')}
              </button>
            </div>

            {popularMusic.length > 0 && (
              <section className="mt-8">
                <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">{t('home.most_popular_songs')}</h2>
                <TrackList
                  tracks={popularMusic.slice(0, displayedResults)}
                  onTrackSelect={onTrackSelect}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueueAction}
                  isInPlaylist={false}
                />
                {displayedResults < popularMusic.length && displayedResults < 100 && (
                  <div className="text-center mt-6">
                    <button
                      onClick={handleShowMore}
                      className="px-6 py-3 bg-blue-500 text-black rounded-md hover:bg-blue-400 transition-colors font-medium"
                    >
                      Mostrar {Math.min(10, popularMusic.length - displayedResults)} canciones más
                    </button>
                  </div>
                )}
                {displayedResults >= 100 && (
                  <div className="text-center mt-4">
                    <p className="text-gray-400 text-sm">
                      Mostrando máximo 100 resultados
                    </p>
                  </div>
                )}
              </section>
            )}
          </section>
        );

      case "search":
        return (
          <section>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-md shadow p-4 mb-6 border border-gray-300 dark:border-gray-700">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={t('search.placeholder')}
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="px-6 py-3 bg-blue-500 text-black rounded-md hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
                >
                  <SearchIcon className="h-5 w-5" />
                  {t('search.button')}
                </button>
              </form>
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                <p className="ml-4 text-gray-300">{t('search.searching')}</p>
              </div>
            )}

            {!isLoading && searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">
                    {t('search.results_for', { query: searchQuery })}
                  </h2>
                  <span className="text-sm text-gray-400">
                    {t('search.songs_found', { count: searchResults.length })}
                  </span>
                </div>
                <TrackList
                  tracks={searchResults}
                  onTrackSelect={onTrackSelect}
                  onAddToPlaylist={handleAddToPlaylist}
                  onAddToQueue={handleAddToQueueAction}
                  isInPlaylist={false}
                />
              </>
            )}

            {!isLoading && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-400 mb-2">
                  {t('search.no_results', { query: searchQuery })}
                </p>
                <p className="text-sm text-gray-500">
                  {t('search.try_specific_terms')}
                </p>
              </div>
            )}

            {!isLoading && !searchQuery && (
              <div className="text-center py-12">
                <SearchIcon className="h-16 w-16 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  {t('search.find_favorite_music')}
                </p>
                <p className="text-sm text-gray-500">
                  {t('search.duration_limit')}
                </p>
              </div>
            )}
          </section>
        );

      case "library":
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-white">{t('library.your_library')}</h2>
            {searchResults.length > 0 ? (
              <TrackList 
                tracks={searchResults} 
                onTrackSelect={onTrackSelect}
                onAddToPlaylist={handleAddToPlaylist}
                onAddToQueue={handleAddToQueueAction}
                isInPlaylist={false}
              />
            ) : (
              <div className="bg-gray-800 rounded-lg shadow-sm p-8 text-center border border-gray-700">
                <p className="text-gray-400">
                  {t('library.empty_message')}
                </p>
              </div>
            )}
          </section>
        );

      case "playlists":
        return playlistsContent;

      case "liked":
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-black dark:text-white">{t('liked.liked_songs')}</h2>
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center border border-gray-300 dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-400">
                {t('liked.no_favorites')}
              </p>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <div>
      {renderContent()}
      
      {showImportModal && (
        <ImportPlaylist
          onImportComplete={handleImportComplete}
          onCancel={() => setShowImportModal(false)}
          onSearch={searchForImport}
        />
      )}

      {/* Modal para crear playlist */}
      {showCreatePlaylistModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold text-black dark:text-white mb-4">
              {t('playlists.create_new_playlist')}
            </h2>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('playlists.playlist_name')}
              </label>
              <input
                type="text"
                value={newPlaylistName}
                onChange={(e) => setNewPlaylistName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreatePlaylist();
                  } else if (e.key === 'Escape') {
                    handleCancelCreatePlaylist();
                  }
                }}
                placeholder={t('playlists.name_example')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-black dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                autoFocus
                maxLength={50}
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleCancelCreatePlaylist}
                className="px-4 py-2 text-gray-400 hover:text-gray-200 transition-colors"
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={handleCreatePlaylist}
                disabled={!newPlaylistName.trim()}
                className="px-4 py-2 bg-blue-500 text-black rounded-md hover:bg-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 font-medium"
              >
                <Plus className="h-4 w-4" />
                {t('playlists.create_playlist')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

MusicLibrary.displayName = 'MusicLibrary';
