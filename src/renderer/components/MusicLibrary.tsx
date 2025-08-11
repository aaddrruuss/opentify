import React, { useState, useEffect } from "react";
import { TrackList } from "./TrackList";
import { ImportPlaylist } from "./ImportPlaylist";
import { Track } from "../types/index";
import { SearchIcon, Upload } from "lucide-react";

interface MusicLibraryProps {
  onTrackSelect: (track: Track) => void;
  currentView: string;
  searchResults: Track[];
  onSearch: (query: string) => void;
  isLoading: boolean;
  searchQuery: string;
}

export function MusicLibrary({
  onTrackSelect,
  currentView,
  searchResults,
  onSearch,
  isLoading,
  searchQuery,
}: MusicLibraryProps) {
  const [inputValue, setInputValue] = useState("");
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedPlaylists, setImportedPlaylists] = useState<{[key: string]: Track[]}>({});

  // Cargar playlists guardadas al inicializar
  useEffect(() => {
    const loadSavedPlaylists = async () => {
      try {
        const playlistNames = await window.playlistAPI.getPlaylists();
        const playlists: {[key: string]: Track[]} = {};
        
        for (const name of playlistNames) {
          const tracks = await window.playlistAPI.loadPlaylist(name);
          playlists[name] = tracks;
        }
        
        setImportedPlaylists(playlists);
        console.log(`📚 Cargadas ${playlistNames.length} playlists guardadas`);
      } catch (error) {
        console.error("Error cargando playlists guardadas:", error);
      }
    };
    
    loadSavedPlaylists();
  }, []);

  // Datos de ejemplo para la vista Home
  const recentlyPlayed: Track[] = [
    {
      id: "demo1",
      title: "Busca tu música favorita",
      artist: "Usa la búsqueda para encontrar canciones",
      duration: "0:00",
      cover: "https://via.placeholder.com/120x90/2196F3/ffffff?text=🎵",
      thumbnail: "https://via.placeholder.com/120x90/2196F3/ffffff?text=🎵",
    },
  ];

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputValue.trim()) {
      let searchTerm = inputValue.trim();
      
      // Agregar "audio" al final si no está presente en la búsqueda
      if (!searchTerm.toLowerCase().includes('audio')) {
        searchTerm += ' audio';
      }
      
      onSearch(searchTerm);
    }
  };

  const handleImportComplete = async (tracks: Track[], playlistName: string) => {
    setImportedPlaylists(prev => ({
      ...prev,
      [playlistName]: tracks
    }));
    setShowImportModal(false);
    
    console.log(`Playlist "${playlistName}" importada con ${tracks.length} canciones`);
  };

  const searchForImport = async (query: string): Promise<Track[]> => {
    try {
      // Hacer búsqueda directa sin modificar la query
      const results = await window.musicAPI.searchMusic(query);
      return results;
    } catch (error) {
      console.error('Error en búsqueda para importación:', error);
      return [];
    }
  };

  const renderContent = () => {
    switch (currentView) {
      case "home":
        return (
          <>
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Bienvenido</h2>
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border dark:border-gray-700">
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Usa la búsqueda para encontrar música de YouTube. Las canciones se guardan
                  en cache para una reproducción más rápida. Tu última canción y posición se restaurarán automáticamente.
                </p>
                <button
                  onClick={() => onSearch("música popular 2024")}
                  className="px-4 py-2 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors"
                >
                  Buscar música popular
                </button>
              </div>
            </section>

            {searchQuery && searchResults.length > 0 && (
              <section>
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Últimas búsquedas</h2>
                <TrackList
                  tracks={searchResults}
                  onTrackSelect={onTrackSelect}
                />
              </section>
            )}
          </>
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
                  placeholder="Buscar canciones, artistas o álbumes en YouTube"
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
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                💡 Se añade "audio" automáticamente a tu búsqueda y se filtran videos de más de 15 minutos.
                Las canciones se guardan en cache para reproducción rápida.
              </p>
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
                  Intenta con términos más específicos. Solo se muestran videos de menos de 15 minutos.
                </p>
              </div>
            )}

            {!isLoading && !searchQuery && (
              <div className="text-center py-12">
                <SearchIcon className="h-16 w-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  Busca tu música favorita en YouTube
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
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">Playlists</h2>
            
            <div className="mb-6">
              <div className="bg-white dark:bg-gray-800 p-6 rounded-md shadow-sm border dark:border-gray-700">
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
                  <button
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors opacity-50 cursor-not-allowed"
                    disabled
                    title="Próximamente"
                  >
                    Crear Nueva Playlist
                  </button>
                </div>
              </div>
            </div>

            {/* Imported Playlists */}
            {Object.keys(importedPlaylists).length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  Playlists Importadas
                </h3>
                {Object.entries(importedPlaylists).map(([name, tracks]) => (
                  <div key={name} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700">
                    <div className="p-4 border-b dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="font-medium text-gray-900 dark:text-gray-100">
                            {name}
                          </h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {tracks.length} canciones
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            // Play first track from playlist
                            if (tracks.length > 0) {
                              onTrackSelect(tracks[0]);
                            }
                          }}
                          className="px-3 py-1 text-sm bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors"
                        >
                          Reproducir
                        </button>
                      </div>
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      <TrackList
                        tracks={tracks}
                        onTrackSelect={onTrackSelect}
                        compact
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {Object.keys(importedPlaylists).length === 0 && (
              <div className="text-center py-8">
                <Upload className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 mb-2">
                  No tienes playlists importadas
                </p>
                <p className="text-sm text-gray-400 dark:text-gray-500">
                  Importa una playlist de Spotify para comenzar
                </p>
              </div>
            )}
          </section>
        );

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
      
      {/* Import Modal */}
      {showImportModal && (
        <ImportPlaylist
          onImportComplete={handleImportComplete}
          onCancel={() => setShowImportModal(false)}
          onSearch={searchForImport}
        />
      )}
    </div>
  );
}
