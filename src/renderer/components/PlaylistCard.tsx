import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import { Music, Edit2, Check, X, Play, MoreHorizontal, ArrowUpDown, ArrowUp, ArrowDown, Search } from 'lucide-react';
import { Track, PlaylistSettings } from '../types/index';
import { ContextMenu } from './ContextMenu';
import { PlaylistContextMenu } from './PlaylistContextMenu';

interface PlaylistCardProps {
  name: string;
  tracks: Track[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNameChange: (oldName: string, newName: string) => void;
  onPlay: () => void;
  onTrackSelect: (track: Track, trackIndex: number, isFromQueue?: boolean, playlistNameOverride?: string) => void;
  onAddToPlaylist?: (track: Track, playlistName: string) => void;
  onRemoveFromPlaylist?: (track: Track, playlistName: string) => void;
  onAddToQueue?: (track: Track) => void;
  onDeletePlaylist?: (playlistName: string) => void;
  isShuffle?: boolean;
}

type SortType = 'default' | 'name' | 'artist' | 'duration';
type SortOrder = 'asc' | 'desc';

export function PlaylistCard({ 
  name, 
  tracks, 
  isExpanded, 
  onToggleExpand, 
  onNameChange, 
  onPlay, 
  onTrackSelect,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onAddToQueue,
  onDeletePlaylist,
  isShuffle
}: PlaylistCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Estados para ordenamiento
  const [sortType, setSortType] = useState<SortType>('default');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  
  // Estados para búsqueda
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Estados para menú contextual de canciones
  const [contextMenu, setContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
    track: Track | null;
  }>({
    isVisible: false,
    x: 0,
    y: 0,
    track: null
  });

  // Estados para menú contextual de playlist
  const [playlistContextMenu, setPlaylistContextMenu] = useState<{
    isVisible: boolean;
    x: number;
    y: number;
  }>({
    isVisible: false,
    x: 0,
    y: 0
  });

  // Cargar configuraciones de la playlist
  useEffect(() => {
    const loadPlaylistSettings = async () => {
      try {
        const settings = await window.playlistAPI.loadPlaylistSettings(name);
        if (settings) {
          setSortType(settings.sortType);
          setSortOrder(settings.sortOrder);
        }
      } catch (error) {
        console.log("No hay configuraciones previas para esta playlist");
      }
    };

    loadPlaylistSettings();
  }, [name]);

  // Cargar imagen personalizada al montar el componente
  useEffect(() => {
    const loadCustomImage = async () => {
      try {
        setIsLoadingImage(true);
        const imageData = await window.playlistAPI.loadPlaylistImage(name);
        setCustomImage(imageData);
      } catch (error) {
        console.error("Error cargando imagen personalizada:", error);
      } finally {
        setIsLoadingImage(false);
      }
    };

    loadCustomImage();
  }, [name]);

  // Cerrar dropdown cuando se hace click fuera
  useEffect(() => {
    const handleClickOutside = () => {
      setShowSortDropdown(false);
    };

    if (showSortDropdown) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showSortDropdown]);

  const handleImageUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validar tipo de archivo
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        console.error("❌ Tipo de archivo no soportado. Use JPG, PNG, GIF o WebP");
        return;
      }
      
      // Validar tamaño (máximo 5MB)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        console.error("❌ El archivo es demasiado grande. Máximo 5MB permitido");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = async (e) => {
        const imageData = e.target?.result as string;
        
