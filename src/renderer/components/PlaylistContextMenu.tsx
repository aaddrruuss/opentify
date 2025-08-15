import React, { useEffect, useRef } from 'react';
import { Trash2 } from 'lucide-react';

interface PlaylistContextMenuProps {
  x: number;
  y: number;
  playlistName: string;
  isVisible: boolean;
  onClose: () => void;
  onDeletePlaylist: (playlistName: string) => void;
}

export const PlaylistContextMenu: React.FC<PlaylistContextMenuProps> = ({
  x,
  y,
  playlistName,
  isVisible,
  onClose,
  onDeletePlaylist
}) => {
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

  const handleDeletePlaylist = () => {
    onDeletePlaylist(playlistName);
    onClose();
  };

  if (!isVisible) return null;

  // Ajustar posición del menú para que no se salga de la pantalla
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 100);

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
        <button
          onClick={handleDeletePlaylist}
          className="w-full text-left px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Eliminar playlist "{playlistName}"
        </button>
      </div>
    </div>
  );
};