import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Music, Edit2, Check, X, Play, MoreHorizontal } from 'lucide-react';
import { Track } from '../types/index';

interface PlaylistCardProps {
  name: string;
  tracks: Track[];
  isExpanded: boolean;
  onToggleExpand: () => void;
  onNameChange: (oldName: string, newName: string) => void;
  onPlay: () => void;
  onTrackSelect: (track: Track, trackIndex: number) => void;
}

export function PlaylistCard({ 
  name, 
  tracks, 
  isExpanded, 
  onToggleExpand, 
  onNameChange, 
  onPlay, 
  onTrackSelect 
}: PlaylistCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(name);
  const [customImage, setCustomImage] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
            <div className="flex items-center justify-between p-6 border-b dark:border-gray-700">
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
                    onPlay();
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

            {/* Lista de canciones mejorada */}
            <div className="overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
              {tracks.length > 0 ? (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {tracks.map((track, index) => (
                    <button
                      key={track.id}
                      onClick={() => {
                        onTrackSelect(track, index);
                        // NO cerrar el modal
                      }}
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
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12">
                  <Music className="w-16 h-16 text-gray-400 mb-4" />
                  <p className="text-gray-500 dark:text-gray-400 text-lg">
                    Esta playlist está vacía
                  </p>
                  <p className="text-gray-400 dark:text-gray-500 text-sm">
                    Agrega algunas canciones para comenzar
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
