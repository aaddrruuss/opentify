import React, { useState } from "react";
import { TrackList } from "./TrackList";
import { Track } from "../types";
import { SearchIcon } from "lucide-react";

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

  const renderContent = () => {
    switch (currentView) {
      case "home":
        return (
          <>
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">Bienvenido</h2>
              <div className="bg-white rounded-lg shadow-sm p-6">
                <p className="text-gray-600 mb-4">
                  Usa la búsqueda para encontrar música de YouTube. Las canciones se guardan
                  en cache para una reproducción más rápida.
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
                <h2 className="text-2xl font-bold mb-4">Últimas búsquedas</h2>
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
            <div className="bg-white rounded-md shadow p-4 mb-6">
              <form onSubmit={handleSearchSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Buscar canciones, artistas o álbumes en YouTube"
                  className="flex-1 p-3 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#2196F3] focus:border-transparent"
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
              <p className="text-sm text-gray-500 mt-2">
                💡 Se añade "audio" automáticamente a tu búsqueda y se filtran videos de más de 15 minutos.
                Las canciones se guardan en cache para reproducción rápida.
              </p>
            </div>

            {isLoading && (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#2196F3]"></div>
                <p className="ml-4 text-gray-600">Buscando canciones...</p>
              </div>
            )}

            {!isLoading && searchResults.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold">
                    Resultados para "{searchQuery}"
                  </h2>
                  <span className="text-sm text-gray-500">
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
                <p className="text-gray-500 mb-2">
                  No se encontraron canciones para "{searchQuery}"
                </p>
                <p className="text-sm text-gray-400">
                  Intenta con términos más específicos. Solo se muestran videos de menos de 15 minutos.
                </p>
              </div>
            )}

            {!isLoading && !searchQuery && (
              <div className="text-center py-12">
                <SearchIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">
                  Busca tu música favorita en YouTube
                </p>
                <p className="text-sm text-gray-400">
                  Solo se mostrarán canciones de menos de 15 minutos de duración
                </p>
              </div>
            )}
          </section>
        );

      case "library":
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4">Tu Biblioteca</h2>
            {searchResults.length > 0 ? (
              <TrackList tracks={searchResults} onTrackSelect={onTrackSelect} />
            ) : (
              <div className="bg-white rounded-lg shadow-sm p-8 text-center">
                <p className="text-gray-500">
                  Tu biblioteca está vacía. Busca música para comenzar.
                </p>
              </div>
            )}
          </section>
        );

      case "playlists":
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4">Playlists</h2>
            <div className="bg-white p-6 rounded-md shadow-sm">
              <p className="text-gray-600 mb-4">
                Las playlists estarán disponibles próximamente.
              </p>
              <button
                className="p-3 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors opacity-50 cursor-not-allowed"
                disabled
              >
                Crear Nueva Playlist
              </button>
            </div>
          </section>
        );

      case "liked":
        return (
          <section>
            <h2 className="text-2xl font-bold mb-4">Canciones Favoritas</h2>
            <div className="bg-white rounded-lg shadow-sm p-8 text-center">
              <p className="text-gray-500">
                Aún no has marcado canciones como favoritas.
              </p>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  return <div>{renderContent()}</div>;
}
