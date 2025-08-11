import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Music, Edit2, Check, X, Play } from 'lucide-react';
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
          
          // Guardar la imagen en el backend (ahora se copiará al directorio de la playlist)
          const success = await window.playlistAPI.savePlaylistImage(name, imageData);
          
          if (success) {
            setCustomImage(imageData);
            console.log("✅ Imagen de playlist guardada y copiada al directorio");
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
          <div className="animate-spin rounded-full h-8 w-8 border-b border-gray-400"></div>
        </div>
      );
    }

    if (customImage) {
      return (
        <img
          src={customImage}
          alt={name}
          className="w-full h-full object-cover"
        />
      );
    }

    // Crear collage con las primeras 4 canciones
    const imageTracks = tracks.slice(0, 4);
    
    if (imageTracks.length === 0) {
      return (
        <div className="w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center">
          <Music className="w-12 h-12 text-white" />
        </div>
      );
    }

    if (imageTracks.length === 1) {
      return (
        <div className="w-full h-full relative">
          <img
            src={imageTracks[0].cover}
            alt={name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
              const fallback = target.nextElementSibling as HTMLElement;
              if (fallback) {
                fallback.style.display = 'flex';
              }
            }}
          />
          <div className="absolute inset-0 w-full h-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center hidden">
            <Music className="w-12 h-12 text-white" />
          </div>
        </div>
      );
    }

    return (
      <div className="w-full h-full grid grid-cols-2 gap-0.5">
        {imageTracks.map((track, index) => (
          <div key={index} className="relative bg-gray-300 dark:bg-gray-600">
            <img
              src={track.cover}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => {
                const target = e.currentTarget as HTMLImageElement;
                target.style.display = 'none';
                const fallback = target.nextElementSibling as HTMLElement;
                if (fallback) {
                  fallback.style.display = 'flex';
                }
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center hidden">
              <Music className="w-4 h-4 text-white" />
            </div>
          </div>
        ))}
        {/* Rellenar espacios vacíos si hay menos de 4 canciones */}
        {Array.from({ length: Math.max(0, 4 - imageTracks.length) }).map((_, index) => (
          <div
            key={`empty-${index}`}
            className="bg-gradient-to-br from-gray-400 to-gray-500 flex items-center justify-center"
          >
            <Music className="w-4 h-4 text-white" />
          </div>
        ))}
      </div>
    );
  };

  const handleToggleExpand = useCallback(() => {
    setIsAnimating(true);
    onToggleExpand();
    
    // Reset animation state after animation completes
    setTimeout(() => {
      setIsAnimating(false);
    }, 300);
  }, [onToggleExpand]);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden playlist-card-transition playlist-hover">
      {/* Playlist Header */}
      <div className="p-4">
        <div className="flex gap-4">
          {/* Playlist Image */}
          <div className="relative group">
            <div className="w-32 h-32 bg-gray-200 dark:bg-gray-700 rounded-lg overflow-hidden shadow-md">
              {renderPlaylistImage()}
              
              {/* Overlay con botones */}
              <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="flex gap-2">
                  <button
                    onClick={onPlay}
                    className="p-2 bg-green-500 rounded-full hover:bg-green-600 transition-colors transform hover:scale-110"
                    title="Reproducir playlist"
                  >
                    <Play className="w-4 h-4 text-white fill-current" />
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-2 bg-gray-600 rounded-full hover:bg-gray-700 transition-colors transform hover:scale-110"
                    title="Cambiar imagen"
                  >
                    <Edit2 className="w-4 h-4 text-white" />
                  </button>
                </div>
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

          {/* Playlist Info */}
          <div className="flex-1 flex flex-col justify-between">
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Playlist</p>
              
              {/* Nombre editable */}
              <div className="flex items-center gap-2 mb-2">
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1 animate-in slide-in-from-left-2 duration-200">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="text-xl font-bold bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500 text-gray-900 dark:text-gray-100 flex-1 transition-colors"
                      autoFocus
                      onKeyPress={(e) => e.key === 'Enter' && handleNameEdit()}
                      maxLength={50}
                    />
                    <button
                      onClick={handleNameEdit}
                      className="p-1 text-green-500 hover:text-green-600 transition-all hover:scale-110"
                      title="Guardar"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="p-1 text-red-500 hover:text-red-600 transition-all hover:scale-110"
                      title="Cancelar"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 group cursor-pointer" onClick={handleNameEdit}>
                    <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 truncate transition-colors">
                      {name}
                    </h2>
                    <Edit2 className="w-4 h-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-all duration-200 transform group-hover:scale-110" />
                  </div>
                )}
              </div>
              
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {tracks.length} canción{tracks.length !== 1 ? 'es' : ''}
              </p>
            </div>

            {/* Botones de acción */}
            <div className="flex items-center gap-2 mt-3">
              <button
                onClick={onPlay}
                className="px-4 py-2 bg-green-500 text-white rounded-full hover:bg-green-600 transition-all duration-200 flex items-center gap-2 hover:shadow-lg transform hover:scale-105"
              >
                <Play className="w-4 h-4 fill-current" />
                Reproducir
              </button>
              
              <button
                onClick={handleToggleExpand}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600 transition-all duration-200 transform hover:scale-105"
              >
                <span className="transition-transform duration-200 inline-block">
                  {isExpanded ? 'Ocultar' : 'Ver todas'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Lista de canciones expandible con animación mejorada */}
      <div 
        className={`border-t dark:border-gray-700 playlist-tracks-container ${
          isExpanded ? 'playlist-tracks-expanded' : 'playlist-tracks-collapsed'
        }`}
      >
        <div className="overflow-y-auto playlist-scroll" style={{ maxHeight: '400px' }}>
          {tracks.map((track, index) => (
            <button
              key={track.id}
              onClick={() => onTrackSelect(track, index)}
              className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 border-b border-gray-100 dark:border-gray-600 last:border-b-0 playlist-track-item transform hover:translate-x-1 ${
                isExpanded && !isAnimating ? 'entering' : isAnimating ? 'leaving' : ''
              }`}
              style={{
                animationDelay: `${index * 0.02}s`,
                display: isExpanded || isAnimating ? 'block' : 'none'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-8 text-center text-sm text-gray-500 dark:text-gray-400 transition-colors">
                  {index + 1}
                </div>
                
                <div className="relative flex-shrink-0 transition-transform hover:scale-110">
                  <img
                    src={track.thumbnail}
                    alt={track.title}
                    className="w-10 h-10 rounded object-cover transition-all"
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
                  <div className="absolute inset-0 w-10 h-10 bg-[#2196F3] dark:bg-blue-600 rounded flex items-center justify-center">
                    <Music className="w-4 h-4 text-white" />
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate text-sm transition-colors">
                    {track.title}
                  </h3>
                  <p className="text-xs text-gray-600 dark:text-gray-400 truncate transition-colors">
                    {track.artist}
                  </p>
                </div>
                
                <div className="text-xs text-gray-500 dark:text-gray-400 flex-shrink-0 transition-colors">
                  {track.duration}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