        try {
          setIsLoadingImage(true);
          
          // Guardar la imagen en el backend
          const success = await window.playlistAPI.savePlaylistImage(name, imageData);
          
          if (success) {
            setCustomImage(imageData);
            console.log("✅ Imagen de playlist guardada");
          } else {
            console.error("❌ Error guardando imagen de playlist");
          }
        } catch (error) {
          console.error("Error guardando imagen:", error);
        } finally {
          setIsLoadingImage(false);
        }
      };
      reader.readAsDataURL(file);
    }
  }, [name]);

  // Actualizar la imagen cuando cambie el nombre de la playlist
  useEffect(() => {
    setEditName(name);
  }, [name]);

  const handleNameEdit = useCallback(async () => {
    if (isEditing) {
      const trimmedName = editName.trim();
      if (trimmedName !== name && trimmedName.length > 0) {
        // Llamar a la función de renombrado que preserva los datos
        try {
          await onNameChange(name, trimmedName);
          console.log(`✅ Playlist renombrada de "${name}" a "${trimmedName}"`);
        } catch (error) {
          console.error("Error renombrando playlist:", error);
          // Revertir el nombre si falla
          setEditName(name);
        }
      } else {
        // Revertir si el nombre está vacío o es igual
        setEditName(name);
      }
    }
    setIsEditing(!isEditing);
  }, [isEditing, editName, name, onNameChange]);

  const handleCancelEdit = useCallback(() => {
    setEditName(name);
    setIsEditing(false);
  }, [name]);

  // Función para guardar configuraciones de la playlist
  const savePlaylistSettings = useCallback(async (settings: PlaylistSettings) => {
    try {
      await window.playlistAPI.savePlaylistSettings(name, settings);
    } catch (error) {
      console.error("Error guardando configuraciones de la playlist:", error);
    }
  }, [name]);

  // Función para convertir duración a segundos para comparar
  const durationToSeconds = useCallback((duration: string): number => {
    if (!duration) return 0;
    const parts = duration.split(':').map(part => parseInt(part, 10));
    if (parts.length === 2) {
      return parts[0] * 60 + parts[1]; // MM:SS
    } else if (parts.length === 3) {
      return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
    }
    return 0;
  }, []);

  // Función para filtrar y ordenar canciones
  const filteredAndSortedTracks = useMemo(() => {
    // Primero filtrar por búsqueda
    let filtered = tracks;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filtered = tracks.filter(track => 
        track.title.toLowerCase().includes(query) || 
        track.artist.toLowerCase().includes(query)
      );
    }

    // Luego ordenar si es necesario
    if (sortType === 'default') {
      return filtered;
    }

    const sorted = [...filtered].sort((a, b) => {
      let comparison = 0;

      switch (sortType) {
        case 'name':
          comparison = a.title.localeCompare(b.title, 'es', { sensitivity: 'base' });
          break;
        case 'artist':
          comparison = a.artist.localeCompare(b.artist, 'es', { sensitivity: 'base' });
          break;
        case 'duration':
          const aDuration = durationToSeconds(a.duration);
          const bDuration = durationToSeconds(b.duration);
          comparison = aDuration - bDuration;
          break;
        default:
          return 0;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return sorted;
  }, [tracks, sortType, sortOrder, searchQuery, durationToSeconds]);

  // Manejar cambio de ordenamiento
  const handleSortChange = useCallback(async (newSortType: SortType) => {
    let newSortOrder: SortOrder = 'asc';

    if (sortType === newSortType) {
      // Si se selecciona el mismo tipo, alternar orden
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
    }

    setSortType(newSortType);
    setSortOrder(newSortOrder);
    setShowSortDropdown(false);

    // Guardar configuraciones
    await savePlaylistSettings({
      sortType: newSortType,
      sortOrder: newSortOrder
    });
  }, [sortType, sortOrder, savePlaylistSettings]);

  // Funciones para el menú contextual
  const handleContextMenu = useCallback((e: React.MouseEvent, track: Track) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      isVisible: true,
      x: e.clientX,
      y: e.clientY,
      track
    });
  }, []);

  const handleCloseContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, isVisible: false, track: null }));
  }, []);

  const handleAddToPlaylistAction = useCallback((track: Track, playlistName: string) => {
    onAddToPlaylist?.(track, playlistName);
  }, [onAddToPlaylist]);

  const handleRemoveFromPlaylistAction = useCallback((track: Track) => {
    onRemoveFromPlaylist?.(track, name);
  }, [onRemoveFromPlaylist, name]);

  const handleAddToQueueAction = useCallback((track: Track) => {
    onAddToQueue?.(track);
  }, [onAddToQueue]);

  // Funciones para el menú contextual de playlist
  const handlePlaylistContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPlaylistContextMenu({
      isVisible: true,
      x: e.clientX,
      y: e.clientY
    });
  }, []);

  const handleClosePlaylistContextMenu = useCallback(() => {
    setPlaylistContextMenu(prev => ({ ...prev, isVisible: false }));
  }, []);

  const handleDeletePlaylistAction = useCallback((playlistName: string) => {
    onDeletePlaylist?.(playlistName);
  }, [onDeletePlaylist]);

  const renderPlaylistImage = () => {
    if (isLoadingImage) {
      return (
        <div className="w-full h-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-400 border-t-transparent"></div>
        </div>
      );
    }

    if (customImage) {
      return (
        <img
          src={customImage}
          alt={name}
          className="w-full h-full object-cover"
          draggable={false}
        />
      );
    }

    // Crear collage con las primeras 4 canciones usando sus thumbnails reales
    const imageTracks = tracks.slice(0, 4);
    
    if (imageTracks.length === 0) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <Music className="w-12 h-12 text-white" />
        </div>
      );
    }

    if (imageTracks.length === 1) {
      const track = imageTracks[0];
      const coverUrl = track.thumbnail || track.cover;
      
      return coverUrl ? (
        <img
          src={coverUrl}
          alt={name}
          className="w-full h-full object-cover"
          draggable={false}
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            const fallback = target.nextElementSibling as HTMLElement;
            if (fallback) {
              fallback.style.display = 'flex';
            }
          }}
        />
      ) : (
        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <Music className="w-12 h-12 text-white" />
        </div>
      );
    }

    // Collage de múltiples covers
    return (
      <div className="w-full h-full grid grid-cols-2 gap-0.5">
        {imageTracks.map((track, index) => {
          const coverUrl = track.thumbnail || track.cover;
          
          return (
            <div key={index} className="relative bg-gray-300 dark:bg-gray-600">
              {coverUrl ? (
                <img
                  src={coverUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  draggable={false}
                  onError={(e) => {
                    const target = e.currentTarget as HTMLImageElement;
                    target.style.display = 'none';
                    const fallback = target.nextElementSibling as HTMLElement;
                    if (fallback) {
                      fallback.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div 
                className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center"
                style={{ display: coverUrl ? 'none' : 'flex' }}
              >
                <Music className="w-3 h-3 text-white" />
              </div>
            </div>
          );
        })}
        {/* Rellenar espacios vacíos si hay menos de 4 canciones */}
        {Array.from({ length: Math.max(0, 4 - imageTracks.length) }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center"
          >
            <Music className="w-3 h-3 text-white" />
          </div>
        ))}
      </div>
    );
  };

  return (
    <div 
      className="group cursor-pointer"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => onToggleExpand()} // Click en cualquier parte abre la playlist
      onContextMenu={handlePlaylistContextMenu} // Click derecho muestra menú contextual
    >
      {/* Tarjeta estilo Spotify */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-lg transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-700 shadow-sm hover:shadow-lg">
        {/* Imagen de la playlist con botón de play */}
        <div className="relative mb-4">
          <div className="aspect-square w-full bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden shadow-md">
            {renderPlaylistImage()}
            
            {/* Botón de play flotante - AZUL */}
            <div 
              className={`absolute bottom-2 right-2 transform transition-all duration-300 ${
                isHovered ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
              }`}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onPlay();
                }}
                className="w-12 h-12 bg-[#2196F3] rounded-full flex items-center justify-center shadow-lg hover:bg-blue-600 hover:scale-105 transition-all duration-200"
                title="Reproducir playlist"
              >
                <Play className="w-5 h-5 text-white fill-current ml-0.5" />
              </button>
            </div>

            {/* Overlay para editar imagen */}
            <div className="absolute top-2 right-2">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                className={`w-8 h-8 bg-black bg-opacity-50 rounded-full flex items-center justify-center transition-all duration-200 ${
                  isHovered ? 'opacity-100' : 'opacity-0'
                }`}
                title="Cambiar imagen"
              >
                <Edit2 className="w-4 h-4 text-white" />
              </button>
            </div>
          </div>

          {/* Input oculto para subir imagen */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageUpload}
            className="hidden"
          />
        </div>

        {/* Información de la playlist */}
        <div className="space-y-1">
          {/* Nombre editable con cursor text */}
          {isEditing ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="flex-1 text-sm font-bold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100"
                autoFocus
                onKeyPress={(e) => e.key === 'Enter' && handleNameEdit()}
                onBlur={handleNameEdit}
                maxLength={50}
              />
              <button
                onClick={handleNameEdit}
                className="text-[#2196F3] hover:text-blue-600"
              >
                <Check className="w-3 h-3" />
              </button>
              <button
                onClick={handleCancelEdit}
                className="text-red-500 hover:text-red-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <h3 
              className="text-sm font-bold text-gray-900 dark:text-gray-100 truncate hover:underline group-hover:text-[#2196F3] transition-colors duration-200 cursor-text"
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(true);
              }}
              title={name}
              style={{ cursor: 'text' }} // Forzar cursor de texto
            >
              {name}
            </h3>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            {tracks.length} canción{tracks.length !== 1 ? 'es' : ''}
          </p>
        </div>
      </div>

      {/* Modal expandible para mostrar canciones */}
      {isExpanded && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Solo cerrar si el click es en el backdrop, no en el contenido del modal
            if (e.target === e.currentTarget) {
              onToggleExpand();
            }
          }}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[80vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()} // Prevenir que clicks en el modal lo cierren
          >
            {/* Header del modal */}
            <div className="p-6 border-b dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-gray-200 dark:bg-gray-700 rounded-md overflow-hidden">
                    {renderPlaylistImage()}
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{name}</h2>
                    <p className="text-gray-500 dark:text-gray-400">
                      {tracks.length} canción{tracks.length !== 1 ? 'es' : ''}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      // Si shuffle está activado, reproducir canción aleatoria
                      if (isShuffle && tracks.length > 0) {
                        const randomIndex = Math.floor(Math.random() * tracks.length);
                        console.log(`🔀 Shuffle activado en modal: comenzando desde canción ${randomIndex + 1}/${tracks.length}`);
                        onTrackSelect(tracks[randomIndex], randomIndex, false, name);
                      } else {
                        onPlay();
                      }
                    }}
                    className="ml-4 px-6 py-2 bg-[#2196F3] text-white rounded-full hover:bg-blue-600 transition-colors flex items-center gap-2 hover:shadow-lg transform hover:scale-105"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Reproducir
                  </button>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleExpand();
                  }}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  title="Cerrar"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>
              
              {/* Controles de ordenamiento y búsqueda */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                  {/* Información de ordenamiento */}
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {sortType !== 'default' && (
                      <span className="flex items-center gap-1">
                        Ordenado por{' '}
                        <span className="font-medium">
                          {sortType === 'name' && 'Nombre'}
                          {sortType === 'artist' && 'Artista'}
                          {sortType === 'duration' && 'Duración'}
                        </span>
                        {sortOrder === 'asc' ? (
                          <ArrowUp className="w-3 h-3" />
                        ) : (
                          <ArrowDown className="w-3 h-3" />
                        )}
                      </span>
                    )}
                  </div>
                  
                  {/* Contador de resultados de búsqueda */}
                  {searchQuery.trim() && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {filteredAndSortedTracks.length} de {tracks.length} canciones
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-3">
                  {/* Campo de búsqueda */}
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar canciones..."
                      className="block w-64 pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2196F3] focus:border-[#2196F3] text-sm"
                      onClick={(e) => e.stopPropagation()}
                    />
                    {searchQuery && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSearchQuery('');
                        }}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        <X className="h-4 w-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300" />
                      </button>
                    )}
                  </div>
                  
                  {/* Dropdown de ordenamiento */}
                  <div className="relative">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSortDropdown(!showSortDropdown);
                      }}
                      className="flex items-center gap-2 px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    >
                      <ArrowUpDown className="w-4 h-4" />
                      Ordenar
                    </button>
                    
                    {showSortDropdown && (
                      <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 z-10">
                        <div className="py-2">
                          <button
                            onClick={() => handleSortChange('default')}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                              sortType === 'default' ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2196F3]' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Defecto (orden de importación)
                          </button>
                          <button
                            onClick={() => handleSortChange('name')}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                              sortType === 'name' ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2196F3]' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Por Nombre (canción)
                            {sortType === 'name' && (
                              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleSortChange('artist')}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                              sortType === 'artist' ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2196F3]' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Por Artista
                            {sortType === 'artist' && (
                              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleSortChange('duration')}
                            className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center justify-between ${
                              sortType === 'duration' ? 'bg-blue-50 dark:bg-blue-900/20 text-[#2196F3]' : 'text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            Por Duración
                            {sortType === 'duration' && (
                              sortOrder === 'asc' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Lista de canciones mejorada */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 180px)' }}>
              {filteredAndSortedTracks.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredAndSortedTracks.map((track, index) => {
                    // Encontrar el índice original de la canción para onTrackSelect
                    const originalIndex = tracks.findIndex(t => t.id === track.id);
                    return (
                      <button
                        key={track.id}
                        onClick={() => {
                          onTrackSelect(track, originalIndex, false, name);
                          // NO cerrar el modal
                        }}
                        onContextMenu={(e) => handleContextMenu(e, track)}
                        className="w-full text-left p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-8 text-center text-sm text-gray-500 dark:text-gray-400 font-medium">
                            {index + 1}
                          </div>
                          
                          <div className="relative flex-shrink-0">
                            {track.thumbnail ? (
                              <img
                                src={track.thumbnail}
                                alt={track.title}
                                className="w-12 h-12 rounded object-cover shadow-sm"
                                loading="lazy"
                                onError={(e) => {
                                  const target = e.currentTarget as HTMLImageElement;
                                  target.style.display = 'none';
                                  const musicIcon = target.nextElementSibling as HTMLElement;
                                  if (musicIcon) {
                                    musicIcon.style.display = 'flex';
                                  }
                                }}
                              />
                            ) : null}
                            <div 
                              className="absolute inset-0 w-12 h-12 bg-[#2196F3] dark:bg-blue-600 rounded flex items-center justify-center shadow-sm"
                              style={{ display: track.thumbnail ? 'none' : 'flex' }}
                            >
                              <Music className="w-5 h-5 text-white" />
                            </div>
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate group-hover:text-[#2196F3] transition-colors">
                              {track.title}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                              {track.artist}
                            </p>
                          </div>
                          
                          <div className="text-sm text-gray-500 dark:text-gray-400 flex-shrink-0 font-mono">
                            {track.duration}
                          </div>

                          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                            <Play className="w-4 h-4 text-[#2196F3]" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  {searchQuery.trim() ? (
                    <>
                      <Search className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 text-lg">
                        No se encontraron canciones
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">
                        No hay canciones que coincidan con "{searchQuery}"
                      </p>
                      <button
                        onClick={() => setSearchQuery('')}
                        className="px-4 py-2 bg-[#2196F3] text-white rounded-md hover:bg-blue-600 transition-colors text-sm"
                      >
                        Limpiar búsqueda
                      </button>
                    </>
                  ) : (
                    <>
                      <Music className="w-16 h-16 text-gray-400 mb-4" />
                      <p className="text-gray-500 dark:text-gray-400 text-lg">
                        Esta playlist está vacía
                      </p>
                      <p className="text-gray-400 dark:text-gray-500 text-sm">
                        Agrega algunas canciones para comenzar
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Menú contextual para canciones */}
      {contextMenu.track && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          track={contextMenu.track}
          isVisible={contextMenu.isVisible}
          onClose={handleCloseContextMenu}
          onAddToPlaylist={handleAddToPlaylistAction}
          onRemoveFromPlaylist={handleRemoveFromPlaylistAction}
          onAddToQueue={handleAddToQueueAction}
          isInPlaylist={true}
          currentPlaylistName={name}
        />
      )}

      {/* Menú contextual para playlist */}
      <PlaylistContextMenu
        x={playlistContextMenu.x}
        y={playlistContextMenu.y}
        playlistName={name}
        isVisible={playlistContextMenu.isVisible}
        onClose={handleClosePlaylistContextMenu}
        onDeletePlaylist={handleDeletePlaylistAction}
      />
    </div>
  );
}