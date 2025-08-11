import React from 'react';
import { Music } from 'lucide-react';
import { Track } from '../types/index';

interface NowPlayingProps {
  track: Track;
  isPlaying: boolean;
  isDownloading?: boolean;
  playlistInfo?: {
    name: string;
    current: number;
    total: number;
  };
}

export function NowPlaying({ track, isPlaying, isDownloading = false, playlistInfo }: NowPlayingProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 transition-colors">
      <div className="relative flex-shrink-0">
        <img
          src={track.cover}
          alt={track.title}
          className="w-16 h-16 rounded-lg object-cover"
          onError={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            target.style.display = 'none';
            // Mostrar el ícono de Music cuando falla la imagen
            const musicIcon = target.nextElementSibling as HTMLElement;
            if (musicIcon) {
              musicIcon.style.display = 'flex';
            }
          }}
          onLoad={(e) => {
            const target = e.currentTarget as HTMLImageElement;
            // Ocultar el ícono de Music cuando la imagen carga correctamente
            const musicIcon = target.nextElementSibling as HTMLElement;
            if (musicIcon) {
              musicIcon.style.display = 'none';
            }
          }}
        />
        <div className="absolute inset-0 w-16 h-16 bg-[#2196F3] dark:bg-blue-600 rounded-lg flex items-center justify-center">
          <Music className="w-8 h-8 text-white" />
        </div>
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
            {track.title}
          </h3>
          {isDownloading && (
            <div className="flex items-center gap-1 text-xs text-blue-500">
              <div className="animate-spin rounded-full h-3 w-3 border-b border-blue-500"></div>
              <span>Descargando...</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <span className="truncate">{track.artist}</span>
          <span>•</span>
          <span>{track.duration}</span>
          
          {playlistInfo && playlistInfo.total > 1 && (
            <>
              <span>•</span>
              <span className="truncate">
                {playlistInfo.current}/{playlistInfo.total} en "{playlistInfo.name}"
              </span>
            </>
          )}
        </div>
      </div>
      
      {/* Área fija para el indicador de precarga en la parte derecha */}
      <div className="flex-shrink-0 w-40 flex justify-end">
        {/* El contenido se pasará desde App.tsx */}
      </div>
    </div>
  );
}
