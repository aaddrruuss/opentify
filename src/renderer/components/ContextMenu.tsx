import React, { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, ListPlus, X } from 'lucide-react';
import { Track } from '../types/index';

interface ContextMenuProps {
  x: number;
  y: number;
  track: Track;
  isVisible: boolean;
  onClose: () => void;
  onAddToPlaylist: (track: Track, playlistName: string) => void;
  onRemoveFromPlaylist: (track: Track) => void;
  onAddToQueue: (track: Track) => void;
  isInPlaylist?: boolean;
  currentPlaylistName?: string;
}

interface PlaylistSelectorProps {
  onSelect: (playlistName: string) => void;
  onCancel: () => void;
  onCreateNew: (playlistName: string) => void;
}

const PlaylistSelector: React.FC<PlaylistSelectorProps> = ({ onSelect, onCancel, onCreateNew }) => {
  const [playlists, setPlaylists] = useState<string[]>([]);
  const [showCreateNew, setShowCreateNew] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const loadPlaylists = async () => {
      try {
        const playlistNames = await window.playlistAPI.getPlaylists();
        setPlaylists(playlistNames);
      } catch (error) {
        console.error('Error loading playlists:', error);
      }
    };
    loadPlaylists();
  }, []);

  useEffect(() => {
    if (showCreateNew && inputRef.current) {
      inputRef.current.focus();
    }
  }, [showCreateNew]);

  const handleCreateNew = () => {
    if (newPlaylistName.trim()) {
      onCreateNew(newPlaylistName.trim());
      setNewPlaylistName('');
      setShowCreateNew(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCreateNew();
    } else if (e.key === 'Escape') {
      setShowCreateNew(false);
      setNewPlaylistName('');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-2 min-w-48">
      <div className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 border-b dark:border-gray-700">
        Seleccionar playlist
      </div>
      
      <div className="max-h-48 overflow-y-auto">
        {playlists.map((playlist) => (
          <button
            key={playlist}
            onClick={() => onSelect(playlist)}
            className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
          >
            {playlist}
          </button>
        ))}
      </div>

      {showCreateNew ? (
        <div className="px-3 py-2 border-t dark:border-gray-700">
          <div className="flex items-center gap-2">
            <input
              ref={inputRef}
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Nombre de la playlist..."
              className="flex-1 px-2 py-1 text-sm border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={handleCreateNew}
              className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
            >
              <Plus className="w-4 h-4" />
            </button>
            <button
              onClick={() => {
                setShowCreateNew(false);
                setNewPlaylistName('');
              }}
              className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowCreateNew(true)}
          className="w-full text-left px-3 py-2 text-sm text-blue-600 dark:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t dark:border-gray-700"
        >
          <Plus className="w-4 h-4 inline mr-2" />
          Crear nueva playlist
        </button>
      )}

      <button
        onClick={onCancel}
        className="w-full text-left px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border-t dark:border-gray-700"
      >
        Cancelar
      </button>
    </div>
  );
};

export const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  track,
  isVisible,
  onClose,
  onAddToPlaylist,
  onRemoveFromPlaylist,
  onAddToQueue,
  isInPlaylist = false,
  currentPlaylistName
}) => {
  const [showPlaylistSelector, setShowPlaylistSelector] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscapeKey);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isVisible, onClose]);

  const handleAddToPlaylistClick = () => {
    setShowPlaylistSelector(true);
  };

  const handlePlaylistSelect = (playlistName: string) => {
    onAddToPlaylist(track, playlistName);
    setShowPlaylistSelector(false);
    onClose();
  };

  const handleCreateNewPlaylist = async (playlistName: string) => {
    try {
      // Crear la playlist vacía primero
      await window.playlistAPI.savePlaylist(playlistName, []);
      // Luego añadir la canción
      onAddToPlaylist(track, playlistName);
      setShowPlaylistSelector(false);
      onClose();
    } catch (error) {
      console.error('Error creating new playlist:', error);
    }
  };

  const handleRemoveFromPlaylist = () => {
    onRemoveFromPlaylist(track);
    onClose();
  };

  const handleAddToQueue = () => {
    onAddToQueue(track);
    onClose();
  };

  const handlePlaylistSelectorCancel = () => {
    setShowPlaylistSelector(false);
  };

  if (!isVisible) return null;

  // Ajustar posición del menú para que no se salga de la pantalla
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 150);

  return (
    <div
      className="fixed inset-0 z-50"
      style={{ pointerEvents: isVisible ? 'auto' : 'none' }}
    >
      <div
        ref={menuRef}
        className="absolute bg-white dark:bg-gray-800 rounded-lg shadow-lg border dark:border-gray-700 py-2 min-w-48"
        style={{
          left: adjustedX,
          top: adjustedY,
        }}
      >
        {showPlaylistSelector ? (
          <PlaylistSelector
            onSelect={handlePlaylistSelect}
            onCancel={handlePlaylistSelectorCancel}
            onCreateNew={handleCreateNewPlaylist}
          />
        ) : (
          <>
            <button
              onClick={handleAddToPlaylistClick}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Añadir a playlist
            </button>

            {isInPlaylist && (
              <button
                onClick={handleRemoveFromPlaylist}
                className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Eliminar de "{currentPlaylistName}"
              </button>
            )}

            <button
              onClick={handleAddToQueue}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <ListPlus className="w-4 h-4" />
              Añadir a la cola
            </button>
          </>
        )}
      </div>
    </div>
  );
};