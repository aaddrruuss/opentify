import React, { useState, useEffect, memo, useCallback, useMemo } from "react";
import { TrackList } from "./TrackList";
import { ImportPlaylist } from "./ImportPlaylist";
import { PlaylistCard } from "./PlaylistCard";
import { Track } from "../types/index";
import { SearchIcon, Upload, Music } from "lucide-react";

interface MusicLibraryProps {
  onTrackSelect: (track: Track, fromPlaylist?: Track[], trackIndex?: number) => void;
  currentView: string;
  searchResults: Track[];
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchQuery: string;
}

export const MusicLibrary = memo(({
  onTrackSelect,
  currentView,
  searchResults,
  onSearch,
  isLoading,
  searchQuery,
}: MusicLibraryProps) => {
  const [inputValue, setInputValue] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedPlaylists, setImportedPlaylists] = useState<{[key: string]: Track[]}>({});
  const [playlistsLoaded, setPlaylistsLoaded] = useState(false);
  const [expandedPlaylists, setExpandedPlaylists] = useState<string[]>([]);

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

  // Memoizar contenido pesado
  const playlistsContent = useMemo(() => {
    if (currentView !== "playlists") return null;
    
    return (
      <section>
        <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">Tus Playlists</h2>
        
        <div className="mb-8">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                  Gestionar Playlists
                </h3>
                <p className="text-gray-600 dark:text-gray-300 text-sm">
                  Importa tus playlists de Spotify usando archivos CSV exportados desde tu cuenta.
                </p>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowImportModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[#1DB954] text-white rounded-md hover:bg-green-600 transition-colors"
              >
                <Upload className="h-4 w-4" />
                Importar de Spotify
              </button>
            </div>
          </div>
        </div>

        {Object.keys(importedPlaylists).length > 0 && (
          <div className="space-y-6">
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
                    onTrackSelect(tracks[0], tracks, 0);
                  }
                }}
                onTrackSelect={(track, trackIndex) => {
                  onTrackSelect(track, tracks, trackIndex);
                }}
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
              Importa una playlist de Spotify para comenzar
            </p>
            <button
              onClick={() => setShowImportModal(true)}
              className="px-6 py-3 bg-[#1DB954] text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              Importar Primera Playlist
            </button>
          </div>
        )}
      </section>
    );
  }, [currentView, importedPlaylists, playlistsLoaded, onTrackSelect, expandedPlaylists, togglePlaylistExpansion, handlePlaylistNameChange]);

  const renderContent = () => {
    switch (currentView) {
      case "home":
        return (
          <section className="mb-8">
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Bienvenido</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border dark:border-gray-700">
              <p className="text-gray-600 dark:text-gray-300 mb-4">
                Usa la búsqueda para encontrar música online. Las canciones se guardan
                en cache para una reproducción más rápida. Tu última canción y posición se restaurarán automáticamente.
              </p>
              <button
                onClick={() => onSearch("música popular 2024")}
                className="px-4 py-2 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors"
              >
                Buscar música popular
              </button>
            </div>

            {searchQuery && searchResults.length > 0 && (
              <section className="mt-8">
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Últimas búsquedas</h2>
                <TrackList
                  tracks={searchResults.slice(0, 5)} // Mostrar solo las primeras 5
                  onTrackSelect={onTrackSelect}
                />
              </section>
            )}
          </section>
        );

      case "search":
        return (
          <section>
            <div className="bg-white dark:bg-gray-800 rounded-md shadow p-4 mb-6 border dark:border-gray-700">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Buscar canciones, artistas o álbumes"
                  className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400"
                  autoFocus
                />
                <button
                  type="submit"
                  disabled={isLoading || !inputValue.trim()}
                  className="px-6 py-3 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  <SearchIcon className="h-5 w-5" />
                  Buscar
                </button>
              </form>
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2196F3]"></div>
                <p className="ml-4 text-gray-600 dark:text-gray-300">Buscando canciones...</p>
              </div>
            )}

            {!isLoading && searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Resultados para "{searchQuery}"
                  </h2>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {searchResults.length} canciones encontradas (&lt; 15 min)
                  </span>
                </div>
                <TrackList
                  tracks={searchResults}
                  onTrackSelect={onTrackSelect}
                />
              </>
            )}

            {!isLoading && searchQuery && searchResults.length === 0 && (
              <div className="text-center py-12">
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No se encontraron canciones para "{searchQuery}"
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Intenta con términos más específicos. Solo se muestran canciones de menos de 15 minutos.
                </p>
              </div>
            )}

            {!isLoading && !searchQuery && (
              <div className="text-center py-12">
                <SearchIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  Busca tu música favorita
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Solo se mostrarán canciones de menos de 15 minutos de duración
                </p>
              </div>
            )}
          </section>
        );

      case "library":
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Tu Biblioteca</h2>
            {searchResults.length > 0 ? (
              <TrackList tracks={searchResults} onTrackSelect={onTrackSelect} />
            ) : (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center border dark:border-gray-700">
                <p className="text-gray-500 dark:text-gray-400">
                  Tu biblioteca está vacía. Busca música para comenzar.
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
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Canciones Favoritas</h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 text-center border dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400">
                Aún no has marcado canciones como favoritas.
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
    </div>
  );
});

MusicLibrary.displayName = 'MusicLibrary';
