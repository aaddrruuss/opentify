import React from 'react';
import { PlayIcon, ClockIcon } from 'lucide-react';
import { Track } from '../types';

interface TrackListProps {
  tracks: Track[];
  onTrackSelect: (track: Track) => void;
}

export function TrackList({ tracks, onTrackSelect }: TrackListProps) {
  const getImageUrl = (track: Track) => {
    console.log("Track data:", track); // Debug log
    
    // Priorizar thumbnail sobre cover
    let imageUrl = track.thumbnail || track.cover;
    
    if (imageUrl) {
      console.log("Using image URL:", imageUrl); // Debug log
      return imageUrl;
    }
    
    // Construir URL de YouTube si tenemos el ID
    if (track.id && track.id !== 'demo1') {
      const youtubeUrl = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
      console.log("Using YouTube URL:", youtubeUrl); // Debug log
      return youtubeUrl;
    }
    
    const fallbackUrl = 'https://via.placeholder.com/120x90/cccccc/666666?text=♪';
    console.log("Using fallback URL:", fallbackUrl); // Debug log
    return fallbackUrl;
  };

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement>, track: Track) => {
    const target = e.target as HTMLImageElement;
    const currentSrc = target.src;
    
    console.log("Image error for:", currentSrc); // Debug log
    
    // Secuencia de fallbacks para YouTube
    if (currentSrc.includes('maxresdefault')) {
      target.src = `https://img.youtube.com/vi/${track.id}/hqdefault.jpg`;
    } else if (currentSrc.includes('hqdefault')) {
      target.src = `https://img.youtube.com/vi/${track.id}/mqdefault.jpg`;
    } else if (currentSrc.includes('mqdefault')) {
      target.src = `https://img.youtube.com/vi/${track.id}/default.jpg`;
    } else {
      // Último fallback
      target.src = 'https://via.placeholder.com/120x90/cccccc/666666?text=♪';
    }
    
    console.log("Fallback to:", target.src); // Debug log
  };

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    console.log("Image loaded successfully:", e.currentTarget.src); // Debug log
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md shadow-sm border dark:border-gray-700">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700 text-sm text-gray-500 dark:text-gray-400">
            <th className="p-4 text-left w-10">#</th>
            <th className="p-4 text-left">Título</th>
            <th className="p-4 text-left hidden md:table-cell">Artista</th>
            <th className="p-4 text-right">
              <ClockIcon className="h-4 w-4 inline" />
            </th>
          </tr>
        </thead>
        <tbody>
          {tracks.map((track, index) => (
            <tr
              key={track.id}
              className="border-b border-gray-200 dark:border-gray-700 hover:bg-[#F5F5F5] dark:hover:bg-gray-700 cursor-pointer group transition-colors"
              onClick={() => onTrackSelect(track)}
            >
              <td className="p-4 text-gray-500 dark:text-gray-400 text-sm">
                <span className="group-hover:hidden">{index + 1}</span>
                <PlayIcon className="h-4 w-4 hidden group-hover:block text-[#2196F3]" />
              </td>
              <td className="p-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 mr-3 flex-shrink-0 bg-gray-100 dark:bg-gray-700 rounded overflow-hidden border dark:border-gray-600">
                    <img
                      src={getImageUrl(track)}
                      alt={track.title}
                      className="w-full h-full object-cover"
                      onError={(e) => handleImageError(e, track)}
                      onLoad={handleImageLoad}
                      loading="lazy"
                      crossOrigin="anonymous"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-gray-900 dark:text-gray-100">{track.title}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate md:hidden">
                      {track.artist}
                    </p>
                  </div>
                </div>
              </td>
              <td className="p-4 text-gray-500 dark:text-gray-400 hidden md:table-cell">
                <span className="truncate block">{track.artist}</span>
              </td>
              <td className="p-4 text-right text-gray-500 dark:text-gray-400 text-sm">
                {track.duration}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}