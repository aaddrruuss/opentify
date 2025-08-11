import React, { memo, useCallback } from 'react';
import { Music, Clock } from 'lucide-react';
import { Track } from '../types/index';

interface TrackListProps {
  tracks: Track[];
  onTrackSelect: (track: Track, fromPlaylist?: Track[], trackIndex?: number) => void;
  compact?: boolean;
}

// Componente individual memoizado para mejor performance
const TrackItem = memo(({ 
  track, 
  index, 
  tracks, 
  onTrackSelect, 
  compact 
}: {
  track: Track;
  index: number;
  tracks: Track[];
  onTrackSelect: (track: Track, fromPlaylist?: Track[], trackIndex?: number) => void;
  compact?: boolean;
}) => {
  const handleClick = useCallback(() => {
    onTrackSelect(track, tracks, index);
  }, [track, tracks, index, onTrackSelect]);

  return (
    <button
      onClick={handleClick}
      className={`w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-100 dark:border-gray-600 last:border-b-0 ${
        compact ? 'py-2' : ''
      }`}
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-shrink-0">
          <img
            src={track.thumbnail}
            alt={track.title}
            className={`${compact ? 'w-10 h-10' : 'w-12 h-12'} rounded object-cover`}
            loading="lazy" // Lazy loading para mejor performance
            onError={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              target.style.display = 'none';
              const musicIcon = target.nextElementSibling as HTMLElement;
              if (musicIcon) {
                musicIcon.style.display = 'flex';
              }
            }}
            onLoad={(e) => {
              const target = e.currentTarget as HTMLImageElement;
              const musicIcon = target.nextElementSibling as HTMLElement;
              if (musicIcon) {
                musicIcon.style.display = 'none';
              }
            }}
          />
          <div className={`absolute inset-0 bg-[#2196F3] dark:bg-blue-600 rounded flex items-center justify-center ${compact ? 'w-10 h-10' : 'w-12 h-12'}`}>
            <Music className={`text-white ${compact ? 'w-4 h-4' : 'w-5 h-5'}`} />
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <h3 className={`font-medium text-gray-900 dark:text-gray-100 truncate ${compact ? 'text-sm' : ''}`}>
            {track.title}
          </h3>
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            <span className={`truncate ${compact ? 'text-xs' : 'text-sm'}`}>
              {track.artist}
            </span>
          </div>
        </div>
        
        <div className="flex items-center gap-1 text-gray-500 dark:text-gray-400 flex-shrink-0">
          <Clock className="w-3 h-3" />
          <span className="text-xs">{track.duration}</span>
        </div>
      </div>
    </button>
  );
});

TrackItem.displayName = 'TrackItem';

export const TrackList = memo(({ tracks, onTrackSelect, compact = false }: TrackListProps) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border dark:border-gray-700 overflow-hidden">
      {tracks.map((track, index) => (
        <TrackItem
          key={track.id} // Usar ID como key para mejor performance
          track={track}
          index={index}
          tracks={tracks}
          onTrackSelect={onTrackSelect}
          compact={compact}
        />
      ))}
    </div>
  );
});

TrackList.displayName = 'TrackList';